# Talkinia — Meetings

Video meeting rooms with live transcription, speaker diarization, voice-controlled navigation, and AI-compiled meeting-summary emails. A separate Next.js 14 app (this directory), embedded into PILOT's main dashboard via iframe, backed by PILOT's FastAPI backend for everything beyond the video call itself.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires `STREAM_APP_ID`/`STREAM_API_KEY`/`STREAM_SECRET_KEY` (GetStream.io) in `.env` — see `.env` in this directory for the current keys and the `NEXT_PUBLIC_PILOT_BACKEND_HOST` setting described below.

## Architecture

- **Video/audio call itself**: [Stream Video SDK](https://getstream.io/video/) — real cloud infrastructure, works cross-machine/cross-network out of the box. `components/MeetingRoom.tsx` is the main call UI.
- **Identity**: `providers/ClerkMockProvider.tsx` — carries the real logged-in user's name/email/role/token over via URL query params when entering from PILOT's iframe; falls back to a random `guest_XXXX@localhost` identity otherwise (there's no real Clerk integration despite the naming, it's a mock).
- **Transcription/diarization/notes**: NOT part of Stream — these are PILOT-specific and go over a WebSocket/HTTP connection straight to the PILOT backend (`/ws/events/{session}`, `/ws/audio/{session}`, `/api/v1/sessions/{id}/compile-notes`).

## Cross-machine meetings: what works, what needs setup

The video call connects fine cross-machine on its own (that's Stream's job). Transcription/diarization/notes need **all participants' browsers pointed at the same PILOT backend** — by default each browser talks to `localhost:8000`, which only works when everyone's on the same machine as the backend.

To fix this for a real multi-person meeting on the same network:
1. Start the backend with `uvicorn backend.main:app --host 0.0.0.0 --port 8000` (already documented in the main README) so it's reachable from other machines.
2. Set `NEXT_PUBLIC_PILOT_BACKEND_HOST=<backend-machine-LAN-IP>:8000` in `.env` on every machine running this frontend, then restart the dev server (it's a build-time `NEXT_PUBLIC_` var).
3. The backend's CORS config (`backend/main.py`) already allows private-LAN origins (192.168.x.x, 10.x.x.x, 172.16-31.x.x) on ports 3000/5173 via `allow_origin_regex`.

Without this, transcription/notes silently only work for whoever happens to share a machine with the backend — everyone else's speech is captured client-side but never reaches the server, and they're silently excluded from the notes-email recipients too (see below).

## Meeting-summary emails

Clicking "Compile Notes" (`handleEmailNotes` in `MeetingRoom.tsx`) POSTs to the backend, which resolves recipients from three sources (`backend/tools/meeting_summarizer.py`): the clicker's own email, everyone registered in `session_participants` (populated when their WS connection succeeds), and a DB lookup matching transcript speaker names to `User.email`. This only reaches everyone if their WS connections actually succeeded against the shared backend — see the cross-machine section above.

## Voice control

`components/LiveTranscriptBar.tsx` — a floating pill (mic button + live transcript text, matching PILOT's own transcript-bar design) on the Home page. Recognizes spoken commands via the browser's native `SpeechRecognition` (no backend round-trip):

| Say | Does |
|---|---|
| "start an instant meeting" / "new meeting" | Creates + routes straight to the pre-join camera/mic screen (skips the confirmation modal) |
| "join a meeting" | Opens the join-by-link modal |
| "schedule a meeting" | Opens the schedule modal |
| "go to recordings" / "go to upcoming" / "go to home" / "go to personal room" | Navigates directly to that sidebar page |

Dispatches a `talkinia:voice-command` window event that `components/MeetingTypeList.tsx` listens for (meeting actions) or navigates directly via `next/navigation` (plain page nav) — kept decoupled since the mic lives outside that component.

## Known limitations

- Speaker diarization/identification during a meeting depends on PILOT's voice-enrollment system (see the backend's `VOICE_ENROLLMENT_DIARIZATION_README.md`) — an unenrolled or not-yet-re-enrolled participant will show as "You" (if they're the first voice heard in the session) or "Unknown speaker (spk-N)" (any other unmatched voice), never silently mislabeled as someone else.
- "Previous meetings" sidebar link is commented out/disabled in `constants/index.ts` — no real page behind it yet.
