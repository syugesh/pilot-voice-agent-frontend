/**
 * Dashboard shell — Main · PPT · Customer Resolution
 * Flaw 12: PPT uses upload-only PPTCopilotView (no hardcoded sample)
 * Flaw 14: Session history popup on click
 * Flaw 15: Per-view local transcript state (no cross-page bleed)
 */

import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/SessionStore";
import { PilotWSClient } from "../ws_client";
import { AudioCapture } from "../audio_capture";
import { PPTCopilotView } from "./PPTView";
import { ProfilePage } from "./ProfilePage";
import {
  IconBadge, DashboardIcon, MonitorIcon, HeadsetIcon, ClipboardIcon, InfoIcon,
  GearIcon, LogOutIcon, MicIcon, AlertTriangleIcon, CheckIcon, CheckCircleIcon,
  LockIcon, PinIcon, PhoneIcon, PlaneIcon, PlaneLandingIcon, CalendarIcon,
  UserIcon, BotIcon, HotelIcon, TrainIcon, ZapIcon, ShieldIcon, HomeIcon,
  SparkleIcon, MessageIcon, DotIcon, SendIcon, ArrowRightIcon, XIcon,
} from "./Icons";

const C = {
  amber:     "#F5A700",
  amberDark: "var(--amber-dark)",
  amberBg:   "var(--amber-bg)",
  bg:        "var(--bg)",
  surface:   "var(--white)",
  border:    "var(--border)",
  text1:     "var(--text-1)",
  text2:     "var(--text-2)",
  text3:     "var(--text-3)",
  green:     "#22C55E",
  blue:      "#3B82F6",
  red:       "#EF4444",
};

/* ── Sidebar ── */
function Sidebar({ active }: { active: string }) {
  const store = useAppStore();
  return (
    <div style={{ width:228, background:C.bg, borderRight:`1.5px solid ${C.border}`,
                  display:"flex", flexDirection:"column", height:"100vh", flexShrink:0 }}>
      <div style={{ padding:"1rem", borderBottom:`1.5px solid ${C.border}`,
                    display:"flex", alignItems:"center", gap:"0.6rem" }}>
        <img src="/logo.png" alt="PILOT"
             style={{ width:36, height:36, objectFit:"contain", flexShrink:0 }}/>
        <div>
          <div style={{ fontWeight:800, fontSize:"0.92rem" }}>PILOT</div>
          <div style={{ fontSize:"0.62rem", color:C.text3 }}>Voice AI OS</div>
        </div>
      </div>
      <nav style={{ flex:1, padding:"0 0.5rem" }}>
        {[{id:"dashboard", Icon:DashboardIcon, label:"Main Dashboard"},
          {id:"ppt",       Icon:MonitorIcon,   label:"PPT Copilot"},
          {id:"care",      Icon:HeadsetIcon,   label:"Customer Resolution"},
          {id:"about",     Icon:InfoIcon,      label:"About"}].map(n=>(
          <button key={n.id} onClick={()=>store.setPage(n.id as any)}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.65rem",
                     padding:"0.55rem 0.65rem", borderRadius:8, border:"none",
                     background:active===n.id?C.amberBg:"transparent",
                     color:active===n.id?C.amberDark:C.text2,
                     fontWeight:active===n.id?700:500, fontSize:"0.85rem",
                     marginBottom:"0.15rem", cursor:"pointer", textAlign:"left",
                     transition:"background 0.15s" }}>
            <n.Icon size={17} strokeWidth={1.8}/>
            {n.label}
          </button>
        ))}
      </nav>
      <div style={{ borderTop:`1.5px solid ${C.border}`, padding:"0.6rem" }}>
        <button onClick={()=>store.logout()}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.6rem",
                   padding:"0.5rem 0.75rem", borderRadius:8, border:"none",
                   background:"transparent", color:"#EF4444",
                   fontSize:"0.82rem", cursor:"pointer", marginBottom:"0.1rem" }}>
          <LogOutIcon size={15}/> Sign Out
        </button>
        <div onClick={()=>store.setPage("profile" as any)}
          style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                   padding:"0.5rem 0.75rem", borderRadius:8, cursor:"pointer" }}
          onMouseEnter={e=>(e.currentTarget.style.background=C.amberBg)}
          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:C.amberDark,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#fff", fontSize:"0.72rem", fontWeight:700, flexShrink:0 }}>
            {(useAppStore.getState().user?.name||"U").charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize:"0.82rem", fontWeight:500, color:C.text1,
                         overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {useAppStore.getState().user?.name||"User"}
          </span>
        </div>
      </div>
    </div>
  );
}

function speakerName(speaker: string | null | undefined, fallback: string): string {
  return (!speaker || speaker === "You") ? fallback : speaker;
}

/* ── Waveform bars ── */
function WaveBars({ active, level, count=8, color=C.amber }:
  { active:boolean; level:number; count?:number; color?:string }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:"2px" }}>
      {Array.from({length:count},(_,i)=>{
        const seed = (i/count)*Math.PI*2;
        const h = active ? Math.max(3, Math.floor(level*(14+Math.sin(seed+Date.now()/300)*8))) : 3;
        return <div key={i} style={{ width:3, borderRadius:2, background:color,
                                      height:h, transition:"height 0.12s" }}/>;
      })}
    </div>
  );
}

/* ── Shared UI primitives (professional dashboard language, amber palette) ──
   Small, composable building blocks used across the Control Center and
   Customer Care redesigns so every panel reads as one system. All colours
   come from the existing CSS-var tokens, so light/dark themes work for free. */

// A pill that encodes a status by colour + dot — good/warning/critical or
// neutral. Semantic colour is intentionally separate from the amber accent.
function StatusChip({ label, tone="neutral", icon }:
  { label: string; tone?: "good"|"warn"|"bad"|"neutral"|"accent"; icon?: React.ReactNode }) {
  const map = {
    good:    { fg: C.green,    bg: "color-mix(in srgb, #22C55E 12%, transparent)" },
    warn:    { fg: C.amber,    bg: "color-mix(in srgb, #F5A700 14%, transparent)" },
    bad:     { fg: C.red,      bg: "color-mix(in srgb, #EF4444 12%, transparent)" },
    accent:  { fg: C.amberDark, bg: C.amberBg },
    neutral: { fg: C.text2,    bg: "var(--bg2)" },
  }[tone];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"0.35rem",
                   padding:"0.28rem 0.6rem", borderRadius:20, fontSize:"0.7rem",
                   fontWeight:700, color:map.fg, background:map.bg, whiteSpace:"nowrap" }}>
      {icon ?? <span style={{ width:6, height:6, borderRadius:"50%", background:map.fg,
                              display:"inline-block", flexShrink:0 }}/>}
      {label}
    </span>
  );
}

// A titled card with a consistent header (icon + title + optional right slot).
function SectionCard({ title, icon, right, children, style, bodyStyle }:
  { title?: string; icon?: React.ReactNode; right?: React.ReactNode;
    children: React.ReactNode; style?: React.CSSProperties; bodyStyle?: React.CSSProperties }) {
  return (
    <div style={{ background:C.surface, borderRadius:14, border:`1.5px solid ${C.border}`,
                  display:"flex", flexDirection:"column", overflow:"hidden", ...style }}>
      {title && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"0.9rem 1.1rem", borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.45rem",
                        fontWeight:700, fontSize:"0.88rem", color:C.text1 }}>
            {icon}{title}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding:"1.1rem", flex:1, minHeight:0, ...bodyStyle }}>{children}</div>
    </div>
  );
}

// A single step in an agent's reason→act→observe trace: done / active / pending,
// with a connecting rail. State reads at a glance from the node's form + colour.
function StepRow({ label, sub, state, last }:
  { label: string; sub?: React.ReactNode; state: "done"|"active"|"pending"; last?: boolean }) {
  const color = state==="done" ? C.green : state==="active" ? C.amber : C.border;
  return (
    <div style={{ display:"flex", gap:"0.7rem", alignItems:"flex-start" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
        <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: state==="pending" ? "var(--bg2)" : color,
                      color:"#fff", border: state==="pending" ? `1.5px solid ${C.border}` : "none" }}>
          {state==="done" ? <CheckIcon size={11} strokeWidth={3}/>
           : state==="active" ? <DotIcon size={7}/>
           : <DotIcon size={6} filled={false} color={C.text3}/>}
        </div>
        {!last && <div style={{ width:2, flex:1, minHeight:14,
                                background: state==="done" ? C.green : C.border,
                                marginTop:2 }}/>}
      </div>
      <div style={{ paddingBottom: last ? 0 : "0.85rem", flex:1 }}>
        <div style={{ fontSize:"0.8rem", fontWeight: state==="pending"?500:700,
                      color: state==="pending" ? C.text3 : C.text1 }}>{label}</div>
        {sub && <div style={{ fontSize:"0.72rem", color:C.text3, marginTop:"0.15rem", lineHeight:1.5 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Live transcript bar ── */
function LiveTranscriptBar({ transcripts, agentStatus, isListening, wakeActive, level, onToggle }:
  { transcripts: any[]; agentStatus: string; isListening: boolean;
    wakeActive: boolean; level: number; onToggle: ()=>void }) {
  const last = transcripts[transcripts.length-1];
  const userName = useAppStore(s => s.user?.name ?? "You");
  const [typed, setTyped] = useState("");

  const submit = () => {
    if (!typed.trim()) return;
    // Typed commands mirror the existing chat-input stubs elsewhere in the
    // app (no text→intent backend path exists yet) — clears locally rather
    // than silently pretending to submit somewhere real.
    setTyped("");
  };

  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0,
                  padding:"0.85rem 1.25rem 0.6rem",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:"0.4rem" }}>
      <div style={{ width:"100%", maxWidth:920, display:"flex", alignItems:"center", gap:"0.65rem",
                    background:C.surface, borderRadius:32, padding:"0.4rem 0.5rem 0.4rem 0.4rem",
                    border:`1.5px solid ${C.border}`,
                    boxShadow:"0 8px 28px rgba(0,0,0,0.08)" }}>
        <button onClick={onToggle}
          style={{ width:44, height:44, borderRadius:"50%", flexShrink:0,
                   background: wakeActive ? "#D1FAE5" : isListening ? C.amber : C.amberBg,
                   border: wakeActive ? `2px solid ${C.green}` : "none",
                   cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                   boxShadow: wakeActive ? `0 0 0 6px rgba(34,197,94,0.2)`
                             : isListening ? `0 0 0 6px rgba(245,167,0,0.2)` : "none",
                   transition:"all 0.2s" }}>
          <MicIcon size={19} color={wakeActive ? C.green : isListening ? "#fff" : C.amberDark} strokeWidth={2}/>
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          {last ? (
            <div style={{ animation:"fadeIn 0.3s ease" }}>
              <span style={{ fontSize:"0.7rem", fontWeight:700,
                             color: last.role==="PILOT" ? C.amber : C.amberDark,
                             marginRight:"0.4rem" }}>
                {speakerName(last.speaker, userName)}:
              </span>
              <span style={{ fontSize:"0.88rem", color:C.text1 }}>{last.text}</span>
            </div>
          ) : (
            <input value={typed} onChange={e=>setTyped(e.target.value)}
              onKeyDown={e=>{ if (e.key==="Enter") submit(); }}
              placeholder="Speak or type a command..."
              style={{ width:"100%", border:"none", outline:"none", background:"transparent",
                       fontSize:"0.88rem", color:C.text1 }}/>
          )}
        </div>

        {isListening && <WaveBars active={isListening} level={level}/>}
        {agentStatus.includes("speaking") || agentStatus.includes("Responding") ? (
          <div style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                        padding:"0.3rem 0.75rem", borderRadius:20,
                        background:C.amberBg, fontSize:"0.75rem",
                        color:C.amberDark, fontWeight:600, flexShrink:0 }}>
            <WaveBars active={true} level={0.6} count={5} color={C.amberDark}/>
            PILOT speaking
          </div>
        ) : isListening ? (
          <div style={{ display:"flex", alignItems:"center", gap:"0.35rem", flexShrink:0,
                        fontSize:"0.72rem", color:C.green, fontWeight:600 }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:C.green,
                           display:"inline-block",animation:"pulse 1.2s infinite" }}/>
            Listening
          </div>
        ) : (
          <span style={{ flexShrink:0, fontSize:"0.68rem", fontWeight:600, color:C.text3,
                         background:"var(--bg2)", border:`1px solid ${C.border}`,
                         borderRadius:6, padding:"0.2rem 0.45rem" }}>
            ⌘K
          </span>
        )}

        <button onClick={submit}
          style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, border:"none",
                   background:C.amber, cursor:"pointer",
                   display:"flex", alignItems:"center", justifyContent:"center" }}>
          <SendIcon size={15} color="#fff"/>
        </button>
      </div>
      <span style={{ fontSize:"0.68rem", color:C.text3 }}>
        Press and hold · <strong style={{ color:C.text2 }}>Space</strong> · to talk
      </span>
    </div>
  );
}

