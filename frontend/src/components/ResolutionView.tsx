/**
 * Customer Resolution — live CSR-dashboard panel showing:
 * - Live customer frustration/sentiment meter (sentiment_update WS events)
 * - Resolution confidence + escalate/resolve recommendation (resolution_update)
 * - Matched KB articles + escalation reasons
 * - Manual "Assess Now" / "Create Escalation Ticket" dashboard buttons
 *   (voice — "should I escalate this?" — works the same way via the tool registry)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { useAppStore } from "../store/SessionStore";
import { C } from "./transcript/helpers";
import { WaveBars } from "./transcript/LiveTranscriptBar";

interface KBArticle { doc_id: number; title: string; excerpt: string; score: number; }

interface ResolutionUpdate {
  resolution_confidence: number;
  recommendation: "resolve" | "escalate";
  reasoning: string;
  escalation_target: string | null;
  escalation_reasons: string[];
  issue_summary: string;
  kb_articles: KBArticle[];
}

interface SentimentUpdate {
  sentiment: "negative" | "neutral" | "positive";
  sentiment_score: number;
  frustration_score: number;
  urgency: "low" | "medium" | "high";
}

const api = async (method: string, path: string, body?: unknown) => {
  const token = useAppStore.getState().token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
};

export function ResolutionCopilotView({ sessionId, isListening, agentStatus }:
  { sessionId: string | null; isListening: boolean; agentStatus: string; onToggleMic: () => void }) {
  const [resolution, setResolution] = useState<ResolutionUpdate | null>(null);
  const [sentiment, setSentiment] = useState<SentimentUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState("");

  // Real two-party calling — rep talks through the browser (Twilio Voice JS
  // SDK / WebRTC), bridged by Twilio to a real phone call to the customer.
  // Call audio is streamed server-side into the same ASR/sentiment pipeline
  // (see api/ws_telephony.py) that populates the panels above.
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "ringing" | "connected" | "ended" | "error">("idle");
  const [callError, setCallError] = useState("");
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);

  const startCall = useCallback(async () => {
    if (!phoneNumber.trim() || !sessionId) return;
    setCallError("");
    setCallStatus("connecting");
    try {
      if (!deviceRef.current) {
        const { token: voiceToken } = await api("GET", "/telephony/token");
        const device = new Device(voiceToken, { logLevel: "error" });
        deviceRef.current = device;
      }
      const call = await deviceRef.current.connect({
        params: { To: phoneNumber.trim(), session_id: sessionId },
      });
      activeCallRef.current = call;
      call.on("accept", () => setCallStatus("connected"));
      call.on("disconnect", () => setCallStatus("ended"));
      call.on("cancel", () => setCallStatus("ended"));
      call.on("error", (e: any) => { setCallError(e?.message || "Call error"); setCallStatus("error"); });
      setCallStatus("ringing");
    } catch (e: any) {
      setCallError(e.message || "Couldn't place the call. Is telephony configured (TWILIO_* in backend/.env)?");
      setCallStatus("error");
    }
  }, [phoneNumber, sessionId]);

  const hangUp = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setCallStatus("ended");
  }, []);

  useEffect(() => {
    return () => { deviceRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    const onResolution = (e: Event) => {
      setResolution((e as CustomEvent).detail);
      setLoading(false);
    };
    const onSentiment = (e: Event) => {
      setSentiment((e as CustomEvent).detail);
    };
    window.addEventListener("resolution_update" as any, onResolution);
    window.addEventListener("sentiment_update" as any, onSentiment);
    return () => {
      window.removeEventListener("resolution_update" as any, onResolution);
      window.removeEventListener("sentiment_update" as any, onSentiment);
    };
  }, []);

  const runAssess = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api("POST", "/resolution/assess", { session_id: sessionId });
      // resolution_assess returns just a spoken_reply (no recommendation/
      // confidence/etc.) when there's no customer conversation yet to
      // assess — that's not a real assessment, so don't render the panel
      // as if it were one (was previously showing a bogus NaN%/"resolve"
      // card, with an Escalate button that looked broken on empty data).
      if (res.recommendation) {
        setResolution(res);
      } else {
        setResolution(null);
        setError(res.spoken_reply || "No assessment available yet.");
      }
    } catch (e: any) {
      setError(e.message || "Assessment failed");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const runEscalate = useCallback(async () => {
    if (!sessionId) return;
    setEscalating(true);
    setError("");
    try {
      await api("POST", "/resolution/escalate", {
        session_id: sessionId,
        synopsis: resolution?.issue_summary || "Escalated from Customer Resolution dashboard",
        escalation_target: resolution?.escalation_target || undefined,
      });
    } catch (e: any) {
      setError(e.message || "Escalation failed");
    } finally {
      setEscalating(false);
    }
  }, [sessionId, resolution]);

  const confPct = resolution ? Math.round(resolution.resolution_confidence * 100) : null;
  const confColor = confPct == null ? C.text3 : confPct >= 70 ? C.green : confPct >= 40 ? C.amber : C.red;
  const frustPct = sentiment ? Math.round(sentiment.frustration_score * 100) : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", background: C.bg, padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, color: C.text1, fontSize: "1.4rem" }}>🧭 Customer Resolution</h2>
          <div style={{ color: C.text3, fontSize: "0.85rem" }}>{agentStatus}</div>
        </div>
        <WaveBars active={isListening} level={isListening ? 0.6 : 0} />
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: C.red, padding: "0.6rem 1rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {!sessionId && (
        <div style={{ background: C.amberBg, color: C.text1, padding: "0.6rem 1rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.82rem" }}>
          ⓘ Start a session first — click the mic bar at the bottom of the page. The Assess and Escalate buttons below are disabled until a session is active.
        </div>
      )}

      {/* Call Customer — real two-party calling via Twilio */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", color: C.text2, marginBottom: 8, fontWeight: 600 }}>Call Customer</div>
        {callError && (
          <div style={{ background: "#FEE2E2", color: C.red, padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: 8, fontSize: "0.78rem" }}>
            {callError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+15551234567" disabled={callStatus === "ringing" || callStatus === "connected"}
            style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: "0.82rem", background: "#fff", color: C.text1 }} />
          {callStatus === "ringing" || callStatus === "connected" ? (
            <button onClick={hangUp} style={{
              background: C.red, color: "#fff", border: "none", borderRadius: 8,
              padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
            }}>
              {callStatus === "ringing" ? "Cancel" : "Hang Up"}
            </button>
          ) : (
            <button onClick={startCall} disabled={!sessionId || !phoneNumber.trim() || callStatus === "connecting"}
              title={!sessionId ? "Start a session first (mic bar at the bottom of the page)" : undefined}
              style={{
                background: C.green, color: "#fff", border: "none", borderRadius: 8,
                padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600,
                cursor: (!sessionId || !phoneNumber.trim() || callStatus === "connecting") ? "not-allowed" : "pointer",
                opacity: (!sessionId || !phoneNumber.trim() || callStatus === "connecting") ? 0.5 : 1,
              }}>
              {callStatus === "connecting" ? "Connecting…" : "📞 Call"}
            </button>
          )}
        </div>
        {(callStatus === "ringing" || callStatus === "connected") && (
          <div style={{ fontSize: "0.75rem", color: C.text3, marginTop: 6 }}>
            {callStatus === "ringing" ? "Ringing…" : "🟢 Connected — transcribing and scoring sentiment live"}
          </div>
        )}
      </div>

      {/* Sentiment meter */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", color: C.text2, marginBottom: 6, fontWeight: 600 }}>Live Customer Sentiment</div>
        {sentiment ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.border, overflow: "hidden" }}>
                <div style={{
                  width: `${frustPct}%`, height: "100%",
                  background: frustPct >= 70 ? C.red : frustPct >= 40 ? C.amber : C.green,
                  transition: "width 0.3s",
                }} />
              </div>
              <span style={{ fontSize: "0.8rem", color: C.text1, minWidth: 40 }}>{frustPct}%</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: C.text3, marginTop: 4 }}>
              {sentiment.sentiment} · urgency: {sentiment.urgency}
            </div>
          </>
        ) : (
          <div style={{ fontSize: "0.8rem", color: C.text3 }}>No customer turns scored yet this call.</div>
        )}
      </div>

      {/* Resolution assessment panel */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.2rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: "0.9rem", color: C.text1, fontWeight: 700 }}>Resolution Assessment</div>
          <button onClick={runAssess} disabled={loading || !sessionId}
            title={!sessionId ? "Start a session first (mic bar at the bottom of the page)" : undefined}
            style={{
              background: C.amber, color: "#1A1A1A", border: "none", borderRadius: 8,
              padding: "0.4rem 0.9rem", fontSize: "0.8rem", fontWeight: 600,
              cursor: (loading || !sessionId) ? "not-allowed" : "pointer",
              opacity: (loading || !sessionId) ? 0.5 : 1,
            }}>
            {loading ? "Assessing..." : "Assess Now"}
          </button>
        </div>

        {resolution ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                border: `4px solid ${confColor}`, fontSize: "1.1rem", fontWeight: 800, color: confColor, flexShrink: 0,
              }}>
                {confPct}%
              </div>
              <div>
                <div style={{
                  display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700,
                  background: resolution.recommendation === "escalate" ? "#FEE2E2" : "#DCFCE7",
                  color: resolution.recommendation === "escalate" ? C.red : C.green,
                  textTransform: "uppercase",
                }}>
                  {resolution.recommendation === "escalate" ? "Recommend Escalate" : "Resolvable on this call"}
                </div>
                {resolution.escalation_target && (
                  <div style={{ fontSize: "0.75rem", color: C.text3, marginTop: 4 }}>→ {resolution.escalation_target}</div>
                )}
              </div>
            </div>

            <div style={{ fontSize: "0.85rem", color: C.text1, lineHeight: 1.5, marginBottom: 10 }}>{resolution.reasoning}</div>

            {resolution.issue_summary && (
              <div style={{ fontSize: "0.8rem", color: C.text2, fontStyle: "italic", marginBottom: 10 }}>
                "{resolution.issue_summary}"
              </div>
            )}

            {resolution.escalation_reasons?.length > 0 && (
              <ul style={{ margin: "0 0 10px 0", paddingLeft: 18, fontSize: "0.78rem", color: C.text2 }}>
                {resolution.escalation_reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}

            {resolution.kb_articles?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: "0.75rem", color: C.text3, fontWeight: 600, marginBottom: 4 }}>Matched KB articles</div>
                {resolution.kb_articles.map(a => (
                  <div key={a.doc_id} style={{ fontSize: "0.78rem", color: C.text2, padding: "0.3rem 0", borderTop: `1px solid ${C.border}` }}>
                    <strong>{a.title}</strong> <span style={{ color: C.text3 }}>({Math.round(a.score * 100)}% match)</span>
                    <div style={{ color: C.text3 }}>{a.excerpt}</div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={runEscalate} disabled={escalating || !sessionId}
              title={!sessionId ? "Start a session first (mic bar at the bottom of the page)" : undefined}
              style={{
                background: resolution.recommendation === "escalate" ? C.red : "transparent",
                color: resolution.recommendation === "escalate" ? "#fff" : C.text2,
                border: `1px solid ${resolution.recommendation === "escalate" ? C.red : C.border}`,
                borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600,
                cursor: (escalating || !sessionId) ? "not-allowed" : "pointer",
                opacity: (escalating || !sessionId) ? 0.5 : 1,
              }}>
              {escalating ? "Creating ticket..." : "Create Escalation Ticket"}
            </button>
          </>
        ) : (
          <div style={{ fontSize: "0.85rem", color: C.text3 }}>
            No assessment yet. Say "should I escalate this?" or click Assess Now once the call has some conversation.
          </div>
        )}
      </div>
    </div>
  );
}
