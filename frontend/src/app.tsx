import React from "react";
import { useAppStore } from "./store/SessionStore";
import { LandingPage } from "./components/SessionHeader";
import { Dashboard }   from "./components/TranscriptOverlay";
import "./global.css";

const DASH_PAGES = ["dashboard","ppt","care","profile","settings","guidelines","about"];

// Module-level (not React state) so it survives React.StrictMode's double-invoke
// of effects in dev — this init logic reads + destructively clears URL params and
// must run exactly once per page load, or the 2nd invocation falls through to the
// localStorage-restore branch and clobbers the SSO redirect's page decision.
let didInitFromUrl = false;

export default function App() {
  const page  = useAppStore((s) => s.page);
  const theme = useAppStore((s) => s.theme);

  // Dark theme is only allowed inside the dashboard. Landing/auth pages are always light.
  const activeTheme = DASH_PAGES.includes(page) ? theme : "light";

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme);
  }, [activeTheme]);

  React.useEffect(() => {
    if (didInitFromUrl) return;
    didInitFromUrl = true;

    const store = useAppStore.getState();

    // Apply theme immediately — light for landing/auth, saved preference for dashboard
    const initialPage = store.page;
    const initialTheme = DASH_PAGES.includes(initialPage) ? store.theme : "light";
    document.documentElement.setAttribute("data-theme", initialTheme);

    // Handle Google SSO redirect: /?sso_token=...&sso_user=...&voice_enrolled=0|1&new_user=0|1
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    const ssoUser  = params.get("sso_user");
    const voiceEnrolled = params.get("voice_enrolled");
    const newUser = params.get("new_user");

    if (ssoToken && ssoUser) {
      try {
        const user = JSON.parse(atob(ssoUser));
        store.setUser(user, ssoToken);
        store.setVoiceEnrolled(voiceEnrolled === "1");
        // SSO has no signup form, so a first-time signup gets a placeholder role —
        // send them to pick a real one before enrollment/dashboard.
        store.setPage(newUser === "1" ? "choose-role" : voiceEnrolled === "1" ? "dashboard" : "enroll");
        window.history.replaceState({}, "", "/");
        return;
      } catch { /* fall through to normal restore */ }
    }

    // Normal session restore from localStorage — voiceEnrolled is hydrated from
    // its own localStorage key at store creation (see SessionStore.ts) and kept
    // in sync on every login/SSO redirect, so it's safe to trust here too.
    const token = localStorage.getItem("pilot_token");
    const user  = localStorage.getItem("pilot_user");
    if (token && user) {
      try {
        store.setUser(JSON.parse(user), token);
        store.setPage(store.voiceEnrolled ? "dashboard" : "enroll");
      } catch { /* ignore */ }
    }
  }, []);

  if (DASH_PAGES.includes(page)) return <Dashboard />;
  return <LandingPage />;
}
