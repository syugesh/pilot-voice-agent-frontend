/**
 * Icon system — replaces emoji throughout the UI with a consistent,
 * stroke-based SVG set (Feather/Lucide-style: 24x24, currentColor,
 * round caps/joins) plus IconBadge, a glossy gradient-container treatment
 * for primary nav/feature icons.
 */
import React from "react";

export interface IconProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

function base(paths: React.ReactNode) {
  return function Icon({ size = 18, strokeWidth = 1.8, color = "currentColor", style }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
           style={{ display: "block", flexShrink: 0, ...style }}>
        {paths}
      </svg>
    );
  };
}

export const DashboardIcon = base(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>);
export const MonitorIcon   = base(<><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>);
export const HeadsetIcon   = base(<><path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="2.5" y="13" width="4" height="6" rx="1.5"/><rect x="17.5" y="13" width="4" height="6" rx="1.5"/><path d="M19.5 19v.5a3 3 0 01-3 3H13"/></>);
export const ClipboardIcon = base(<><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8.5" y="2.5" width="7" height="3" rx="1"/><path d="M8.5 11h7M8.5 15h7M8.5 19h4"/></>);
export const InfoIcon      = base(<><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/></>);
export const GearIcon      = base(<><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 00.34 1.87l.06.06a2.06 2.06 0 11-2.92 2.92l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55v.17a2.06 2.06 0 01-4.12 0v-.09a1.7 1.7 0 00-1.11-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2.06 2.06 0 11-2.92-2.92l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1h-.17a2.06 2.06 0 010-4.12h.09A1.7 1.7 0 004.6 9.5a1.7 1.7 0 00-.34-1.87l-.06-.06A2.06 2.06 0 117.12 4.65l.06.06a1.7 1.7 0 001.87.34h.08a1.7 1.7 0 001-1.55V3.3a2.06 2.06 0 014.12 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2.06 2.06 0 112.92 2.92l-.06.06a1.7 1.7 0 00-.34 1.87v.08a1.7 1.7 0 001.55 1h.17a2.06 2.06 0 010 4.12h-.09a1.7 1.7 0 00-1.55 1z"/></>);
export const LogOutIcon    = base(<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>);
export const MicIcon       = base(<><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7"/></>);
export const MicOffIcon    = base(<><path d="M3 3l18 18"/><path d="M9 5a3 3 0 016 0v6a3 3 0 01-.35 1.41M15 9.34V13a3 3 0 01-4.6 2.54"/><path d="M5.5 11a6.5 6.5 0 009.3 5.88M18.5 11a6.48 6.48 0 01-1 3.45"/><path d="M12 17.5V21M8.5 21h7"/></>);
export const StopIcon      = base(<rect x="6" y="6" width="12" height="12" rx="2.5"/>);
export const AlertTriangleIcon = base(<><path d="M12 3.5l9.5 16.5H2.5L12 3.5z" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01"/></>);
export const CheckIcon     = base(<path d="M4 12.5l5.5 5.5L20 6"/>);
export const CheckCircleIcon = base(<><circle cx="12" cy="12" r="9.5"/><path d="M8 12.3l2.7 2.7L16.5 9"/></>);
export const XIcon         = base(<path d="M5 5l14 14M19 5L5 19"/>);
export const XCircleIcon   = base(<><circle cx="12" cy="12" r="9.5"/><path d="M9 9l6 6M15 9l-6 6"/></>);
export const LockIcon      = base(<><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M7.5 10.5V7a4.5 4.5 0 019 0v3.5"/><circle cx="12" cy="15.3" r="1.4"/></>);
export const PinIcon       = base(<><path d="M12 21.5s7-6.5 7-12A7 7 0 105 9.5c0 5.5 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.4"/></>);
export const PhoneIcon     = base(<path d="M5.3 3.5h3.2l1.4 4.6-2.2 1.6a11.4 11.4 0 005.6 5.6l1.6-2.2 4.6 1.4v3.2a1.6 1.6 0 01-1.7 1.6A16.5 16.5 0 013.7 5.2a1.6 1.6 0 011.6-1.7z" strokeLinejoin="round"/>);
export const PlaneIcon     = base(<path d="M10.5 3.5l2 6.2 6.2-3.1a1.4 1.4 0 011.9 1.9l-3.1 6.2 6.2 2v1.6l-6.2-1-2.8 5.7-1.7-.5.9-5.9-5.2-1.7-2 2.6-1.6-.4.8-3.8-3.1-1 .3-1.6 3.8.4 2-3.4z" strokeLinejoin="round"/>);
export const PlaneLandingIcon = base(<><path d="M2.5 20h19"/><path d="M4 15.5l4.2-1.3 3.6-6.7a1 1 0 011.8.1l1.9 5 5.4-1.7a1.6 1.6 0 011.1 3l-8.4 2.9-6.7 2.1z" strokeLinejoin="round"/></>);
export const CalendarIcon  = base(<><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></>);
export const UserIcon      = base(<><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.2a7.5 7.5 0 0115 0"/></>);
export const BotIcon       = base(<><rect x="4" y="8.5" width="16" height="11" rx="3"/><path d="M12 8.5V5M9 3.5h6"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M2 13v3M22 13v3"/></>);
export const HotelIcon     = base(<><path d="M3 21V6.5a2 2 0 012-2h5v16.5"/><path d="M14 21V9a2 2 0 012-2h3a2 2 0 012 2v12"/><path d="M6.5 8.5h.01M6.5 12h.01M6.5 15.5h.01M3 21h18"/></>);
export const TrainIcon     = base(<><rect x="5" y="3.5" width="14" height="13" rx="4"/><path d="M5 12h14M9 3.5v4M15 3.5v4"/><circle cx="8.5" cy="14" r=".01"/><path d="M8 20l-2 2M16 20l2 2M8 16.5v0M16 16.5v0"/></>);
export const ZapIcon       = base(<path d="M12.5 2.5L4 14h6l-1 7.5L20 10h-6l-1.5-7.5z" strokeLinejoin="round"/>);
export const ShieldIcon    = base(<><path d="M12 2.5l8 3.5v6c0 5-3.4 8.7-8 9.5-4.6-.8-8-4.5-8-9.5V6l8-3.5z"/><path d="M8.5 12l2.3 2.3L16 9.5"/></>);
export const HomeIcon      = base(<><path d="M3.5 11l8.5-7.5L20.5 11"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></>);
export const SparkleIcon   = base(<path d="M12 2.5l1.8 5.7 5.7 1.8-5.7 1.8L12 17.5l-1.8-5.7-5.7-1.8 5.7-1.8L12 2.5z" strokeLinejoin="round"/>);
export const MessageIcon   = base(<path d="M4 4.5h16v12H9l-4 3.5v-3.5H4z" strokeLinejoin="round"/>);
export const FolderUpIcon  = base(<><path d="M3 8V6a2 2 0 012-2h4.5l2 2.2H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><path d="M12 17v-5.5M9.5 14l2.5-2.5 2.5 2.5"/></>);
export const PresentationIcon = base(<><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20l4-4 4 4M12 16v4"/></>);
export const PencilIcon    = base(<><path d="M4 20l.9-4.3L15.6 5a2 2 0 012.9 0l.5.5a2 2 0 010 2.9L8.3 19.1 4 20z"/><path d="M13.5 6.5l4 4"/></>);
export const TrashIcon     = base(<><path d="M4.5 7h15"/><path d="M9.5 7V4.8a1.3 1.3 0 011.3-1.3h2.4a1.3 1.3 0 011.3 1.3V7"/><path d="M6.5 7l1 12.3A2 2 0 009.5 21h5a2 2 0 002-1.7L17.5 7"/><path d="M10.2 11v6M13.8 11v6"/></>);
export const DownloadIcon  = base(<><path d="M12 3.5v11.5M8 11.5l4 4 4-4"/><path d="M4.5 16.5V19a2 2 0 002 2h11a2 2 0 002-2v-2.5"/></>);
export const ChevronLeftIcon  = base(<path d="M15 5l-7 7 7 7"/>);
export const ChevronRightIcon = base(<path d="M9 5l7 7-7 7"/>);
export const ArrowLeftIcon  = base(<path d="M19 12H5M11 6l-6 6 6 6"/>);
export const ArrowRightIcon = base(<path d="M5 12h14M13 6l6 6-6 6"/>);
export const SendIcon      = base(<path d="M4 12.5L20 4l-6 18-3-7-7-2.5z" strokeLinejoin="round"/>);
export const MoonIcon      = base(<path d="M20 14.2A8.5 8.5 0 119.8 4a7 7 0 0010.2 10.2z" strokeLinejoin="round"/>);
export const SunIcon       = base(<><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6"/></>);
export const BulbIcon      = base(<><path d="M9 18.5h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 00-3.6 11.9c.7.5 1.1 1.3 1.1 2.1h5c0-.8.4-1.6 1.1-2.1A6.5 6.5 0 0012 2.5z"/></>);
export const MailIcon      = base(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></>);
export const DotIcon = function DotIcon({ size = 8, color = "currentColor", filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="5" cy="5" r={filled ? 5 : 3.8} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.6}/>
    </svg>
  );
};

/**
 * Flat tinted icon tile — a soft, single-tone background with the icon in
 * that same tone's solid color. No gradients, no glow, no sheen: matches
 * the app's existing soft-badge language (e.g. the amber "Level N Access"
 * pill already used elsewhere) instead of standing out as its own effect.
 */
export function IconBadge({
  children, size = 32, tone = "amber", active = false, style,
}: {
  children: React.ReactNode; size?: number;
  tone?: "amber" | "blue" | "green" | "violet" | "neutral" | "red";
  active?: boolean; style?: React.CSSProperties;
}) {
  const solid: Record<string, string> = {
    amber: "#B9790A", blue: "#2E7BE0", green: "#1A9850", violet: "#7C5FD6",
    neutral: "#6B7280", red: "#DC2626",
  };
  const tint: Record<string, string> = {
    amber: "rgba(245,167,0,0.12)", blue: "rgba(46,123,224,0.10)",
    green: "rgba(26,152,80,0.10)", violet: "rgba(124,95,214,0.10)",
    neutral: "rgba(107,114,128,0.10)", red: "rgba(220,38,38,0.10)",
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: tint[tone],
      color: solid[tone],
      transition: "background 0.15s",
      ...style,
    }}>
      {children}
    </div>
  );
}
