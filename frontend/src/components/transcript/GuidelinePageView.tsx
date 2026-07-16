import React from "react";
import { C } from "./helpers";

export function GuidelinePageView() {
  const sections = [
    {
      title: "🖥️ PPT COPILOT SYSTEM",
      color: C.amberDark,
      bg: "#FAF9F5",
      desc: "Controls, navigates, and edits presentation content in real time, executing lightweight rendering locally on device.",
      commands: [
        { spoken: "go to slide 5", action: "Instantly navigates the PowerPoint presentation viewer to slide 5." },
        { spoken: "next slide / previous slide / first slide / last slide", action: "Steps forward, backward, or jumps to the boundaries of the presentation deck." },
        { spoken: "change the title to Project Overview / add a bullet about market expansion", action: "Edits the title, bullets, speaker notes, or any other text on the current slide — every field you don't mention is left exactly as-is." },
        { spoken: "add a slide about pricing", action: "Inserts a brand-new slide; PILOT picks a sensible position automatically if you don't specify one." },
        { spoken: "move slide 2 after slide 5", action: "Reorders an existing slide without touching its content." },
        { spoken: "generate speaker notes for this slide / write notes for every slide", action: "Writes speaker notes for the current slide, or for the whole deck." },
        { spoken: "delete slide / delete this slide", action: "Deletes the current slide — Admin role only, and PILOT will ask you to say \"yes confirm\" before it actually removes anything." },
        { spoken: "summarize this slide", action: "Performs instant verbal summaries of bullet points and shapes on the active slide." },
        { spoken: "what did you just change?", action: "Recaps the most recent voice edit made to the deck." }
      ],
      details: "The PPT Copilot renders your presentation instantly and keeps it in sync as you navigate, letting you control, edit, reorder, and save slides hands-free using your voice — edits are text content only for now (title/bullets/notes/other text boxes); bold/italic/font-color styling and text-box drawing are mouse/toolbar-only, not yet wired to a voice command."
    },
    {
      title: "🎧 CUSTOMER CARE, FLIGHTS, HOTELS & TRAINS",
      color: "#2563EB",
      bg: "#F0F4FF",
      desc: "Performs dynamic, natural-language search lookups for flights, hotels, and train routes, presenting options directly in your workspace.",
      commands: [
        { spoken: "search flights from Mumbai to Delhi", action: "Looks up matching flights and auto-fills the sidebar route criteria." },
        { spoken: "find me 5 star hotels in Paris / any hotels near my location", action: "Pulls hotel listings matching the city, rating, or GPS criteria with ratings, rates, and imagery." },
        { spoken: "search trains from London to Manchester", action: "Looks up railway schedules and fares. If there's no direct train, PILOT finds a real connecting route through an interchange city instead of just reporting no results." },
      ],
      details: "When travel options are found, PILOT displays clean, interactive summary cards directly in your chat view — flight connections, hotel listings (with real images and ratings), and train itineraries. Place names are auto-corrected for typos before searching. Booking a flight/hotel/train is done by clicking the result card's Book button, not by voice yet; booking is a destructive action so it will ask you to say \"yes confirm\" before it finalizes. Hotel results only show room details the provider actually returns — PILOT never invents a bed count or amenity that isn't in the source data."
    },
    {
      title: "🧭 CUSTOMER RESOLUTION (disabled)",
      color: "#9CA3AF",
      bg: "#F3F4F6",
      desc: "Built but currently switched off — not reachable from the sidebar in this build.",
      commands: [],
      details: "The Customer Resolution dashboard (live frustration meter, resolve-vs-escalate recommendations, escalation ticket creation) and its backend tools still exist in the codebase, but navigation to it has been intentionally disabled — it's commented out of the sidebar and page router. It isn't part of the currently supported feature set — ask if you'd like it re-enabled."
    },
    {
      title: "✉️ EMAIL WORKFLOW CENTER (disabled)",
      color: "#9CA3AF",
      bg: "#F3F4F6",
      desc: "Built but currently switched off — not reachable from the sidebar or by voice in this build.",
      commands: [],
      details: "The Email Center component and its backend draft/send tools still exist in the codebase, but navigation to it has been intentionally disabled (it's commented out of the sidebar and page router, and voice routing no longer recognizes \"email\" as a destination). It isn't part of the currently supported feature set — ask if you'd like it re-enabled."
    },
    {
      title: "📹 MeetRoom MEETING SPACE",
      color: "#7C3AED",
      bg: "#F5F3FF",
      desc: "An integrated collaboration space for high-fidelity virtual video meetings with live multi-speaker transcription.",
      commands: [
        { spoken: "go to meetings / start meeting / join meeting / talkinia", action: "Navigates your workspace to the Talkinia Meeting space to create or enter a room." }
      ],
      details: "Talkinia opens directly inside your PILOT workspace (embedded), carrying your identity over automatically so you're recognized the moment you join — no separate sign-in needed. During active meetings, PILOT performs continuous diarization and voiceprint tracking to log who is speaking. Meeting-minutes compilation exists as a backend capability (admin-only) but isn't currently wired to a spoken command — for now, ask a developer/admin if you need a transcript compiled."
    },
    {
      title: "🧠 VOICE ROUTING & CONCURRENCY SYSTEMS",
      color: "#4F46E5",
      bg: "#EEF2FF",
      desc: "Controls ambient environment listener parameters, wake-up states, barge-in windows, and dynamic page routing.",
      commands: [
        { spoken: "go to trip planner / go to ppt copilot / go to meetings / go to guidelines / go to profile / go to settings / go to dashboard", action: "Routes the frontend canvas to the named workstation area via voice — works with \"go to\", \"open\", \"switch to\", \"navigate to\", \"show\", \"start\", or \"join\"." },
        { spoken: "stop / cancel / please stop / stop now / hey pilot stop", action: "Immediately silences PILOT's speech and cancels whatever background job is currently running — natural filler words (\"please\", \"just\", \"now\", \"hey pilot\") are stripped before matching, so you don't have to say the bare word \"stop\"." },
        { spoken: "Hey Pilot / Hello Pilot", action: "Wakes PILOT up and resumes active ambient listening." },
        { spoken: "Go to sleep / Stop listening", action: "Pauses ambient listening cleanly until you wake it again." }
      ],
      details: "PILOT continuously listens for natural pauses in speech and gives you a short window to finish a full thought before responding, so it won't cut you off mid-sentence. Saying \"customer care\" or \"customer resolution\" by voice still gets recognized as a page-routing phrase, but since that page is now disabled it just silently lands you on the Main Dashboard instead — say \"trip planner\" or \"travel\" if you mean flights/hotels/trains. \"Email\" and \"chat\" are not recognized destinations since those pages are disabled. Current queue status is displayed directly in the visual UI queue backlog tracker (right sidebar)."
    }
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 2.5rem", background: C.surface, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <h1 style={{ fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", color: C.text1 }}>
          📖 System Guidelines & Operator Manual
        </h1>
        <p style={{ fontSize: "0.85rem", color: C.text3, marginTop: 4 }}>
          A comprehensive guide for using PILOT's Voice AI Copilot modules and everyday workflows.
        </p>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem 5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

        {/* Intro */}
        <div style={{ background: C.surface, borderRadius: 14, padding: "1.5rem", border: `1.5px solid ${C.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>System Overview</h2>
          <p style={{ fontSize: "0.88rem", color: C.text2, lineHeight: 1.6, margin: 0 }}>
            PILOT is a voice-first AI workspace designed to orchestrate complex task workflows through natural speech.
            By combining continuous audio understanding, automatic speaker recognition, biometric access control, and real-time task execution,
            PILOT acts as a seamless extension of your desktop environment.
          </p>
        </div>

        {/* Quick Start Step-by-Step User Guide */}
        <div style={{ background: C.surface, borderRadius: 14, padding: "2rem", border: `1.5px solid ${C.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: C.text1 }}>
            🚀 Quick Start: How to Use PILOT
          </h2>
          <p style={{ fontSize: "0.85rem", color: C.text3, marginBottom: "1.5rem" }}>
            Follow these steps to experience the full power of a voice-first cognitive workspace.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>1</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Enroll Your Voice Profile</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Complete the 3-round voice calibration during registration. This creates a secure, unique biometric signature used to verify your identity.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>2</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Start the Voice Session</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Navigate to the Dashboard and tap the microphone icon at the bottom of the screen (or speak the wake word <em>"Hey Pilot"</em>) to activate listening.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>3</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Speak Natural Commands</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Speak naturally. The biometrics engine automatically identifies your profile, attributes the transcript, and delegates the task.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>4</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Manage Slide Presentations</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Go to PPT Copilot. Use voice to generate slides, edit bullet outlines on the sidebar, or resize layouts by dragging the split divider bar.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>5</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Search Flights, Hotels & Trains</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Go to Trip Planner. Speak a route or destination — misspoken city/station names are auto-corrected before the search runs, and trains without a direct route automatically get a real connecting itinerary via an interchange city.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.amberBg, color: C.amberDark, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>6</div>
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.3rem 0", color: C.text1 }}>Join a Meeting</h4>
                <p style={{ fontSize: "0.8rem", color: C.text2, lineHeight: 1.5, margin: 0 }}>
                  Join a Talkinia meeting room to see speech diarized in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Layout Map */}
        <div style={{ background: C.surface, borderRadius: 14, padding: "2rem", border: `1.5px solid ${C.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: C.text1 }}>
            🗺️ Navigating the PILOT Workspace
          </h2>
          <p style={{ fontSize: "0.85rem", color: C.text3, marginBottom: "1.5rem" }}>
            The interface is structured into four key functional zones to maximize voice-first productivity.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2.5rem" }}>
            <div style={{ borderRight: `1px dashed ${C.border}`, paddingRight: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "#FAF9F5", border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: C.text1 }}>1. Navigation Sidebar</h4>
                <p style={{ fontSize: "0.78rem", color: C.text2, margin: 0, lineHeight: 1.5 }}>
                  Positioned on the far left. Allows instant tab transitions between Main Dashboard, PPT Copilot, Trip Planner, MeetRoom, and System Guidelines. (Customer Resolution, Email Center, and Wanna Chat exist in the codebase but are currently disabled from navigation.)
                </p>
              </div>
              <div style={{ background: "#FAF9F5", border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: C.text1 }}>2. Main Workstation Area</h4>
                <p style={{ fontSize: "0.78rem", color: C.text2, margin: 0, lineHeight: 1.5 }}>
                  The central canvas displaying the active module. When in PPT Copilot, this houses the resizable widescreen slide deck workspace.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "#FAF9F5", border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: C.text1 }}>3. Agent Activity Backlog (Right Sidebar)</h4>
                <p style={{ fontSize: "0.78rem", color: C.text2, margin: 0, lineHeight: 1.5 }}>
                  A sticky right-hand panel displaying running background tasks. It updates in real-time as background jobs are queued, processed, and completed.
                </p>
              </div>
              <div style={{ background: "#FAF9F5", border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: C.text1 }}>4. Live Transcript & Mic Bar (Bottom Overlay)</h4>
                <p style={{ fontSize: "0.78rem", color: C.text2, margin: 0, lineHeight: 1.5 }}>
                  The sticky bottom panel. Houses the global microphone toggle, live audio frequency bars, and real-time transcription status. Can be toggled on/off in the Settings page.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {sections.map((sec, idx) => (
            <div key={idx} style={{
              background: C.surface,
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
            }}>
              <div style={{ background: sec.bg, padding: "1.25rem 1.5rem", borderBottom: `1.5px solid ${C.border}`, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 800, color: sec.color, letterSpacing: "0.04em" }}>
                  {sec.title}
                </span>
                <p style={{ fontSize: "0.82rem", color: C.text1, margin: 0, fontWeight: 500 }}>
                  {sec.desc}
                </p>
              </div>

              <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2rem" }}>
                <div style={{ borderRight: `1px dashed ${C.border}`, paddingRight: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: C.text3, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                    How It Works
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: C.text2, lineHeight: 1.55, margin: 0 }}>
                    {sec.details}
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: C.text3, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                    Standard Voice Triggers
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {sec.commands.map((cmd, cIdx) => (
                      <div key={cIdx} style={{ background: "#FAF9F5", padding: "0.75rem 1rem", borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.7rem", color: C.amberDark }}>🗣️</span>
                          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: C.text1 }}>
                            "{cmd.spoken}"
                          </span>
                        </div>
                        <p style={{ fontSize: "0.74rem", color: C.text2, lineHeight: 1.45, margin: 0 }}>
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
    </div>
  );
}