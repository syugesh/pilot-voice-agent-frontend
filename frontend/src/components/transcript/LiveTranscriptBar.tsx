import React, { useState } from "react";
import { C, speakerName } from "./helpers";
import { useAppStore } from "../../store/SessionStore";
import { MicIcon, SendIcon } from "../Icons";

/* ── Waveform bars ── */
export function WaveBars({ active, level, count = 8, color = C.amber }:
  { active: boolean; level: number; count?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px" }}>
      {Array.from({ length: count }, (_, i) => {
        const seed = (i / count) * Math.PI * 2;
        const h = active ? Math.max(3, Math.floor(level * (14 + Math.sin(seed + Date.now() / 300) * 8))) : 3;
        return <div key={i} style={{
          width: 3, borderRadius: 2, background: color,
          height: h, transition: "height 0.12s"
        }} />;
      })}
    </div>
  );
}

/* ── Live transcript bar — floating pill, centered, matching the reference
   design (pilot-voice-agent-frontend-feature-PPT-Copilot's LiveTranscriptBar):
   a rounded card instead of a full-width flat bar, with a real mic icon,
   a typed-command fallback input when there's nothing to show yet, and a
   "⌘K" hint badge when idle. Keeps two PILOT-specific behaviors the
   reference doesn't have: the localStorage show/hide toggle, and truncating
   very long transcript text so the bar never grows unboundedly tall. */
export function LiveTranscriptBar({ transcripts, agentStatus, isListening, level, onToggle }:
  {
    transcripts: any[]; agentStatus: string; isListening: boolean;
    level: number; onToggle: () => void
  }) {
  const show = localStorage.getItem("pilot_show_transcript") !== "false";
  const userName = useAppStore(s => s.user?.name ?? "You");
  const [typed, setTyped] = useState("");

  if (!show) return null;

  const last = transcripts[transcripts.length - 1];

  // Clean up and truncate extremely long status/draft transcripts for the bottom bar
  let displayWordText = last ? last.text : "";
  if (displayWordText && displayWordText.length > 120) {
    displayWordText = displayWordText.split("```")[0].trim();
    if (displayWordText.length > 120 || displayWordText === "") {
      displayWordText = last.text.slice(0, 110) + "... [Full content displayed in transcript section]";
    }
  }

  const submit = () => {
    if (!typed.trim()) return;
    // Typed commands mirror the existing chat-input stubs elsewhere in the
    // app (no text→intent backend path exists yet) — clears locally rather
    // than silently pretending to submit somewhere real.
    setTyped("");
  };

  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 100,
                  padding: "0.85rem 1.25rem 0.6rem",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
      <div style={{ width: "100%", maxWidth: 920, display: "flex", alignItems: "center", gap: "0.65rem",
                    background: C.surface, borderRadius: 32, padding: "0.4rem 0.5rem 0.4rem 0.4rem",
                    border: `1.5px solid ${C.border}`,
                    boxShadow: "0 8px 28px rgba(0,0,0,0.08)" }}>
        <button onClick={onToggle}
          style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                   background: isListening ? C.amber : C.amberBg, border: "none",
                   cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                   boxShadow: isListening ? `0 0 0 6px rgba(245,167,0,0.2)` : "none",
                   transition: "all 0.2s" }}>
          <MicIcon size={19} color={isListening ? "#fff" : C.amberDark} strokeWidth={2} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {last ? (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700,
                             color: last.role === "PILOT" ? C.amber : C.amberDark,
                             marginRight: "0.4rem" }}>
                {speakerName(last.speaker, userName)}:
              </span>
              <span style={{ fontSize: "0.88rem", color: C.text1 }}>{displayWordText}</span>
            </div>
          ) : (
            <input value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="Speak here..."
              style={{ width: "100%", border: "none", outline: "none", background: "transparent",
                       fontSize: "0.88rem", color: C.text1 }} />
          )}
        </div>

        {isListening && <WaveBars active={isListening} level={level} />}
        {agentStatus.includes("speaking") || agentStatus.includes("Responding") ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.3rem 0.75rem", borderRadius: 20,
                        background: C.amberBg, fontSize: "0.75rem",
                        color: C.amberDark, fontWeight: 600, flexShrink: 0 }}>
            <WaveBars active={true} level={0.6} count={5} color={C.amberDark} />
            PILOT speaking
          </div>
        ) : isListening ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0,
                        fontSize: "0.72rem", color: C.green, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green,
                           display: "inline-block", animation: "pulse 1.2s infinite" }} />
            Listening
          </div>
        ) : (
          <span style={{ flexShrink: 0, fontSize: "0.68rem", fontWeight: 600, color: C.text3,
                         background: "var(--bg2)", border: `1px solid ${C.border}`,
                         borderRadius: 6, padding: "0.2rem 0.45rem" }}>
            ⌘K
          </span>
        )}

        {/* <button onClick={submit}
          style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: "none",
                   background: C.amber, cursor: "pointer",
                   display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SendIcon size={15} color="#fff" />
        </button> */}
      </div>
    </div>
  );
}
