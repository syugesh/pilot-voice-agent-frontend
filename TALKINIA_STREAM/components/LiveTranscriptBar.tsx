"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";

// Same amber/neutral palette as PILOT's frontend/src/components/transcript/helpers.tsx
// (the `C` theme object) — kept as plain hex here since this is a separate
// Next.js app with no shared theme/store to import from.
const C = {
  amber: "#F5A700", amberDark: "#7C5E00", amberBg: "#FFF8E7",
  surface: "#FFFFFF", border: "#E5E2DA",
  text1: "#1A1A1A", text3: "#888", green: "#22C55E",
};

type MeetingAction = "instant" | "join" | "schedule" | "recordings";
type NavPage = "home" | "upcoming" | "personal-room";

const NAV_ROUTES: Record<NavPage, string> = {
  home: "/",
  upcoming: "/upcoming",
  // NOTE: matches the existing (misspelled) route folder name in this repo —
  // not a typo introduced here, see app/(root)/(home)/../presonal-room.
  "personal-room": "/presonal-room",
};

// Recognizes a spoken command and maps it to either a meeting action (New /
// Join / Schedule Meeting, View Recordings — same as MeetingTypeList's
// cards) or direct "go to <page>" navigation covering every real sidebar
// destination (constants/index.ts): Home, Upcoming, Recordings, Personal
// Room. "Previous" isn't included — that sidebar link is itself commented
// out/disabled in constants/index.ts, so there's no real page to send a
// "go to previous" command to. Checked roughly most-specific-first so e.g.
// "schedule an instant meeting" (unlikely, but "instant" alone shouldn't win
// over an explicit "schedule").
function _parseVoiceCommand(text: string): { kind: "meeting"; action: MeetingAction } | { kind: "nav"; page: NavPage } | null {
  const t = text.toLowerCase();
  if (/schedule|plan a meeting/.test(t)) return { kind: "meeting", action: "schedule" };
  if (/join/.test(t)) return { kind: "meeting", action: "join" };
  if (/recording/.test(t)) return { kind: "meeting", action: "recordings" };
  if (/instant|start.*meeting|new meeting/.test(t)) return { kind: "meeting", action: "instant" };
  if (/personal room|personal space/.test(t)) return { kind: "nav", page: "personal-room" };
  if (/upcoming/.test(t)) return { kind: "nav", page: "upcoming" };
  if (/\bhome\b|main dashboard|main page/.test(t)) return { kind: "nav", page: "home" };
  return null;
}

/* Waveform bars — ported from PILOT's LiveTranscriptBar.tsx (WaveBars). */
function WaveBars({ active, count = 8, color = C.amber }: { active: boolean; count?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px" }}>
      {Array.from({ length: count }, (_, i) => {
        const seed = (i / count) * Math.PI * 2;
        const h = active ? Math.max(3, Math.floor(0.8 * (14 + Math.sin(seed + Date.now() / 300) * 8))) : 3;
        return <div key={i} style={{ width: 3, borderRadius: 2, background: color, height: h, transition: "height 0.12s" }} />;
      })}
    </div>
  );
}

/* Floating live-transcript pill — same shape/behavior as PILOT's
   LiveTranscriptBar (frontend/src/components/transcript/LiveTranscriptBar.tsx):
   a rounded mic button + the current spoken line, shown live as you talk
   (continuous recognition, not single-shot), with a waveform + "Listening"
   indicator while active and a typed-command fallback when idle. Built
   standalone for Talkinia (separate Next.js app, no shared PILOT store)
   using the same browser-native SpeechRecognition already used for
   description dictation. When a recognized final phrase matches a meeting
   action, dispatches "talkinia:voice-command" — MeetingTypeList.tsx listens
   for it; plain "go to <page>" phrases navigate directly instead. */
export default function LiveTranscriptBar() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [typed, setTyped] = useState("");
  const recognitionRef = useRef<any>(null);

  const toggleListening = useCallback(() => {
    const SpeechRecognitionCtor =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SpeechRecognitionCtor) {
      setLastHeard("Voice isn't supported in this browser — try Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      if (finalTranscript) {
        const command = _parseVoiceCommand(finalTranscript);
        if (command?.kind === "meeting") {
          window.dispatchEvent(new CustomEvent("talkinia:voice-command", { detail: command.action }));
        } else if (command?.kind === "nav") {
          router.push(NAV_ROUTES[command.page]);
        }
        setLastHeard(finalTranscript.trim());
      } else if (interimTranscript) {
        setLastHeard(interimTranscript.trim());
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, router]);

  const submitTyped = () => {
    if (!typed.trim()) return;
    const command = _parseVoiceCommand(typed);
    if (command?.kind === "meeting") {
      window.dispatchEvent(new CustomEvent("talkinia:voice-command", { detail: command.action }));
    } else if (command?.kind === "nav") {
      router.push(NAV_ROUTES[command.page]);
    }
    setTyped("");
  };

  return (
    // In normal document flow (not position:fixed) — renders as a real
    // footer AFTER whatever content is above it (e.g. the meeting-type
    // cards), instead of floating over the page and overlapping them.
    <div style={{
      padding: "0.85rem 1.25rem 1.1rem",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem",
    }}>
      <div style={{
        width: "100%", maxWidth: 920, display: "flex", alignItems: "center", gap: "0.65rem",
        background: C.surface, borderRadius: 32, padding: "0.4rem 0.5rem 0.4rem 0.4rem",
        border: `1.5px solid ${C.border}`,
        boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
      }}>
        <button onClick={toggleListening}
          style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: isListening ? C.amber : C.amberBg, border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isListening ? `0 0 0 6px rgba(245,167,0,0.2)` : "none",
            transition: "all 0.2s",
          }}>
          <Mic size={19} color={isListening ? "#fff" : C.amberDark} strokeWidth={2} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {lastHeard ? (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: C.amberDark, marginRight: "0.4rem" }}>
                You:
              </span>
              <span style={{ fontSize: "0.88rem", color: C.text1 }}>{lastHeard}</span>
            </div>
          ) : (
            <input value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitTyped(); }}
              placeholder='Speak , e.g. "start an instant meeting"'
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "0.88rem", color: C.text1 }} />
          )}
        </div>

        {isListening ? (
          <>
            <WaveBars active={isListening} />
            <div style={{
              display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0,
              fontSize: "0.72rem", color: C.green, fontWeight: 600,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.2s infinite" }} />
              Listening
            </div>
          </>
        ) : (
          <span style={{
            flexShrink: 0, fontSize: "0.68rem", fontWeight: 600, color: C.text3,
            background: "#F3F1EB", border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "0.2rem 0.45rem",
          }}>
            ⌘K
          </span>
        )}
      </div>
    </div>
  );
}
