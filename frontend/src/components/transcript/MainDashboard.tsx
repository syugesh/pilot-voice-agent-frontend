import React, { useEffect, useState } from "react";
import { useAppStore } from "../../store/SessionStore";
import { useSession } from "./useSession";
import { C, speakerName } from "./helpers";
import { SessionsList } from "./SessionModal";
import { WaveBars, LiveTranscriptBar } from "./LiveTranscriptBar";
import {
  DashboardIcon, ClipboardIcon, ZapIcon, SparkleIcon, GearIcon, LockIcon,
  ArrowRightIcon, MicIcon, DotIcon, PinIcon, BotIcon, CheckIcon, CheckCircleIcon,
  XIcon, IconBadge,
} from "../Icons";

/* ── Shared dashboard building blocks — local to this view for now; pull up
   to helpers.tsx if another view (e.g. Customer Care) adopts this look. ── */

function StatusChip({ label, tone = "neutral", icon }:
  { label: string; tone?: "good" | "warn" | "bad" | "neutral" | "accent"; icon?: React.ReactNode }) {
  const map = {
    good: { fg: C.green, bg: "rgba(34,197,94,0.12)" },
    warn: { fg: C.amber, bg: "rgba(245,167,0,0.14)" },
    bad: { fg: C.red, bg: "rgba(239,68,68,0.12)" },
    accent: { fg: C.amberDark, bg: C.amberBg },
    neutral: { fg: C.text2, bg: "var(--bg2)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.28rem 0.6rem", borderRadius: 20, fontSize: "0.7rem",
      fontWeight: 700, color: map.fg, background: map.bg, whiteSpace: "nowrap",
    }}>
      {icon ?? <span style={{ width: 6, height: 6, borderRadius: "50%", background: map.fg, display: "inline-block", flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function SectionCard({ title, icon, right, children, style, bodyStyle }:
  { title?: string; icon?: React.ReactNode; right?: React.ReactNode;
    children: React.ReactNode; style?: React.CSSProperties; bodyStyle?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.1rem", borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 700, fontSize: "0.88rem", color: C.text1 }}>
            {icon}{title}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: "1.1rem", flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    </div>
  );
}

function StepRow({ label, sub, state, last }:
  { label: string; sub?: React.ReactNode; state: "done" | "active" | "pending"; last?: boolean }) {
  const color = state === "done" ? C.green : state === "active" ? C.amber : C.border;
  return (
    <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: state === "pending" ? "var(--bg2)" : color,
          color: "#fff", border: state === "pending" ? `1.5px solid ${C.border}` : "none",
        }}>
          {state === "done" ? <CheckIcon size={11} strokeWidth={3} />
            : state === "active" ? <DotIcon size={7} />
            : <DotIcon size={6} filled={false} color={C.text3} />}
        </div>
        {!last && <div style={{ width: 2, flex: 1, minHeight: 14, background: state === "done" ? C.green : C.border, marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : "0.85rem", flex: 1 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: state === "pending" ? 500 : 700, color: state === "pending" ? C.text3 : C.text1 }}>{label}</div>
        {sub && <div style={{ fontSize: "0.72rem", color: C.text3, marginTop: "0.15rem", lineHeight: 1.5 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MetricTile({ Icon, tone, label, value, deltaPct, extra }:
  { Icon: React.ComponentType<any>; tone: "blue" | "green" | "amber" | "violet"; label: string;
    value: string; deltaPct?: number | null; extra?: string }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: "1.1rem", border: `1.5px solid ${C.border}` }}>
      <IconBadge size={32} tone={tone} style={{ marginBottom: "0.7rem" }}><Icon size={16} strokeWidth={1.8} /></IconBadge>
      <div style={{ fontSize: "0.76rem", color: C.text3, marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.text1, marginBottom: "0.2rem" }}>{value}</div>
      {extra ? (
        <div style={{ fontSize: "0.72rem", color: C.text3, display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <DotIcon size={6} color={C.green} /> {extra}
        </div>
      ) : deltaPct != null ? (
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: deltaPct >= 0 ? C.green : C.red }}>
          {deltaPct >= 0 ? "+" : ""}{deltaPct}% vs yesterday
        </div>
      ) : (
        <div style={{ fontSize: "0.72rem", color: C.text3 }}>—</div>
      )}
    </div>
  );
}

/* ── Activity Feed — a live, time-ordered event log derived from the real
   session state (transcript turns + tool calls). No fake backend call: it
   reflects exactly what happened in this session. ── */
function ActivityFeed({ transcripts, toolCards }: { transcripts: any[]; toolCards: any[] }) {
  const fmt = (ts?: number) => ts ? new Date(ts * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  const items: { t: number; dot: string; text: string }[] = [];
  transcripts.slice(-6).forEach((tr: any) => items.push({
    t: tr.timestamp || 0,
    dot: tr.speaker === "PILOT" ? C.amber : C.blue,
    text: tr.speaker === "PILOT" ? "PILOT responded" : "Speech detected",
  }));
  toolCards.slice(-6).forEach((c: any) => items.push({
    t: Date.now() / 1000,
    dot: c.status === "ok" ? C.green : c.status === "running" ? C.amber : C.text3,
    text: `${(c.tool || "task").replace(/_/g, " ")} ${c.status === "ok" ? "completed" : c.status === "running" ? "started" : "queued"}`,
  }));
  items.sort((a, b) => b.t - a.t);

  return (
    <SectionCard title="Activity Feed" icon={<ZapIcon size={14} color={C.amberDark} />}
      style={{ maxHeight: 340 }} bodyStyle={{ overflowY: "auto" }}>
      {items.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "1.5rem 0", textAlign: "center" }}>
          <ZapIcon size={20} color={C.text3} />
          <div style={{ fontSize: "0.76rem", color: C.text3 }}>Activity will appear here as the session runs.</div>
        </div>
      ) : items.slice(0, 10).map((it, i) => (
        <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", marginBottom: "0.7rem" }}>
          <span style={{ fontSize: "0.66rem", color: C.text3, fontVariantNumeric: "tabular-nums", minWidth: 44, flexShrink: 0 }}>{fmt(it.t)}</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: it.dot, flexShrink: 0, marginTop: "0.25rem" }} />
          <span style={{ fontSize: "0.76rem", color: C.text2, lineHeight: 1.4 }}>{it.text}</span>
        </div>
      ))}
    </SectionCard>
  );
}

/* ── Pipeline detail modal — describes PILOT's real, current audio pipeline
   (matches pipeline/*.py + services/stt.py + services/tts.py). ── */
const PIPELINE_STAGES = [
  { title: "Browser (Client)", tone: "blue" as const, status: "Live",
    lines: ["getUserMedia → AudioWorklet → PCM chunks", "WebSocket /ws/audio → Server"],
    tags: ["transcript", "tool_start", "tool_end", "job_queued"] },
  { title: "Silero VAD", tone: "violet" as const, status: "Active",
    lines: ["Reads short frames → speech detected", "Silence → TurnSegment → turn_q"],
    tags: ["turn_q"] },
  { title: "Smart Turn", tone: "green" as const, status: "Active",
    lines: ["Linguistic heuristic — trailing punctuation / dangling conjunctions", "Complete? → route now | Incomplete? → buffer & wait for more speech"],
    tags: [] },
  { title: "Diarizer", tone: "amber" as const, status: "Active",
    lines: ["SpeechBrain ECAPA-TDNN embeddings — separates speakers in the same audio stream", "Outputs a labeled turn → identity_q"],
    tags: ["identity_q"] },
  { title: "Identity Resolver", tone: "blue" as const, status: "Active",
    lines: ["Cosine similarity vs enrolled voice profiles", "Above threshold → identified | else → fallback role"],
    tags: [] },
  { title: "ASR Worker", tone: "violet" as const, status: "Active",
    lines: ["faster-whisper (CPU) / MLX Whisper (Apple Silicon)", "Dual write: transcript_q (live) + TranscriptLog (DB)"],
    tags: ["transcript_q"] },
  { title: "Front LLM", tone: "green" as const, status: "Active",
    lines: ["Ollama (qwen2.5:7b) → route decision JSON", "ignore | respond_now | delegate"],
    tags: ["ignore", "respond_now", "delegate"] },
  { title: "Background Agent", tone: "amber" as const, status: "Active",
    lines: ["PolicyGate (RBAC) → BGSupervisor → Tool Registry", "Executes the tool, writes an audit log row, streams events"],
    tags: ["job_queued", "tool_start", "tool_end"] },
  { title: "Text-to-Speech", tone: "blue" as const, status: "Active",
    lines: ["edge-tts (primary) → Kokoro-ONNX / macOS say (fallback)", "tts_audio event → browser playback"],
    tags: ["tts_audio"] },
];

function PipelineDetailModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 16, padding: "1.5rem", width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 48px rgba(0,0,0,0.18)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <DashboardIcon size={17} color={C.amberDark} />
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>Voice Agent Process Pipeline</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, display: "flex", alignItems: "center" }}>
            <XIcon size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.25rem" }}>
          <div style={{ position: "relative", paddingLeft: "2.5rem" }}>
            <div style={{ position: "absolute", left: 14, top: 14, bottom: 14, width: 2, background: `repeating-linear-gradient(180deg, ${C.border} 0 4px, transparent 4px 8px)` }} />
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.title} style={{ position: "relative", marginBottom: i === PIPELINE_STAGES.length - 1 ? 0 : "0.85rem" }}>
                <IconBadge size={28} tone={stage.tone} style={{ position: "absolute", left: -38, top: 2, fontWeight: 800, fontSize: "0.78rem" }}>
                  {i + 1}
                </IconBadge>
                <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "0.85rem 1rem", border: `1.5px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text1 }}>{stage.title}</span>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 20, background: stage.status === "Live" ? "rgba(34,197,94,0.12)" : C.amberBg, color: stage.status === "Live" ? C.green : C.amberDark }}>
                      {stage.status}
                    </span>
                  </div>
                  {stage.lines.map((line, li) => (
                    <div key={li} style={{ fontSize: "0.76rem", color: C.text2, lineHeight: 1.55 }}>{line}</div>
                  ))}
                  {stage.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.55rem" }}>
                      {stage.tags.map(tag => (
                        <span key={tag} style={{ fontSize: "0.62rem", fontWeight: 600, color: C.text3, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "0.12rem 0.4rem", fontFamily: "monospace" }}>
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

export function MainDashboard() {
  const store = useAppStore();
  const sess = useSession();
  const ts = sess.transcripts;
  const tc = store.toolCards;
  const [showPipeline, setShowPipeline] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/sessions/stats", { headers: { Authorization: `Bearer ${store.token}` } })
      .then(r => r.json()).then(setStats).catch(() => {});
  }, [store.token]);

  const last = ts[ts.length - 1];
  const roleLevel = ({ admin: 4, manager: 3, csr: 2, operator: 2, developer: 2, user: 1, guest: 1 } as Record<string, number>)[store.user?.role?.toLowerCase() || "user"] ?? 1;
  const running = tc.find((c: any) => c.status === "running");
  const busy = sess.isListening || !!running;
  const st = (sess.agentStatus || "").toLowerCase();
  const phase = !busy ? 0
    : st.includes("speak") || st.includes("respond") ? 4
    : st.includes("task") || st.includes("running") || running ? 3
    : st.includes("process") || st.includes("think") ? 2
    : st.includes("listen") ? 1 : 1;
  const stepState = (i: number): "done" | "active" | "pending" =>
    phase === 0 ? "pending" : i < phase ? "done" : i === phase ? "active" : "pending";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ flex: 1, overflow: "auto", padding: "2rem 2.5rem 8rem" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.02em", color: C.text1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {store.user?.name || "Control Center"}
              {/* <WaveBars active={sess.isListening} level={sess.level} count={4} color={C.amber} /> */}
            </h1>
            {/* <p style={{ color: C.text3, fontSize: "0.82rem" }}>Monitor live conversations, agent activity, and background tasks.</p> */}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
            {/* <StatusChip label="System Healthy" tone="good" icon={<CheckCircleIcon size={13} color={C.green} />} />
            <StatusChip label={stats?.avg_latency_ms != null ? `Latency ${stats.avg_latency_ms}ms` : "Latency —"}
              tone={stats?.avg_latency_ms != null && stats.avg_latency_ms < 1500 ? "good" : "warn"}
              icon={<ZapIcon size={12} color={stats?.avg_latency_ms != null && stats.avg_latency_ms < 1500 ? C.green : C.amber} />} />
            <StatusChip label={`${tc.filter((c: any) => c.status === "running").length} Workers`} tone="accent" icon={<GearIcon size={12} color={C.amberDark} />} /> */}
            <StatusChip label={`Level ${roleLevel} Access`} tone="good" icon={<LockIcon size={12} color={C.green} />} />
            <button onClick={() => setShowPipeline(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.85rem", background: C.surface, borderRadius: 20, border: `1.5px solid ${C.amber}`, fontSize: "0.72rem", fontWeight: 700, color: C.amberDark, cursor: "pointer" }}>
              View details <ArrowRightIcon size={12} />
            </button>
          </div>
        </div>

        {/* Live Conversation | Current Task + Queue | Agent is Working */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem", alignItems: "start" }}>
          {/* Live Transcript */}
          <div style={{ background: C.surface, borderRadius: 14, padding: "1.25rem", border: `1.5px solid ${C.border}`, height: 420, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 700, fontSize: "0.92rem" }}>
                <MicIcon size={16} color={C.amberDark} /> Live Transcript
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.55rem", borderRadius: 20, background: sess.isListening ? "rgba(34,197,94,0.12)" : "var(--bg2)", color: sess.isListening ? C.green : C.text3 }}>
                <DotIcon size={6} color={sess.isListening ? C.green : C.text3} />
                {sess.isListening ? "Live" : "Idle"}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {ts.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", textAlign: "center" }}>
                  <WaveBars active={sess.isListening} level={sess.level} count={5} color={C.text3} />
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: C.text1, marginTop: "0.4rem" }}>
                    {sess.isListening ? "Listening for speech…" : "Not connected"}
                  </div>
                  <div style={{ fontSize: "0.76rem", color: C.text3 }}>Start speaking to see live transcription here.</div>
                </div>
              ) : (
                <div>
                  {ts.slice(-8).map((t: any, i: number) => (
                    <div key={i} style={{ marginBottom: "0.5rem", animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: t.speaker === "PILOT" ? C.amber : C.amberDark, marginBottom: "0.1rem" }}>
                        {t.speaker === "PILOT" ? "PILOT" : speakerName(t.speaker, store.user?.name || "You")}
                      </div>
                      <div style={{ background: t.speaker === "PILOT" ? C.amberBg : "var(--bg2)", borderRadius: 8, padding: "0.4rem 0.6rem", fontSize: "0.8rem", lineHeight: 1.5, color: t.speaker === "PILOT" ? C.amberDark : C.text1 }}>
                        {t.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Stat chips */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.6rem", marginTop: "0.9rem", flexShrink: 0 }}>
              {[
                { label: "Language", value: "en-US" },
                { label: "Model", value: "Whisper" },
                { label: "Latency", value: stats?.avg_latency_ms != null ? `~${stats.avg_latency_ms}ms` : "—" },
                { label: "Confidence", value: last?.confidence != null ? `${Math.round(last.confidence * 100)}%` : "—" },
              ].map(chip => (
                <div key={chip.label} style={{ background: "var(--bg2)", borderRadius: 8, padding: "0.5rem 0.6rem", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: "0.62rem", color: C.text3, marginBottom: "0.15rem" }}>{chip.label}</div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Task + Queue */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", height: 420 }}>
            {/* <SectionCard title="Current Task" icon={<PinIcon size={14} color={C.amberDark} />}
              right={<StatusChip label={busy ? "Running" : "Idle"} tone={busy ? "accent" : "neutral"} />}
              bodyStyle={{ padding: "1rem 1.1rem" }} style={{ flexShrink: 0 }}>
              {busy ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BotIcon size={17} color={C.amberDark} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {running ? (running.tool || "task").replace(/_/g, " ") : "Listening for speech"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: C.text3, marginTop: "0.15rem" }}>
                      {sess.agentStatus || "Capturing your voice…"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.78rem", color: C.text3, padding: "0.3rem 0" }}>
                  No active task — press the mic or say "Hey Pilot" to begin.
                </div>
              )}
            </SectionCard> */}

            <SectionCard title="Queue" icon={<DashboardIcon size={14} color={C.amberDark} />}
              style={{ flex: 1 }} bodyStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "0.9rem 1.1rem" }}>
                {tc.length === 0 ? (
                  <div style={{ height: "100%", minHeight: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem", textAlign: "center" }}>
                    <DashboardIcon size={22} color={C.text3} />
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.text2 }}>No jobs in queue</div>
                    <div style={{ fontSize: "0.68rem", color: C.text3 }}>Background jobs will appear here.</div>
                  </div>
                ) : tc.slice(-6).reverse().map((c: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.7rem" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: c.status === "ok" ? C.green : c.status === "running" ? C.amber : "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: c.status === "pending" ? `1.5px solid ${C.border}` : "none" }}>
                      {c.status === "ok" ? <CheckIcon size={9} strokeWidth={3} /> : c.status === "running" ? <DotIcon size={6} /> : <DotIcon size={6} filled={false} color={C.text3} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: c.status === "ok" ? C.text3 : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(c.tool || "task").replace(/_/g, " ")}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.64rem", fontWeight: 700, color: c.status === "running" ? C.amber : c.status === "ok" ? C.green : C.text3 }}>
                      {c.status === "running" ? "Running" : c.status === "ok" ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Agent is Working — reason → plan → act → respond trace */}
          <SectionCard title="Agent is Working" icon={<SparkleIcon size={14} color={C.amberDark} />}
            right={<StatusChip label={busy ? "Active" : "Standby"} tone={busy ? "good" : "neutral"} />}
            style={{ height: 420 }} bodyStyle={{ overflowY: "auto" }}>
            <StepRow label="Listening" state={stepState(1)} sub={stepState(1) !== "pending" ? "Capturing your voice…" : undefined} />
            <StepRow label="Understanding" state={stepState(2)} sub={stepState(2) === "done" ? "Speech recognized" : stepState(2) === "active" ? "Interpreting intent" : undefined} />
            <StepRow label="Thinking" state={stepState(3)} sub={stepState(3) !== "pending" ? (
              <span>Interpreting intent and planning action
                {running && <span style={{ display: "block", marginTop: "0.4rem" }}><StatusChip label={(running.tool || "task").replace(/_/g, " ")} tone="accent" /></span>}
              </span>
            ) : undefined} />
            <StepRow label="Responding" state={stepState(4)} last sub={stepState(4) === "active" ? "Composing the reply…" : undefined} />
          </SectionCard>
        </div>

        {/* Metric tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
          <MetricTile Icon={DashboardIcon} tone="blue" label="Sessions Today" value={stats ? String(stats.sessions_today) : "—"} deltaPct={stats?.sessions_delta_pct} />
          <MetricTile Icon={ClipboardIcon} tone="green" label="Transcripts" value={stats ? String(stats.transcripts_today) : "—"} deltaPct={stats?.transcripts_delta_pct} />
          <MetricTile Icon={ZapIcon} tone="amber" label="Avg. Latency" value={stats?.avg_latency_ms != null ? `${stats.avg_latency_ms}ms` : "—"} extra={stats?.avg_latency_ms != null ? (stats.avg_latency_ms < 1500 ? "Good" : "Slow") : undefined} />
          <MetricTile Icon={SparkleIcon} tone="violet" label="Tools Used" value={stats ? String(stats.tools_today) : "—"} deltaPct={stats?.tools_delta_pct} />
        </div>

        {/* Recent Sessions — full width now that ActivityFeed (its old grid
            neighbor) is disabled; gridTemplateColumns was a leftover from
            when this row had two columns and had no effect on this
            display:"flex" container. */}
        <div style={{ display: "flex", alignItems: "start" }}>
          {store.token && <div style={{ flex: 1 }}><SessionsList token={store.token} /></div>}
        </div>
      </div>

      {showPipeline && <PipelineDetailModal onClose={() => setShowPipeline(false)} />}

      <LiveTranscriptBar
        transcripts={ts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} level={sess.level}
        onToggle={() => sess.toggle("general")}
      />
    </div>
  );
}
