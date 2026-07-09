/**
 * PPT Copilot — full view with:
 * - File upload (.pptx)
 * - Slide list with smooth navigation
 * - Voice "go to slide 42" support
 * - Agent activity panel
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../store/SessionStore";

function useThemeColors() {
  const theme = useAppStore(s => s.theme);
  return theme === "dark"
    ? { bg:"#0F0F0F", surface:"#1A1A1A", border:"#2A2A2A", text1:"#F0F0F0", text2:"#AAA", text3:"#666", amber:"#F5A700", amberDark:"#D4900F", amberBg:"rgba(245,167,0,0.12)" }
    : { bg:"#F7F6F3", surface:"#FFFFFF", border:"#E5E2DA", text1:"#1A1A1A", text2:"#555", text3:"#888", amber:"#F5A700", amberDark:"#7C5E00", amberBg:"#FFF8E7" };
}

interface SlideShape { text:string; color:string; size:number; bold:boolean; left?:number; top?:number; width?:number; align?:string; }
interface Slide { index:number; title:string; notes:string; bg_color?:string; shapes?:SlideShape[]; image_url?:string; kind?:string|null; }

function looksDecorativeTitle(text = "", width = 90): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/\b(?:https?:\/\/|www\.|[\w.-]+\.(?:com|org|net|io|ai|co|in))\b/i.test(trimmed)) return true;
  if (/^\d{1,2}(?:\s*\/\s*\d{1,2})?$/.test(trimmed)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(trimmed)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(trimmed)) return true; // "July 2026" — month name + year, no day
  return width < 8;
}

function inferSlideTitle(slide?: Slide, fallback = "Slide"): string {
  if (!slide) return fallback;
  // Slides from the GD template have their title resolved server-side by
  // the exact shape the generator wrote it into (see api/ppt.py's
  // _extract_sync) — trust it outright rather than re-guessing locally,
  // since the local heuristic below only has the (deliberately truncated)
  // shapes list to work from and can't be as precise.
  if (slide.kind && slide.title) return slide.title;
  if (!looksDecorativeTitle(slide.title)) return slide.title;
  const candidates = (slide.shapes || [])
    .filter(sh => !looksDecorativeTitle(sh.text, sh.width ?? 90) && !/^\d+\.\s{1,3}/.test(sh.text.trim()))
    .map(sh => ({
      text: sh.text.trim().split("\n")[0],
      score: (sh.size || 0) + (sh.bold ? 12 : 0) + ((sh.top ?? 50) < 75 ? 8 : 0) + (sh.text.length <= 55 ? 6 : 0),
    }))
    .filter(c => c.text);
  return candidates.length ? candidates.sort((a, b) => b.score - a.score)[0].text : fallback;
}

// ── Kind-aware edit form ──────────────────────────────────────────────────
// Slides generated from the GD template (team, table, comparison, ...) have
// a declarative field schema (see KIND_FIELD_SCHEMA in
// services/ppt_template_builder.py) instead of the old flat title/bullets
// model. Rather than one bespoke form layout per kind, this renders any
// schema generically from ~6 field types, composed recursively — a new kind
// added on the backend needs zero frontend changes.
interface KindField {
  key: string; type: string; label?: string;
  fields?: KindField[]; item_fields?: KindField[];
  max_length?: number; fixed_length?: number; max_cols?: number; textarea?: boolean;
}

function kindInputStyle(C: any) {
  return { width:"100%", boxSizing:"border-box" as const, padding:"0.5rem 0.65rem", borderRadius:6,
           border:`1.5px solid ${C.border}`, background:C.bg, color:C.text1, fontSize:"0.82rem",
           outline:"none", fontFamily:"inherit" };
}
function kindAddBtnStyle(C: any) {
  return { fontSize:"0.76rem", color:C.amber, background:"none", border:"none", cursor:"pointer", padding:"0.3rem 0" };
}
function kindRemoveBtnStyle(C: any) {
  return { width:22, height:22, borderRadius:"50%", border:"none", background:"rgba(239,68,68,0.15)",
           color:"#EF4444", cursor:"pointer", fontSize:"0.7rem", flexShrink:0,
           display:"flex", alignItems:"center", justifyContent:"center" };
}

function blankKindValue(field: KindField): any {
  if (field.type === "list_of_strings") return [];
  if (field.type === "list_of_objects") return [];
  if (field.type === "object") {
    const o: any = {};
    (field.fields || []).forEach(f => { o[f.key] = blankKindValue(f); });
    return o;
  }
  return "";
}

function KindFieldEditor({ field, value, onChange, C }: { field: KindField; value: any; onChange: (v: any) => void; C: any }) {
  const inputStyle = kindInputStyle(C);

  if (field.type === "text") {
    return <input value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={field.label} style={{ ...inputStyle, marginBottom:"0.9rem" }} />;
  }

  if (field.type === "textarea") {
    return <textarea value={value ?? ""} rows={3} onChange={e => onChange(e.target.value)}
      placeholder={field.label} style={{ ...inputStyle, resize:"vertical", marginBottom:"0.9rem" }} />;
  }

  if (field.type === "object") {
    const obj = value || {};
    return (
      <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"0.7rem", marginBottom:"0.9rem" }}>
        {(field.fields || []).map(sub => (
          <div key={sub.key} style={{ marginBottom:"0.3rem" }}>
            <label style={{ fontSize:"0.7rem", color:C.text3, display:"block", marginBottom:"0.2rem" }}>{sub.label}</label>
            <KindFieldEditor field={sub} value={obj[sub.key]} onChange={v => onChange({ ...obj, [sub.key]: v })} C={C} />
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "list_of_strings") {
    const items: string[] = value || [];
    const canRemove = !field.fixed_length;
    const canAdd = !field.fixed_length && (!field.max_length || items.length < field.max_length);
    return (
      <div style={{ marginBottom:"0.9rem" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display:"flex", gap:"0.4rem", marginBottom:"0.4rem", alignItems:"flex-start" }}>
            {field.textarea ? (
              <textarea value={item} rows={2}
                onChange={e => { const next = [...items]; next[i] = e.target.value; onChange(next); }}
                style={{ ...inputStyle, resize:"vertical" }} />
            ) : (
              <input value={item}
                onChange={e => { const next = [...items]; next[i] = e.target.value; onChange(next); }}
                style={inputStyle} />
            )}
            {canRemove && (
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ ...kindRemoveBtnStyle(C), marginTop:2 }}>✕</button>
            )}
          </div>
        ))}
        {canAdd && <button onClick={() => onChange([...items, ""])} style={kindAddBtnStyle(C)}>+ Add {field.label || "item"}</button>}
      </div>
    );
  }

  if (field.type === "list_of_objects") {
    const items: any[] = value || [];
    const canRemove = !field.fixed_length;
    const canAdd = !field.fixed_length && (!field.max_length || items.length < field.max_length);
    return (
      <div style={{ marginBottom:"0.9rem" }}>
        {items.map((item, i) => (
          <div key={i} style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"0.6rem",
                                marginBottom:"0.5rem", position:"relative" }}>
            {canRemove && (
              <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                style={{ ...kindRemoveBtnStyle(C), position:"absolute", top:6, right:6 }}>✕</button>
            )}
            {(field.item_fields || []).map(sub => (
              <div key={sub.key} style={{ marginBottom:"0.35rem", paddingRight: canRemove ? "1.8rem" : 0 }}>
                <label style={{ fontSize:"0.68rem", color:C.text3, display:"block", marginBottom:"0.15rem" }}>{sub.label}</label>
                <KindFieldEditor field={sub} value={item[sub.key]}
                  onChange={v => { const next = [...items]; next[i] = { ...item, [sub.key]: v }; onChange(next); }} C={C} />
              </div>
            ))}
          </div>
        ))}
        {canAdd && (
          <button onClick={() => {
            const blank: any = {};
            (field.item_fields || []).forEach(f => { blank[f.key] = blankKindValue(f); });
            onChange([...items, blank]);
          }} style={kindAddBtnStyle(C)}>+ Add {field.label || "item"}</button>
        )}
      </div>
    );
  }

  if (field.type === "table_grid") {
    const table = value || { headers: [], rows: [] };
    const headers: string[] = table.headers || [];
    const rows: string[][] = table.rows || [];
    const nCols = field.max_cols || headers.length;
    const setHeader = (c: number, v: string) => { const h = [...headers]; h[c] = v; onChange({ ...table, headers: h }); };
    const setCell = (r: number, c: number, v: string) => {
      const rr = rows.map(row => [...row]); rr[r][c] = v; onChange({ ...table, rows: rr });
    };
    return (
      <div style={{ marginBottom:"0.9rem", overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
          <thead>
            <tr>
              {headers.map((h, c) => (
                <th key={c} style={{ padding:"0.2rem" }}>
                  <input value={h} onChange={e => setHeader(c, e.target.value)}
                    style={{ ...inputStyle, padding:"0.3rem 0.4rem", fontWeight:700 }} />
                </th>
              ))}
              <th style={{ width:26 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ padding:"0.2rem" }}>
                    <input value={cell} onChange={e => setCell(r, c, e.target.value)}
                      style={{ ...inputStyle, padding:"0.3rem 0.4rem" }} />
                  </td>
                ))}
                <td>
                  <button onClick={() => onChange({ ...table, rows: rows.filter((_, i) => i !== r) })}
                    style={kindRemoveBtnStyle(C)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => onChange({ ...table, rows: [...rows, Array(nCols).fill("")] })}
          style={kindAddBtnStyle(C)}>+ Add Row</button>
      </div>
    );
  }

  return null;
}

// Stable per-tab id for uploads made before a live voice session exists —
// avoids every such upload colliding into one shared "default" backend slot.
function getAnonPptSid(): string {
  let s = sessionStorage.getItem("pilot_ppt_anon_sid");
  if (!s) {
    s = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("pilot_ppt_anon_sid", s);
  }
  return s;
}

export function PPTCopilotView({ sessionId, isListening, agentStatus }:
  { sessionId:string|null; isListening:boolean; agentStatus:string; onToggleMic:()=>void }) {
  const store  = useAppStore();
  const C      = useThemeColors();
  const token  = store.token;
  // Restore from store so slides survive tab switches
  const [slides,     setSlides]     = useState<Slide[]>((store.pptSlides as Slide[]) || []);
  const [current,    setCurrent]    = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [fileName,   setFileName]   = useState(store.pptFileName || "");
  const [agentLog,   setAgentLog]   = useState<string[]>([]);
  const [thumbStart, setThumbStart] = useState(0);
  const THUMB_COUNT = 6;
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep thumbnail window centred on the active slide
  useEffect(() => {
    if (current < thumbStart) setThumbStart(current);
    else if (current >= thumbStart + THUMB_COUNT) setThumbStart(current - THUMB_COUNT + 1);
  }, [current]);

  // Keyboard navigation — left/right arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setCurrent(c => Math.min(c + 1, Math.max(slides.length - 1, 0)));
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setCurrent(c => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  // Show "Access Denied" modal when policy blocks ppt_delete_slide for non-admins
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.tool === "ppt_delete_slide") setDeleteModal("denied");
    };
    window.addEventListener("tool_blocked" as any, handler);
    return () => window.removeEventListener("tool_blocked" as any, handler);
  }, []);

  async function uploadFile(file: File) {
    if (!file.name.endsWith(".pptx")) { alert("Please upload a .pptx file"); return; }
    setUploading(true);
    const name = file.name;
    setFileName(name);
    store.setPptFileName(name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const sid = sessionId || getAnonPptSid();
      const res = await fetch(`/api/v1/ppt/upload?session_id=${sid}`, {
        method:"POST", headers:{Authorization:`Bearer ${token}`}, body:fd
      }).then(r=>r.json());
      const sl: Slide[] = res.slides || [];
      setSlides(sl);
      store.setPptSlides(sl);
      setCurrent(0);
      setAgentLog(l => [...l, `✓ Loaded ${sl.length} slides from ${name}`]);
    } catch(e) {
      setAgentLog(l => [...l, "✗ Upload failed"]);
    } finally { setUploading(false); }
  }

  function removePresentation() {
    setSlides([]);
    setFileName("");
    setAgentLog([]);
    store.setPptSlides([]);
    store.setPptFileName("");
  }

  // Delete slide — admin only (Level 3 access)
  const [deleteModal,   setDeleteModal]   = useState<"hidden"|"denied"|"confirm">("hidden");

  // ── History state ──────────────────────────────────────────────────────────
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [historyList,   setHistoryList]   = useState<any[]>([]);
  const [historyLoading,setHistoryLoading]= useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/v1/ppt/history", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      setHistoryList(res.history || []);
    } catch { setHistoryList([]); }
    setHistoryLoading(false);
  }

  async function loadFromHistory(sid: string) {
    setHistoryOpen(false);
    setUploading(true);
    try {
      const res = await fetch(`/api/v1/ppt/history/load/${sid}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
      const sl: Slide[] = res.slides || [];
      setSlides(sl);
      store.setPptSlides(sl);
      store.setPptFileName(res.title);
      setFileName(res.title);
      setCurrent(0);
      setGeneratedSid(sid);
      setAgentLog(l => [...l, `✓ Loaded "${res.title}" from history`]);
    } catch(e: any) {
      setAgentLog(l => [...l, `✗ Failed to load: ${e.message}`]);
    }
    setUploading(false);
  }

  // ── Create PPT state ────────────────────────────────────────────────────────
  const [createModal,   setCreateModal]   = useState(false);
  const [genDesc,       setGenDesc]       = useState("");
  const [genCount,      setGenCount]      = useState(10);
  const [generating,    setGenerating]    = useState(false);
  const [genProgress,   setGenProgress]   = useState("");
  const [generatedSid,  setGeneratedSid]  = useState<string|null>(null); // has downloadable file
  const [micListening,  setMicListening]  = useState(false);
  const recognitionRef  = useRef<any>(null);

  // ── Add slide state ─────────────────────────────────────────────────────
  const [addSlideModal, setAddSlideModal] = useState(false);
  const [addSlideDesc,  setAddSlideDesc]  = useState("");
  const [addingSlide,   setAddingSlide]   = useState(false);
  const [addSlideError, setAddSlideError] = useState("");

  // ── Edit slide state ──────────────────────────────────────────────────
  const [editOpen,      setEditOpen]      = useState(false);
  const [savingEdit,    setSavingEdit]    = useState(false);
  const [editDraft,     setEditDraft]     = useState<{
    title: string;
    bullets: string[];
  }>({ title: "", bullets: [] });
  const [notesDraft,    setNotesDraft]    = useState("");
  // Present only for slides generated from the GD template (a known "kind");
  // absent (null) for uploaded/legacy slides, which use editDraft above
  // exactly as before this feature existed.
  const [kindSchema,    setKindSchema]    = useState<{ kind:string; fields:KindField[] } | null>(null);
  const [kindDraft,     setKindDraft]     = useState<any>(null);

  // Listen for ppt_command events (navigation + voice-triggered delete + refresh)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { action, index, session_id } = e.detail;
      if (action === "goto" && index !== undefined) {
        setCurrent(Math.max(0, Math.min(index, Math.max(slides.length-1, 0))));
        setAgentLog(l => [...l.slice(-9), `Navigated to slide ${index+1}`]);
      } else if (action === "next")   setCurrent(c => Math.min(c+1, Math.max(slides.length-1, 0)));
      else if (action === "prev")     setCurrent(c => Math.max(c-1, 0));
      else if (action === "first")    setCurrent(0);
      else if (action === "last")     setCurrent(Math.max(slides.length-1, 0));
      else if (action === "delete")   setDeleteModal("confirm");
      else if (action === "refresh") {
        const sid = session_id || generatedSid || sessionId || getAnonPptSid();
        fetch(`/api/v1/ppt/slides/${sid}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(res => {
            if (res.slides) {
              setSlides(res.slides);
              store.setPptSlides(res.slides);
            }
            setAgentLog(l => [...l.slice(-9), "Slide updated by agent."]);
          }).catch(console.error);
      }
    };
    window.addEventListener("ppt_command" as any, handler);
    return () => window.removeEventListener("ppt_command" as any, handler);
  }, [slides.length, generatedSid, sessionId, token]);

  async function openEditModal() {
    const slide = slides[current];
    if (!slide) return;
    setNotesDraft(slide.notes || "");
    const sid = sessionId || getAnonPptSid();

    // Slides generated from the GD template carry a known "kind" — fetch
    // its field schema + current values and render the generic kind-aware
    // form. Uploaded/legacy slides (or a failed lookup) fall through to
    // the original title/bullets form, unchanged.
    try {
      const res = await fetch(`/api/v1/ppt/slide/${sid}/${current}/schema`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.kind) {
        setKindSchema({ kind: res.kind, fields: res.fields || [] });
        setKindDraft(res.data || {});
        setEditOpen(true);
        return;
      }
    } catch { /* fall through to the generic form below */ }

    setKindSchema(null);
    // Parse bullets from shapes: lines starting with "1.  ", "2.  " etc.
    const rawBullets: string[] = [];
    (slide.shapes || []).forEach(sh => {
      sh.text.split("\n").forEach(line => {
        const m = line.match(/^\d+\.\s{1,3}(.+)/);
        if (m) rawBullets.push(m[1].trim());
      });
    });
    setEditDraft({
      title:   inferSlideTitle(slide, `Slide ${current + 1}`),
      bullets: rawBullets.length > 0 ? rawBullets : [""],
    });
    setEditOpen(true);
  }

  async function saveEditSlide() {
    const sid = sessionId || getAnonPptSid();
    setSavingEdit(true);
    try {
      const url = kindSchema ? "/api/v1/ppt/slide/kind" : "/api/v1/ppt/slide";
      const body = kindSchema
        ? { session_id: sid, slide_index: current, kind: kindSchema.kind, data: kindDraft, notes: notesDraft }
        : { session_id: sid, slide_index: current, title: editDraft.title,
            bullets: editDraft.bullets.filter(b => b.trim() !== ""), notes: notesDraft };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
      const sl: Slide[] = res.slides || [];
      setSlides(sl);
      store.setPptSlides(sl);
      setEditOpen(false);
      setAgentLog(l => [...l, `✓ Saved edits to slide ${current + 1}`]);
    } catch (e: any) {
      setAgentLog(l => [...l, `✗ Edit save failed: ${e.message}`]);
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeleteSlide() {
    if (slides.length === 0) return;
    const role = (store.user?.role || "").toLowerCase();
    if (role !== "admin") {
      setDeleteModal("denied");
      return;
    }
    setDeleteModal("confirm");
  }

  function confirmDeleteSlide() {
    const updated = slides.filter((_,i) => i !== current);
    // Re-index
    const reindexed = updated.map((s,i) => ({ ...s, index: i }));
    setSlides(reindexed);
    store.setPptSlides(reindexed);
    setCurrent(c => Math.min(c, Math.max(reindexed.length - 1, 0)));
    setAgentLog(l => [...l, `✓ Deleted slide ${current + 1}`]);
    setDeleteModal("hidden");
  }

  // ── Voice input for description field ─────────────────────────────────────
  const toggleMicInput = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser. Use Chrome."); return; }
    if (micListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setMicListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const heard = e.results[0][0].transcript;
      setGenDesc(prev => prev ? prev + " " + heard : heard);
      setMicListening(false);
    };
    rec.onerror = () => setMicListening(false);
    rec.onend   = () => setMicListening(false);
    recognitionRef.current = rec;
    rec.start();
    setMicListening(true);
  }, [micListening]);

  // ── PPT generation ─────────────────────────────────────────────────────────
  const generatePPT = useCallback(async () => {
    if (!genDesc.trim()) return;
    setGenerating(true);
    setGenProgress(`Generating ${genCount} slides with AI…`);
    const sid = sessionId || getAnonPptSid();
    try {
      const est = Math.round(genCount * 0.6);
      setGenProgress(`Asking Ollama to write ${genCount} slides… (~${est}s)`);
      const res = await fetch("/api/v1/ppt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sid, description: genDesc.trim(), slide_count: genCount }),
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });

      const sl: Slide[] = res.slides || [];
      setSlides(sl);
      store.setPptSlides(sl);
      store.setPptFileName(res.title || "Generated Presentation");
      setFileName(res.title || "Generated Presentation");
      setCurrent(0);
      setGeneratedSid(sid);
      setCreateModal(false);
      setAgentLog(l => [...l, `✓ Created "${res.title}" — ${sl.length} slides`]);
    } catch (e: any) {
      setGenProgress(`Failed: ${e.message}`);
      setTimeout(() => { setGenerating(false); setGenProgress(""); }, 3000);
      return;
    }
    setGenerating(false);
    setGenProgress("");
    setGenDesc("");
  }, [genDesc, genCount, sessionId, token]);

  // ── Add slide to the loaded presentation ────────────────────────────────
  const addSlide = useCallback(async () => {
    const sid = generatedSid || sessionId || getAnonPptSid();
    setAddingSlide(true);
    setAddSlideError("");
    try {
      const res = await fetch("/api/v1/ppt/slide/add-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sid, instruction: addSlideDesc.trim(), insert_after: current }),
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });

      const sl: Slide[] = res.slides || [];
      setSlides(sl);
      store.setPptSlides(sl);
      setCurrent(Math.min(current + 1, Math.max(sl.length - 1, 0)));
      setAddSlideModal(false);
      setAddSlideDesc("");
      setAgentLog(l => [...l.slice(-9), `✓ Added slide — ${res.title || "New Slide"}`]);
    } catch (e: any) {
      setAddSlideError(`Failed: ${e.message}`);
    }
    setAddingSlide(false);
  }, [addSlideDesc, current, generatedSid, sessionId, token]);

  const slideTitle = inferSlideTitle(slides[current], `Slide ${current+1}`);
  const slideNotes = slides[current]?.notes || "";

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"0.75rem 1.5rem",
                    background:C.surface, borderBottom:`1.5px solid ${C.border}` }}>
        <div style={{ flex:1 }}>
          <h2 style={{ fontWeight:700, fontSize:"0.95rem", color:C.text1 }}>
            {fileName || "PPT Copilot"}
          </h2>
          <p style={{ fontSize:"0.72rem", color:C.text3 }}>
            {slides.length > 0 ? `${slides.length} slides · Slide ${current+1}: ${slideTitle}` : "Upload a .pptx file to begin"}
          </p>
        </div>

        {/* upload button */}
        <button onClick={() => fileRef.current?.click()}
          style={{ padding:"0.45rem 1rem", borderRadius:8, background:C.amberBg,
                   border:`1.5px solid ${C.amber}`, color:C.amberDark,
                   fontWeight:600, fontSize:"0.8rem", cursor:"pointer" }}>
          {uploading ? "Uploading…" : "📁 Upload .pptx"}
        </button>
        <input ref={fileRef} type="file" accept=".pptx" style={{ display:"none" }}
          onChange={e => { const f=e.target.files?.[0]; if(f) uploadFile(f); }}/>

        {/* Create PPT button — same amber style as Upload */}
        <button onClick={() => { setCreateModal(true); setGenProgress(""); }}
          style={{ padding:"0.45rem 1rem", borderRadius:8, background:C.amberBg,
                   border:`1.5px solid ${C.amber}`, color:C.amberDark,
                   fontWeight:600, fontSize:"0.8rem", cursor:"pointer" }}>
          Create PPT
        </button>

        {/* Add Slide button — only meaningful once a deck is loaded */}
        {slides.length > 0 && (
          <button onClick={() => { setAddSlideModal(true); setAddSlideError(""); }}
            style={{ padding:"0.45rem 1rem", borderRadius:8, background:C.amberBg,
                     border:`1.5px solid ${C.amber}`, color:C.amberDark,
                     fontWeight:600, fontSize:"0.8rem", cursor:"pointer" }}>
            + Add Slide
          </button>
        )}

        {/* History button */}
        <div style={{ position:"relative" }}>
          <button onClick={() => historyOpen ? setHistoryOpen(false) : openHistory()}
            style={{ padding:"0.45rem 1rem", borderRadius:8, background:C.amberBg,
                     border:`1.5px solid ${C.amber}`, color:C.amberDark,
                     fontWeight:600, fontSize:"0.8rem", cursor:"pointer" }}>
            History
          </button>

          {historyOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:100,
                          width:340, maxHeight:420, overflowY:"auto",
                          background:C.surface, border:`1.5px solid ${C.border}`,
                          borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.35)",
                          padding:"0.6rem" }}>
              <div style={{ fontSize:"0.72rem", fontWeight:700, color:C.text3,
                            letterSpacing:"0.06em", padding:"0.25rem 0.4rem 0.5rem" }}>
                GENERATED PRESENTATIONS
              </div>
              {historyLoading && (
                <div style={{ padding:"1rem", textAlign:"center", color:C.text3, fontSize:"0.8rem" }}>
                  Loading…
                </div>
              )}
              {!historyLoading && historyList.length === 0 && (
                <div style={{ padding:"1rem", textAlign:"center", color:C.text3, fontSize:"0.8rem" }}>
                  No presentations generated yet.
                </div>
              )}
              {!historyLoading && historyList.map((entry, i) => (
                <div key={i} onClick={() => loadFromHistory(entry.session_id)}
                  style={{ padding:"0.6rem 0.7rem", borderRadius:8, cursor:"pointer",
                           border:`1px solid ${C.border}`, marginBottom:"0.4rem",
                           background:"transparent", transition:"background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.amberBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ fontSize:"0.8rem", fontWeight:600, color:C.text1,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {entry.title}
                  </div>
                  <div style={{ fontSize:"0.68rem", color:C.text3, marginTop:"0.2rem", display:"flex", gap:"0.75rem" }}>
                    <span>{entry.slide_count} slides</span>
                    <span>{new Date(entry.created_at).toLocaleDateString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>
                  </div>
                  {entry.description && (
                    <div style={{ fontSize:"0.66rem", color:C.text3, marginTop:"0.15rem",
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {entry.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export PDF / Download PPTX buttons — visible whenever slides are loaded */}
        {slides.length > 0 && (() => {
          const sid = generatedSid || sessionId || getAnonPptSid();
          return (
            <>
              <a href={`/api/v1/ppt/export-pdf/${sid}`}
                download
                style={{ padding:"0.45rem 1rem", borderRadius:8, textDecoration:"none",
                         background:"rgba(34,197,94,0.1)", border:"1.5px solid rgba(34,197,94,0.4)",
                         color:"#22C55E", fontWeight:600, fontSize:"0.8rem", cursor:"pointer",
                         display:"flex", alignItems:"center", gap:"0.3rem" }}>
                ⬇ Export PDF
              </a>
              <a href={`/api/v1/ppt/download/${sid}`}
                download
                style={{ padding:"0.45rem 1rem", borderRadius:8, textDecoration:"none",
                         background:C.amberBg, border:`1.5px solid ${C.amber}`,
                         color:C.amberDark, fontWeight:600, fontSize:"0.8rem", cursor:"pointer",
                         display:"flex", alignItems:"center", gap:"0.3rem" }}>
                ⬇ Download PPTX
              </a>
            </>
          );
        })()}

        {/* Remove button — only shown when slides are loaded */}
        {slides.length > 0 && (
          <button onClick={removePresentation}
            style={{ padding:"0.45rem 0.85rem", borderRadius:8,
                     background:"rgba(239,68,68,0.08)", border:"1.5px solid rgba(239,68,68,0.3)",
                     color:"#EF4444", fontWeight:600, fontSize:"0.8rem", cursor:"pointer" }}>
            ✕ Remove
          </button>
        )}

        {/* listening badge */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                      padding:"0.35rem 0.85rem", background:C.surface,
                      borderRadius:20, border:`1.5px solid ${C.border}`,
                      fontSize:"0.78rem", fontWeight:700, color:C.text1 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:"2px" }}>
            {[6,12,8,16,10,14,8].map((h,i)=>(
              <div key={i} style={{ width:3, height:isListening ? h : 3,
                                    background:C.amber, borderRadius:1,
                                    transition:"height 0.15s",
                                    transitionDelay:`${i*0.04}s` }}/>
            ))}
          </div>
          {isListening ? "LISTENING" : "OFFLINE"}
        </div>
      </div>

      {/* paddingBottom reserves clearance for the fixed LiveTranscriptBar (~4.35rem tall)
          overlaid by the parent PPTPageView, matching MainDashboard's 6rem convention. */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", boxSizing:"border-box", paddingBottom:"6rem" }}>
        {/* Main slide area */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
          {/* Slide canvas */}
          <div style={{ flex:1, background:C.bg, display:"flex",
                        alignItems:"center", justifyContent:"center",
                        position:"relative", overflow:"hidden", minHeight:0 }}>
            {slides.length === 0 ? (
              /* Drop zone */
              <div onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)uploadFile(f);}}
                onClick={() => fileRef.current?.click()}
                style={{ display:"flex", flexDirection:"column", alignItems:"center",
                         gap:"1rem", cursor:"pointer", userSelect:"none" }}>
                <div style={{ width:80, height:80, borderRadius:16,
                              background:C.amberBg, border:`2px dashed ${C.amber}`,
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2rem" }}>📊</div>
                <p style={{ color:C.text2, fontSize:"0.9rem", textAlign:"center" }}>
                  Drop a .pptx file here<br/>
                  <span style={{ fontSize:"0.75rem", color:C.text3 }}>or click to browse</span>
                </p>
              </div>
            ) : (
              /* Slide canvas — shows converted PNG image (exact copy of original) */
              <div style={{ width:"90%", maxWidth:720, aspectRatio:"16/9",
                            background:C.surface, borderRadius:6,
                            border:`1.5px solid ${C.border}`,
                            boxShadow:"0 8px 36px rgba(0,0,0,0.14)",
                            position:"relative", overflow:"hidden", flexShrink:0 }}>
                {/* Slide counter */}
                <div style={{ position:"absolute", top:8, right:8, zIndex:10,
                              padding:"0.15rem 0.5rem", borderRadius:4,
                              background:"rgba(0,0,0,0.5)",
                              fontSize:"0.58rem", color:"#F5A700", fontWeight:700,
                              letterSpacing:"0.08em" }}>
                  {current+1} / {slides.length}
                </div>

                {slides[current]?.image_url ? (
                  /* ── Faithful image from LibreOffice conversion ── */
                  <img
                    key={slides[current].image_url}
                    src={slides[current].image_url}
                    alt={slideTitle}
                    style={{ width:"100%", height:"100%",
                             objectFit:"contain", display:"block" }}
                  />
                ) : (
                  /* ── Text fallback (LibreOffice not installed) ── */
                  <div style={{ position:"absolute", inset:0,
                                background: slides[current]?.bg_color || C.surface,
                                display:"flex", flexDirection:"column",
                                alignItems:"center", justifyContent:"center",
                                padding:"2rem", gap:"0.5rem" }}>
                    {slides[current]?.shapes && slides[current].shapes!.length > 0
                      ? slides[current].shapes!.map((shape, idx) => (
                          <div key={idx} style={{
                            position:   "absolute",
                            left:       `${shape.left ?? 5}%`,
                            top:        `${shape.top  ?? 10}%`,
                            width:      `${Math.min(shape.width ?? 90, 96)}%`,
                            color:      shape.color || "#fff",
                            fontSize:   `${Math.max(shape.size * 0.75, 8)}px`,
                            fontWeight: shape.bold ? 700 : 400,
                            textAlign:  (shape.align || "left") as "left"|"right"|"center",
                            lineHeight: 1.3, wordBreak:"break-word",
                            whiteSpace: "pre-wrap", overflow:"hidden",
                          }}>
                            {shape.text}
                          </div>
                        ))
                      : (
                        <>
                          <h2 style={{ fontSize:"1.5rem", fontWeight:800, color:"#fff",
                                       textAlign:"center", margin:0 }}>{slideTitle}</h2>
                          {slideNotes && (
                            <p style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.55)",
                                        textAlign:"center", lineHeight:1.6,
                                        maxWidth:460, margin:0 }}>
                              {slideNotes.substring(0, 200)}
                            </p>
                          )}
                        </>
                      )
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thumbnail slider — shows THUMB_COUNT at a time */}
          {slides.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:"0.35rem",
                          padding:"0.5rem 0.75rem", background:C.surface,
                          borderTop:`1.5px solid ${C.border}`, height:72, flexShrink:0 }}>
              {/* Prev arrow */}
              <button onClick={() => setThumbStart(t => Math.max(0, t - 1))}
                disabled={thumbStart === 0}
                style={{ flexShrink:0, width:26, height:40, borderRadius:5,
                         border:`1px solid ${C.border}`, background:C.bg,
                         color: thumbStart === 0 ? C.text3 : C.text2,
                         cursor: thumbStart === 0 ? "default" : "pointer",
                         fontSize:"0.75rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                ‹
              </button>

              {/* Visible thumbnails */}
              <div style={{ flex:1, display:"flex", gap:"0.35rem", overflow:"hidden" }}>
                {slides.slice(thumbStart, thumbStart + THUMB_COUNT).map((s, rel) => {
                  const i = thumbStart + rel;
                  return (
                    <div key={i} onClick={() => {
                      setCurrent(i);
                      fetch(`/api/v1/ppt/jump`, {
                        method:"POST",
                        headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
                        body: JSON.stringify({session_id: sessionId||getAnonPptSid(), query: `slide ${i+1}`})
                      }).catch(()=>{});
                    }}
                      style={{ flex:1, minWidth:0, height:52, borderRadius:5,
                               background: i===current ? C.amberBg : C.bg,
                               border:`2px solid ${i===current ? C.amber : C.border}`,
                               cursor:"pointer", overflow:"hidden", flexShrink:0,
                               transition:"all 0.18s", position:"relative" }}>
                      {s.image_url ? (
                        <img src={s.image_url} alt={s.title}
                             style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                      ) : (
                        <div style={{ padding:"0.28rem 0.4rem" }}>
                          <div style={{ fontSize:"0.52rem", color:i===current?C.amberDark:"rgba(255,255,255,0.45)", fontWeight:700 }}>
                            {i+1}
                          </div>
                          <div style={{ fontSize:"0.58rem", color:i===current?C.amberDark:"rgba(255,255,255,0.65)",
                                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {s.title}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Next arrow */}
              <button onClick={() => setThumbStart(t => Math.min(slides.length - THUMB_COUNT, t + 1))}
                disabled={thumbStart + THUMB_COUNT >= slides.length}
                style={{ flexShrink:0, width:26, height:40, borderRadius:5,
                         border:`1px solid ${C.border}`, background:C.bg,
                         color: thumbStart + THUMB_COUNT >= slides.length ? C.text3 : C.text2,
                         cursor: thumbStart + THUMB_COUNT >= slides.length ? "default" : "pointer",
                         fontSize:"0.75rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                ›
              </button>

              {/* Slide counter */}
              <div style={{ flexShrink:0, fontSize:"0.65rem", color:"#555",
                            fontWeight:600, minWidth:36, textAlign:"right" }}>
                {current+1}/{slides.length}
              </div>
            </div>
          )}

          {/* Nav controls + mic */}
          <div style={{ display:"flex", gap:"0.5rem", padding:"0.65rem 1rem",
                        background:C.surface, borderTop:`1.5px solid ${C.border}`,
                        alignItems:"center" }}>
            {["first","prev","next","last"].map(d=>(
              <button key={d} onClick={()=>{
                const actions: Record<string,()=>void> = {
                  first:()=>setCurrent(0), last:()=>setCurrent(Math.max(slides.length-1,0)),
                  prev:()=>setCurrent(c=>Math.max(c-1,0)), next:()=>setCurrent(c=>Math.min(c+1,Math.max(slides.length-1,0)))
                };
                actions[d]?.();
                fetch(`/api/v1/ppt/navigate`,{
                  method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
                  body:JSON.stringify({session_id:sessionId||getAnonPptSid(),direction:d})
                }).catch(()=>{});
              }}
                style={{ padding:"0.4rem 0.85rem", borderRadius:6,
                         border:`1.5px solid ${C.border}`, background:"transparent",
                         color:C.text2, cursor:"pointer", fontSize:"0.78rem" }}>
                {d}
              </button>
            ))}
            <div style={{ flex:1 }}/>
            {/* Edit slide button */}
            {slides.length > 0 && (
              <button onClick={openEditModal}
                style={{ padding:"0.4rem 0.85rem", borderRadius:6,
                         background:C.amberBg, border:`1.5px solid ${C.amber}`,
                         color:C.amberDark, cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>
                ✏️ Edit Slide
              </button>
            )}
            {/* Delete slide — admin only */}
            {slides.length > 0 && (
              <button onClick={handleDeleteSlide}
                style={{ padding:"0.4rem 0.85rem", borderRadius:6,
                         background:"rgba(239,68,68,0.08)", border:"1.5px solid rgba(239,68,68,0.25)",
                         color:"#EF4444", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>
                🗑 Delete Slide
              </button>
            )}
            <span style={{ fontSize:"0.7rem", color:C.text3 }}>Say "Go to slide 42"</span>
          </div>

          {/* ── Speaker Notes ── moved below the slide viewer: this is the natural
              reading position for notes (directly under what they annotate),
              and gives the text far more horizontal room than the 290px sidebar
              could — long notes no longer wrap into a tall, narrow column. ── */}
          {slides.length > 0 && (
            <div style={{ padding:"0.75rem 1rem", background:C.surface,
                          borderTop:`1.5px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                            marginBottom:"0.4rem" }}>
                <div style={{ fontWeight:700, fontSize:"0.75rem", color:C.amber,
                              letterSpacing:"0.06em" }}>SPEAKER NOTES</div>
                <button onClick={openEditModal}
                  title="Edit slide notes"
                  style={{ fontSize:"0.68rem", color:C.text3, background:"none", border:"none",
                           cursor:"pointer", padding:"0.1rem 0.3rem", borderRadius:4,
                           transition:"color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.amber)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.text3)}>
                  ✏️ edit
                </button>
              </div>
              <div style={{ background:C.bg, borderRadius:8, padding:"0.6rem 0.75rem",
                            border:`1.5px solid ${C.border}`, maxHeight:110, overflowY:"auto",
                            fontSize:"0.78rem", color:C.text2, lineHeight:1.6,
                            whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                {slides[current]?.notes
                  ? slides[current].notes
                  : <span style={{ color:C.text3, fontStyle:"italic" }}>No notes for this slide.</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* Agent activity panel */}
        <div style={{ width:290, background:C.surface, borderLeft:`1.5px solid ${C.border}`,
                      padding:"1rem", overflowY:"auto", flexShrink:0, display:"flex",
                      flexDirection:"column", gap:"1rem" }}>

          {/* Status */}
          <div>
            <div style={{ fontWeight:700, fontSize:"0.82rem", color:C.text1, marginBottom:"0.6rem",
                          letterSpacing:"0.04em" }}>
              AGENT ACTIVITY
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                          padding:"0.5rem 0.7rem", borderRadius:8,
                          background: isListening ? C.amberBg : C.surface,
                          border:`1.5px solid ${isListening ? C.amber : C.border}` }}>
              <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                            background: isListening ? C.amber : C.border,
                            animation: isListening ? "pulse 1.2s infinite" : "none" }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"0.76rem", fontWeight:600, color:C.text1 }}>
                  {isListening ? "Listening" : "Idle"}
                </div>
                {isListening && (
                  <div style={{ fontSize:"0.66rem", color:C.text3, marginTop:"0.1rem" }}>{agentStatus}</div>
                )}
              </div>
            </div>
          </div>

          {/* Tool calls */}
          {(() => {
            const pptTools = store.toolCards.filter(c =>
              ["ppt_navigate","ppt_jump_to_title","ppt_summarize"].includes(c.tool)
            ).slice(-6).reverse();
            return pptTools.length > 0 ? (
              <div>
                <div style={{ fontSize:"0.68rem", fontWeight:700, color:C.text3,
                              letterSpacing:"0.07em", marginBottom:"0.4rem" }}>TOOL CALLS</div>
                {pptTools.map((c,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"0.4rem",
                                        marginBottom:"0.45rem" }}>
                    <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0, marginTop:1,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  fontSize:"0.45rem", fontWeight:700, color:"#fff",
                                  background: c.status==="ok" ? "#22C55E"
                                            : c.status==="running" ? C.amber : C.border }}>
                      {c.status==="ok" ? "✓" : c.status==="running" ? "●" : "○"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.74rem", fontWeight:600, color:C.text1 }}>
                        {c.tool.replace("ppt_","").replace(/_/g," ")}
                      </div>
                      <div style={{ fontSize:"0.66rem", color: c.status==="running" ? C.amber : C.text3 }}>
                        {c.status==="running" ? "Running…"
                         : c.status==="ok" ? `Done · ${c.latency_ms ? c.latency_ms+"ms" : ""}` : "Pending"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* Nav log */}
          <div>
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:C.text3,
                          letterSpacing:"0.07em", marginBottom:"0.4rem" }}>NAVIGATION LOG</div>
            {agentLog.length === 0
              ? <div style={{ fontSize:"0.72rem", color:C.text3 }}>No actions yet.</div>
              : agentLog.slice().reverse().map((l,i) => (
                  <div key={i} style={{ display:"flex", gap:"0.35rem", marginBottom:"0.4rem",
                                        alignItems:"flex-start" }}>
                    <span style={{ color:"#22C55E", flexShrink:0, fontSize:"0.72rem", marginTop:"0.05rem" }}>›</span>
                    <div style={{ fontSize:"0.72rem", lineHeight:1.45, color:C.text2 }}>{l}</div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Edit Slide modal */}
      {editOpen && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)",
                      display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div style={{ background:C.surface, borderRadius:16, padding:"1.75rem",
                        maxWidth:520, width:"92%", maxHeight:"86vh", overflowY:"auto",
                        boxShadow:"0 12px 56px rgba(0,0,0,0.45)" }}>

            <div style={{ fontWeight:700, fontSize:"1rem", color:C.text1, marginBottom:"0.25rem" }}>
              ✏️ Edit Slide {current + 1}
            </div>
            <p style={{ fontSize:"0.76rem", color:C.text3, marginBottom:"1.25rem" }}>
              Changes are saved to the .pptx file and thumbnails are regenerated.
            </p>

            {kindSchema ? (
              kindSchema.fields.length === 0 ? (
                <p style={{ fontSize:"0.8rem", color:C.text3, fontStyle:"italic", marginBottom:"1rem" }}>
                  This slide has no editable fields — it's a fixed closing slide.
                </p>
              ) : (
                kindSchema.fields.map(field => (
                  <div key={field.key} style={{ marginBottom:"0.2rem" }}>
                    <label style={{ fontSize:"0.78rem", fontWeight:600, color:C.text2, display:"block", marginBottom:"0.35rem" }}>
                      {field.label || field.key}
                    </label>
                    {field.type === "table_grid" ? (
                      // The "table" kind's extract/populate functions read/write
                      // "headers"/"rows" at the TOP level of the data dict (matching
                      // the generation-time content schema), not nested under a
                      // "table" key the way every other field's `key` maps 1:1 onto
                      // a data property — bind directly to those two keys instead.
                      <KindFieldEditor
                        field={field}
                        value={{ headers: kindDraft?.headers, rows: kindDraft?.rows }}
                        onChange={v => setKindDraft((d: any) => ({ ...(d || {}), headers: v.headers, rows: v.rows }))}
                        C={C}
                      />
                    ) : (
                      <KindFieldEditor
                        field={field}
                        value={kindDraft?.[field.key]}
                        onChange={v => setKindDraft((d: any) => ({ ...(d || {}), [field.key]: v }))}
                        C={C}
                      />
                    )}
                  </div>
                ))
              )
            ) : (
              <>
                {/* Title */}
                <label style={{ fontSize:"0.78rem", fontWeight:600, color:C.text2, display:"block", marginBottom:"0.35rem" }}>
                  Slide Title
                </label>
                <input
                  value={editDraft.title}
                  onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="Slide title"
                  style={{ width:"100%", boxSizing:"border-box", padding:"0.55rem 0.75rem",
                           borderRadius:8, border:`1.5px solid ${C.border}`,
                           background:C.bg, color:C.text1, fontSize:"0.88rem",
                           outline:"none", marginBottom:"1.1rem", fontFamily:"inherit" }}
                />

                {/* Bullets */}
                <label style={{ fontSize:"0.78rem", fontWeight:600, color:C.text2, display:"block", marginBottom:"0.35rem" }}>
                  Bullet Points
                </label>
                {editDraft.bullets.map((b, i) => (
                  <div key={i} style={{ display:"flex", gap:"0.4rem", marginBottom:"0.4rem", alignItems:"flex-start" }}>
                    <span style={{ marginTop:"0.55rem", color:C.text3, fontSize:"0.72rem",
                                   minWidth:"1.2rem", textAlign:"right" }}>{i + 1}.</span>
                    <textarea
                      value={b}
                      rows={2}
                      onChange={e => setEditDraft(d => {
                        const bullets = [...d.bullets];
                        bullets[i] = e.target.value;
                        return { ...d, bullets };
                      })}
                      placeholder={`Bullet ${i + 1}`}
                      style={{ flex:1, padding:"0.45rem 0.65rem", borderRadius:6,
                               border:`1.5px solid ${C.border}`, background:C.bg,
                               color:C.text1, fontSize:"0.8rem", resize:"vertical",
                               fontFamily:"inherit", outline:"none" }}
                    />
                    <button
                      onClick={() => setEditDraft(d => ({ ...d, bullets: d.bullets.filter((_,j) => j !== i) }))}
                      disabled={editDraft.bullets.length <= 1}
                      style={{ marginTop:"0.4rem", width:22, height:22, borderRadius:"50%", border:"none",
                               background:"rgba(239,68,68,0.15)", color:"#EF4444",
                               cursor: editDraft.bullets.length <= 1 ? "default" : "pointer",
                               fontSize:"0.75rem", opacity: editDraft.bullets.length <= 1 ? 0.35 : 1,
                               flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditDraft(d => ({ ...d, bullets: [...d.bullets, ""] }))}
                  style={{ fontSize:"0.76rem", color:C.amber, background:"none", border:"none",
                           cursor:"pointer", padding:"0.25rem 0", marginBottom:"1.1rem" }}>
                  + Add bullet
                </button>
              </>
            )}

            {/* Speaker Notes — a universal field, present on every kind and on
                uploaded decks alike, so it's shared by both edit modes above. */}
            <label style={{ fontSize:"0.78rem", fontWeight:600, color:C.text2, display:"block", marginBottom:"0.35rem" }}>
              Speaker Notes
            </label>
            <textarea
              value={notesDraft}
              rows={4}
              onChange={e => setNotesDraft(e.target.value)}
              placeholder="Notes visible to the presenter during the presentation…"
              style={{ width:"100%", boxSizing:"border-box", padding:"0.55rem 0.75rem",
                       borderRadius:8, border:`1.5px solid ${C.border}`,
                       background:C.bg, color:C.text1, fontSize:"0.8rem",
                       resize:"vertical", fontFamily:"inherit", outline:"none",
                       marginBottom:"1.4rem" }}
            />

            {/* Regeneration note */}
            {savingEdit && (
              <div style={{ fontSize:"0.76rem", color:C.amber, marginBottom:"1rem",
                            display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span>
                Saving and regenerating slide thumbnails… (~5–10s)
              </div>
            )}

            {/* Buttons */}
            <div style={{ display:"flex", gap:"0.75rem" }}>
              <button onClick={() => { setEditOpen(false); setSavingEdit(false); }}
                disabled={savingEdit}
                style={{ flex:1, padding:"0.6rem", borderRadius:8,
                         border:`1.5px solid ${C.border}`, background:C.surface,
                         color:C.text1, cursor:"pointer", fontSize:"0.88rem",
                         opacity: savingEdit ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={saveEditSlide}
                disabled={savingEdit || (!kindSchema && !editDraft.title.trim())}
                style={{ flex:2, padding:"0.6rem", borderRadius:8, border:"none",
                         background: savingEdit || (!kindSchema && !editDraft.title.trim())
                           ? "rgba(245,167,0,0.35)" : C.amber,
                         color:"#fff", fontWeight:700, fontSize:"0.88rem",
                         cursor: savingEdit || (!kindSchema && !editDraft.title.trim()) ? "default" : "pointer" }}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PPT modal */}
      {createModal && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)",
                      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div style={{ background:C.surface, borderRadius:16, padding:"1.75rem",
                        maxWidth:440, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>

            <div style={{ fontWeight:700, fontSize:"1rem", color:C.text1, marginBottom:"0.25rem" }}>
              Create Presentation
            </div>
            <p style={{ fontSize:"0.78rem", color:C.text3, marginBottom:"1.2rem" }}>
              Describe your topic — PILOT will generate the slides with AI.
            </p>

            {/* Description field + mic */}
            <div style={{ position:"relative", marginBottom:"1rem" }}>
              <textarea
                value={genDesc}
                onChange={e => setGenDesc(e.target.value)}
                placeholder="e.g. Introduction to Machine Learning for beginners, covering supervised learning, neural networks, and real-world applications"
                rows={4}
                style={{ width:"100%", boxSizing:"border-box", padding:"0.65rem 2.8rem 0.65rem 0.75rem",
                         borderRadius:8, border:`1.5px solid ${C.border}`,
                         background:C.bg, color:C.text1, fontSize:"0.82rem",
                         resize:"vertical", fontFamily:"inherit", outline:"none" }}
              />
              {/* In-field mic button */}
              <button onClick={toggleMicInput}
                title={micListening ? "Stop listening" : "Speak description"}
                style={{ position:"absolute", bottom:10, right:8, width:28, height:28,
                         borderRadius:"50%", border:"none", cursor:"pointer",
                         background: micListening ? C.amber : C.amberBg,
                         fontSize:"0.85rem", display:"flex", alignItems:"center",
                         justifyContent:"center", flexShrink:0 }}>
                {micListening ? "⏹" : "🎤"}
              </button>
            </div>

            {/* Slide count */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1.4rem" }}>
              <label style={{ fontSize:"0.8rem", color:C.text2, whiteSpace:"nowrap" }}>
                Number of slides
              </label>
              <input
                type="number" min={3} max={20} value={genCount}
                onChange={e => setGenCount(Math.max(3, Math.min(20, Number(e.target.value))))}
                style={{ width:70, padding:"0.4rem 0.6rem", borderRadius:6,
                         border:`1.5px solid ${C.border}`, background:C.bg,
                         color:C.text1, fontSize:"0.85rem", textAlign:"center" }}
              />
              <span style={{ fontSize:"0.72rem", color:C.text3 }}>
                ~{Math.round(genCount * 1.2)}s estimate
              </span>
            </div>

            {/* Progress / error */}
            {genProgress && (
              <div style={{ fontSize:"0.78rem", color: genProgress.startsWith("Failed")
                              ? "#EF4444" : C.amber,
                            marginBottom:"1rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                {!genProgress.startsWith("Failed") && (
                  <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span>
                )}
                {genProgress}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display:"flex", gap:"0.75rem" }}>
              <button onClick={() => { setCreateModal(false); setGenProgress(""); }}
                disabled={generating}
                style={{ flex:1, padding:"0.6rem", borderRadius:8,
                         border:`1.5px solid ${C.border}`, background:C.surface,
                         color:C.text1, cursor:"pointer", fontSize:"0.88rem",
                         opacity: generating ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={generatePPT}
                disabled={generating || !genDesc.trim()}
                style={{ flex:2, padding:"0.6rem", borderRadius:8, border:"none",
                         background: generating || !genDesc.trim()
                           ? "rgba(255,184,0,0.35)" : "#FFB800",
                         color:"#fff", fontWeight:700, fontSize:"0.88rem",
                         cursor: generating || !genDesc.trim() ? "default" : "pointer" }}>
                {generating ? "Generating…" : `Generate ${genCount} Slides`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slide modal */}
      {addSlideModal && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)",
                      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div style={{ background:C.surface, borderRadius:16, padding:"1.75rem",
                        maxWidth:440, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>

            <div style={{ fontWeight:700, fontSize:"1rem", color:C.text1, marginBottom:"0.25rem" }}>
              Add Slide
            </div>
            <p style={{ fontSize:"0.78rem", color:C.text3, marginBottom:"1.2rem" }}>
              Describe what the new slide should be about — it will be inserted
              right after slide {current + 1}, styled to match the rest of the deck.
            </p>

            <textarea
              value={addSlideDesc}
              onChange={e => setAddSlideDesc(e.target.value)}
              placeholder="e.g. Our Q4 roadmap, covering the three main initiatives"
              rows={3}
              style={{ width:"100%", boxSizing:"border-box", padding:"0.65rem 0.75rem",
                       borderRadius:8, border:`1.5px solid ${C.border}`,
                       background:C.bg, color:C.text1, fontSize:"0.82rem",
                       resize:"vertical", fontFamily:"inherit", outline:"none",
                       marginBottom:"1rem" }}
            />

            {addSlideError && (
              <div style={{ fontSize:"0.78rem", color:"#EF4444", marginBottom:"1rem" }}>
                {addSlideError}
              </div>
            )}

            <div style={{ display:"flex", gap:"0.75rem" }}>
              <button onClick={() => { setAddSlideModal(false); setAddSlideError(""); }}
                disabled={addingSlide}
                style={{ flex:1, padding:"0.6rem", borderRadius:8,
                         border:`1.5px solid ${C.border}`, background:C.surface,
                         color:C.text1, cursor:"pointer", fontSize:"0.88rem",
                         opacity: addingSlide ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={addSlide}
                disabled={addingSlide}
                style={{ flex:2, padding:"0.6rem", borderRadius:8, border:"none",
                         background: addingSlide ? "rgba(255,184,0,0.35)" : "#FFB800",
                         color:"#fff", fontWeight:700, fontSize:"0.88rem",
                         cursor: addingSlide ? "default" : "pointer" }}>
                {addingSlide ? "Adding…" : "Add Slide"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete slide modals */}
      {deleteModal !== "hidden" && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)",
                      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div style={{ background:C.surface, borderRadius:16, padding:"1.75rem",
                        maxWidth:360, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
            {deleteModal === "denied" ? (
              <>
                <div style={{ fontSize:"1.4rem", marginBottom:"0.5rem" }}>🔒</div>
                <div style={{ fontWeight:700, fontSize:"1rem", color:"#EF4444", marginBottom:"0.4rem" }}>
                  Access Denied
                </div>
                <p style={{ fontSize:"0.85rem", color:C.text2, marginBottom:"1.25rem", lineHeight:1.6 }}>
                  Deleting slides requires <strong>Level 3 Admin access</strong>. Your current access level does not permit this action.
                </p>
                <button onClick={() => setDeleteModal("hidden")}
                  style={{ width:"100%", padding:"0.6rem", borderRadius:8, border:"none",
                           background:"#EF4444", color:"#fff", fontWeight:600,
                           fontSize:"0.88rem", cursor:"pointer" }}>
                  OK
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize:"1.4rem", marginBottom:"0.5rem" }}>🗑</div>
                <div style={{ fontWeight:700, fontSize:"1rem", marginBottom:"0.4rem" }}>
                  Delete Slide {current + 1}?
                </div>
                <p style={{ fontSize:"0.85rem", color:C.text2, marginBottom:"1.25rem", lineHeight:1.6 }}>
                  You are about to delete <strong>"{slideTitle}"</strong>. This action cannot be undone.
                </p>
                <div style={{ display:"flex", gap:"0.75rem" }}>
                  <button onClick={() => setDeleteModal("hidden")}
                    style={{ flex:1, padding:"0.6rem", borderRadius:8,
                             border:`1.5px solid ${C.border}`, background:C.surface,
                             color:C.text1, cursor:"pointer", fontSize:"0.88rem" }}>
                    No, Keep It
                  </button>
                  <button onClick={confirmDeleteSlide}
                    style={{ flex:1, padding:"0.6rem", borderRadius:8, border:"none",
                             background:"#EF4444", color:"#fff", fontWeight:600,
                             fontSize:"0.88rem", cursor:"pointer" }}>
                    Yes, Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}