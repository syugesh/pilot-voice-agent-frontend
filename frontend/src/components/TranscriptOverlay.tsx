/**
 * Dashboard shell — Main · PPT · Customer Care
 * Flaw 12: PPT uses upload-only PPTCopilotView (no hardcoded sample)
 * Flaw 14: Session history popup on click
 * Flaw 15: Per-view local transcript state (no cross-page bleed)
 */

import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/SessionStore";
import { PilotWSClient } from "../ws_client";
import { AudioCapture } from "../audio_capture";
import { PPTCopilotView } from "./PPTView";
import { ProfilePage, SettingsPage } from "./ProfilePage";

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
        <div style={{ width:36, height:36, borderRadius:10, background:C.amber,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem" }}>📡</div>
        <div>
          <div style={{ fontWeight:800, fontSize:"0.92rem" }}>PILOT</div>
          <div style={{ fontSize:"0.62rem", color:C.text3 }}>Voice AI OS</div>
        </div>
      </div>
      <nav style={{ flex:1, padding:"0 0.5rem" }}>
        {[{id:"dashboard",  icon:"⊞", label:"Main Dashboard"},
          {id:"ppt",        icon:"🖥", label:"PPT Copilot"},
          {id:"care",       icon:"🎧", label:"Customer Care"},
          {id:"guidelines", icon:"📋", label:"Guidelines"}].map(n=>(
          <button key={n.id} onClick={()=>store.setPage(n.id as any)}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.6rem",
                     padding:"0.6rem 0.75rem", borderRadius:8, border:"none",
                     background:active===n.id?C.amber:"transparent",
                     color:active===n.id?"#fff":C.text2,
                     fontWeight:active===n.id?600:400, fontSize:"0.85rem",
                     marginBottom:"0.1rem", cursor:"pointer", textAlign:"left" }}>
            <span>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div style={{ borderTop:`1.5px solid ${C.border}`, padding:"0.6rem" }}>
        <button onClick={()=>store.setPage("settings" as any)}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.6rem",
                   padding:"0.5rem 0.75rem", borderRadius:8, border:"none",
                   background:"transparent", color:C.text3,
                   fontSize:"0.82rem", cursor:"pointer", marginBottom:"0.1rem" }}>
          ⚙ Settings
        </button>
        <button onClick={()=>store.logout()}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.6rem",
                   padding:"0.5rem 0.75rem", borderRadius:8, border:"none",
                   background:"transparent", color:"#EF4444",
                   fontSize:"0.82rem", cursor:"pointer", marginBottom:"0.1rem" }}>
          ⎋ Sign Out
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

/* ── Live transcript bar ── */
function LiveTranscriptBar({ transcripts, agentStatus, isListening, wakeActive, level, onToggle }:
  { transcripts: any[]; agentStatus: string; isListening: boolean;
    wakeActive: boolean; level: number; onToggle: ()=>void }) {
  const last = transcripts[transcripts.length-1];
  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0,
                  background:C.surface,
                  borderTop:`1.5px solid ${C.border}`,
                  backdropFilter:"blur(8px)",
                  padding:"0.75rem 1.25rem",
                  display:"flex", alignItems:"center", gap:"1rem",
                  boxShadow:"0 -4px 20px rgba(0,0,0,0.06)" }}>
      <button onClick={onToggle}
        style={{ width:44, height:44, borderRadius:"50%", flexShrink:0,
                 background: wakeActive ? "#D1FAE5" : isListening ? C.amber : "var(--amber-bg)",
                 border: wakeActive ? `2px solid ${C.green}` : "none",
                 fontSize:"1.1rem", cursor:"pointer",
                 boxShadow: wakeActive ? `0 0 0 6px rgba(34,197,94,0.2)`
                           : isListening ? `0 0 0 6px rgba(245,167,0,0.2)` : "none",
                 transition:"all 0.2s" }}>
        🎤
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        {last ? (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <span style={{ fontSize:"0.7rem", fontWeight:700,
                           color: last.role==="PILOT" ? C.amber : C.amberDark,
                           marginRight:"0.4rem" }}>
              {last.speaker || "You"}:
            </span>
            <span style={{ fontSize:"0.88rem", color:C.text1 }}>{last.text}</span>
          </div>
        ) : (
          <span style={{ fontSize:"0.88rem", color:C.text3 }}>{agentStatus}</span>
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
      ) : null}
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
  const wsRef       = useRef<PilotWSClient|null>(null);
  const capRef      = useRef<AudioCapture|null>(null);
  const audioQ      = useRef<{buf: ArrayBuffer; mime: string}[]>([]);
  const playing     = useRef(false);
  const audioCtx    = useRef<AudioContext|null>(null);
  const wakeTimer   = useRef<number>(0);

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
    };
  }, []);

  const addT = (entry: any) => setTranscripts(ts => [...ts.slice(-299), entry]);

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
          src.onended = () => res();
          src.start(0);
        });
      } catch {
        await new Promise<void>(res => {
          const blob = new Blob([buf], { type: mime });
          const url  = URL.createObjectURL(blob);
          const a    = new Audio(url);
          a.onended = () => { URL.revokeObjectURL(url); res(); };
          a.onerror = () => { URL.revokeObjectURL(url); res(); };
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
            setAgentStatus(`⚠ Low confidence (${Math.round(conf*100)}%) — speak clearly`);
          } else if (p.speaker && p.speaker !== "spk-unknown") {
            setAgentStatus(`${p.speaker}: ${p.text.substring(0,55)}…`);
          }
        },
        tts_audio: (p:any) => {
          if (p.b64) enqueueB64Audio(p.b64, p.mime || "audio/mp3");
        },
        tool_start: (p:any) => {
          store.upsertToolCard({...p, status:"running"});
          setAgentStatus(`Running ${p.tool}...`);
          addT({ text:`⚙ Starting: ${p.tool}`, speaker:"PILOT", role:"PILOT",
                 confidence:1, timestamp:Date.now()/1000 });
        },
        tool_end: (p:any) => {
          store.upsertToolCard({...p, status:p.result?.status||"ok"});
          const r = p.result;
          if (p.tool === "flight_search" && r?.flights?.length) {
            addT({
              text: `Found ${r.flights.length} flights · ${r.origin} → ${r.destination}`,
              speaker:"PILOT", role:"PILOT", confidence:1, timestamp:Date.now()/1000,
              flights: r.flights, origin: r.origin, destination: r.destination, date: r.date,
            });
          } else {
            let msg = `✓ ${p.tool} complete`;
            if (r?.ticket_ref)  msg = `✓ Ticket created: ${r.ticket_ref}`;
            if (r?.booking_ref) msg = `✓ Flight booked: ${r.booking_ref}`;
            addT({text:msg, speaker:"PILOT", role:"PILOT", confidence:1, timestamp:Date.now()/1000});
          }
        },
        job_queued: (p:any) => store.addJob({...p, status:"pending"}),
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
        },
        ppt_command: (p:any) => {
          window.dispatchEvent(new CustomEvent("ppt_command", { detail: p }));
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

  return { sessionId, isListening, wakeActive, agentStatus, level, toggle, stop, transcripts };
}

