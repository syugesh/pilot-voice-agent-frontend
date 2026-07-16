import React from "react";
import { useAppStore } from "./store/SessionStore";
import { LandingPage } from "./components/SessionHeader";
import { Dashboard }   from "./components/transcript";
import "./global.css";

export default function App() {
  const page = useAppStore((s) => s.page);
  const token = useAppStore((s) => s.token);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  // Voice enrollment is mandatory. Accounts that can hold a valid token
  // without one (Google SSO auto-registers with no voice sample) must be
  // forced to /enroll no matter how `page` got set — a stale URL, the
  // enrollment page's own Cancel button, browser back/forward, anything.
  // This is a render-level gate (re-evaluated on every page change), not
  // just a redirect at login time, so there's no client-side bypass.
  // Exempts "chooseRole" too — a brand-new SSO signup also has
  // has_enrollment===false, but must pick a real role (there's no SSO
  // signup form to have picked one on) before this gate sends them onward.
  const needsEnrollment = !!token && !!user && user.has_enrollment === false;

  React.useEffect(() => {
    if (needsEnrollment && page !== "enroll" && page !== "chooseRole") {
      useAppStore.getState().setPage("enroll");
    }
  }, [needsEnrollment, page]);

  React.useEffect(() => {
    // 0. Google SSO redirect return — the backend's /auth/sso/google/callback
    // sends the browser back here with the session encoded on the URL
    // (there's no other way to hand off a token across the Google redirect
    // round-trip). Takes priority over localStorage since it's a fresh login;
    // strips the params afterward so a refresh doesn't reprocess a stale
    // token. The mandatory-voice-enrollment gate above re-evaluates off
    // user.has_enrollment automatically once setUser runs, same as any
    // other login path.
    const ssoParams = new URLSearchParams(window.location.search);
    const ssoToken = ssoParams.get("sso_token");
    if (ssoToken) {
      const ssoUserB64 = ssoParams.get("sso_user");
      const voiceEnrolled = ssoParams.get("voice_enrolled") === "1";
      const isNewUser = ssoParams.get("new_user") === "1";
      try {
        // Backend encodes with Python's base64.urlsafe_b64encode (- and _
        // instead of + and /, no guaranteed padding) — atob() alone only
        // understands standard base64, so convert back first.
        const toStdBase64 = (s: string) => {
          let out = s.replace(/-/g, "+").replace(/_/g, "/");
          while (out.length % 4) out += "=";
          return out;
        };
        const ssoUser = ssoUserB64 ? JSON.parse(atob(toStdBase64(ssoUserB64))) : null;
        if (ssoUser) {
          useAppStore.getState().setUser({ ...ssoUser, has_enrollment: voiceEnrolled }, ssoToken);
          // Brand-new SSO signup: pick a real role first (there's no SSO
          // signup form, so the account was created with a placeholder
          // role) — ChooseRolePage sends them to /enroll once that's done.
          // Existing SSO users skip straight to the enrollment gate above,
          // same as any other login.
          if (isNewUser) useAppStore.getState().setPage("chooseRole");
        }
      } catch { /* malformed sso_user — ignore, user stays logged out */ }
      window.history.replaceState({}, "", window.location.pathname);
    }

    // 1. Authenticate user from localStorage if present
    const token = localStorage.getItem("pilot_token");
    const user  = localStorage.getItem("pilot_user");
    const loginTimeStr = localStorage.getItem("pilot_login_time");
    
    if (token && user) {
      const now = Date.now();
      const loginTime = loginTimeStr ? parseInt(loginTimeStr, 10) : now;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - loginTime > twentyFourHours) {
        // Session expired (24h limit reached)
        logout();
      } else {
        try {
          useAppStore.getState().setUser(JSON.parse(user), token);
        } catch { /* ignore */ }
      }
    }

    // 2. Parse URL path and sync initial route
    const parseUrlAndSyncState = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      const parts = path.split("/").filter(Boolean);
      const store = useAppStore.getState();
      const token = localStorage.getItem("pilot_token");
      
      if (parts.length === 0) {
        // If authenticated, go to dashboard, else landing
        store.setPage(token ? "dashboard" : "landing");
        store.setSession("");
        return;
      }
      
      const firstPart = parts[0];
      // Email Center and Wanna Chat are disabled from UI navigation — deep
      // links to them fall through to the else branch below and render as
      // the Main Dashboard (see index.tsx's fallback view).
      const protectedPaths = ["profile", "settings", "guideline", "ppt", "care", "resolution", "meetings", "dashboard"];
      if (protectedPaths.includes(firstPart) && !token) {
        store.setPage("landing");
        store.setSession("");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/");
        }
        return;
      }
      if (firstPart === "profile") {
        store.setPage("profile");
        store.setSession("");
      } else if (firstPart === "settings") {
        store.setPage("settings");
        store.setSession("");
      } else if (firstPart === "meetings") {
        store.setPage("meetings");
        // Extract meetings sub-path, e.g. /meetings/personal-room -> /personal-room
        const subRoute = parts.slice(1).length > 0 ? "/" + parts.slice(1).join("/") : "/";
        store.setTalkiniaSubRoute(subRoute);
        store.setSession("");
      // } else if (firstPart === "chat") {
      //   store.setPage("chat");
      //   store.setSession("");
      } else if (firstPart === "guideline") {
        store.setPage("guideline");
        store.setSession("");
      } else if (["ppt", "care", "resolution", "dashboard"].includes(firstPart)) {
        store.setPage(firstPart);
        if (parts[1]) {
          store.setSession(parts[1]);
        } else {
          store.setSession("");
        }
      } else {
        store.setPage(firstPart);
        store.setSession("");
      }
    };

    parseUrlAndSyncState();

    // 3. Listen to browser back/forward buttons (popstate event)
    const handlePopstate = () => {
      parseUrlAndSyncState();
    };
    window.addEventListener("popstate", handlePopstate);

    // 4. Listen to route updates from the Talkinia iframe
    const handleIframeMessage = (event: MessageEvent) => {
      // Security check: restrict to Talkinia's dev origin
      if (event.origin !== "http://localhost:3000") return;

      if (event.data?.type === "talkinia_route") {
        const subRoute = event.data.path || "/";
        const store = useAppStore.getState();

        // Report the path to update both talkiniaSubRoute and lastReportedTalkiniaPath
        store.reportTalkiniaPath(subRoute);

        // Sync the browser URL address bar dynamically only if the user is on the meetings page
        if (store.page === "meetings") {
          const fullPath = `/meetings${subRoute === "/" ? "" : subRoute}`;
          if (window.location.pathname !== fullPath) {
            window.history.pushState(null, "", fullPath);
          }
        }
      }
    };
    window.addEventListener("message", handleIframeMessage);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
      window.removeEventListener("message", handleIframeMessage);
    };
  }, [logout]);

  // Email Center and Wanna Chat are disabled from UI navigation.
  const dashPages = ["dashboard","ppt","care","resolution","profile","settings","guideline","meetings"];
  const effectivePage = needsEnrollment ? "enroll" : page;
  if (dashPages.includes(effectivePage)) return <Dashboard />;
  return <LandingPage />;
}



// i am storing all info into a sessionstore.tsx so would it bbe good to store all sessions in a one session or should i create seperate sesions for separate features . 