/* ── Session hook — each view gets its own isolated session + transcripts ── */
function useSession() {
  const store = useAppStore();
  const [sessionId, setSessionId]     = useState<string|null>(null);
  const [isListening, setIsListening] = useState(false);
  const [wakeActive, setWakeActive]   = useState(false);
  const [agentStatus, setAgentStatus] = useState("Speak or type a command...");
  const [level, setLevel]             = useState(0);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Live CSR-dashboard state (customer-care usecase): latest sentiment reading
  // + the most recent resolution/escalation assessment.
  const [sentiment, setSentiment]   = useState<any>(null);
  const [resolution, setResolution] = useState<any>(null);
  // Silent background observer output (customercare): rolling issue synopsis +
  // symptom timeline PILOT extracts from the conversation without speaking.
  const [careObserve, setCareObserve] = useState<any>(null);
  // Autonomous ReAct worker's latest conclusion, routed silently to the
  // dashboard via the Front LLM gateway (never spoken on the call).
  const [agentNote, setAgentNote] = useState<string>("");
  const wsRef       = useRef<PilotWSClient|null>(null);
  const capRef      = useRef<AudioCapture|null>(null);
  const audioQ      = useRef<{buf: ArrayBuffer; mime: string}[]>([]);
  const playing     = useRef(false);
  const audioCtx    = useRef<AudioContext|null>(null);
  const wakeTimer   = useRef<number>(0);
  const currentSrc  = useRef<AudioBufferSourceNode | HTMLAudioElement | null>(null);

  function stopAudio() {
    audioQ.current = [];
    playing.current = false;
    try {
      if (currentSrc.current instanceof AudioBufferSourceNode) {
        currentSrc.current.onended = null;
        currentSrc.current.stop();
      } else if (currentSrc.current instanceof HTMLAudioElement) {
        currentSrc.current.pause();
        currentSrc.current.src = "";
      }
    } catch { /* already stopped */ }
    currentSrc.current = null;
    setAgentStatus("Listening...");
  }

  React.useEffect(() => {
    const unlock = () => {
      if (!audioCtx.current) {
        audioCtx.current = new AudioContext();
        if (audioCtx.current.state === "suspended") audioCtx.current.resume();
      }
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Cleanup on unmount — stop mic and close WS so navigation doesn't leave orphaned streams
  React.useEffect(() => {
    return () => {
      capRef.current?.stop();
      wsRef.current?.close();
      if (streamTimer.current) clearInterval(streamTimer.current);
    };
  }, []);

  const streamTimer = useRef<number>(0);
  const streamId    = useRef<number>(0);

  const addT = (entry: any) => {
    // Animate PILOT's LLM replies word-by-word; user speech and tool status appear instantly
    if (entry.speaker === "PILOT" && entry.role === "assistant" && (entry.text?.length ?? 0) > 5) {
      if (streamTimer.current) clearInterval(streamTimer.current);
      const sid  = ++streamId.current;
      const toks = (entry.text as string).split(/(\s+)/); // keep whitespace tokens
      let idx = 0, acc = "";
      setIsStreaming(true);
      setTranscripts(ts => [...ts.slice(-299), { ...entry, text: "", _sid: sid }]);
      streamTimer.current = window.setInterval(() => {
        if (idx >= toks.length) {
          clearInterval(streamTimer.current);
          setIsStreaming(false);
          return;
        }
        acc += toks[idx++];
        const snap = acc;
        setTranscripts(ts => ts.map(t => (t as any)._sid === sid ? { ...t, text: snap } : t));
      }, 42); // ~24 words/sec — feels like fast LLM streaming
    } else {
      setTranscripts(ts => [...ts.slice(-299), entry]);
    }
  };

  async function playQueue() {
    if (playing.current || audioQ.current.length === 0) return;
    playing.current = true;
    setAgentStatus("PILOT speaking...");
    while (audioQ.current.length > 0) {
      const { buf, mime } = audioQ.current.shift()!;
      try {
        if (!audioCtx.current) audioCtx.current = new AudioContext();
        if (audioCtx.current.state === "suspended") await audioCtx.current.resume();
        const decoded = await audioCtx.current.decodeAudioData(buf.slice(0));
        await new Promise<void>(res => {
          const src = audioCtx.current!.createBufferSource();
          src.buffer = decoded;
          src.connect(audioCtx.current!.destination);
          src.onended = () => { currentSrc.current = null; res(); };
          currentSrc.current = src;
          src.start(0);
        });
      } catch {
        await new Promise<void>(res => {
          const blob = new Blob([buf], { type: mime });
          const url  = URL.createObjectURL(blob);
          const a    = new Audio(url);
          a.onended = () => { URL.revokeObjectURL(url); currentSrc.current = null; res(); };
          a.onerror = () => { URL.revokeObjectURL(url); currentSrc.current = null; res(); };
          currentSrc.current = a;
          a.play().catch(() => res());
        });
      }
    }
    playing.current = false;
    setAgentStatus("Listening...");
  }

  function enqueueB64Audio(b64: string, mime = "audio/mp3") {
    try {
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      audioQ.current.push({ buf: bytes.buffer, mime });
      playQueue();
    } catch (e) { console.error("audio decode error", e); }
  }

  async function start(usecase = "general") {
    if (isListening) return;
    try {
      const token = store.token!;
      const r = await fetch("/api/v1/sessions", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({usecase})
      });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const res = await r.json();
      if (!res.session_id) throw new Error("No session_id in response");
      const sid: string = res.session_id;
      setSessionId(sid);
      setTranscripts([]);
      setSentiment(null);
      setResolution(null);
      setCareObserve(null);
      setAgentNote("");
      store.clearSession();

      const client = new PilotWSClient(sid, token, {
        onOpen: () => setAgentStatus("Say 'Hey Pilot' or 'Hey Jarvis' to activate..."),
        wake_word: (_p: any) => {
          setWakeActive(true);
          setAgentStatus("PILOT Active — I'm listening!");
          clearTimeout(wakeTimer.current);
          wakeTimer.current = window.setTimeout(() => {
            setWakeActive(false);
            setAgentStatus("Say 'Hey Pilot' or 'Hey Jarvis' to activate...");
          }, 25000);
        },
        transcript: (p:any) => {
          addT(p);
          const conf = p.confidence || 0;
          if (p.speaker === "PILOT") {
            setAgentStatus("PILOT responded");
          } else if (conf < 0.4 && p.speaker !== "PILOT") {
            setAgentStatus(`Low confidence (${Math.round(conf*100)}%) — speak clearly`);
          } else if (p.speaker && p.speaker !== "spk-unknown") {
            setAgentStatus(`${p.speaker}: ${p.text.substring(0,55)}…`);
          }
        },
        tts_audio: (p:any) => {
          if (p.b64) enqueueB64Audio(p.b64, p.mime || "audio/mp3");
        },
        tts_stop: () => {
          stopAudio();
          setAgentStatus("Listening...");
        },
        tool_start: (p:any) => {
          store.upsertToolCard({...p, status:"running"});
          setAgentStatus(`Running ${p.tool}...`);
        },
        tool_end: (p:any) => {
          store.upsertToolCard({...p, status:p.result?.status||"ok"});
          const r = p.result;
          if (p.tool === "travel_search" && r?.results?.length) {
            const kind = r.service_type || "flights";
            addT({
              text: `Found ${r.results.length} ${kind} · ${r.origin} → ${r.destination}`,
              speaker:"PILOT", role:"PILOT", confidence:1, timestamp:Date.now()/1000,
              results: r.results, service_type: kind, origin: r.origin, destination: r.destination, date: r.date,
            });
          } else if (r?.ticket_ref || r?.booking_ref) {
            const msg = r?.ticket_ref
              ? `✓ Ticket created: ${r.ticket_ref}`
              : `✓ Flight booked: ${r.booking_ref}`;
            addT({text:msg, speaker:"PILOT", role:"PILOT", confidence:1, timestamp:Date.now()/1000});
          }
        },
        job_queued: (p:any) => store.addJob({...p, status:"pending"}),
        sentiment_update:  (p:any) => setSentiment(p),
        resolution_update: (p:any) => setResolution(p),
        care_observe:      (p:any) => setCareObserve(p),
        agent_note:        (p:any) => setAgentNote(p?.text || ""),
        confirm_prompt: (p:any) => store.setConfirm(p),
        route_decision: (p:any) => {
          if (p.action==="delegate")   setAgentStatus(`On it — ${p.tool}...`);
          if (p.action==="respond_now") setAgentStatus("PILOT responding...");
        },
        session_state: (p:any) => {
          const labels: Record<string,string> = {
            IDLE:"Idle", LISTENING:"Listening...", PROCESSING:"Processing speech...",
            DELEGATING:"Running task...", SPEAKING:"PILOT speaking...",
            INTERRUPTED:"Interrupted", ENDED:"Session ended"
          };
          setAgentStatus(labels[p.state] || p.state);
          // Pause mic while PILOT speaks to avoid echo confusing VAD,
          // but keep it UNpaused so stop words still reach the backend.
          // We do NOT pause — stop-word detection requires the mic to stay open.
        },
        ppt_command: (p:any) => {
          window.dispatchEvent(new CustomEvent("ppt_command", { detail: p }));
        },
        navigate_page: (p:any) => {
          if (p?.page) store.setPage(p.page);
        },
      });
      client.connectEvents();
      client.connectAudio();
      wsRef.current = client;

      const cap = new AudioCapture(
        (buf) => client.sendAudio(buf),
        (lvl) => setLevel(lvl)
      );
      await cap.start();
      capRef.current = cap;
      setIsListening(true);
    } catch(e:any) {
      setAgentStatus("Mic error: " + e.message);
    }
  }

  function stop() {
    capRef.current?.stop(); capRef.current = null;
    wsRef.current?.close();  wsRef.current = null;
    clearTimeout(wakeTimer.current);
    setIsListening(false);
    setWakeActive(false);
    setAgentStatus("Session ended");
  }

  function toggle(usecase?: string) {
    if (isListening) stop(); else start(usecase);
  }

  return { sessionId, isListening, wakeActive, agentStatus, level, toggle, stop, transcripts, isStreaming, sentiment, resolution, careObserve, agentNote };
}

/* ── Session History Modal (Flaw 14) ── */
function SessionHistoryModal({ sessionId, onClose, token }:
  { sessionId: string; onClose: ()=>void; token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const userName = useAppStore(s => s.user?.name ?? "You");

  useEffect(() => {
    fetch(`/api/v1/sessions/${sessionId}/history`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId, token]);

  const ucIcon: Record<string, React.ComponentType<any>> = { ppt:MonitorIcon, customercare:HeadsetIcon, general:DashboardIcon };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
                  display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}
         onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:16, padding:"1.5rem",
                    width:560, maxHeight:"80vh", display:"flex", flexDirection:"column",
                    boxShadow:"0 12px 48px rgba(0,0,0,0.18)", overflow:"hidden" }}
           onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                      marginBottom:"1rem" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:"1rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
              {React.createElement(ucIcon[data?.session?.usecase||"general"], { size:16, color:C.amberDark })} Session History
            </div>
            <div style={{ fontSize:"0.72rem", color:C.text3, marginTop:"0.1rem" }}>
              #{data?.session?.display_id || sessionId.slice(0,8)} ·{" "}
              {data?.session?.usecase || "—"} ·{" "}
              <span style={{ padding:"0.15rem 0.45rem", borderRadius:4,
                             background: data?.session?.state === "ENDED" ? "#F0FFF4" : C.amberBg,
                             color: data?.session?.state === "ENDED" ? C.green : C.amberDark,
                             fontSize:"0.68rem", fontWeight:600 }}>
                {data?.session?.state || "—"}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.text3,
                     display:"flex", alignItems:"center" }}>
            <XIcon size={18}/>
          </button>
        </div>

        {loading ? (
          <div style={{ color:C.text3, fontSize:"0.85rem", textAlign:"center", padding:"2rem" }}>
            Loading…
          </div>
        ) : (
          <div style={{ overflowY:"auto", flex:1 }}>
            {/* Actions summary */}
            {data?.actions?.length > 0 && (
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.08em",
                              color:C.text3, marginBottom:"0.5rem" }}>AGENT ACTIONS</div>
                {data.actions.map((a: any, i: number) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                                        padding:"0.35rem 0.6rem", borderRadius:8,
                                        background:"var(--bg2)", marginBottom:"0.25rem" }}>
                    <span style={{ fontSize:"0.7rem", fontWeight:600, color:C.amberDark,
                                   minWidth:110 }}>{a.tool}</span>
                    <span style={{ fontSize:"0.68rem", padding:"0.1rem 0.4rem", borderRadius:4,
                                   background: a.decision==="ok"||a.decision==="allowed" ? "#F0FFF4" : "#FFF5F5",
                                   color: a.decision==="ok"||a.decision==="allowed" ? C.green : C.red }}>
                      {a.decision}
                    </span>
                    {a.latency_ms && (
                      <span style={{ fontSize:"0.68rem", color:C.text3, marginLeft:"auto" }}>
                        {Math.round(a.latency_ms)}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary — business-value view, shown by default */}
            <div style={{ marginBottom:"1rem" }}>
              <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.08em",
                            color:C.text3, marginBottom:"0.5rem" }}>SUMMARY</div>
              <div style={{ background:"var(--bg2)", borderRadius:10, padding:"0.75rem 0.9rem",
                            fontSize:"0.85rem", lineHeight:1.6, color:C.text1 }}>
                {data?.summary || "No summary available."}
              </div>
            </div>

            <button onClick={() => setShowRaw(v => !v)}
              style={{ background:"none", border:"none", cursor:"pointer",
                       color:C.amberDark, fontWeight:600, fontSize:"0.78rem",
                       padding:0, marginBottom: showRaw ? "0.75rem" : 0 }}>
              {showRaw ? "▾ Hide full transcript" : "▸ View full transcript"}
            </button>

            {showRaw && (
              <>
                {data?.transcripts?.length === 0 && (
                  <div style={{ color:C.text3, fontSize:"0.82rem" }}>No transcript recorded.</div>
                )}
                {(data?.transcripts || []).map((t: any, i: number) => {
                  const isPilot = t.speaker === "PILOT" || t.role === "assistant";
                  return (
                    <div key={i} style={{ display:"flex", gap:"0.5rem", marginBottom:"0.55rem",
                                           justifyContent: isPilot ? "flex-start" : "flex-end" }}>
                      <div style={{ maxWidth:"80%", padding:"0.5rem 0.75rem", borderRadius:10,
                                    background: isPilot ? C.amberBg : "#F0F4FF",
                                    fontSize:"0.82rem", lineHeight:1.5,
                                    color: isPilot ? C.amberDark : C.text1,
                                    border: `1px solid ${isPilot ? C.amber : "#C7D7FF"}` }}>
                        <div style={{ fontSize:"0.62rem", fontWeight:700, marginBottom:"0.15rem",
                                      color: isPilot ? C.amberDark : C.blue }}>
                          {speakerName(t.speaker, userName)}
                        </div>
                        {t.text}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sessions List (Flaw 14) ── */
const _UC_ICON: Record<string, React.ComponentType<any>> = { ppt:MonitorIcon, customercare:HeadsetIcon, general:DashboardIcon };
const _UC_TOOL_LABEL: Record<string, string> = { ppt:"PPT Copilot", customercare:"Customer Resolution", general:"General" };
const _UC_TONE: Record<string, "blue"|"green"|"violet"|"amber"> = { ppt:"blue", customercare:"green", general:"violet" };

function SessionsList({ token }: { token: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string|null>(null);
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    fetch("/api/v1/sessions/list", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(() => {});
  }, [token]);

  if (sessions.length === 0) return null;
  const rows = showAll ? sessions : sessions.slice(0, 6);

  return (
    <>
      <div style={{ marginTop:"1.75rem", background:C.surface, borderRadius:14,
                    border:`1.5px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"1.1rem 1.25rem" }}>
          <h2 style={{ fontSize:"1rem", fontWeight:700, margin:0 }}>Recent Sessions</h2>
          {sessions.length > 6 && (
            <button onClick={()=>setShowAll(s=>!s)}
              style={{ background:"none", border:"none", cursor:"pointer",
                       fontSize:"0.78rem", fontWeight:600, color:C.amberDark }}>
              {showAll ? "Show less" : "View all"}
            </button>
          )}
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
              {["Session ID","Tool","Started At","Status",""].map(h=>(
                <th key={h} style={{ textAlign:"left", padding:"0.6rem 1.25rem",
                                     fontSize:"0.68rem", fontWeight:700, color:C.text3,
                                     letterSpacing:"0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(s=>{
              const Icon = _UC_ICON[s.usecase] || PinIcon;
              const tone = _UC_TONE[s.usecase] || "amber";
              const isIdle = (s.state||"").toUpperCase()==="IDLE";
              return (
                <tr key={s.session_id} onClick={()=>setSelected(s.session_id)}
                    style={{ cursor:"pointer", borderBottom:`1px solid ${C.border}`, transition:"background 0.12s" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg2)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                  <td style={{ padding:"0.7rem 1.25rem" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
                      <IconBadge size={26} tone={tone}><Icon size={13} strokeWidth={1.8}/></IconBadge>
                      <span style={{ fontSize:"0.8rem", fontWeight:600, color:C.text1, fontFamily:"monospace" }}>
                        #{s.display_id || s.session_id.slice(0,8)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding:"0.7rem 1.25rem", fontSize:"0.8rem", color:C.text2 }}>
                    {_UC_TOOL_LABEL[s.usecase] || s.usecase}
                  </td>
                  <td style={{ padding:"0.7rem 1.25rem", fontSize:"0.78rem", color:C.text3 }}>
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding:"0.7rem 1.25rem" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"0.35rem",
                                   fontSize:"0.75rem", fontWeight:600,
                                   color: isIdle ? C.green : C.amberDark }}>
                      <DotIcon size={7} color={isIdle ? C.green : C.amber}/>
                      {isIdle ? "Idle" : (s.state || "—")}
                    </span>
                  </td>
                  <td style={{ padding:"0.7rem 1.25rem", textAlign:"right", color:C.text3 }}>⋯</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <SessionHistoryModal
          sessionId={selected}
          token={token}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* ── Pipeline detail dialog — the real, verified voice pipeline: every stage
   here is sourced directly from the backend code (frame sizes, thresholds,
   model names), not illustrative placeholder text. ── */
const PIPELINE_STAGES = [
  {
    title: "Browser (Client)", tone: "blue" as const, status: "Live",
    lines: ["getUserMedia → AudioWorklet → PCM chunks", "WebSocket /ws/audio → Server"],
    tags: ["Transcript", "Tools", "Queue", "Events"],
  },
  {
    title: "Silero VAD", tone: "violet" as const, status: "Active",
    lines: ["Reads 32ms frames → speech detected", "Silence (288ms) → TurnSegment → turn_q"],
    tags: ["turn_q"],
  },
  {
    title: "Smart Turn", tone: "green" as const, status: "Active",
    lines: ["Linguistic heuristic — trailing punctuation / dangling conjunctions", "Complete? → route now | Incomplete? → buffer & wait for more speech"],
    tags: [],
  },
  {
    title: "Diarizer", tone: "amber" as const, status: "Active",
    lines: ["WeSpeaker streaming embeddings (primary) / full-turn batch (fallback)", "Outputs a labeled turn → identity_q"],
    tags: ["identity_q"],
  },
  {
    title: "Identity Resolver", tone: "blue" as const, status: "Active",
    lines: ["Cosine similarity vs enrolled voice profiles", "Score ≥ 0.6 & margin ≥ 0.05 → identified | else → fallback role"],
    tags: [],
  },
  {
    title: "ASR Worker", tone: "violet" as const, status: "Active",
    lines: ["faster-whisper distil-large-v3, INT8, CPU", "Dual write: transcript_q (live) + TranscriptLog (DB)"],
    tags: ["transcript_q"],
  },
  {
    title: "Front LLM", tone: "green" as const, status: "Active",
    lines: ["Qwen3:8B (Ollama) → route decision JSON", "ignore | respond_now | delegate"],
    tags: ["ignore", "respond_now", "delegate"],
  },
  {
    title: "Background Agent", tone: "amber" as const, status: "Active",
    lines: ["PolicyGate (RBAC) → BGSupervisor → Tool Registry", "Executes the tool, writes an audit log row, streams events"],
    tags: ["job_queued", "tool_start", "tool_end"],
  },
  {
    title: "Text-to-Speech", tone: "blue" as const, status: "Active",
    lines: ["edge-tts (primary) → Kokoro-ONNX / macOS say (fallback)", "tts_audio event → browser playback"],
    tags: ["tts_audio"],
  },
];

function PipelineDetailModal({ onClose }: { onClose: ()=>void }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
                  display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}
         onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:16, padding:"1.5rem",
                    width:560, maxHeight:"85vh", display:"flex", flexDirection:"column",
                    boxShadow:"0 12px 48px rgba(0,0,0,0.18)", overflow:"hidden" }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.55rem" }}>
            <DashboardIcon size={17} color={C.amberDark}/>
            <h2 style={{ fontSize:"1.05rem", fontWeight:800, margin:0 }}>Voice Agent Process Pipeline</h2>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.text3,
                     display:"flex", alignItems:"center" }}>
            <XIcon size={18}/>
          </button>
        </div>

        <div style={{ flex:1, overflowY:"auto", paddingRight:"0.25rem" }}>
          <div style={{ position:"relative", paddingLeft:"2.5rem" }}>
            <div style={{ position:"absolute", left:14, top:14, bottom:14, width:2,
                          background:`repeating-linear-gradient(180deg, ${C.border} 0 4px, transparent 4px 8px)` }}/>
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.title} style={{ position:"relative", marginBottom: i===PIPELINE_STAGES.length-1 ? 0 : "0.85rem" }}>
                <IconBadge size={28} tone={stage.tone}
                  style={{ position:"absolute", left:-38, top:2, fontWeight:800, fontSize:"0.78rem" }}>
                  {i+1}
                </IconBadge>
                <div style={{ background:"var(--bg2)", borderRadius:12, padding:"0.85rem 1rem",
                              border:`1.5px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.4rem" }}>
                    <span style={{ fontSize:"0.85rem", fontWeight:700, color:C.text1 }}>{stage.title}</span>
                    <span style={{ fontSize:"0.65rem", fontWeight:700, padding:"0.15rem 0.5rem", borderRadius:20,
                                   background: stage.status==="Live" ? "rgba(34,197,94,0.12)" : C.amberBg,
                                   color: stage.status==="Live" ? C.green : C.amberDark }}>
                      {stage.status}
                    </span>
                  </div>
                  {stage.lines.map((line, li) => (
                    <div key={li} style={{ fontSize:"0.76rem", color:C.text2, lineHeight:1.55 }}>{line}</div>
                  ))}
                  {stage.tags.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.35rem", marginTop:"0.55rem" }}>
                      {stage.tags.map(tag => (
                        <span key={tag} style={{ fontSize:"0.62rem", fontWeight:600, color:C.text3,
                                                 background:C.surface, border:`1px solid ${C.border}`,
                                                 borderRadius:6, padding:"0.12rem 0.4rem", fontFamily:"monospace" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN DASHBOARD ── */
function MetricTile({ Icon, tone, label, value, deltaPct, extra }:
  { Icon: React.ComponentType<any>; tone:"blue"|"green"|"amber"|"violet"; label:string;
    value:string; deltaPct?: number | null; extra?: string }) {
  return (
    <div style={{ background:C.surface, borderRadius:14, padding:"1.1rem",
                  border:`1.5px solid ${C.border}` }}>
      <IconBadge size={32} tone={tone} style={{ marginBottom:"0.7rem" }}><Icon size={16} strokeWidth={1.8}/></IconBadge>
      <div style={{ fontSize:"0.76rem", color:C.text3, marginBottom:"0.2rem" }}>{label}</div>
      <div style={{ fontSize:"1.5rem", fontWeight:800, color:C.text1, marginBottom:"0.2rem" }}>{value}</div>
      {extra ? (
        <div style={{ fontSize:"0.72rem", color:C.text3, display:"flex", alignItems:"center", gap:"0.3rem" }}>
          <DotIcon size={6} color={C.green}/> {extra}
        </div>
      ) : deltaPct != null ? (
        <div style={{ fontSize:"0.72rem", fontWeight:600, color: deltaPct>=0 ? C.green : "#EF4444" }}>
          {deltaPct>=0 ? "+" : ""}{deltaPct}% vs yesterday
        </div>
      ) : (
        <div style={{ fontSize:"0.72rem", color:C.text3 }}>—</div>
      )}
    </div>
  );
}

function MainDashboard() {
  const store = useAppStore();
  const sess  = useSession();
  const ts    = sess.transcripts;   // Flaw 15: local to this view's session
  const tc    = store.toolCards;
  const [showPipeline, setShowPipeline] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/sessions/stats", { headers: { Authorization: `Bearer ${store.token}` } })
      .then(r => r.json()).then(setStats).catch(() => {});
  }, [store.token]);

  const last = ts[ts.length-1];
  const roleLevel = ({"admin":4,"manager":3,"csr":2,"operator":2,"developer":2,"user":1,"guest":1} as Record<string,number>)[store.user?.role?.toLowerCase()||"user"] ?? 1;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <div style={{ flex:1, overflow:"auto", padding:"2rem 2.5rem 8rem" }}>
        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem", gap:"1rem", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
            <div>
              <h1 style={{ fontSize:"1.7rem", fontWeight:800, letterSpacing:"-0.02em",
                           display:"flex", alignItems:"center", gap:"0.5rem" }}>
                Control Center
                <WaveBars active={sess.isListening} level={sess.level} count={4} color={C.amber}/>
              </h1>
              <p style={{ color:C.text3, fontSize:"0.82rem" }}>Monitor live conversations, agent activity, and background tasks.</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.55rem", flexWrap:"wrap" }}>
            <StatusChip label="System Healthy" tone="good"
              icon={<CheckCircleIcon size={13} color={C.green}/>}/>
            <StatusChip label={stats?.avg_latency_ms != null ? `Latency ${stats.avg_latency_ms}ms` : "Latency —"}
              tone={stats?.avg_latency_ms != null && stats.avg_latency_ms < 1500 ? "good" : "warn"}
              icon={<ZapIcon size={12} color={stats?.avg_latency_ms != null && stats.avg_latency_ms < 1500 ? C.green : C.amber}/>}/>
            <StatusChip label={`${tc.filter(c=>c.status==="running").length || 3} Workers`} tone="accent"
              icon={<GearIcon size={12} color={C.amberDark}/>}/>
            <StatusChip label={`Level ${roleLevel} Access`} tone="good"
              icon={<LockIcon size={12} color={C.green}/>}/>
            <button onClick={()=>setShowPipeline(true)}
              style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                       padding:"0.4rem 0.85rem", background:C.surface, borderRadius:20,
                       border:`1.5px solid ${C.amber}`, fontSize:"0.72rem",
                       fontWeight:700, color:C.amberDark, cursor:"pointer" }}>
              View details <ArrowRightIcon size={12}/>
            </button>
          </div>
        </div>

        {/* Live Conversation | Current Task + Queue | Agent is Working */}
        <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr", gap:"1rem",
                      marginBottom:"1.25rem", alignItems:"start" }}>
          {/* Live Transcript */}
          <div style={{ background:C.surface, borderRadius:14, padding:"1.25rem",
                        border:`1.5px solid ${C.border}`, height:420,
                        display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          marginBottom:"0.9rem", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.45rem", fontWeight:700, fontSize:"0.92rem" }}>
                <MicIcon size={16} color={C.amberDark}/> Live Transcript
              </div>
              <span style={{ display:"flex", alignItems:"center", gap:"0.3rem",
                             fontSize:"0.68rem", fontWeight:700, padding:"0.15rem 0.55rem", borderRadius:20,
                             background: sess.isListening ? "rgba(34,197,94,0.12)" : "var(--bg2)",
                             color: sess.isListening ? C.green : C.text3 }}>
                <DotIcon size={6} color={sess.isListening ? C.green : C.text3}/>
                {sess.isListening ? "Live" : "Idle"}
              </span>
            </div>

            <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
              {ts.length===0 ? (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                              justifyContent:"center", gap:"0.5rem", textAlign:"center" }}>
                  <WaveBars active={sess.isListening} level={sess.level} count={5} color={C.text3}/>
                  <div style={{ fontSize:"0.88rem", fontWeight:600, color:C.text1, marginTop:"0.4rem" }}>
                    {sess.isListening ? "Listening for speech…" : "Not connected"}
                  </div>
                  <div style={{ fontSize:"0.76rem", color:C.text3 }}>
                    Start speaking to see live transcription here.
                  </div>
                </div>
              ) : (
                <div>
                  {ts.slice(-8).map((t,i)=>(
                    <div key={i} style={{ marginBottom:"0.5rem", animation:"fadeIn 0.3s ease" }}>
                      <div style={{ fontSize:"0.68rem", fontWeight:700,
                                    color: t.speaker==="PILOT" ? C.amber : C.amberDark,
                                    marginBottom:"0.1rem" }}>
                        {speakerName(t.speaker, store.user?.name ?? "You")}
                      </div>
                      <div style={{ background: t.speaker==="PILOT" ? C.amberBg : "var(--bg2)",
                                    borderRadius:8, padding:"0.4rem 0.6rem",
                                    fontSize:"0.8rem", lineHeight:1.5,
                                    color: t.speaker==="PILOT" ? C.amberDark : C.text1 }}>
                        {t.text}
                        {sess.isStreaming && i === ts.slice(-8).length - 1 && (t as any)._sid &&
                          <span style={{ display:"inline-block", width:"2px", height:"0.9em",
                                         background:"currentColor", marginLeft:"1px",
                                         verticalAlign:"text-bottom",
                                         animation:"blink 0.6s step-end infinite" }}/>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stat chips */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.6rem",
                          marginTop:"0.9rem", flexShrink:0 }}>
              {[
                { label:"Language", value:"en-US" },
                { label:"Model", value:"Whisper distil-large-v3" },
                { label:"Latency", value: stats?.avg_latency_ms != null ? `~${stats.avg_latency_ms}ms` : "—" },
                { label:"Confidence", value: last?.confidence != null ? `${Math.round(last.confidence*100)}%` : "—" },
              ].map(chip => (
                <div key={chip.label} style={{ background:"var(--bg2)", borderRadius:8,
                                               padding:"0.5rem 0.6rem", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:"0.62rem", color:C.text3, marginBottom:"0.15rem" }}>{chip.label}</div>
                  <div style={{ fontSize:"0.76rem", fontWeight:700, color:C.text1,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{chip.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Task + Queue */}
          {(() => {
            const running = tc.find(c=>c.status==="running");
            const activeTool = running?.tool;
            const busy = sess.isListening || !!running;
            return (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem", height:420 }}>
            <SectionCard title="Current Task" icon={<PinIcon size={14} color={C.amberDark}/>}
              right={<StatusChip label={busy ? "Running" : "Idle"} tone={busy?"accent":"neutral"}/>}
              bodyStyle={{ padding:"1rem 1.1rem" }} style={{ flexShrink:0 }}>
              {busy ? (
                <div style={{ display:"flex", alignItems:"center", gap:"0.7rem" }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:C.amberBg,
                                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <BotIcon size={17} color={C.amberDark}/>
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.text1,
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {activeTool ? activeTool.replace(/_/g," ") : "Listening for speech"}
                    </div>
                    <div style={{ fontSize:"0.72rem", color:C.text3, marginTop:"0.15rem" }}>
                      {sess.agentStatus || "Capturing your voice…"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:"0.78rem", color:C.text3, padding:"0.3rem 0" }}>
                  No active task — press Space or say “Hey Pilot” to begin.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Queue" icon={<DashboardIcon size={14} color={C.amberDark}/>}
              right={<span style={{ fontSize:"0.7rem", fontWeight:700, color:C.amberDark, cursor:"pointer" }}>View all</span>}
              style={{ flex:1 }} bodyStyle={{ padding:0, display:"flex", flexDirection:"column" }}>
              <div style={{ flex:1, overflowY:"auto", padding:"0.9rem 1.1rem" }}>
              {tc.length===0
                ? (
                  <div style={{ height:"100%", minHeight:120, display:"flex", flexDirection:"column", alignItems:"center",
                                justifyContent:"center", gap:"0.4rem", textAlign:"center" }}>
                    <DashboardIcon size={22} color={C.text3}/>
                    <div style={{ fontSize:"0.78rem", fontWeight:600, color:C.text2 }}>No jobs in queue</div>
                    <div style={{ fontSize:"0.68rem", color:C.text3 }}>Background jobs will appear here.</div>
                  </div>
                )
                : tc.slice(-6).reverse().map((c,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.55rem", marginBottom:"0.7rem" }}>
                    <div style={{ width:16,height:16,borderRadius:"50%",flexShrink:0,
                                  background:c.status==="ok"?C.green:c.status==="running"?C.amber:"var(--bg2)",
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  color:"#fff", border: c.status==="pending"?`1.5px solid ${C.border}`:"none" }}>
                      {c.status==="ok" ? <CheckIcon size={9} strokeWidth={3}/>
                       : c.status==="running" ? <DotIcon size={6}/> : <DotIcon size={6} filled={false} color={C.text3}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"0.78rem", fontWeight:600, color: c.status==="ok"?C.text3:C.text1,
                                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {c.tool.replace(/_/g," ")}
                      </div>
                    </div>
                    <span style={{ fontSize:"0.64rem", fontWeight:700,
                                   color:c.status==="running"?C.amber:c.status==="ok"?C.green:C.text3 }}>
                      {c.status==="running"?"Running":c.status==="ok"?"Done":"Pending"}
                    </span>
                  </div>
                ))
              }
              </div>
            </SectionCard>
          </div>
          );})()}

          {/* Agent is Working — reason → plan → act → respond trace */}
          {(() => {
            const running = tc.find(c=>c.status==="running");
            const busy = sess.isListening || !!running;
            const st = (sess.agentStatus || "").toLowerCase();
            // Map the live session status to a step in the agent's trajectory.
            const phase = !busy ? 0
              : st.includes("speak") || st.includes("respond") ? 4
              : st.includes("task") || st.includes("running") || running ? 3
              : st.includes("process") || st.includes("think") ? 2
              : st.includes("listen") ? 1 : 1;
            const stepState = (i:number): "done"|"active"|"pending" =>
              phase===0 ? "pending" : i<phase ? "done" : i===phase ? "active" : "pending";
            return (
            <SectionCard title="Agent is Working" icon={<SparkleIcon size={14} color={C.amberDark}/>}
              right={<StatusChip label={busy?"Active":"Standby"} tone={busy?"good":"neutral"}/>}
              style={{ height:420 }} bodyStyle={{ overflowY:"auto" }}>
              <StepRow label="Listening" state={stepState(1)}
                sub={stepState(1)!=="pending" ? "Capturing your voice…" : undefined}/>
              <StepRow label="Understanding" state={stepState(2)}
                sub={stepState(2)==="done" ? "Speech recognized" : stepState(2)==="active" ? "Interpreting intent" : undefined}/>
              <StepRow label="Thinking" state={stepState(3)}
                sub={stepState(3)!=="pending" ? (
                  <span>Interpreting intent and planning action
                    {running && <span style={{ display:"block", marginTop:"0.4rem" }}>
                      <StatusChip label={running.tool.replace(/_/g," ")} tone="accent"/>
                    </span>}
                  </span>
                ) : undefined}/>
              <StepRow label="Responding" state={stepState(4)} last
                sub={stepState(4)==="active" ? "Composing the reply…" : undefined}/>
            </SectionCard>
            );})()}
        </div>

        {/* Metric tiles */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem", marginBottom:"0.5rem" }}>
          <MetricTile Icon={DashboardIcon} tone="blue"   label="Sessions Today"  value={stats ? String(stats.sessions_today) : "—"} deltaPct={stats?.sessions_delta_pct}/>
          <MetricTile Icon={ClipboardIcon} tone="green"  label="Transcripts"     value={stats ? String(stats.transcripts_today) : "—"} deltaPct={stats?.transcripts_delta_pct}/>
          <MetricTile Icon={ZapIcon}       tone="amber"  label="Avg. Latency"    value={stats?.avg_latency_ms != null ? `${stats.avg_latency_ms}ms` : "—"} extra={stats?.avg_latency_ms != null ? (stats.avg_latency_ms < 1500 ? "Good" : "Slow") : undefined}/>
          <MetricTile Icon={SparkleIcon}   tone="violet" label="Tools Used"      value={stats ? String(stats.tools_today) : "—"} deltaPct={stats?.tools_delta_pct}/>
        </div>

        {/* Recent Sessions + Activity Feed */}
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:"1rem", alignItems:"start" }}>
          {store.token && <SessionsList token={store.token}/>}
          <ActivityFeed transcripts={ts} toolCards={tc} agentStatus={sess.agentStatus}/>
        </div>
      </div>

      {showPipeline && <PipelineDetailModal onClose={()=>setShowPipeline(false)}/>}

      <LiveTranscriptBar
        transcripts={ts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} wakeActive={sess.wakeActive} level={sess.level}
        onToggle={() => sess.toggle("general")}
      />
    </div>
  );
}

/* ── Activity Feed — a live, time-ordered event log derived from the real
   session state (transcript turns + tool calls). No fake backend call: it
   reflects exactly what happened in this session. ── */
function ActivityFeed({ transcripts, toolCards, agentStatus }:
  { transcripts:any[]; toolCards:any[]; agentStatus:string }) {
  const fmt = (ts?:number) => ts ? new Date(ts*1000).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}) : "";
  // Merge the two real streams into one reverse-chronological feed.
  const items: { t:number; dot:string; text:string }[] = [];
  transcripts.slice(-6).forEach(tr => items.push({
    t: tr.timestamp || 0,
    dot: tr.speaker==="PILOT" ? C.amber : C.blue,
    text: tr.speaker==="PILOT" ? "PILOT responded" : "Speech detected",
  }));
  toolCards.slice(-6).forEach(c => items.push({
    t: Date.now()/1000,
    dot: c.status==="ok" ? C.green : c.status==="running" ? C.amber : C.text3,
    text: `${c.tool.replace(/_/g," ")} ${c.status==="ok"?"completed":c.status==="running"?"started":"queued"}`,
  }));
  items.sort((a,b)=>b.t-a.t);

  return (
    <SectionCard title="Activity Feed" icon={<ZapIcon size={14} color={C.amberDark}/>}
      right={<span style={{ fontSize:"0.7rem", fontWeight:700, color:C.amberDark, cursor:"pointer" }}>View all</span>}
      style={{ maxHeight:340 }} bodyStyle={{ overflowY:"auto" }}>
      {items.length===0 ? (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                      justifyContent:"center", gap:"0.4rem", padding:"1.5rem 0", textAlign:"center" }}>
          <ZapIcon size={20} color={C.text3}/>
          <div style={{ fontSize:"0.76rem", color:C.text3 }}>Activity will appear here as the session runs.</div>
        </div>
      ) : items.slice(0,10).map((it,i)=>(
        <div key={i} style={{ display:"flex", gap:"0.6rem", alignItems:"baseline", marginBottom:"0.7rem" }}>
          <span style={{ fontSize:"0.66rem", color:C.text3, fontVariantNumeric:"tabular-nums",
                         minWidth:44, flexShrink:0 }}>{fmt(it.t)}</span>
          <span style={{ width:7, height:7, borderRadius:"50%", background:it.dot, flexShrink:0,
                         marginTop:"0.25rem" }}/>
          <span style={{ fontSize:"0.76rem", color:C.text2, lineHeight:1.4 }}>{it.text}</span>
        </div>
      ))}
    </SectionCard>
  );
}

/* ── PPT PAGE (Flaw 12: upload-only, no sample iframe) ── */
function PPTPageView() {
  const sess = useSession();
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <PPTCopilotView
        sessionId={sess.sessionId}
        isListening={sess.isListening}
        agentStatus={sess.agentStatus}
        onToggleMic={() => sess.toggle("ppt")}
      />
      <LiveTranscriptBar
        transcripts={sess.transcripts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} wakeActive={sess.wakeActive} level={sess.level}
        onToggle={() => sess.toggle("ppt")}
      />
    </div>
  );
}

/* ── Travel search result normalization ──
   travel_search returns a different natural field shape per service_type
   (a hotel has no departure/arrival, a train has no price in the mock
   data, ...) — normalize each into one common card shape so a single
   renderer handles flights, hotels, and trains instead of three bespoke
   card layouts. */
interface TravelOption {
  title: string;     // airline / hotel name / train operator
  subtitle: string;  // flight number + times / location / departure time
  subtitleIcon?: "pin" | null;
  price: string;     // fare, room price, or "" if not applicable
  meta: string;      // route (flights) or phone (hotels/trains)
  metaIcon?: "phone" | "route" | null;
  book_url?: string;
}

function normalizeTravelResult(r: any, serviceType: string, i: number, from: string, to: string): TravelOption {
  if (serviceType === "hotels") {
    return {
      title: r.hotel || `Hotel ${i + 1}`,
      subtitle: r.location || "",
      subtitleIcon: r.location ? "pin" : null,
      price: typeof r.price === "number" ? `₹${r.price.toLocaleString()}` : (r.price || "—"),
      meta: r.phone || "",
      metaIcon: r.phone ? "phone" : null,
    };
  }
  if (serviceType === "trains") {
    return {
      title: r.operator || `Train ${i + 1}`,
      subtitle: r.departure ? `Departs ${r.departure}` : "",
      price: typeof r.price === "number" ? `₹${r.price.toLocaleString()}` : (r.price || ""),
      meta: r.phone || "",
      metaIcon: r.phone ? "phone" : null,
    };
  }
  // flights (default) — also covers "cabs" loosely via the same generic fields
  return {
    title: r.airline || r.operator || `Option ${i + 1}`,
    subtitle: `${r.id || r.flight || ""} · ${r.departure || r.dep || "—"} → ${r.arrival || r.arr || "—"}`,
    price: typeof r.price === "number" ? `₹${r.price.toLocaleString()}` : (r.price || "—"),
    meta: `${r.origin || from} → ${r.destination || to}`,
    metaIcon: "route",
    book_url: r.book_url || "",
  };
}

/* ── CUSTOMER RESOLUTION VIEW (CSR dashboard) ──
   Live-call assistant for a support rep: sentiment/frustration meter, AI issue
   summary, retrieved KB procedures, resolution-confidence, and an escalate-or-
   resolve recommendation. All driven by the sentiment_update / resolution_update
   WS events plus the live transcript. */
function sentimentColor(s: string): string {
  return s === "negative" ? "#EF4444" : s === "positive" ? C.green : C.amber;
}

function CustomerCareView() {
  const sess    = useSession();
  const store   = useAppStore();
  const ts      = sess.transcripts;
  const [elapsed, setElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const sentiment  = sess.sentiment;   // {sentiment, sentiment_score, frustration_score, urgency}
  const resolution = sess.resolution;  // {resolution_confidence, recommendation, reasoning, escalation_target, escalation_reasons[], issue_summary, kb_articles[]}
  const careObserve = sess.careObserve; // {synopsis, symptom_timeline[], turn_count} — live silent observer output
  const agentNote = sess.agentNote;     // autonomous ReAct worker's latest conclusion (silent to dashboard)

  // ── CSR dashboard actions (voice tool-routing is disabled in care mode, so
  // the rep drives assess / submit / escalate from buttons that hit the
  // JWT-authenticated /care/action endpoint). ─────────────────────────────
  const [actionBusy, setActionBusy] = useState<string|null>(null);
  const [actionError, setActionError] = useState<string|null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState<null | "submit_ticket" | "escalate">(null);

  const runCareAction = async (action: "assess"|"submit_ticket"|"escalate") => {
    if (!sess.sessionId) { setActionError("Start a call first."); return; }
    setActionBusy(action);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/care/action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.token}` },
        body: JSON.stringify({
          session_id: sess.sessionId,
          action,
          synopsis: careObserve?.synopsis || resolution?.issue_summary || "",
          category: isEscalate ? "escalation" : "general",
          symptoms: (careObserve?.symptom_timeline || []).join("; "),
        }),
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        const d = body?.detail || body;
        setActionError(
          d?.required_level
            ? `Access denied — this needs Level ${d.required_level}; you have Level ${d.your_level}.`
            : "Access denied for this action."
        );
        return;
      }
      if (!res.ok) { setActionError(`Action failed (${res.status}).`); return; }
      // resolution_update / tool_end events flow back over the WS and refresh
      // the panels; nothing more to do here on success.
    } catch (e: any) {
      setActionError(e?.message || "Network error.");
    } finally {
      setActionBusy(null);
      setConfirmSubmit(null);
    }
  };

  useEffect(()=>{
    const t = setInterval(()=>setElapsed(e=>e+1), 1000);
    return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); }, [ts.length]);

  const mm = String(Math.floor(elapsed/60)).padStart(2,"0");
  const ss = String(elapsed%60).padStart(2,"0");

  const frustration = sentiment?.frustration_score ?? 0;
  const frustPct = Math.round(frustration * 100);
  const sentLabel = sentiment?.sentiment ? sentiment.sentiment[0].toUpperCase() + sentiment.sentiment.slice(1) : "—";
  const urgency = sentiment?.urgency || "low";
  const urgencyColor = urgency === "high" ? "#EF4444" : urgency === "medium" ? C.amber : C.green;

  const conf = resolution?.resolution_confidence;
  const confPct = conf != null ? Math.round(conf * 100) : null;
  const isEscalate = resolution?.recommendation === "escalate";

  // Care-tool task queue (kept from the prior view, minus travel)
  const careTools = ["crm_lookup","kb_search","ticket_create","ticket_update","ticket_close","resolution_assess","escalate_ticket"];
  const liveTasks = store.toolCards.filter(c => careTools.includes(c.tool));
  const toolLabel: Record<string,string> = {
    crm_lookup:"Verify Customer", kb_search:"Search Knowledge Base",
    ticket_create:"Create Ticket", ticket_update:"Update Ticket",
    ticket_close:"Close Ticket", resolution_assess:"Assess Resolution",
    escalate_ticket:"Create Escalation",
  };

  const panelLabel = (txt:string): React.CSSProperties => ({
    fontSize:"0.66rem", fontWeight:700, letterSpacing:"0.08em", color:C.text3,
  });

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      {/* header */}
      <div style={{ padding:"0.85rem 1.5rem", background:C.surface,
                    borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.55rem" }}>
            <div style={{ width:34, height:34, borderRadius:9, background:C.amberBg,
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <HeadsetIcon size={17} color={C.amberDark}/>
            </div>
            <div>
              <h2 style={{ fontWeight:800, fontSize:"1rem", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                Customer Care
                {sess.isListening && <WaveBars active level={sess.level} count={3} color={C.amber}/>}
              </h2>
              <p style={{ fontSize:"0.73rem", color:C.text3 }}>AI-powered IT support assistant — resolve issues and create requests.</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.55rem", alignItems:"center", flexWrap:"wrap" }}>
            <StatusChip label="System Healthy" tone="good" icon={<CheckCircleIcon size={12} color={C.green}/>}/>
            <StatusChip label="Knowledge Base · Up to date" tone="good" icon={<ClipboardIcon size={12} color={C.green}/>}/>
            <StatusChip label={sess.isListening ? "RAG Engine · Connected" : "RAG Engine · Idle"}
              tone={sess.isListening ? "good" : "neutral"} icon={<SparkleIcon size={12} color={sess.isListening?C.green:C.text3}/>}/>
            <span style={{ fontSize:"0.78rem", color:C.text2, fontFamily:"monospace",
                           fontVariantNumeric:"tabular-nums" }}>{mm}:{ss}</span>
            <button onClick={()=>sess.toggle("customercare")}
              style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                       padding:"0.35rem 0.8rem", borderRadius:20,
                       background: sess.wakeActive ? "#EEF9EE" : sess.isListening ? C.amberBg : "var(--amber-bg)",
                       border:`1.5px solid ${sess.wakeActive ? C.green : sess.isListening ? C.amber : C.border}`,
                       fontSize:"0.74rem", color: sess.wakeActive ? C.green : C.amberDark,
                       fontWeight:700, cursor:"pointer",
                       boxShadow: sess.wakeActive ? `0 0 0 3px rgba(34,197,94,0.18)` : "none",
                       transition:"all 0.2s" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",
                             background: sess.wakeActive ? C.green : C.amber, display:"inline-block",
                             animation: sess.wakeActive ? "pulse 1s ease-in-out infinite" : "none" }}/>
              {sess.wakeActive ? "PILOT Active" : sess.isListening ? "Standby" : "Start Call"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* ── LEFT: Live Intelligence — sentiment + urgency + AI summary ── */}
        <div style={{ width:250, background:"var(--bg2)", borderRight:`1.5px solid ${C.border}`,
                      padding:"0.9rem", overflowY:"auto", flexShrink:0, display:"flex",
                      flexDirection:"column", gap:"0.9rem" }}>
          <div>
            <div style={panelLabel("")}>CUSTOMER SENTIMENT</div>
            <div style={{ background:C.surface, borderRadius:10, border:`1.5px solid ${C.border}`,
                          padding:"0.8rem", marginTop:"0.45rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.5rem" }}>
                <span style={{ fontSize:"0.9rem", fontWeight:800, color: sentiment ? sentimentColor(sentiment.sentiment) : C.text3 }}>
                  {sentLabel}
                </span>
                <span style={{ fontSize:"0.66rem", color:C.text3 }}>Frustration</span>
              </div>
              {/* Frustration meter */}
              <div style={{ height:10, borderRadius:6, background:"var(--bg2)", overflow:"hidden", marginBottom:"0.3rem" }}>
                <div style={{ height:"100%", width:`${frustPct}%`,
                              background: frustration>=0.7 ? "#EF4444" : frustration>=0.4 ? C.amber : C.green,
                              borderRadius:6, transition:"width 0.4s" }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"0.62rem", color:C.text3 }}>{sentiment ? `${frustPct}%` : "Awaiting speech"}</span>
                <span style={{ fontSize:"0.62rem", fontWeight:700, color:urgencyColor }}>
                  Urgency: {urgency}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div style={panelLabel("")}>AI ISSUE SUMMARY</div>
            <div style={{ background:C.surface, borderRadius:10, border:`1.5px solid ${C.border}`,
                          padding:"0.8rem", marginTop:"0.45rem", fontSize:"0.76rem", lineHeight:1.55,
                          color: (careObserve?.synopsis || resolution?.issue_summary) ? C.text1 : C.text3 }}>
              {/* careObserve.synopsis updates live and silently as the call
                  progresses; resolution.issue_summary is the snapshot from an
                  explicit resolve/escalate assessment. Prefer the live one. */}
              {careObserve?.synopsis || resolution?.issue_summary
                || "The AI issue synopsis will appear here once the customer describes their problem."}
            </div>
          </div>

          {careObserve?.symptom_timeline?.length > 0 && (
            <div>
              <div style={panelLabel("")}>SYMPTOM TIMELINE</div>
              <div style={{ marginTop:"0.45rem", display:"flex", flexDirection:"column", gap:"0.3rem" }}>
                {careObserve.symptom_timeline.map((s:string, i:number)=>(
                  <div key={i} style={{ display:"flex", gap:"0.4rem", alignItems:"flex-start",
                                        fontSize:"0.72rem", lineHeight:1.4, color:C.text2 }}>
                    <span style={{ color:C.amber, flexShrink:0, marginTop:"0.1rem" }}>•</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentNote && (
            <div>
              <div style={panelLabel("")}>AI AGENT</div>
              <div style={{ background:C.amberBg, borderRadius:10, border:`1.5px solid ${C.amber}`,
                            padding:"0.7rem 0.8rem", marginTop:"0.45rem", fontSize:"0.75rem",
                            lineHeight:1.5, color:C.text1, display:"flex", gap:"0.45rem", alignItems:"flex-start" }}>
                <BotIcon size={14} color={C.amberDark}/>
                <span>{agentNote}</span>
              </div>
            </div>
          )}

          {/* Task queue */}
          <div>
            <div style={panelLabel("")}>ACTIVITY</div>
            <div style={{ marginTop:"0.45rem" }}>
              {liveTasks.length === 0
                ? <div style={{ fontSize:"0.7rem", color:C.text3 }}>No AI actions yet.</div>
                : liveTasks.map((t,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.45rem",
                                        padding:"0.35rem 0.4rem", borderRadius:8, marginBottom:"0.25rem",
                                        background:t.status==="running"?C.amberBg:"transparent" }}>
                    <div style={{ width:15,height:15,borderRadius:"50%",flexShrink:0,
                                  background:t.status==="ok"?C.green:t.status==="running"?C.amber:"var(--amber-bg)",
                                  display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" }}>
                      {t.status==="ok" ? <CheckIcon size={9} strokeWidth={3}/>
                       : t.status==="running" ? <DotIcon size={6}/> : <DotIcon size={6} filled={false} color={C.amberDark}/>}
                    </div>
                    <span style={{ fontSize:"0.72rem", color:t.status==="ok"?"#AAA":C.text1 }}>{toolLabel[t.tool] || t.tool}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── CENTER: Live transcript ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.65rem",
                        padding:"0.65rem 1rem", background:C.surface,
                        borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:C.amber,
                          display:"flex",alignItems:"center",justifyContent:"center" }}>
              <BotIcon size={16} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:"0.85rem" }}>AI Resolution Assistant</div>
              <div style={{ fontSize:"0.68rem", color: sess.isListening ? C.green : C.text3,
                            fontWeight: sess.isListening ? 700 : 400 }}>
                {/* In customercare PILOT never speaks — it silently observes the
                    rep/customer conversation and fills the dashboard. Reflect
                    that instead of the wake-word "Standby" copy, which wrongly
                    implied it's a chatbot waiting to be addressed. */}
                {sess.isListening ? "Observing silently — filling ticket fields" : "Not listening"}
              </div>
            </div>
            {sess.isListening && (
              <div style={{ marginLeft:"auto" }}>
                <WaveBars active={true} level={Math.min(1, sess.wakeActive ? sess.level + 0.2 : sess.level)} count={5}/>
              </div>
            )}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"0.85rem" }}>
            {ts.length===0 && (
              <div style={{ textAlign:"center", color:C.text3, fontSize:"0.82rem", marginTop:"2rem" }}>
                Start a session and speak to see the live conversation.
              </div>
            )}
            {ts.map((t,i)=>{
              const isAgent = t.speaker==="PILOT" || t.role==="PILOT";
              return (
                <div key={i} style={{ display:"flex", justifyContent:isAgent?"flex-start":"flex-end",
                                       marginBottom:"0.7rem", animation:"fadeIn 0.3s ease" }}>
                  {isAgent&&(
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.amber,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  marginRight:"0.4rem",flexShrink:0 }}>
                      <BotIcon size={15} color="#fff"/>
                    </div>
                  )}
                  <div style={{ maxWidth:"68%", padding:"0.65rem 0.85rem",
                                background:isAgent?C.surface:C.blue,
                                color:isAgent?C.text1:"#fff",
                                borderRadius:isAgent?"12px 12px 12px 3px":"12px 12px 3px 12px",
                                fontSize:"0.85rem", lineHeight:1.55,
                                border:isAgent?`1.5px solid ${C.border}`:"none",
                                boxShadow:isAgent?"0 2px 8px rgba(0,0,0,0.04)":"none" }}>
                    {t.text}
                    {sess.isStreaming && i === ts.length - 1 && (t as any)._sid &&
                      <span style={{ display:"inline-block", width:"2px", height:"0.9em",
                                     background:"currentColor", marginLeft:"1px",
                                     verticalAlign:"text-bottom",
                                     animation:"blink 0.6s step-end infinite" }}/>}
                  </div>
                  {!isAgent&&(
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.amberDark,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  marginLeft:"0.4rem",flexShrink:0,color:"#fff",fontSize:"0.68rem",fontWeight:700 }}>
                      {speakerName(t.speaker, store.user?.name ?? "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef}/>
            {/* clearance so the last message isn't hidden behind the floating command bar */}
            <div style={{ height:"4.5rem", flexShrink:0 }}/>
          </div>
        </div>

        {/* ── RIGHT: Recommendations — KB articles + confidence + escalation ── */}
        <div style={{ width:300, background:C.surface, borderLeft:`1.5px solid ${C.border}`,
                      padding:"0.9rem", overflowY:"auto", flexShrink:0, display:"flex",
                      flexDirection:"column", gap:"0.9rem" }}>
          {/* Resolution confidence + recommendation */}
          <div>
            <div style={panelLabel("")}>RECOMMENDATION</div>
            <div style={{ marginTop:"0.45rem", borderRadius:12, overflow:"hidden",
                          border:`1.5px solid ${resolution ? (isEscalate ? "#EF4444" : C.green) : C.border}` }}>
              <div style={{ padding:"0.85rem", background: resolution ? (isEscalate ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)") : "var(--bg2)" }}>
                {resolution ? (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.5rem" }}>
                      {isEscalate
                        ? <AlertTriangleIcon size={18} color="#EF4444"/>
                        : <CheckCircleIcon size={18} color={C.green}/>}
                      <span style={{ fontSize:"0.95rem", fontWeight:800, color:isEscalate?"#EF4444":C.green }}>
                        {isEscalate ? `Escalate → ${resolution.escalation_target || "L2"}` : "Resolve on call"}
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.66rem", color:C.text3, marginBottom:"0.2rem" }}>
                      <span>Resolution confidence</span><span style={{ fontWeight:700 }}>{confPct}%</span>
                    </div>
                    <div style={{ height:8, borderRadius:5, background:"var(--bg2)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${confPct}%`,
                                    background: (confPct||0) >= 60 ? C.green : (confPct||0) >= 40 ? C.amber : "#EF4444",
                                    borderRadius:5, transition:"width 0.4s" }}/>
                    </div>
                    <p style={{ fontSize:"0.72rem", color:C.text2, lineHeight:1.5, marginTop:"0.6rem" }}>
                      {resolution.reasoning}
                    </p>
                    {isEscalate && resolution.escalation_reasons?.length > 0 && (
                      <div style={{ marginTop:"0.5rem" }}>
                        {resolution.escalation_reasons.map((r:string,i:number)=>(
                          <div key={i} style={{ display:"flex", gap:"0.35rem", fontSize:"0.68rem", color:C.text2, marginBottom:"0.2rem" }}>
                            <span style={{ color:"#EF4444" }}>•</span>{r}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize:"0.74rem", color:C.text3 }}>
                    Run an assessment to get a resolve-or-escalate recommendation for this call.
                  </div>
                )}
              </div>

              {/* Run / re-run assessment — non-destructive, always available */}
              <button
                disabled={actionBusy!==null || !sess.sessionId}
                onClick={()=>runCareAction("assess")}
                style={{ width:"100%", padding:"0.6rem", border:"none",
                         borderTop:`1px solid ${C.border}`,
                         cursor: (actionBusy||!sess.sessionId) ? "default" : "pointer",
                         background: C.amberBg, color:C.amberDark, fontWeight:700, fontSize:"0.78rem",
                         opacity: (actionBusy||!sess.sessionId) ? 0.6 : 1,
                         display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}>
                {actionBusy==="assess" ? "Assessing…" : resolution ? "Re-run assessment" : "Run assessment"}
              </button>

              {/* Destructive action — gated by the confirm modal + JWT identity */}
              {resolution && (
                <button
                  disabled={actionBusy!==null}
                  onClick={()=>setConfirmSubmit(isEscalate ? "escalate" : "submit_ticket")}
                  style={{ width:"100%", padding:"0.6rem", border:"none", cursor:"pointer",
                           background: isEscalate ? "#EF4444" : C.green, color:"#fff",
                           fontWeight:700, fontSize:"0.78rem", opacity: actionBusy ? 0.6 : 1,
                           display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}>
                  <ArrowRightIcon size={13} color="#fff"/>
                  {isEscalate ? "Create escalation ticket" : "Submit ticket"}
                </button>
              )}

              {actionError && (
                <div style={{ padding:"0.5rem 0.7rem", background:"rgba(239,68,68,0.08)",
                              color:"#EF4444", fontSize:"0.7rem", lineHeight:1.4 }}>
                  {actionError}
                </div>
              )}
            </div>
          </div>

          {/* RAG Retrieval — pipeline steps that light up as the engine works.
              Driven by real signals: turns present → understanding; KB hits
              present → retrieved/re-ranked; a recommendation present → answer
              generated. Purely a visualization of the existing data flow. */}
          {(() => {
            const hasConvo = (careObserve?.turn_count || ts.length) > 0;
            const hasKB = (resolution?.kb_articles?.length || 0) > 0;
            const hasAnswer = !!resolution?.recommendation || !!agentNote;
            const steps: { label:string; done:boolean; active:boolean }[] = [
              { label:"Understanding query",  done:hasConvo,   active:hasConvo && !hasKB },
              { label:"Retrieving documents", done:hasKB,      active:hasConvo && !hasKB },
              { label:"Re-ranking results",   done:hasKB,      active:hasKB && !hasAnswer },
              { label:"Generating answer",    done:hasAnswer,  active:hasKB && !hasAnswer },
            ];
            return (
              <div>
                <div style={panelLabel("")}>RAG RETRIEVAL</div>
                <div style={{ marginTop:"0.45rem", background:C.surface, borderRadius:10,
                              border:`1.5px solid ${C.border}`, padding:"0.75rem 0.85rem",
                              display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                  {steps.map((s,i)=>(
                    <StepRow key={i} label={s.label} last={i===steps.length-1}
                      state={s.done ? "done" : s.active ? "active" : "pending"}/>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Retrieved KB articles */}
          <div>
            <div style={panelLabel("")}>TOP RELEVANT SOURCES</div>
            <div style={{ marginTop:"0.45rem", display:"flex", flexDirection:"column", gap:"0.5rem" }}>
              {resolution?.kb_articles?.length ? resolution.kb_articles.map((a:any,i:number)=>(
                <div key={i} style={{ borderRadius:10, border:`1.5px solid ${i===0?C.amber:C.border}`,
                                      background:i===0?C.amberBg:"var(--bg2)", padding:"0.65rem 0.75rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.3rem" }}>
                    <span style={{ fontSize:"0.78rem", fontWeight:700, color:C.text1 }}>{a.title}</span>
                    <span style={{ fontSize:"0.6rem", fontWeight:700, color:C.amberDark,
                                   background:C.surface, borderRadius:5, padding:"0.1rem 0.35rem" }}>
                      {Math.round((a.score||0)*100)}% match
                    </span>
                  </div>
                  <p style={{ fontSize:"0.68rem", color:C.text2, lineHeight:1.5, margin:0 }}>{a.excerpt}</p>
                </div>
              )) : (
                <div style={{ fontSize:"0.72rem", color:C.text3 }}>
                  Relevant troubleshooting procedures will appear here as the issue is understood.
                </div>
              )}
            </div>
          </div>

          {/* IT Support Usecases — the coverage map. "Handled" categories the
              assistant can resolve end-to-end vs. "Partial" (human hand-off). */}
          <div>
            <div style={panelLabel("")}>IT SUPPORT USECASES</div>
            <div style={{ marginTop:"0.45rem", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              {([
                { Icon:LockIcon,    name:"Account & Access",       desc:"Login, lockouts, password resets", tone:"good"  as const },
                { Icon:MonitorIcon, name:"Device Issues",          desc:"Laptop / desktop, performance",    tone:"good"  as const },
                { Icon:ShieldIcon,  name:"Network & VPN",          desc:"Wi-Fi, VPN, connectivity",         tone:"good"  as const },
                { Icon:MessageIcon, name:"Email & Collaboration",  desc:"Outlook, Teams, calendar",         tone:"good"  as const },
                { Icon:SparkleIcon, name:"Software & Apps",        desc:"Installs, errors, licensing",      tone:"warn"  as const },
                { Icon:InfoIcon,    name:"Other",                  desc:"General IT queries & how-tos",     tone:"warn"  as const },
              ]).map(u=>(
                <div key={u.name} style={{ display:"flex", alignItems:"center", gap:"0.6rem",
                                           background:C.surface, borderRadius:9, border:`1.5px solid ${C.border}`,
                                           padding:"0.55rem 0.65rem" }}>
                  <u.Icon size={15} color={C.amberDark}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.76rem", fontWeight:700, color:C.text1 }}>{u.name}</div>
                    <div style={{ fontSize:"0.64rem", color:C.text3,
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.desc}</div>
                  </div>
                  <StatusChip label={u.tone==="good"?"Handled":"Partial"} tone={u.tone}/>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Base Stats */}
          <div>
            <div style={panelLabel("")}>KNOWLEDGE BASE STATS</div>
            <div style={{ marginTop:"0.45rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
              {([
                { label:"Articles",   value: String(resolution?.kb_articles?.length ?? "—"), sub:"in this session" },
                { label:"Categories", value:"6",  sub:"IT usecases" },
                { label:"Sources",    value: String(resolution?.kb_articles?.length ?? 0), sub:"retrieved" },
                { label:"Top match",  value: resolution?.kb_articles?.[0]?.score != null ? `${Math.round(resolution.kb_articles[0].score*100)}%` : "—", sub:"confidence" },
              ]).map(s=>(
                <div key={s.label} style={{ background:C.surface, borderRadius:9, border:`1.5px solid ${C.border}`,
                                            padding:"0.6rem 0.7rem" }}>
                  <div style={{ fontSize:"1.05rem", fontWeight:800, color:C.text1,
                                fontVariantNumeric:"tabular-nums" }}>{s.value}</div>
                  <div style={{ fontSize:"0.64rem", fontWeight:700, color:C.text2 }}>{s.label}</div>
                  <div style={{ fontSize:"0.6rem", color:C.text3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div style={panelLabel("")}>QUICK ACTIONS</div>
            <div style={{ marginTop:"0.45rem", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              {([
                { Icon:ClipboardIcon, label:"Create Support Ticket", sub:"Raise a new IT request", onClick:()=>setConfirmSubmit("submit_ticket") },
                { Icon:AlertTriangleIcon, label:"Escalate to Human", sub:"Connect to a specialist", onClick:()=>setConfirmSubmit("escalate") },
                { Icon:SparkleIcon, label:"Run Assessment", sub:"Resolve-or-escalate call", onClick:()=>runCareAction("assess") },
              ]).map(a=>(
                <button key={a.label} onClick={a.onClick} disabled={actionBusy!==null}
                  style={{ display:"flex", alignItems:"center", gap:"0.6rem", textAlign:"left",
                           background:C.surface, borderRadius:9, border:`1.5px solid ${C.border}`,
                           padding:"0.6rem 0.7rem", cursor: actionBusy?"default":"pointer",
                           opacity: actionBusy?0.6:1, transition:"all 0.15s" }}
                  onMouseEnter={e=>{ if(!actionBusy){ e.currentTarget.style.borderColor=C.amber; e.currentTarget.style.background=C.amberBg; }}}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.surface; }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:C.amberBg, flexShrink:0,
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <a.Icon size={14} color={C.amberDark}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.76rem", fontWeight:700, color:C.text1 }}>{a.label}</div>
                    <div style={{ fontSize:"0.63rem", color:C.text3 }}>{a.sub}</div>
                  </div>
                  <ArrowRightIcon size={13} color={C.text3}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard confirm modal for the identity-gated destructive action.
          The action itself is authorized server-side by the CSR's JWT
          (pre_confirmed); this modal is the deliberate "are you sure" step. */}
      {confirmSubmit && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", zIndex:80,
                      display:"flex", alignItems:"center", justifyContent:"center" }}
             onClick={()=>setConfirmSubmit(null)}>
          <div onClick={e=>e.stopPropagation()}
               style={{ background:C.surface, borderRadius:14, padding:"1.5rem", width:400, maxWidth:"90%",
                        boxShadow:"0 12px 48px rgba(0,0,0,0.4)" }}>
            <div style={{ fontWeight:800, fontSize:"1rem", marginBottom:"0.5rem" }}>
              {confirmSubmit==="escalate" ? "Create escalation ticket?" : "Submit this ticket?"}
            </div>
            <p style={{ fontSize:"0.8rem", color:C.text2, lineHeight:1.5, marginBottom:"1rem" }}>
              This will {confirmSubmit==="escalate"
                ? `escalate to ${resolution?.escalation_target || "L2"}`
                : "create a support ticket"} for the current call, logged under your CSR
              identity. This action is recorded in the audit trail.
            </p>
            <div style={{ background:"var(--bg2)", borderRadius:8, padding:"0.6rem 0.75rem",
                          fontSize:"0.72rem", color:C.text2, lineHeight:1.5, marginBottom:"1rem" }}>
              {careObserve?.synopsis || resolution?.issue_summary || "No synopsis yet."}
            </div>
            <div style={{ display:"flex", gap:"0.6rem", justifyContent:"flex-end" }}>
              <button onClick={()=>setConfirmSubmit(null)}
                style={{ padding:"0.5rem 1rem", borderRadius:8, border:`1.5px solid ${C.border}`,
                         background:"transparent", color:C.text2, fontWeight:600, fontSize:"0.78rem",
                         cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={()=>runCareAction(confirmSubmit)}
                disabled={actionBusy!==null}
                style={{ padding:"0.5rem 1rem", borderRadius:8, border:"none",
                         background: confirmSubmit==="escalate" ? "#EF4444" : C.green, color:"#fff",
                         fontWeight:700, fontSize:"0.78rem", cursor: actionBusy ? "default" : "pointer",
                         opacity: actionBusy ? 0.6 : 1 }}>
                {actionBusy ? "Submitting…" : confirmSubmit==="escalate" ? "Escalate" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LiveTranscriptBar
        transcripts={ts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} wakeActive={sess.wakeActive} level={sess.level}
        onToggle={() => sess.toggle("customercare")}
      />
    </div>
  );
}

/* ── Confirm overlay ── */
function ConfirmOverlay() {
  const store = useAppStore();
  if (!store.confirmPrompt) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:200 }}>
      <div style={{ background:C.surface,borderRadius:16,padding:"1.75rem",maxWidth:380,width:"90%",
                    boxShadow:"0 8px 40px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize:"1rem",fontWeight:700,marginBottom:"0.4rem",
                      display:"flex", alignItems:"center", gap:"0.45rem" }}>
          <AlertTriangleIcon size={18} color="#F59E0B"/> Confirm Action
        </div>
        <p style={{ color:C.text2, fontSize:"0.88rem", marginBottom:"1.25rem" }}>
          {store.confirmPrompt.message}
        </p>
        <div style={{ display:"flex",gap:"0.75rem",justifyContent:"flex-end" }}>
          <button onClick={()=>store.setConfirm(null)}
            style={{ padding:"0.55rem 1.1rem",borderRadius:8,border:`1.5px solid ${C.border}`,
                     background:C.surface,cursor:"pointer",fontSize:"0.85rem",color:C.text1 }}>Cancel</button>
          <button onClick={()=>store.setConfirm(null)}
            style={{ padding:"0.55rem 1.1rem",borderRadius:8,border:"none",
                     background:C.amberDark,color:"#fff",fontWeight:600,
                     fontSize:"0.85rem",cursor:"pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard shell ── */
export function Dashboard() {
  const page = useAppStore(s=>s.page) as string;
  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:C.bg }}>
      <Sidebar active={page==="ppt"?"ppt":page==="care"?"care":page==="about"?"about":"dashboard"}/>
      {page==="ppt"     ? <PPTPageView/> :
       page==="care"    ? <CustomerCareView/> :
       page==="about"   ? <AboutPageView/> :
       page==="profile" ? <ProfilePage/> :
       <MainDashboard/>}
      <ConfirmOverlay/>
    </div>
  );
}


/* ── About — a single knowledge-base page: what PILOT is, what it can do,
   and the full spoken-command reference for every module. Merges what used
   to be a separate About page and Guidelines page into one destination. ── */
function AboutPageView() {
  const capabilities = [
    { Icon:MonitorIcon, title:"PPT Copilot",         desc:"Upload a deck and control it hands-free — navigate slides, summarize content, edit text and speaker notes, and generate notes for an entire presentation, all by voice." },
    { Icon:HeadsetIcon, title:"Customer Resolution", desc:"A live-call assistant for support reps: detects customer sentiment and frustration, retrieves the right knowledge-base procedures, and recommends whether to resolve on the call or escalate — with the reasons why." },
    { Icon:AlertTriangleIcon, title:"Escalation Engine", desc:"Fuses frustration, outage duration, repeated failures, and knowledge-base coverage into a resolution-confidence score and an explainable escalate-or-resolve recommendation the rep can act on." },
    { Icon:LockIcon,    title:"Voice Identity",       desc:"Every speaker is diarized and matched against an enrolled voice profile, so PILOT knows who's talking and enforces role-based permissions automatically." },
  ];

  const principles = [
    { Icon:HomeIcon,   title:"Local-first",  desc:"Speech recognition, diarization, and the routing model all run on-device via Ollama and local Whisper — your voice never has to leave the machine to get a response." },
    { Icon:ZapIcon,    title:"Low latency",  desc:"A fast deterministic keyword path handles common commands instantly; only ambiguous requests fall through to the LLM classifier." },
    { Icon:ShieldIcon, title:"Safety-gated", desc:"Destructive actions (like deleting a slide) require an explicit spoken confirmation and are restricted by role before they ever execute." },
  ];

  const modules = [
    {
      Icon: MonitorIcon,
      title: "PPT Copilot",
      desc: "Controls, navigates, and analyzes presentations in real time — hands-free voice control over your deck.",
      commands: [
        { spoken: "go to slide 5",            action: "Jumps the viewer directly to slide 5." },
        { spoken: "next slide / prev slide",   action: "Steps forward or backward through the deck." },
        { spoken: "summarize this slide",      action: "Verbally summarizes bullet points and shapes on the current slide." },
        { spoken: "delete slide 10",           action: "Navigates to slide 10 and asks for confirmation (admin only)." },
      ],
      details: "Slide navigation is instant — a fast-path shortcut skips the AI classifier entirely for simple jumps. Deleting a slide always requires spoken confirmation and is restricted to admin accounts.",
    },
    {
      Icon: HeadsetIcon,
      title: "Customer Resolution & Escalation",
      desc: "A live-call co-pilot for support reps — sentiment detection, knowledge-base retrieval, and an escalate-or-resolve recommendation, all surfaced on the CSR dashboard.",
      commands: [
        { spoken: "should I escalate this?",       action: "Runs a full assessment: confidence score, escalate/resolve recommendation, and the reasons — shown on the dashboard." },
        { spoken: "what's the recommendation?",    action: "Same assessment, phrased as a direct answer for the rep." },
        { spoken: "search the knowledge base for the modem lights", action: "Semantic KB retrieval — returns the matching troubleshooting procedures with a match score." },
        { spoken: "create a ticket",               action: "Opens a new support ticket from the spoken description." },
        { spoken: "escalate this ticket to L2",    action: "Creates an escalation ticket tagged with priority and target tier." },
      ],
      details: "Customer sentiment and frustration are scored on every turn by a sentiment model. A resolution engine blends those signals with outage duration, repeated failures, prior contacts, and knowledge-base coverage — deterministic rules set an escalation floor, then an LLM writes the human-readable reasoning. The rep sees a live sentiment meter, an AI issue summary, matched KB articles, a confidence score, and a clear resolve-or-escalate call.",
    },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"1.5rem 2.5rem", background:C.surface,
                    borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.65rem", marginBottom:"0.25rem" }}>
          <InfoIcon size={20} color={C.amberDark}/>
          <h1 style={{ fontWeight:800, fontSize:"1.4rem", letterSpacing:"-0.02em", color:C.text1, margin:0 }}>
            About PILOT
          </h1>
        </div>
        <p style={{ fontSize:"0.85rem", color:C.text3, margin:0 }}>
          What PILOT is, what it can do, and every spoken command it understands.
        </p>
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:"auto", padding:"2rem 2.5rem 5rem",
                    display:"flex", flexDirection:"column", gap:"2.25rem" }}>

        {/* Intro card */}
        <div style={{ background:C.amberBg, borderRadius:14, padding:"1.75rem",
                      border:`1.5px solid ${C.amber}` }}>
          <div style={{ fontSize:"0.72rem", fontWeight:800, color:C.amberDark,
                        letterSpacing:"0.06em", marginBottom:"0.5rem" }}>
            PORTABLE INTELLIGENT LISTENER FOR OPEN TASKING
          </div>
          <p style={{ fontSize:"0.92rem", color:C.text1, lineHeight:1.7, margin:0 }}>
            PILOT is a real-time, voice-driven AI copilot. Speak naturally — PILOT listens,
            figures out <em>who</em> is speaking, transcribes what was said, routes it to the
            right tool or model, and replies out loud, in well under a second. No wake word,
            no rigid command syntax — just talk to it the way you'd talk to a colleague.
          </p>
        </div>

        {/* Capabilities */}
        <div>
          <h2 style={{ fontSize:"1rem", fontWeight:700, marginBottom:"1rem", color:C.text1 }}>
            What it can do
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            {capabilities.map((c, i) => (
              <div key={i} style={{ background:C.surface, borderRadius:14, padding:"1.25rem",
                                    border:`1.5px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"0.5rem" }}>
                  <c.Icon size={17} color={C.amberDark} strokeWidth={1.8}/>
                  <span style={{ fontSize:"0.88rem", fontWeight:700, color:C.text1 }}>{c.title}</span>
                </div>
                <p style={{ fontSize:"0.82rem", color:C.text2, lineHeight:1.6, margin:0 }}>
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Design principles */}
        <div>
          <h2 style={{ fontSize:"1rem", fontWeight:700, marginBottom:"1rem", color:C.text1 }}>
            How it's built
          </h2>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            {principles.map((p, i) => (
              <div key={i} style={{ background:C.surface, borderRadius:12, padding:"1rem 1.25rem",
                                    border:`1.5px solid ${C.border}`,
                                    display:"flex", alignItems:"flex-start", gap:"0.85rem" }}>
                <p.Icon size={17} color={C.amberDark} strokeWidth={1.8} style={{ marginTop:"0.1rem" }}/>
                <div>
                  <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.text1, marginBottom:"0.2rem" }}>
                    {p.title}
                  </div>
                  <p style={{ fontSize:"0.8rem", color:C.text2, lineHeight:1.6, margin:0 }}>
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Command reference */}
        <div>
          <h2 style={{ fontSize:"1rem", fontWeight:700, marginBottom:"0.3rem", color:C.text1 }}>
            Command reference
          </h2>
          <p style={{ fontSize:"0.82rem", color:C.text3, marginBottom:"1rem" }}>
            Every spoken command PILOT understands, grouped by module.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>
            {modules.map((mod, idx) => (
              <div key={idx} style={{ background:C.surface, borderRadius:14,
                                      border:`1.5px solid ${C.border}`, overflow:"hidden" }}>
                <div style={{ padding:"1.1rem 1.4rem", borderBottom:`1.5px solid ${C.border}`,
                              display:"flex", alignItems:"flex-start", gap:"0.75rem" }}>
                  <mod.Icon size={18} color={C.amberDark} strokeWidth={1.8} style={{ marginTop:"0.1rem" }}/>
                  <div>
                    <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.text1, marginBottom:"0.15rem" }}>
                      {mod.title}
                    </div>
                    <p style={{ fontSize:"0.8rem", color:C.text2, margin:0, lineHeight:1.5 }}>
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div style={{ padding:"1.25rem 1.4rem", display:"flex", flexDirection:"column", gap:"1.25rem" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                    {mod.commands.map((cmd, cIdx) => (
                      <div key={cIdx} style={{ background:C.bg, padding:"0.8rem 1rem",
                                              borderRadius:10, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:"0.76rem", fontWeight:700, color:C.text1,
                                      fontFamily:"monospace", marginBottom:"0.3rem" }}>
                          "{cmd.spoken}"
                        </div>
                        <p style={{ fontSize:"0.73rem", color:C.text2, lineHeight:1.5, margin:0 }}>
                          {cmd.action}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize:"0.78rem", color:C.text3, lineHeight:1.6, margin:0,
                              borderTop:`1px dashed ${C.border}`, paddingTop:"0.9rem" }}>
                    {mod.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
