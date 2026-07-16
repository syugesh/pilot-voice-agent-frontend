import React from "react";
import { ResolutionCopilotView } from "../ResolutionView";
import { useSession } from "./useSession";
import { isResolutionRelated } from "./helpers";
import { LiveTranscriptBar } from "./LiveTranscriptBar";

export function ResolutionPageView() {
  const sess = useSession();
  const resolutionTranscripts = sess.transcripts.filter(t => isResolutionRelated(t.text));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflowY: "auto", overflowX: "hidden" }}>
      <ResolutionCopilotView
        sessionId={sess.sessionId}
        isListening={sess.isListening}
        agentStatus={sess.agentStatus}
        onToggleMic={() => sess.toggle("customercare")}
      />
      <LiveTranscriptBar
        transcripts={resolutionTranscripts} agentStatus={sess.agentStatus}
        isListening={sess.isListening} level={sess.level}
        onToggle={() => sess.toggle("customercare")}
      />
    </div>
  );
}