/* ── Session History Modal (Flaw 14) ── */
function SessionHistoryModal({ sessionId, onClose, token }:
  { sessionId: string; onClose: ()=>void; token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/sessions/${sessionId}/history`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId, token]);

  const ucIcon: Record<string,string> = { ppt:"🖥", customercare:"🎧", general:"⊞" };

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
            <div style={{ fontWeight:800, fontSize:"1rem" }}>
              {ucIcon[data?.session?.usecase||"general"]} Session History
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
            style={{ background:"none", border:"none", fontSize:"1.3rem", cursor:"pointer", color:C.text3 }}>
            ✕
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

            {/* Transcript */}
            <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.08em",
                          color:C.text3, marginBottom:"0.5rem" }}>TRANSCRIPT</div>
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
                      {t.speaker || "You"}
                    </div>
                    {t.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sessions List (Flaw 14) ── */
function SessionsList({ token }: { token: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string|null>(null);

  useEffect(() => {
    fetch("/api/v1/sessions/list", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(() => {});
  }, [token]);

  const ucIcon: Record<string,string> = { ppt:"🖥", customercare:"🎧", general:"⊞" };

  if (sessions.length === 0) return null;

  return (
    <>
      <div style={{ marginTop:"1.75rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                      marginBottom:"0.85rem" }}>
          <h2 style={{ fontSize:"1.2rem", fontWeight:700 }}>Recent Sessions</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.65rem" }}>
          {sessions.slice(0,9).map(s => (
            <div key={s.session_id} onClick={() => setSelected(s.session_id)}
              style={{ background:C.surface, borderRadius:12, padding:"0.9rem",
                       border:`1.5px solid ${C.border}`, cursor:"pointer",
                       transition:"box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow="none")}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.45rem", marginBottom:"0.45rem" }}>
                <span style={{ fontSize:"1rem" }}>{ucIcon[s.usecase] || "📌"}</span>
                <span style={{ fontSize:"0.72rem", fontWeight:700, color:C.text1 }}>
                  #{s.display_id}
                </span>
                <span style={{ marginLeft:"auto", fontSize:"0.62rem", padding:"0.1rem 0.4rem",
                               borderRadius:4, fontWeight:600,
                               background: s.state==="ENDED" ? "#F0FFF4" : C.amberBg,
                               color: s.state==="ENDED" ? C.green : C.amberDark }}>
                  {s.state}
                </span>
              </div>
              <div style={{ fontSize:"0.72rem", color:C.text2, marginBottom:"0.2rem" }}>
                {s.usecase}
              </div>
              <div style={{ fontSize:"0.65rem", color:C.text3 }}>
                {new Date(s.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
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

/* ── MAIN DASHBOARD ── */
function MainDashboard() {
  const store = useAppStore();
  const sess  = useSession();
  const ts    = sess.transcripts;   // Flaw 15: local to this view's session
  const tc    = store.toolCards;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <div style={{ flex:1, overflow:"auto", padding:"2rem 2.5rem 6rem" }}>
        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" }}>
          <div>
            <h1 style={{ fontSize:"1.9rem", fontWeight:800, letterSpacing:"-0.02em" }}>Welcome, {store.user?.name || "there"}</h1>
            <p style={{ color:C.text3, fontSize:"0.85rem" }}>Live voice processing and agent orchestration.</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.65rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                          padding:"0.45rem 0.9rem", background:"color-mix(in srgb, #22C55E 10%, var(--bg))", borderRadius:10,
                          border:`1.5px solid ${C.green}`, fontSize:"0.78rem",
                          fontWeight:700, color:C.green, cursor:"pointer",
                          userSelect:"none" as const }}>
              🔐 ✓ Level {({"admin":4,"manager":3,"csr":2,"operator":2,"developer":2,"user":1,"guest":1} as Record<string,number>)[store.user?.role?.toLowerCase()||"user"] ?? 1} Access
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                          padding:"0.5rem 1rem", background:C.surface, borderRadius:10,
                          border:`1.5px solid ${C.border}`, fontSize:"0.8rem", fontWeight:600 }}>
              <span style={{ width:8,height:8,borderRadius:"50%", display:"inline-block",
                             background:sess.isListening ? C.green : C.border }}/>
              {sess.isListening ? "Live Mode" : "Offline"}
              <WaveBars active={sess.isListening} level={sess.level} count={5}/>
            </div>
          </div>
        </div>

        {/* 3 cards — Transcript spans 2 cols */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:"1rem", marginBottom:"1.75rem" }}>
          {/* Transcript */}
          <div style={{ background:C.surface, borderRadius:14, padding:"1.1rem",
                        border:`1.5px solid ${C.border}`, overflow:"hidden", gridColumn:"span 1" }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"0.75rem" }}>📋 Transcript</div>
            <div style={{ maxHeight:340, overflowY:"auto" }}>
              {ts.length===0
                ? <div style={{ color:C.text3, fontSize:"0.78rem" }}>Waiting for speech…</div>
                : ts.slice(-8).map((t,i)=>(
                  <div key={i} style={{ marginBottom:"0.5rem", animation:"fadeIn 0.3s ease" }}>
                    <div style={{ fontSize:"0.68rem", fontWeight:700,
                                  color: t.speaker==="PILOT" ? C.amber : C.amberDark,
                                  marginBottom:"0.1rem" }}>
                      {t.speaker||"You"}
                    </div>
                    <div style={{ background: t.speaker==="PILOT" ? C.amberBg : "var(--bg2)",
                                  borderRadius:8, padding:"0.4rem 0.6rem",
                                  fontSize:"0.8rem", lineHeight:1.5,
                                  color: t.speaker==="PILOT" ? C.amberDark : C.text1 }}>
                      {t.text}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Tools */}
          <div style={{ background:C.surface, borderRadius:14, padding:"1.1rem", border:`1.5px solid ${C.border}` }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"0.75rem" }}>✦ Tools</div>
            {([
              {name:"PPT Copilot", icon:"🖥", page:"ppt"},
              {name:"Customer Care", icon:"🎧", page:"care"},
            ] as const).map(t=>(
              <div key={t.name}
                   onClick={()=>store.setPage(t.page as any)}
                   style={{ display:"flex", alignItems:"center", gap:"0.5rem",
                            padding:"0.55rem 0.7rem", borderRadius:10, marginBottom:"0.5rem",
                            background:"var(--bg2)", border:`1.5px solid ${C.border}`,
                            cursor:"pointer", transition:"all 0.15s" }}
                   onMouseEnter={e=>(e.currentTarget.style.background=C.amberBg,
                                     e.currentTarget.style.borderColor=C.amber)}
                   onMouseLeave={e=>(e.currentTarget.style.background="var(--bg2)",
                                     e.currentTarget.style.borderColor=C.border)}>
                <span style={{ fontSize:"1rem" }}>{t.icon}</span>
                <span style={{ flex:1, fontSize:"0.82rem", fontWeight:600 }}>{t.name}</span>
                <span style={{ fontSize:"0.7rem", color:C.text3 }}>→</span>
              </div>
            ))}
          </div>

          {/* Queue */}
          <div style={{ background:C.surface, borderRadius:14, padding:"1.1rem", border:`1.5px solid ${C.border}` }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"0.75rem" }}>⊡ Queue</div>
            {tc.length===0
              ? <div style={{ color:C.text3, fontSize:"0.78rem" }}>No jobs yet</div>
              : tc.map((c,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"0.45rem", marginBottom:"0.55rem" }}>
                  <div style={{ width:14,height:14,borderRadius:"50%",flexShrink:0,marginTop:2,
                                background:c.status==="ok"?C.green:c.status==="running"?C.amber:C.border,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:"0.5rem",color:"#fff" }}>
                    {c.status==="ok"?"✓":c.status==="running"?"●":"○"}
                  </div>
                  <div>
                    <div style={{ fontSize:"0.78rem", fontWeight:600 }}>{c.tool}</div>
                    <div style={{ fontSize:"0.68rem",
                                  color:c.status==="running"?C.amber:"#AAA" }}>
                      {c.status==="running"?"Running…":c.status==="ok"?"Done":"Pending"}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>

        </div>


        {/* Recent Sessions — Flaw 14 */}
        {store.token && <SessionsList token={store.token}/>}
      </div>

      <LiveTranscriptBar
        transcripts={ts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} wakeActive={sess.wakeActive} level={sess.level}
        onToggle={() => sess.toggle("general")}
      />
    </div>
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

/* ── CUSTOMER CARE VIEW ── */
function CustomerCareView() {
  const sess    = useSession();
  const store   = useAppStore();
  const ts      = sess.transcripts;
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [from, setFrom]   = useState("");
  const [to, setTo]       = useState("");
  const [date, setDate]   = useState(""); // used in flight search hint text
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const t = setInterval(()=>setElapsed(e=>e+1), 1000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); }, [ts.length]);

  const mm = String(Math.floor(elapsed/60)).padStart(2,"0");
  const ss = String(elapsed%60).padStart(2,"0");

  // Real-time flights from last flight_search tool result
  const flightCard = store.toolCards.slice().reverse().find(c => c.tool === "flight_search");
  const flightResult = flightCard?.result as any;
  const rawFlights: any[] = flightResult?.flights || [];
  const flights = rawFlights.map((f: any, i: number) => ({
    id:       f.id || f.flight || `FL${i}`,
    airline:  f.airline || `Flight ${i+1}`,
    price:    typeof f.price === "number" ? `₹${f.price.toLocaleString()}` : (f.price || "—"),
    dep:      f.departure || f.dep || "—",
    arr:      f.arrival   || f.arr || "—",
    from:     f.origin      || from,
    to:       f.destination || to,
    book_url: f.book_url || "",
  }));

  // Auto-fill From/To from voice search result
  useEffect(() => {
    if (flightResult?.origin)      setFrom(flightResult.origin);
    if (flightResult?.destination) setTo(flightResult.destination);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightResult?.origin, flightResult?.destination]);

  // Real-time task queue from store.toolCards (care tools only)
  const careTools = ["crm_lookup","kb_search","ticket_create","ticket_update","ticket_close","flight_search","flight_book"];
  const liveTasks = store.toolCards.filter(c => careTools.includes(c.tool));

  const toolLabel: Record<string,string> = {
    crm_lookup:"Verify Customer Identity", kb_search:"Search Knowledge Base",
    ticket_create:"Create Support Ticket", ticket_update:"Update Ticket",
    ticket_close:"Close Ticket", flight_search:"Search Flights",
    flight_book:"Book & Issue Ticket",
  };

  // Status timeline derived from live tool activity
  const now = new Date();
  const fmt = (d:Date) => d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  const timeline = [
    {l:"Session Connected", t: fmt(new Date(now.getTime() - elapsed*1000)), done:true, active:false},
    ...liveTasks.map(c => ({
      l: toolLabel[c.tool] || c.tool,
      t: c.status === "ok" ? "Done" : c.status === "running" ? "In progress…" : "Pending",
      done: c.status === "ok",
      active: c.status === "running",
    })),
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      {/* header */}
      <div style={{ padding:"0.85rem 1.5rem", background:C.surface,
                    borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ fontWeight:800, fontSize:"1rem" }}>Active Session: Flight Booking</h2>
            <p style={{ fontSize:"0.75rem", color:C.text3 }}>Connecting with user ID: 894-3B-ZULU</p>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>
            <button onClick={()=>sess.toggle("customercare")}
              style={{ display:"flex", alignItems:"center", gap:"0.4rem",
                       padding:"0.35rem 0.8rem", borderRadius:20,
                       background: sess.wakeActive ? "#EEF9EE" : sess.isListening ? C.amberBg : "var(--amber-bg)",
                       border:`1.5px solid ${sess.wakeActive ? C.green : sess.isListening ? C.amber : C.border}`,
                       fontSize:"0.75rem",
                       color: sess.wakeActive ? C.green : C.amberDark,
                       fontWeight:600, cursor:"pointer",
                       boxShadow: sess.wakeActive ? `0 0 0 3px rgba(34,197,94,0.18)` : "none",
                       transition:"all 0.2s" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",
                             background: sess.wakeActive ? C.green : C.amber,
                             display:"inline-block",
                             animation: sess.wakeActive ? "pulse 1s ease-in-out infinite" : "none" }}/>
              {sess.wakeActive ? "PILOT Active" : sess.isListening ? "Standby" : "Start Call"}
            </button>
            <span style={{ fontSize:"0.8rem", color:C.text2, fontFamily:"monospace" }}>{mm}:{ss}</span>
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* flight search panel */}
        <div style={{ width:210, background:"var(--bg2)", borderRight:`1.5px solid ${C.border}`,
                      padding:"0.85rem", overflowY:"auto", flexShrink:0, display:"flex",
                      flexDirection:"column", gap:"0.35rem" }}>
          <div style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em",
                        color:C.text3, marginBottom:"0.25rem" }}>FLIGHT SEARCH</div>
          {/* From / To / Date inputs */}
          {[
            {icon:"🛫", placeholder:"From (e.g. JFK)", val:from, set:setFrom},
            {icon:"🛬", placeholder:"To (e.g. LAX)",   val:to,   set:setTo},
            {icon:"📅", placeholder:"Date (e.g. 2026-07-01)", val:date, set:setDate},
          ].map(f=>(
            <div key={f.placeholder} style={{ display:"flex", alignItems:"center", gap:"0.35rem",
                                              background:C.surface, borderRadius:8,
                                              border:`1.5px solid ${C.border}`, padding:"0.3rem 0.5rem" }}>
              <span style={{ fontSize:"0.85rem" }}>{f.icon}</span>
              <input value={f.val} onChange={e=>f.set(e.target.value)}
                placeholder={f.placeholder}
                style={{ flex:1, border:"none", outline:"none", fontSize:"0.72rem",
                         background:"transparent", color:C.text1 }}/>
            </div>
          ))}
          <div style={{ fontSize:"0.66rem", color:C.text3, marginTop:"0.1rem" }}>
            Say "search flights from {from||"…"} to {to||"…"}" or type above
          </div>
          {/* Live flight cards */}
          {flights.length > 0 && (
            <div style={{ marginTop:"0.35rem" }}>
              <div style={{ fontSize:"0.66rem", fontWeight:700, color:C.text3,
                            letterSpacing:"0.06em", marginBottom:"0.4rem" }}>
                {flightResult?.source === "web" ? "LIVE RESULTS" : "RESULTS"}
              </div>
              {flights.map((f,i)=>(
                <div key={i} style={{ borderRadius:8, marginBottom:"0.4rem",
                                      border:`1.5px solid ${i===0?C.amber:C.border}`,
                                      background:i===0?C.amberBg:C.surface,
                                      overflow:"hidden", position:"relative" }}>
                  {i===0 && (
                    <div style={{ position:"absolute", top:0, right:0,
                                  background:C.amber, color:"#fff",
                                  fontSize:"0.52rem", fontWeight:700,
                                  padding:"2px 6px", borderRadius:"0 8px 0 6px" }}>BEST</div>
                  )}
                  <div style={{ padding:"0.45rem 0.55rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:"0.72rem", fontWeight:700 }}>{f.airline}</span>
                      <span style={{ fontSize:"0.74rem", fontWeight:800, color:C.amberDark }}>{f.price}</span>
                    </div>
                    <div style={{ fontSize:"0.62rem", color:C.text2, marginTop:"0.15rem" }}>
                      {f.id} · {f.dep} → {f.arr}
                    </div>
                    <div style={{ fontSize:"0.6rem", color:C.text3 }}>
                      {f.from} → {f.to}
                    </div>
                  </div>
                  {f.book_url && (
                    <a href={f.book_url} target="_blank" rel="noopener noreferrer"
                       style={{ display:"block", textAlign:"center",
                                padding:"0.25rem", fontSize:"0.62rem",
                                fontWeight:600, color: i===0 ? C.amberDark : C.text3,
                                background: i===0 ? C.amberBg : C.bg,
                                borderTop:`1px solid ${i===0?C.amber:C.border}`,
                                textDecoration:"none" }}>
                      Book →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {flights.length === 0 && (
            <div style={{ fontSize:"0.72rem", color:C.text3, textAlign:"center",
                          padding:"1rem 0", marginTop:"0.5rem" }}>
              No results yet. Start a call and ask to search flights.
            </div>
          )}
        </div>

        {/* chat */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.65rem",
                        padding:"0.65rem 1rem", background:C.surface,
                        borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--border)",
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem" }}>🧑</div>
            <div>
              <div style={{ fontWeight:600, fontSize:"0.85rem" }}>Customer Care Agent</div>
              <div style={{ fontSize:"0.68rem",
                            color: sess.wakeActive ? C.green : C.text3,
                            fontWeight: sess.wakeActive ? 700 : 400 }}>
                {sess.wakeActive ? "PILOT Active" : sess.isListening ? "Standby — say 'Hey Pilot'" : "Connected"}
              </div>
            </div>
            {sess.isListening && (
              <div style={{ marginLeft:"auto" }}>
                <WaveBars active={true} level={Math.min(1, sess.wakeActive ? sess.level + 0.2 : sess.level)} count={5}/>
              </div>
            )}
          </div>

          {/* messages = session-scoped transcripts */}
          <div style={{ flex:1, overflowY:"auto", padding:"0.85rem" }}>
            {ts.length===0 && (
              <div style={{ textAlign:"center", color:C.text3, fontSize:"0.82rem", marginTop:"2rem" }}>
                Start a session and speak to see the live conversation.
              </div>
            )}
            {ts.map((t,i)=>{
              const isAgent = t.speaker==="PILOT" || t.role==="PILOT";

              // ── Flight search result cards ──
              if (t.flights?.length) {
                return (
                  <div key={i} style={{ marginBottom:"1rem", animation:"fadeIn 0.3s ease" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"0.6rem" }}>
                      <div style={{ width:28,height:28,borderRadius:"50%",background:C.amber,
                                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",flexShrink:0 }}>🤖</div>
                      <span style={{ fontSize:"0.75rem", fontWeight:700, color:C.amberDark }}>
                        ✈ {t.origin} → {t.destination} · {t.date || "Today"}
                      </span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", paddingLeft:"0.5rem" }}>
                      {(t.flights as any[]).map((f:any, fi:number) => (
                        <div key={fi} style={{ borderRadius:12, overflow:"hidden",
                                               border:`1.5px solid ${fi===0?C.amber:C.border}`,
                                               background:fi===0?C.amberBg:C.surface,
                                               boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
                                               position:"relative" }}>
                          {fi===0 && (
                            <div style={{ position:"absolute", top:0, right:0,
                                          background:C.amber, color:"#fff",
                                          fontSize:"0.55rem", fontWeight:800,
                                          padding:"3px 8px", borderRadius:"0 12px 0 8px" }}>BEST</div>
                          )}
                          <div style={{ padding:"0.7rem 0.75rem 0.5rem" }}>
                            <div style={{ fontWeight:700, fontSize:"0.82rem", marginBottom:"0.15rem" }}>{f.airline}</div>
                            <div style={{ fontSize:"0.68rem", color:C.text3, marginBottom:"0.35rem" }}>{f.flight}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.3rem",
                                          fontSize:"0.78rem", fontWeight:600, color:C.text1, marginBottom:"0.1rem" }}>
                              <span>{f.departure || f.dep}</span>
                              <span style={{ fontSize:"0.6rem", color:C.text3 }}>→</span>
                              <span>{f.arrival || f.arr}</span>
                            </div>
                            <div style={{ fontSize:"0.62rem", color:C.text3 }}>{f.origin || f.from} → {f.destination || f.to}</div>
                            <div style={{ fontSize:"0.9rem", fontWeight:800, color:C.amberDark, marginTop:"0.4rem" }}>{f.price}</div>
                          </div>
                          {f.book_url && (
                            <a href={f.book_url} target="_blank" rel="noopener noreferrer"
                               style={{ display:"flex", alignItems:"center", justifyContent:"center",
                                        gap:"0.25rem", padding:"0.4rem",
                                        background:fi===0?C.amberBg:C.bg,
                                        borderTop:`1px solid ${fi===0?C.amber:C.border}`,
                                        fontSize:"0.7rem", fontWeight:700,
                                        color:fi===0?C.amberDark:C.text2,
                                        textDecoration:"none" }}>
                              Book Now →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // ── Regular chat bubble ──
              return (
                <div key={i} style={{ display:"flex", justifyContent:isAgent?"flex-start":"flex-end",
                                       marginBottom:"0.7rem", animation:"fadeIn 0.3s ease" }}>
                  {isAgent&&(
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.amber,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  marginRight:"0.4rem",flexShrink:0,fontSize:"0.75rem" }}>🤖</div>
                  )}
                  <div style={{ maxWidth:"68%", padding:"0.65rem 0.85rem",
                                background:isAgent?C.surface:C.blue,
                                color:isAgent?C.text1:"#fff",
                                borderRadius:isAgent?"12px 12px 12px 3px":"12px 12px 3px 12px",
                                fontSize:"0.85rem", lineHeight:1.55,
                                border:isAgent?`1.5px solid ${C.border}`:"none",
                                boxShadow:isAgent?"0 2px 8px rgba(0,0,0,0.04)":"none" }}>
                    {t.text}
                  </div>
                  {!isAgent&&(
                    <div style={{ width:28,height:28,borderRadius:"50%",background:C.amberDark,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  marginLeft:"0.4rem",flexShrink:0,color:"#fff",fontSize:"0.68rem",fontWeight:700 }}>
                      {(t.speaker||"U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef}/>
          </div>

          {/* text input */}
          <div style={{ display:"flex", gap:"0.6rem", padding:"0.65rem 0.85rem",
                        background:C.surface, borderTop:`1.5px solid ${C.border}`, flexShrink:0,
                        alignItems:"flex-end" }}>
            <button style={{ width:28,height:28,borderRadius:7,background:"var(--amber-bg)",
                             border:`1.5px solid ${C.border}`,fontSize:"0.9rem",flexShrink:0 }}>+</button>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key==="Enter"&&input.trim()){
                  // local only — doesn't pollute other views
                  setInput("");
                }
              }}
              style={{ flex:1, padding:"0.55rem 0.8rem", borderRadius:10,
                       border:`1.5px solid ${C.border}`, fontSize:"0.85rem",
                       background:"var(--bg2)", outline:"none" }}
              placeholder="Type a message or command override..."/>
            <button style={{ padding:"0.55rem 1rem", borderRadius:10, background:C.amberDark,
                             border:"none", color:"#fff", fontWeight:600, fontSize:"0.85rem" }}>
              ▶ Send
            </button>
          </div>
        </div>

        {/* task queue */}
        <div style={{ width:210, background:C.surface, borderLeft:`1.5px solid ${C.border}`,
                      padding:"0.85rem", overflowY:"auto", flexShrink:0 }}>
          <div style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em",
                        color:C.text3, marginBottom:"0.6rem" }}>TASK QUEUE</div>
          {liveTasks.length === 0
            ? <div style={{ fontSize:"0.72rem", color:C.text3 }}>No tasks yet. Start a call.</div>
            : liveTasks.map((t,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.45rem",
                                     padding:"0.45rem 0.55rem", borderRadius:8, marginBottom:"0.3rem",
                                     background:t.status==="running"?C.amberBg:"transparent",
                                     border:`1.5px solid ${t.status==="running"?C.amber:"transparent"}` }}>
                <div style={{ width:16,height:16,borderRadius:"50%",flexShrink:0,
                              background:t.status==="ok"?C.green:t.status==="running"?C.amber:"var(--amber-bg)",
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:"0.55rem",color:"#fff" }}>
                  {t.status==="ok"?"✓":t.status==="running"?"●":"○"}
                </div>
                <span style={{ fontSize:"0.74rem", fontWeight:t.status==="running"?600:400,
                               textDecoration:t.status==="ok"?"line-through":"none",
                               color:t.status==="ok"?"#AAA":C.text1 }}>
                  {toolLabel[t.tool] || t.tool}
                </span>
              </div>
            ))
          }

          <div style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em",
                        color:C.text3, margin:"1rem 0 0.6rem" }}>STATUS TIMELINE</div>
          {timeline.map((s,i)=>(
            <div key={i} style={{ display:"flex", gap:"0.45rem", marginBottom:"0.65rem" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:11,height:11,borderRadius:"50%",flexShrink:0,
                              background:s.done?C.green:s.active?C.amber:C.border }}/>
                {i<timeline.length-1&&<div style={{ width:2,height:18,background:C.border }}/>}
              </div>
              <div>
                <div style={{ fontSize:"0.75rem", fontWeight:600,
                              color:s.active?C.text1:C.text3 }}>{s.l}</div>
                <div style={{ fontSize:"0.65rem", color:s.active?C.amber:"#AAA" }}>{s.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
        <div style={{ fontSize:"1rem",fontWeight:700,marginBottom:"0.4rem" }}>⚠ Confirm Action</div>
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
      <Sidebar active={page==="ppt"?"ppt":page==="care"?"care":page==="guidelines"?"guidelines":"dashboard"}/>
      {page==="ppt"        ? <PPTPageView/> :
       page==="care"       ? <CustomerCareView/> :
       page==="guidelines" ? <GuidelinePageView/> :
       page==="profile"    ? <ProfilePage/> :
       page==="settings"   ? <SettingsPage/> :
       <MainDashboard/>}
      <ConfirmOverlay/>
    </div>
  );
}


/* ── Guidelines ── */
function GuidelinePageView() {
  const sections = [
    {
      icon: "🖥",
      title: "PPT COPILOT SYSTEM",
      color: C.amberDark,
      accentBg: C.amberBg,
      desc: "Controls, navigates, and analyzes presentations in real time — hands-free voice control over your deck.",
      commands: [
        { spoken: "go to slide 5",            action: "Jumps the viewer directly to slide 5 (0-indexed internally)." },
        { spoken: "next slide / prev slide",   action: "Steps forward or backward through the presentation deck." },
        { spoken: "summarize this slide",      action: "Verbally summarizes bullet points and shapes on the current slide." },
        { spoken: "delete slide 10",           action: "Navigates to slide 10 and triggers the confirmation popup (admin only)." },
      ],
      details: "The PPT Copilot renders PPTX decks to high-fidelity PNG frames on-the-fly via an SSE stream renderer. Slide navigation uses a fast-path regex that bypasses the LLM for deterministic zero-latency jumps. Destructive commands (delete/remove) bypass the fast path and are RBAC-gated — only admin role (Level 4) may confirm deletion.",
    },
    {
      icon: "🎧",
      title: "CUSTOMER CARE & FLIGHT CENTER",
      color: "#2563EB",
      accentBg: "color-mix(in srgb, #2563EB 8%, var(--bg))",
      desc: "Natural-language flight search and customer care ticketing — results appear as inline cards in the conversation.",
      commands: [
        { spoken: "search flights from Mumbai to Delhi on 2026-07-01", action: "Backend lookup → inline card with airlines, fares, departure times, and a Google Flights booking link." },
        { spoken: "search flights from New York to London",            action: "Origin/destination extracted automatically; date defaults to today if omitted." },
        { spoken: "create ticket / open ticket",                       action: "Opens a new support ticket and logs the synopsis from your spoken description." },
        { spoken: "look up customer / CRM",                            action: "Pulls the customer record from CRM by name or context in the conversation." },
      ],
      details: "Flight search results are rendered as interactive inline cards — not raw text — so schedules stay readable without cluttering the transcript. Parameters (origin, destination, date) are extracted via regex from natural speech; 'tomorrow' and 'today' resolve automatically. Ticket and CRM tools follow the same queue/interrupt concurrency model as all other PILOT tools.",
    },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"1.5rem 2.5rem", background:C.surface,
                    borderBottom:`1.5px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"0.25rem" }}>
          <span style={{ fontSize:"1.25rem" }}>📋</span>
          <h1 style={{ fontWeight:800, fontSize:"1.4rem", letterSpacing:"-0.02em", color:C.text1, margin:0 }}>
            System Guidelines & Operator Manual
          </h1>
        </div>
        <p style={{ fontSize:"0.85rem", color:C.text3, margin:0 }}>
          Operational reference for PILOT's active Voice AI pipeline modules.
        </p>
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:"auto", padding:"2rem 2.5rem 5rem",
                    display:"flex", flexDirection:"column", gap:"2rem" }}>

        {/* System overview card */}
        <div style={{ background:C.surface, borderRadius:14, padding:"1.5rem",
                      border:`1.5px solid ${C.border}` }}>
          <h2 style={{ fontSize:"1rem", fontWeight:700, marginBottom:"0.5rem", color:C.text1 }}>
            System Overview
          </h2>
          <p style={{ fontSize:"0.87rem", color:C.text2, lineHeight:1.65, margin:0 }}>
            PILOT is a fully local-first Voice AI Operating System that orchestrates complex task
            workflows through raw voice input. It combines continuous audio streaming,{" "}
            <strong style={{ color:C.text1 }}>unsupervised diarization</strong>,{" "}
            <strong style={{ color:C.text1 }}>biometric RBAC</strong>, and{" "}
            <strong style={{ color:C.text1 }}>real-time tool calling</strong> to act as a seamless
            extension of your desktop environment.
          </p>
        </div>

        {/* Feature sections */}
        {sections.map((sec, idx) => (
          <div key={idx} style={{ background:C.surface, borderRadius:16,
                                  border:`1.5px solid ${C.border}`, overflow:"hidden" }}>
            {/* Section header */}
            <div style={{ background:sec.accentBg, padding:"1.25rem 1.5rem",
                          borderBottom:`1.5px solid ${C.border}`,
                          display:"flex", alignItems:"flex-start", gap:"0.75rem" }}>
              <span style={{ fontSize:"1.4rem", lineHeight:1 }}>{sec.icon}</span>
              <div>
                <div style={{ fontSize:"0.82rem", fontWeight:800, color:sec.color,
                              letterSpacing:"0.06em", marginBottom:"0.2rem" }}>
                  {sec.title}
                </div>
                <p style={{ fontSize:"0.82rem", color:C.text1, margin:0, fontWeight:500, lineHeight:1.5 }}>
                  {sec.desc}
                </p>
              </div>
            </div>

            {/* Body: mechanics then triggers stacked */}
            <div style={{ padding:"1.5rem 1.75rem", display:"flex", flexDirection:"column", gap:"1.5rem" }}>
              {/* Pipeline mechanics — full width */}
              <div>
                <h3 style={{ fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase",
                             color:C.text3, marginBottom:"0.6rem", letterSpacing:"0.07em" }}>
                  Pipeline Mechanics
                </h3>
                <p style={{ fontSize:"0.84rem", color:C.text2, lineHeight:1.7, margin:0 }}>
                  {sec.details}
                </p>
              </div>

              {/* Divider */}
              <div style={{ borderTop:`1px dashed ${C.border}` }}/>

              {/* Voice triggers — 2-column card grid */}
              <div>
                <h3 style={{ fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase",
                             color:C.text3, marginBottom:"0.75rem", letterSpacing:"0.07em" }}>
                  Voice Triggers
                </h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.85rem" }}>
                  {sec.commands.map((cmd, cIdx) => (
                    <div key={cIdx} style={{ background:C.bg, padding:"0.9rem 1.1rem",
                                            borderRadius:10, border:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"0.35rem" }}>
                        <span style={{ fontSize:"0.82rem" }}>🗣</span>
                        <span style={{ fontSize:"0.78rem", fontWeight:700, color:C.text1,
                                      fontFamily:"monospace" }}>
                          "{cmd.spoken}"
                        </span>
                      </div>
                      <p style={{ fontSize:"0.74rem", color:C.text2, lineHeight:1.55, margin:0 }}>
                        {cmd.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
