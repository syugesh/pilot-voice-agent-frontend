# Main Dashboard & Transcript Pipeline

The dashboard shell every PILOT page lives inside, plus the real-time voice pipeline (mic → transcript → agent) that feeds all of them.

## Where the code lives

| Piece | File |
|---|---|
| Dashboard shell / router | `index.tsx` — `Dashboard()`, a "keep-alive tab router": every page view is always mounted (`display: none` when inactive) rather than unmounted/remounted on nav, so a session's state (mic listening, transcript, in-progress work) survives switching tabs |
| Sidebar nav | `Sidebar.tsx` |
| Overview page | `MainDashboard.tsx` — metrics, pipeline-stage visualization, recent sessions list, live activity feed |
| Session state | `useSession.ts` — the hook every page view (`CustomerCareView`, `PPTPageView`, `MeetingsPageView`, …) calls for `sessionId`, `isListening`, `agentStatus`, `transcripts`, mic toggle |
| Live transcript UI | `LiveTranscriptBar.tsx` — the floating pill (mic button, current spoken line, waveform, "Listening" indicator) shown at the bottom of the active page |
| Shared utilities | `helpers.tsx` — theme colors (`C`), the `speakerName()` fallback helper, and the `parse*FromText` functions that turn the agent's raw reply text into structured result cards (hotels/flights/trains) |
| Past-session viewer | `SessionModal.tsx` — `SessionHistoryModal` (view one past session's full transcript) and `SessionsList` (recent sessions on the dashboard) |

## Backend pipeline this all reflects

`useSession`'s live data comes from a WebSocket pipeline in `backend/pipeline/`: audio comes in → `asr_worker.py` (speech-to-text) → `diarizer.py` (which voice is this, within the session) → `identity_resolver.py` (whose voice is this, against enrolled profiles — see the Voice Enrollment README) → `front_llm.py` (routes to the right tool/agent) → broadcast back over the WS as a labeled transcript turn.

## The "You" vs. real name display rule

The backend sends the literal string `"You"` when a voice couldn't be matched to an enrolled profile — this is data, not a placeholder the frontend invents. `speakerName()` in `helpers.tsx` is the one place that decides what to actually show:

```ts
export function speakerName(speaker: string | null | undefined, fallback: string): string {
  return (!speaker || speaker === "You") ? fallback : speaker;
}
```

Every transcript-rendering spot (`LiveTranscriptBar`, `MainDashboard`, `SessionModal`) must use this — a plain `speaker || fallback` check silently never fires, since `"You"` is truthy. Anything the backend labels `"Unknown speaker (spk-N)"` (a genuinely different, unmatched voice — see the diarization README) passes through unchanged and displays as-is, since that's already honest.

## Disabled features still in the codebase

Customer Resolution, Email Center, and Wanna Chat are fully built but commented out of navigation (`Sidebar.tsx`, `index.tsx`) and the Main Dashboard's page-fallback list — following this project's "comment out, never delete" convention, so they're a quick re-enable away rather than gone. `GuidelinePageView.tsx` documents this in its own in-app copy so users aren't left guessing why a voice command like "go to customer resolution" gets recognized by the backend but lands on the Dashboard instead.
