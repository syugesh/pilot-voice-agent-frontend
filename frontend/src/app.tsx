import React from "react";
import { useAppStore } from "./store/SessionStore";
import { LandingPage } from "./components/SessionHeader";
import { Dashboard }   from "./components/TranscriptOverlay";
import "./global.css";

export default function App() {
  const page  = useAppStore((s) => s.page);
  const theme = useAppStore((s) => s.theme);

  // Sync theme to <html data-theme="..."> so CSS variables cascade everywhere
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    const store = useAppStore.getState();

    // Apply saved theme immediately on first load
    document.documentElement.setAttribute("data-theme", store.theme);

    // Handle Google SSO redirect: /?sso_token=...&sso_user=...&voice_enrolled=0|1
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    const ssoUser  = params.get("sso_user");
    const voiceEnrolled = params.get("voice_enrolled");

    if (ssoToken && ssoUser) {
      try {
        const user = JSON.parse(atob(ssoUser));
        store.setUser(user, ssoToken);
        store.setVoiceEnrolled(voiceEnrolled === "1");
        store.setPage(voiceEnrolled === "1" ? "dashboard" : "enroll");
        window.history.replaceState({}, "", "/");
        return;
      } catch { /* fall through to normal restore */ }
    }

    // Normal session restore from localStorage
    const token = localStorage.getItem("pilot_token");
    const user  = localStorage.getItem("pilot_user");
    if (token && user) {
      try {
        store.setUser(JSON.parse(user), token);
        store.setPage("dashboard");
      } catch { /* ignore */ }
    }
  }, []);

  const dashPages = ["dashboard","ppt","care","profile","settings","guidelines"];
  if (dashPages.includes(page)) return <Dashboard />;
  return <LandingPage />;
}
