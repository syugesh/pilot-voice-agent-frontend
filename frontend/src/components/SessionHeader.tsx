/**
 * Landing · Login · Signup (4-step) · OTP · VoiceCalibration
 * Feature 1: voice enrollment with real embedding
 * Feature 5: audio file upload in enrollment
 * Feature 6: PDF-accurate design
 */
import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/SessionStore";

const C = {
  amber:     "#F5A700",
  amberDark: "var(--amber-dark)",
  amberBg:   "var(--amber-bg)",
  bg:        "var(--bg)",
  surface:   "var(--white)",
  border:    "var(--border)",
  text1:     "var(--text-1)",
  text2:     "var(--text-2)",
  text3:     "var(--text-3)",
  green:     "#22C55E",
  red:       "#EF4444",
  orange:    "#F97316",
  yellow:    "#EAB308",
};

/* Voice blob captured during signup, consumed after OTP verification */
let _pendingVoiceBlob: Blob | null = null;

const api = async (method:string, path:string, body?:unknown) => {
  const token = localStorage.getItem("pilot_token");
  const h: Record<string,string> = {"Content-Type":"application/json"};
  if (token) h["Authorization"] = `Bearer ${token}`;
  const opts: RequestInit = {method:method.toUpperCase(), headers:h};
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch("/api/v1"+path, opts);
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error((e as any).detail??res.statusText); }
  return res.json();
};

const inp: React.CSSProperties = {
  width:"100%", padding:"0.7rem 1rem", borderRadius:10,
  border:`1.5px solid ${C.border}`, fontSize:"0.9rem",
  background:"var(--white)", color:C.text1, outline:"none",
};

/* ── Password utilities ── */
function checkPw(pw: string) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

function pwScore(pw: string): number {
  const c = checkPw(pw);
  return [c.length, c.upper, c.lower, c.number, c.special].filter(Boolean).length;
}

const STRENGTH_LABEL = ["","Weak","Fair","Good","Strong","Very Strong"];
const STRENGTH_COLOR = ["","#EF4444","#F97316","#EAB308","#22C55E","#16A34A"];

function StrengthBar({ pw }: { pw: string }) {
  const score = pwScore(pw);
  const c = checkPw(pw);
  if (!pw) return null;
  return (
    <div style={{ marginTop:"0.5rem" }}>
      <div style={{ display:"flex", gap:"4px", marginBottom:"0.35rem" }}>
        {[1,2,3,4,5].map(i=>(
          <div key={i} style={{ flex:1, height:4, borderRadius:2, transition:"background 0.2s",
                                background: i <= score ? STRENGTH_COLOR[score] : C.border }}/>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
        <span style={{ fontSize:"0.72rem", color:STRENGTH_COLOR[score], fontWeight:600 }}>
          {STRENGTH_LABEL[score]}
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.2rem 0.75rem" }}>
        {[
          { ok:c.length,  label:"At least 8 characters" },
          { ok:c.upper,   label:"Uppercase letter (A–Z)" },
          { ok:c.lower,   label:"Lowercase letter (a–z)" },
          { ok:c.number,  label:"Number (0–9)" },
          { ok:c.special, label:"Special character (!@#…)" },
        ].map((r,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
            <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0,
                          background: r.ok ? C.green : C.border,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:"0.55rem", color:"#fff", fontWeight:700 }}>
              {r.ok ? "✓" : ""}
            </div>
            <span style={{ fontSize:"0.72rem", color: r.ok ? C.text2 : C.text3 }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PwInput({ value, onChange, placeholder, onKeyDown }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input
        style={{...inp, paddingRight:"3.5rem"}}
        type={show ? "text" : "password"}
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        onClick={()=>setShow(s=>!s)}
        style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)",
                 background:"none", border:"none", cursor:"pointer",
                 fontSize:"0.72rem", fontWeight:600, color:C.text3, padding:"0.2rem 0.3rem",
                 letterSpacing:"0.02em" }}>
        {show ? "HIDE" : "SHOW"}
      </button>
    </div>
  );
}

/* ── SSO buttons ── */
function SSODivider() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", margin:"1.25rem 0" }}>
      <div style={{ flex:1, height:1, background:C.border }}/>
      <span style={{ fontSize:"0.75rem", color:C.text3, whiteSpace:"nowrap" }}>or continue with email</span>
      <div style={{ flex:1, height:1, background:C.border }}/>
    </div>
  );
}

function SSOButtons() {
  return (
    <button onClick={()=>{ window.location.href = "/api/v1/auth/sso/google"; }}
      style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem",
               width:"100%", padding:"0.65rem 1rem", borderRadius:10, cursor:"pointer",
               background:"var(--white)", color:"var(--text-1)", fontWeight:500, fontSize:"0.85rem",
               border:`1.5px solid ${C.border}` }}>
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  );
}

/* ── LANDING ── */
export function LandingPage() {
  const store = useAppStore();
  const p = store.page;
  if (p==="login")   return <LoginPage/>;
  if (p==="signup")  return <SignupPage/>;
  if (p==="verify")  return <OTPPage/>;
  if (p==="enroll")  return <VoiceCalibration/>;
  if (p==="forgot")  return <ForgotPasswordPage/>;
  if (p==="choose-role") return <ChooseRolePage/>;

  return (
    <div style={{ minHeight:"100vh", fontFamily:"Inter,sans-serif", background:"var(--bg)" }}>

      {/* nav */}
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"1.1rem 3rem", background:"var(--white)", borderBottom:`1px solid ${C.border}`,
                    position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
          <img src="/logo.png" alt="PILOT" style={{ width:32, height:32, objectFit:"contain" }}/>
          <span style={{ fontWeight:900, fontSize:"1rem", letterSpacing:"-0.02em" }}>PILOT</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"2.5rem" }}>
          <div style={{ display:"flex", gap:"1.75rem" }}>
            {["Features","How it Works","Use Cases"].map(link=>(
              <a key={link} href={`#${link.toLowerCase().replace(/ /g,"-")}`}
                style={{ fontSize:"0.85rem", color:C.text2, textDecoration:"none", fontWeight:500 }}>
                {link}
              </a>
            ))}
          </div>
          <div style={{ display:"flex", gap:"0.6rem" }}>
            <button onClick={()=>store.setPage("login")}
              style={{ padding:"0.45rem 1.1rem", borderRadius:8,
                       border:`1.5px solid ${C.border}`, background:"var(--white)", color:C.text1,
                       fontWeight:500, fontSize:"0.83rem", cursor:"pointer" }}>Sign In</button>
            <button onClick={()=>store.setPage("signup")}
              style={{ padding:"0.45rem 1.1rem", borderRadius:8, border:"none",
                       background:C.amber, color:"#fff", fontWeight:600, fontSize:"0.83rem", cursor:"pointer" }}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* hero */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"6rem 3rem 4rem",
                    display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4rem", alignItems:"center" }}>
        <div>
          <h1 style={{ fontSize:"3.25rem", fontWeight:900, lineHeight:1.1,
                       letterSpacing:"-0.04em", marginBottom:"1.25rem", color:C.text1 }}>
            Voice-First AI<br/>
            <span style={{ color:C.amberDark }}>for the Modern Workspace.</span>
          </h1>
          <p style={{ fontSize:"1rem", color:C.text2, lineHeight:1.75, maxWidth:420, marginBottom:"2rem" }}>
            PILOT transforms how teams interact with technology. Natural language commands,
            speaker recognition, and autonomous AI agents — all working together in real time.
          </p>
          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={()=>store.setPage("signup")}
              style={{ padding:"0.85rem 1.75rem", borderRadius:10, background:C.amber,
                       color:"#fff", fontWeight:700, fontSize:"0.95rem", border:"none", cursor:"pointer" }}>
              Get Started
            </button>
            <button onClick={()=>store.setPage("login")}
              style={{ padding:"0.85rem 1.75rem", borderRadius:10, background:"var(--white)",
                       color:C.text1, fontWeight:500, fontSize:"0.95rem",
                       border:`1.5px solid ${C.border}`, cursor:"pointer" }}>
              Sign In
            </button>
          </div>
        </div>

        {/* session preview card */}
        <div style={{ background:"var(--white)", borderRadius:20, padding:"1.75rem",
                      border:`1.5px solid ${C.border}`,
                      boxShadow:"0 4px 32px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.1em",
                        color:C.text3, marginBottom:"1.25rem" }}>LIVE SESSION</div>
          {[
            { name:"Maya K.", msg:"Book a flight to Delhi for tomorrow morning.", self:true },
            { name:"PILOT AI", msg:"Found 5 flights from Chennai to Delhi. Showing results now.", self:false },
          ].map((row, i)=>(
            <div key={i} style={{ display:"flex", gap:"0.75rem", alignItems:"flex-start",
                                  marginBottom:i===0?"1.1rem":0 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, marginTop:2,
                            background:row.self ? C.amber : "#E5E2DA",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:"0.72rem", fontWeight:700, color:row.self ? "#fff" : C.text2 }}>
                {row.name[0]}
              </div>
              <div>
                <div style={{ display:"flex", gap:"0.4rem", alignItems:"center", marginBottom:"0.25rem" }}>
                  <span style={{ fontSize:"0.78rem", fontWeight:700, color:C.text1 }}>{row.name}</span>
                </div>
                <div style={{ fontSize:"0.83rem", color:C.text2, lineHeight:1.55 }}>{row.msg}</div>
              </div>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"flex-end", gap:"3px",
                        marginTop:"1.25rem", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
            {[5,9,14,8,18,11,22,15,10,19,13,8,16].map((h,i)=>(
              <div key={i} style={{ width:5, borderRadius:3, background:C.amber, height:h, opacity:0.7 }}/>
            ))}
            <span style={{ fontSize:"0.68rem", color:C.text3, marginLeft:"0.5rem", alignSelf:"center" }}>
              Listening
            </span>
          </div>
        </div>
      </div>

      {/* features */}
      <div id="features" style={{ background:"var(--white)", padding:"5rem 3rem" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <h2 style={{ fontSize:"2rem", fontWeight:800, letterSpacing:"-0.03em",
                         marginBottom:"0.6rem", color:C.text1 }}>
              Built for how people actually work.
            </h2>
            <p style={{ color:C.text3, fontSize:"0.93rem", maxWidth:520, margin:"0 auto", lineHeight:1.7 }}>
              From continuous listening to autonomous agents, PILOT handles complexity
              so your team can stay focused on what matters.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1.25rem" }}>
            {[
              { abbr:"CL", label:"Continuous Listening",
                desc:"Always-on voice detection with sub-100ms latency. PILOT understands context before you finish your sentence, with full privacy controls." },
              { abbr:"SR", label:"Speaker Recognition",
                desc:"Advanced voice biometrics instantly identify who is speaking, attributing every transcript and command to the correct team member." },
              { abbr:"VA", label:"Voice Authorization",
                desc:"Secure high-stakes actions with voice-print verification. No keyboard, no password — just your unique vocal signature." },
              { abbr:"BA", label:"Background Agents",
                desc:"Deploy autonomous agents that listen to meetings, search the web, draft content, and update records without interrupting the conversation." },
              { abbr:"RT", label:"Realtime Transcription",
                desc:"Sub-100ms transcription processed locally. Every word attributed, timestamped, and searchable across your session history." },
              { abbr:"RB", label:"Role-Based Access",
                desc:"Fine-grained permissions ensure each speaker can only trigger actions their role allows — automatically enforced on every command." },
            ].map((f,i)=>(
              <div key={i} style={{ background:C.bg, border:`1.5px solid ${C.border}`,
                                     borderRadius:16, padding:"1.6rem" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.amberBg,
                              border:`1.5px solid ${C.amber}`, display:"flex", alignItems:"center",
                              justifyContent:"center", fontSize:"0.72rem", fontWeight:800,
                              color:C.amberDark, marginBottom:"0.9rem", letterSpacing:"0.04em" }}>
                  {f.abbr}
                </div>
                <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:"0.4rem", color:C.text1 }}>{f.label}</div>
                <div style={{ fontSize:"0.82rem", color:C.text2, lineHeight:1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* how it works */}
      <div id="how-it-works" style={{ background:"var(--bg)", padding:"5rem 3rem" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <h2 style={{ fontSize:"2rem", fontWeight:800, letterSpacing:"-0.03em",
                         marginBottom:"0.6rem", color:C.text1 }}>
              How PILOT works.
            </h2>
            <p style={{ color:C.text3, fontSize:"0.93rem", lineHeight:1.7 }}>
              From voice to action in milliseconds — securely, accurately, and automatically.
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {[
              { step:"01", title:"Speak Naturally",
                desc:"PILOT listens continuously during your session. No special commands needed — just talk as you would in a normal meeting or workflow." },
              { step:"02", title:"Identify and Authorize",
                desc:"Voice biometrics match the speaker to their enrolled profile. Role-based policies automatically determine what each person can do." },
              { step:"03", title:"Agents Execute",
                desc:"Background AI agents translate intent into action — searching flights, creating tickets, navigating presentations, or querying knowledge bases in real time." },
              { step:"04", title:"Confirm and Continue",
                desc:"Results surface in the session transcript with full context. Every action is logged, attributed, and auditable." },
            ].map((item, i)=>(
              <div key={i} style={{ display:"flex", gap:"1.5rem", alignItems:"flex-start",
                                    background:"var(--white)", border:`1.5px solid ${C.border}`,
                                    borderRadius:14, padding:"1.5rem" }}>
                <div style={{ fontSize:"1.3rem", fontWeight:900, color:C.amber,
                              lineHeight:1, flexShrink:0, minWidth:32 }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:"0.35rem", color:C.text1 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize:"0.85rem", color:C.text2, lineHeight:1.65 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* use cases */}
      <div id="use-cases" style={{ background:"var(--white)", padding:"5rem 3rem" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"3rem" }}>
            <h2 style={{ fontSize:"2rem", fontWeight:800, letterSpacing:"-0.03em",
                         marginBottom:"0.6rem", color:C.text1 }}>
              Designed for real workflows.
            </h2>
            <p style={{ color:C.text3, fontSize:"0.93rem", maxWidth:520, margin:"0 auto", lineHeight:1.7 }}>
              PILOT adapts to the tools and processes your team already relies on.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"1.25rem" }}>
            {[
              { title:"Customer Service",
                desc:"Agents automatically look up records, surface knowledge base answers, and draft responses — all while the agent stays fully present in the conversation.",
                live:true },
              { title:"Travel Planner",
                desc:"Voice-triggered flight, hotel, and train search plus flight booking workflows. Just say where you want to go.",
                live:true },
              { title:"Presentation Control",
                desc:"Navigate slides, jump to sections, and get AI summaries of decks using only your voice during live presentations.",
                live:true },
              { title:"Meeting Intelligence",
                desc:"Real-time transcription, speaker attribution, and action item extraction from every conversation — automatically logged to your workflow.",
                live:false },
            ].map((uc, i)=>(
              <div key={i} style={{ border:`1.5px solid ${C.border}`, borderRadius:14,
                                    padding:"1.75rem", background:C.bg }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                              marginBottom:"0.65rem" }}>
                  <div style={{ fontWeight:700, fontSize:"1rem", color:C.text1 }}>{uc.title}</div>
                  <span style={{ fontSize:"0.68rem", fontWeight:700, padding:"0.2rem 0.55rem",
                                 borderRadius:20, flexShrink:0, marginLeft:"0.5rem",
                                 background:uc.live ? "#ECFDF5" : "#F5F5F5",
                                 color:uc.live ? "#16A34A" : C.text3,
                                 border:`1px solid ${uc.live ? "#86EFAC" : C.border}` }}>
                    {uc.live ? "Live" : "Coming Soon"}
                  </span>
                </div>
                <div style={{ fontSize:"0.85rem", color:C.text2, lineHeight:1.65 }}>{uc.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* cta */}
      <div style={{ background:`linear-gradient(135deg,${C.amberBg} 0%,#fff 100%)`,
                    padding:"5rem 3rem", textAlign:"center",
                    borderTop:`1.5px solid ${C.border}` }}>
        <h2 style={{ fontSize:"2.2rem", fontWeight:900, letterSpacing:"-0.04em",
                     marginBottom:"0.75rem", color:C.text1 }}>
          Start your first session.
        </h2>
        <p style={{ color:C.text2, fontSize:"0.95rem", maxWidth:440,
                    margin:"0 auto 2rem", lineHeight:1.7 }}>
          Create an account, enroll your voice, and experience PILOT in under five minutes.
        </p>
        <div style={{ display:"flex", gap:"0.75rem", justifyContent:"center" }}>
          <button onClick={()=>store.setPage("signup")}
            style={{ padding:"0.9rem 2.2rem", borderRadius:10, background:C.amberDark,
                     color:"#fff", fontWeight:700, fontSize:"1rem", border:"none", cursor:"pointer" }}>
            Create Account
          </button>
          <button onClick={()=>store.setPage("login")}
            style={{ padding:"0.9rem 2.2rem", borderRadius:10, background:"var(--white)",
                     color:C.text1, fontWeight:500, fontSize:"1rem",
                     border:`1.5px solid ${C.border}`, cursor:"pointer" }}>
            Sign In
          </button>
        </div>
      </div>

      {/* footer */}
      <div style={{ background:"#1A1A1A", padding:"1.5rem 3rem",
                    display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <img src="/logo.png" alt="PILOT" style={{ width:22, height:22, objectFit:"contain" }}/>
          <span style={{ color:"#555", fontSize:"0.8rem", fontWeight:700 }}>PILOT</span>
        </div>
        <span style={{ color:"#555", fontSize:"0.75rem" }}>Voice AI Platform</span>
      </div>
    </div>
  );
}

/* ── LOGIN ── */
function LoginPage() {
  const store = useAppStore();
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit() {
    setErr(""); setLoading(true);
    try {
      const r=await api("POST","/auth/login",{email,password:pw});
      store.setUser(r.user,r.access_token);
      store.setVoiceEnrolled(r.voice_enrolled ?? false);
      store.setPage(r.voice_enrolled ? "dashboard" : "enroll");
    }
    catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"var(--white)", borderRadius:20, padding:"2.5rem", width:420,
                    boxShadow:"0 8px 48px rgba(0,0,0,0.08)", position:"relative" }}>
        <button onClick={()=>store.setPage("landing")}
          style={{ position:"absolute",top:"1rem",left:"1rem",background:"none",border:"none",
                   color:C.text3,cursor:"pointer",fontSize:"0.85rem",display:"flex",
                   alignItems:"center",gap:"0.3rem" }}>← Back</button>

        <div style={{ textAlign:"center", marginBottom:"1.75rem" }}>
          <img src="/logo.png" alt="PILOT"
               style={{ width:56, height:56, objectFit:"contain", margin:"0 auto 1rem", display:"block" }}/>
          <h2 style={{ fontSize:"1.6rem", fontWeight:800, color:C.text1 }}>Welcome back</h2>
          <p style={{ color:C.text3, fontSize:"0.88rem", marginTop:"0.25rem" }}>
            Sign in to your PILOT account.
          </p>
        </div>

        <SSOButtons/>
        <SSODivider/>

        <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
          Email address
        </label>
        <input style={{...inp,marginBottom:"0.85rem"}} type="email" value={email}
          onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/>

        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.3rem" }}>
          <label style={{ fontSize:"0.8rem",fontWeight:600,color:C.text1 }}>Password</label>
          <span onClick={()=>store.setPage("forgot")}
            style={{ fontSize:"0.78rem",color:C.amberDark,cursor:"pointer",fontWeight:500 }}>
            Forgot password?
          </span>
        </div>
        <PwInput value={pw} onChange={setPw} onKeyDown={e=>e.key==="Enter"&&submit()}/>

        {err&&<div style={{ color:C.red,fontSize:"0.78rem",marginTop:"0.5rem",
                            padding:"0.5rem 0.75rem",background:"#FEF2F2",borderRadius:8,
                            border:"1px solid #FECACA" }}>{err}</div>}

        <button onClick={submit} disabled={loading}
          style={{ width:"100%",padding:"0.85rem",borderRadius:10,background:C.amberDark,
                   color:"#fff",fontWeight:700,border:"none",marginTop:"1.1rem",
                   fontSize:"0.92rem",cursor:"pointer",
                   opacity:loading?0.7:1 }}>
          {loading?"Signing in…":"Sign In"}
        </button>

        <p style={{ textAlign:"center",fontSize:"0.83rem",color:C.text3,marginTop:"1.1rem" }}>
          Don't have an account?{" "}
          <span style={{ color:C.amberDark,cursor:"pointer",fontWeight:600 }}
            onClick={()=>store.setPage("signup")}>Sign up</span>
        </p>

        <p style={{ textAlign:"center",fontSize:"0.72rem",color:C.text3,marginTop:"1.25rem",
                    lineHeight:1.5 }}>
          By continuing, you agree to PILOT's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

/* ── FORGOT PASSWORD — request code, then reset ── */
function ForgotPasswordPage() {
  const store = useAppStore();
  const [step, setStep]   = useState<"email"|"reset"|"done">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp]     = useState("");
  const [pw, setPw]       = useState("");
  const [pw2, setPw2]     = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setErr(""); setLoading(true);
    try {
      await api("POST", "/auth/forgot-password", { email });
      setStep("reset");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const pwValid = pwScore(pw) === 5;

  async function doReset() {
    if (!pwValid) { setErr("Password does not meet the requirements below."); return; }
    if (pw !== pw2) { setErr("Passwords do not match."); return; }
    setErr(""); setLoading(true);
    try {
      await api("POST", "/auth/reset-password", { email, otp, new_password: pw });
      setStep("done");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"var(--white)", borderRadius:20, padding:"2.5rem", width:420,
                    boxShadow:"0 8px 48px rgba(0,0,0,0.08)", position:"relative" }}>
        <button onClick={()=>store.setPage("login")}
          style={{ position:"absolute",top:"1rem",left:"1rem",background:"none",border:"none",
                   color:C.text3,cursor:"pointer",fontSize:"0.85rem",display:"flex",
                   alignItems:"center",gap:"0.3rem" }}>← Back</button>

        <div style={{ textAlign:"center", marginBottom:"1.75rem" }}>
          <img src="/logo.png" alt="PILOT"
               style={{ width:56, height:56, objectFit:"contain", margin:"0 auto 1rem", display:"block" }}/>
          <h2 style={{ fontSize:"1.6rem", fontWeight:800, color:C.text1 }}>
            {step==="done" ? "Password reset" : "Reset your password"}
          </h2>
          <p style={{ color:C.text3, fontSize:"0.88rem", marginTop:"0.25rem" }}>
            {step==="email" && "Enter your account email and we'll send a reset code."}
            {step==="reset" && `Enter the code sent to ${email} and choose a new password.`}
            {step==="done"  && "Your password has been updated."}
          </p>
        </div>

        {step==="email" && (
          <>
            <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
              Email address
            </label>
            <input style={{...inp,marginBottom:"1rem"}} type="email" value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendCode()}
              placeholder="name@company.com"/>

            {err && <div style={{ color:C.red,fontSize:"0.78rem",marginBottom:"0.85rem",
                                  padding:"0.5rem 0.75rem",background:"#FEF2F2",borderRadius:8,
                                  border:"1px solid #FECACA" }}>{err}</div>}

            <button onClick={sendCode} disabled={loading || !email}
              style={{ width:"100%",padding:"0.85rem",borderRadius:10,background:C.amberDark,
                       color:"#fff",fontWeight:700,border:"none",
                       fontSize:"0.92rem",cursor:"pointer",
                       opacity:(loading||!email)?0.7:1 }}>
              {loading?"Sending…":"Send Reset Code"}
            </button>
          </>
        )}

        {step==="reset" && (
          <>
            <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
              Reset code
            </label>
            <input style={{...inp,marginBottom:"0.85rem",letterSpacing:"0.3em",textAlign:"center"}}
              value={otp} maxLength={6} inputMode="numeric"
              onChange={e=>setOtp(e.target.value.replace(/\D/g,""))}
              placeholder="000000"/>

            <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
              New password
            </label>
            <PwInput value={pw} onChange={setPw}/>
            <div style={{ marginBottom:"0.6rem" }}><StrengthBar pw={pw}/></div>

            <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
              Confirm new password
            </label>
            <PwInput value={pw2} onChange={setPw2} placeholder="Repeat password"
              onKeyDown={e=>e.key==="Enter"&&doReset()}/>
            {pw2 && pw !== pw2 && (
              <p style={{ fontSize:"0.75rem", color:C.red, marginTop:"0.35rem" }}>Passwords do not match.</p>
            )}

            {err && <div style={{ color:C.red,fontSize:"0.78rem",margin:"0.85rem 0",
                                  padding:"0.5rem 0.75rem",background:"#FEF2F2",borderRadius:8,
                                  border:"1px solid #FECACA" }}>{err}</div>}

            <button onClick={doReset} disabled={loading || otp.length!==6 || !pwValid || pw!==pw2}
              style={{ width:"100%",padding:"0.85rem",borderRadius:10,marginTop:"1rem",
                       background:(otp.length===6 && pwValid && pw===pw2)?C.amberDark:C.border,
                       color:(otp.length===6 && pwValid && pw===pw2)?"#fff":C.text3,
                       fontWeight:700,border:"none",
                       fontSize:"0.92rem",
                       cursor:(otp.length===6 && pwValid && pw===pw2)?"pointer":"not-allowed" }}>
              {loading?"Resetting…":"Reset Password"}
            </button>

            <p style={{ textAlign:"center",fontSize:"0.8rem",color:C.text3,marginTop:"1rem" }}>
              Didn't get a code?{" "}
              <span style={{ color:C.amberDark,cursor:"pointer",fontWeight:600 }}
                onClick={sendCode}>Resend</span>
            </p>
          </>
        )}

        {step==="done" && (
          <>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                          justifyContent:"center", padding:"1rem 0 1.5rem", gap:"0.75rem" }}>
              <div style={{ width:60, height:60, borderRadius:"50%", background:"#DCFCE7",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:"1.6rem", color:C.green }}>✓</div>
            </div>
            <button onClick={()=>store.setPage("login")}
              style={{ width:"100%",padding:"0.85rem",borderRadius:10,background:C.amberDark,
                       color:"#fff",fontWeight:700,border:"none",
                       fontSize:"0.92rem",cursor:"pointer" }}>
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── SIGNUP — single page: form + voice calibration side-by-side ── */
function SignupPage() {
  const store = useAppStore();

  // Form state
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState("developer");
  const [pw,      setPw]      = useState("");
  const [pw2,     setPw2]     = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  // Voice calibration state
  const [vcRound, setVcRound] = useState(1);
  const [vcPhase, setVcPhase] = useState<"idle"|"recording"|"done">("idle");
  const [vcBars,  setVcBars]  = useState<number[]>(new Array(9).fill(3));
  const [vcDone,  setVcDone]  = useState(false);
  const [vcErr,   setVcErr]   = useState("");
  const mrRef     = useRef<MediaRecorder|null>(null);
  const allChunks = useRef<Blob[]>([]);
  const animRef   = useRef<number>(0);
  const streamRef = useRef<MediaStream|null>(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const PASSAGES = [
    '"I am securely enrolling my voice into the PILOT system. This unique vocal signature will verify my identity."',
    '"I authorize PILOT to act on my commands and confirm that I am the registered user of this system."',
    '"PILOT uses voice biometrics to authenticate me. My voice is my secure and unique identity key."',
  ];

  async function startVcRec() {
    setVcErr("");
    streamRef.current?.getTracks().forEach(t => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an  = ctx.createAnalyser(); an.fftSize = 128; src.connect(an);
    const tick = () => {
      const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d);
      setVcBars(Array.from(d.slice(0, 9)).map(v => 3 + Math.floor(v / 255 * 22)));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mrRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) allChunks.current.push(e.data); };
    mr.start(500);
    setVcPhase("recording");
  }

  function stopVcRec(): Promise<void> {
    cancelAnimationFrame(animRef.current);
    return new Promise(resolve => {
      const mr = mrRef.current;
      if (mr && mr.state !== "inactive") { mr.onstop = () => resolve(); mr.stop(); }
      else resolve();
    });
  }

  async function handleVcStop() {
    await stopVcRec();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setVcPhase("done");
    setVcBars(new Array(9).fill(3));
  }

  async function handleVcNext() {
    await stopVcRec();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (vcRound < 3) {
      setVcRound(r => r + 1);
      setVcPhase("idle");
      setVcBars(new Array(9).fill(3));
    } else {
      const blob = new Blob(allChunks.current, { type: "audio/webm" });
      if (blob.size < 1000) {
        setVcErr("Recording too short. Please try again from Round 1.");
        setVcRound(1); setVcPhase("idle"); allChunks.current = [];
        return;
      }
      _pendingVoiceBlob = blob;
      setVcDone(true);
    }
  }

  const pwValid   = pwScore(pw) === 5;
  const formValid = name.trim().length > 0 &&
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
                    pwValid && pw === pw2;
  const canSubmit = formValid && vcDone;

  async function submit() {
    if (!canSubmit) return;
    setErr(""); setLoading(true);
    try {
      await api("POST", "/auth/signup", { name, email, password: pw, role });
      store.setPendingEmail(email);
      store.setPage("verify");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const lbl: React.CSSProperties = {
    fontSize: "0.8rem", fontWeight: 600, display: "block",
    marginBottom: "0.3rem", color: C.text1,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex",
                  alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: "2.5rem",
                    width: "100%", maxWidth: 920,
                    boxShadow: "0 8px 48px rgba(0,0,0,0.08)", position: "relative" }}>

        {/* Back */}
        <button onClick={() => store.setPage("landing")}
          style={{ position: "absolute", top: "1.25rem", left: "1.25rem",
                   background: "none", border: "none", color: C.text3,
                   cursor: "pointer", fontSize: "0.85rem",
                   display: "flex", alignItems: "center", gap: "0.3rem" }}>
          ← Back
        </button>

        {/* 2-step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      gap: "0.75rem", marginBottom: "2rem", marginTop: "0.5rem" }}>
          {[{n:1,l:"Register"},{n:2,l:"Verify"}].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.25rem" }}>
                <div style={{ width:34, height:34, borderRadius:"50%",
                              background: s.n === 1 ? C.amber : C.border,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.9rem", fontWeight:700,
                              color: s.n === 1 ? "#fff" : "#999" }}>
                  {s.n}
                </div>
                <span style={{ fontSize:"0.65rem", fontWeight: s.n===1?700:500,
                               color: s.n===1 ? C.amberDark : C.text3 }}>{s.l}</span>
              </div>
              {i === 0 && <div style={{ width:80, height:2, background:C.border, marginBottom:14 }}/>}
            </React.Fragment>
          ))}
        </div>

        {/* Title */}
        <div style={{ textAlign:"center", marginBottom:"0.75rem" }}>
          <img src="/logo.png" alt="PILOT"
               style={{ width:52, height:52, objectFit:"contain", margin:"0 auto 0.75rem", display:"block" }}/>
        </div>
        <h2 style={{ textAlign:"center", fontSize:"1.55rem", fontWeight:800,
                     color:C.text1, marginBottom:"0.25rem" }}>
          Create your account & Enroll Voice
        </h2>
        <p style={{ textAlign:"center", color:C.text3, fontSize:"0.85rem", marginBottom:"1.75rem" }}>
          Provide your details and complete the 3 calibration rounds side-by-side to register.
        </p>

        {/* SSO centered */}
        <div style={{ maxWidth:420, margin:"0 auto 1.75rem" }}>
          <SSOButtons/>
          <SSODivider/>
        </div>

        {/* Two-column layout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1px 1fr", gap:"2.25rem" }}>

          {/* ── Left: Profile Details ── */}
          <div>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:C.amberDark,
                          marginBottom:"1.25rem", letterSpacing:"0.04em" }}>
              1. Profile Details
            </div>

            <label style={lbl}>Full Name</label>
            <input style={{...inp, marginBottom:"0.85rem"}}
              value={name} onChange={e=>setName(e.target.value)} placeholder="Ada Lovelace"/>

            <label style={lbl}>Email</label>
            <input style={{...inp, marginBottom:"0.85rem"}} type="email"
              value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/>

            <label style={lbl}>Role</label>
            <select style={{...inp, marginBottom:"0.85rem"}} value={role} onChange={e=>setRole(e.target.value)}>
              <option value="developer">Developer</option>
              <option value="manager">Manager</option>
              <option value="csr">Customer Service Rep</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>

            <label style={lbl}>Password</label>
            <PwInput value={pw} onChange={setPw}/>
            <div style={{ marginBottom:"0.9rem" }}><StrengthBar pw={pw}/></div>

            <label style={lbl}>Confirm Password</label>
            <PwInput value={pw2} onChange={setPw2} placeholder="Repeat password"/>
            {pw2 && pw !== pw2 && (
              <p style={{ fontSize:"0.75rem", color:C.red, marginTop:"0.35rem" }}>Passwords do not match.</p>
            )}
            {pw2 && pw === pw2 && pw2.length > 0 && (
              <p style={{ fontSize:"0.75rem", color:C.green, marginTop:"0.35rem" }}>Passwords match.</p>
            )}
          </div>

          {/* Column divider */}
          <div style={{ background:C.border }}/>

          {/* ── Right: Voice Calibration ── */}
          <div>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:C.text2,
                          marginBottom:"1.25rem", letterSpacing:"0.04em" }}>
              2. Voice Calibration
            </div>

            {vcDone ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                            justifyContent:"center", paddingTop:"3.5rem", gap:"0.75rem" }}>
                <div style={{ width:60, height:60, borderRadius:"50%", background:"#DCFCE7",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"1.6rem", color:C.green }}>✓</div>
                <div style={{ fontWeight:700, color:C.green, fontSize:"1rem" }}>Voice enrolled!</div>
                <div style={{ fontSize:"0.8rem", color:C.text3, textAlign:"center" }}>
                  All 3 rounds captured. Ready to submit.
                </div>
              </div>
            ) : (
              <>
                {/* Round progress bar */}
                <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"1rem" }}>
                  {[1,2,3].map(r=>(
                    <div key={r} style={{ flex:1, height:5, borderRadius:3, transition:"background 0.3s",
                                         background: vcRound>r ? C.green : vcRound===r ? C.amber : C.border }}/>
                  ))}
                  <span style={{ fontSize:"0.72rem", color:C.text3, whiteSpace:"nowrap" }}>
                    Round {vcRound}/3
                  </span>
                </div>

                {/* Passage */}
                <div style={{ display:"inline-block", padding:"0.2rem 0.65rem", borderRadius:20,
                              background:C.amber, color:"#fff", fontSize:"0.65rem",
                              fontWeight:700, letterSpacing:"0.08em", marginBottom:"0.55rem" }}>
                  READ ALOUD PASSAGE
                </div>
                <div style={{ background:"var(--bg2)", border:`1.5px solid ${C.border}`, borderRadius:10,
                              padding:"0.9rem 1rem", fontSize:"0.88rem", fontWeight:500,
                              lineHeight:1.65, color:C.text1, marginBottom:"1.1rem" }}>
                  {PASSAGES[vcRound - 1]}
                </div>

                {/* Mic + waveform */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.6rem" }}>
                  <button onClick={vcPhase==="recording" ? handleVcStop : startVcRec}
                    style={{ width:54, height:54, borderRadius:"50%",
                             background: vcPhase==="recording" ? "#EF4444" : C.amberDark,
                             border:"none", fontSize:"1.2rem", color:"#fff", cursor:"pointer",
                             boxShadow: vcPhase==="recording" ? "0 0 0 8px rgba(239,68,68,0.15)" : "none",
                             transition:"all 0.2s" }}>
                    {vcPhase==="recording" ? "⏹" : "🎤"}
                  </button>

                  <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:24 }}>
                    {vcBars.map((h,i)=>(
                      <div key={i} style={{ width:4, borderRadius:2, background:C.amberDark,
                                           height: vcPhase==="recording" ? h : 3,
                                           transition:"height 0.1s" }}/>
                    ))}
                  </div>

                  <div style={{ fontSize:"0.78rem", color:C.text3, textAlign:"center" }}>
                    {vcPhase==="idle"      ? `Tap mic to start Round ${vcRound}` :
                     vcPhase==="recording" ? "Recording… read the passage above" :
                                            `Round ${vcRound} captured`}
                  </div>

                  {vcPhase==="done" && !vcDone && (
                    <button onClick={handleVcNext}
                      style={{ padding:"0.5rem 1.25rem", borderRadius:10,
                               background:C.amber, border:"none", color:"#fff",
                               fontWeight:600, fontSize:"0.82rem", cursor:"pointer" }}>
                      {vcRound < 3 ? `Continue to Round ${vcRound+1} →` : "Finish Enrollment →"}
                    </button>
                  )}
                  {vcErr && <div style={{ color:C.red, fontSize:"0.75rem" }}>{vcErr}</div>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{ color:C.red, fontSize:"0.78rem", margin:"1rem 0",
                        padding:"0.5rem 0.75rem", background:"#FEF2F2",
                        borderRadius:8, border:"1px solid #FECACA" }}>{err}</div>
        )}

        {/* Submit */}
        <button onClick={submit} disabled={!canSubmit || loading}
          style={{ width:"100%", padding:"0.9rem", borderRadius:10, marginTop:"1.75rem",
                   background: canSubmit ? C.amberDark : C.border,
                   color: canSubmit ? "#fff" : C.text3,
                   fontWeight:700, border:"none",
                   cursor: canSubmit ? "pointer" : "not-allowed",
                   fontSize:"0.92rem", transition:"all 0.2s" }}>
          {loading ? "Please wait…" : "Complete Voice Calibration to Sign Up"}
        </button>

        <p style={{ textAlign:"center", fontSize:"0.83rem", color:C.text3, marginTop:"1rem" }}>
          Already have an account?{" "}
          <span style={{ color:C.amberDark, cursor:"pointer", fontWeight:600 }}
            onClick={()=>store.setPage("login")}>Sign in</span>
        </p>
        <p style={{ textAlign:"center", fontSize:"0.72rem", color:C.text3,
                    marginTop:"0.75rem", lineHeight:1.5 }}>
          By creating an account, you agree to PILOT's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

/* ── OTP — with 10-minute countdown ── */
function OTPPage() {
  const store = useAppStore();
  const [digits,   setDigits]   = useState(["","","","","",""]);
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [secsLeft, setSecsLeft] = useState(600);
  const refs = Array.from({length:6}, () => useRef<HTMLInputElement>(null));

  useEffect(() => {
    const id = setInterval(() => {
      setSecsLeft(s => { if (s <= 1) { clearInterval(id); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const expired = secsLeft === 0;
  const mins = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const secs = String(secsLeft % 60).padStart(2, "0");

  function upd(i:number, v:string) {
    if (!/^\d?$/.test(v)) return;
    const d = [...digits]; d[i] = v; setDigits(d);
    if (v && i < 5) refs[i+1].current?.focus();
  }
  function kd(i:number, e:React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i-1].current?.focus();
  }

  async function verify() {
    const otp = digits.join("");
    if (otp.length !== 6) { setErr("Enter all 6 digits"); return; }
    if (expired) { setErr("This code has expired. Please request a new one."); return; }
    setErr(""); setLoading(true);
    try {
      const r = await api("POST", "/auth/verify-otp", { email: store.pendingEmail, otp });
      store.setUser(r.user, r.access_token);
      store.setVoiceEnrolled(r.voice_enrolled);

      // Enroll voice using blob captured on the signup page
      const blob = _pendingVoiceBlob;
      _pendingVoiceBlob = null;
      if (blob && !r.voice_enrolled) {
        try {
          const enroll = await api("POST", "/enrollment/start", { name: r.user.name, role: r.user.role });
          const fd = new FormData();
          fd.append("speaker_id", String(enroll.speaker_id));
          fd.append("audio", blob, "enrollment.webm");
          await fetch("/api/v1/enrollment/audio", {
            method: "POST",
            headers: { Authorization: `Bearer ${r.access_token}` },
            body: fd,
          });
          store.setVoiceEnrolled(true);
          store.setPage("dashboard");
        } catch {
          store.setPage("enroll");
        }
      } else {
        store.setPage(r.voice_enrolled ? "dashboard" : "enroll");
      }
    } catch(e:any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function resend() {
    setSecsLeft(600);
    setDigits(["","","","","",""]);
    setErr("");
    try { await api("POST", "/auth/send-otp", { email: store.pendingEmail }); }
    catch(e:any) { setErr(e.message); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"var(--white)", borderRadius:20, padding:"2.5rem", width:440,
                    boxShadow:"0 8px 48px rgba(0,0,0,0.08)", textAlign:"center" }}>

        {/* Step indicator */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                      gap:"0.75rem", marginBottom:"2rem" }}>
          {[{n:1,l:"Register",done:true},{n:2,l:"Verify",done:false}].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.25rem" }}>
                <div style={{ width:34, height:34, borderRadius:"50%",
                              background: s.done ? C.green : C.amber,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.9rem", fontWeight:700, color:"#fff" }}>
                  {s.done ? "✓" : s.n}
                </div>
                <span style={{ fontSize:"0.65rem", fontWeight: s.done?500:700,
                               color: s.done ? C.text3 : C.amberDark }}>{s.l}</span>
              </div>
              {i === 0 && <div style={{ width:80, height:2, background:C.green, marginBottom:14 }}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ width:50, height:50, borderRadius:14, background:C.amberBg,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"1.4rem", margin:"0 auto 1rem" }}>✈</div>
        <h2 style={{ fontSize:"1.5rem", fontWeight:800, marginBottom:"0.25rem" }}>Check your email</h2>
        <p style={{ color:C.text3, fontSize:"0.85rem", marginBottom:"1rem" }}>
          We sent a 6-digit code to <strong>{store.pendingEmail}</strong>
        </p>

        {/* Countdown pill */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem",
                      padding:"0.35rem 0.9rem", borderRadius:20, marginBottom:"1.5rem",
                      background: expired ? "#FEF2F2" : C.amberBg,
                      border:`1px solid ${expired ? "#FECACA" : C.amber}` }}>
          <span style={{ fontSize:"0.72rem", color: expired ? C.red : C.amberDark, fontWeight:500 }}>
            {expired ? "Code expired" : "Expires in"}
          </span>
          {!expired && (
            <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:"0.9rem",
                           color: secsLeft < 60 ? C.red : C.amberDark }}>
              {mins}:{secs}
            </span>
          )}
        </div>

        {/* OTP digit inputs */}
        <div style={{ display:"flex", gap:"0.55rem", justifyContent:"center", marginBottom:"1.4rem" }}>
          {digits.map((d,i)=>(
            <input key={i} ref={refs[i]} value={d} maxLength={1} inputMode="numeric"
              onChange={e=>upd(i,e.target.value)} onKeyDown={e=>kd(i,e)}
              disabled={expired}
              style={{ width:50, height:58, borderRadius:12,
                       border:`2px solid ${C.border}`, textAlign:"center",
                       fontSize:"1.5rem", fontWeight:700,
                       background:"var(--bg2)", outline:"none", color:C.text1,
                       opacity: expired ? 0.45 : 1 }}/>
          ))}
        </div>

        {err && (
          <div style={{ color:C.red, fontSize:"0.78rem", marginBottom:"0.6rem",
                        padding:"0.5rem", background:"#FEF2F2", borderRadius:8 }}>{err}</div>
        )}

        <button onClick={verify} disabled={loading || expired}
          style={{ width:"100%", padding:"0.85rem", borderRadius:10,
                   background: expired ? C.border : C.amberDark,
                   color: expired ? C.text3 : "#fff",
                   fontWeight:700, border:"none",
                   cursor: expired ? "not-allowed" : "pointer",
                   opacity: loading ? 0.7 : 1, fontSize:"0.92rem" }}>
          {loading ? "Verifying…" : "Verify & Continue →"}
        </button>

        <p style={{ fontSize:"0.8rem", color:C.text3, marginTop:"1rem" }}>
          Didn't receive it?{" "}
          <span style={{ color:C.amberDark, cursor:"pointer", fontWeight:500 }}
            onClick={resend}>Resend code</span>
        </p>
      </div>
    </div>
  );
}

/* ── CHOOSE ROLE — one-time step for first-time SSO signups (no signup form to pick one) ── */
function ChooseRolePage() {
  const store = useAppStore();
  const [role, setRole] = useState("developer");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr(""); setLoading(true);
    try {
      const r = await api("PATCH", "/auth/role", { role });
      store.setUser(r.user, r.access_token);
      store.setPage(store.voiceEnrolled ? "dashboard" : "enroll");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"var(--white)", borderRadius:20, padding:"2.5rem", width:420,
                    boxShadow:"0 8px 48px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign:"center", marginBottom:"1.75rem" }}>
          <img src="/logo.png" alt="PILOT"
               style={{ width:56, height:56, objectFit:"contain", margin:"0 auto 1rem", display:"block" }}/>
          <h2 style={{ fontSize:"1.6rem", fontWeight:800, color:C.text1 }}>Welcome to PILOT</h2>
          <p style={{ color:C.text3, fontSize:"0.88rem", marginTop:"0.25rem" }}>
            One last thing — what's your role?
          </p>
        </div>

        <label style={{ fontSize:"0.8rem",fontWeight:600,display:"block",marginBottom:"0.3rem",color:C.text1 }}>
          Role
        </label>
        <select style={{...inp,marginBottom:"1rem"}} value={role} onChange={e=>setRole(e.target.value)}>
          <option value="developer">Developer</option>
          <option value="manager">Manager</option>
          <option value="csr">Customer Service Rep</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>

        {err && <div style={{ color:C.red,fontSize:"0.78rem",marginBottom:"0.85rem",
                              padding:"0.5rem 0.75rem",background:"#FEF2F2",borderRadius:8,
                              border:"1px solid #FECACA" }}>{err}</div>}

        <button onClick={submit} disabled={loading}
          style={{ width:"100%",padding:"0.85rem",borderRadius:10,background:C.amberDark,
                   color:"#fff",fontWeight:700,border:"none",
                   fontSize:"0.92rem",cursor:"pointer",
                   opacity:loading?0.7:1 }}>
          {loading?"Saving…":"Continue →"}
        </button>
      </div>
    </div>
  );
}

// Each round reads a different pair of sentences — repeating the same lines
// 3 times in a row felt monotonous and gave less varied voice data anyway.
const CALIBRATION_PASSAGES: [string, string][] = [
  [
    "I am securely enrolling my voice into the PILOT system.",
    "This unique vocal signature will verify my identity.",
  ],
  [
    "I authorize PILOT to act on my commands and confirm that I am the registered user of this system.",
    "My voice is my secure and unique identity key.",
  ],
  [
    "PILOT uses voice biometrics to authenticate me during every session.",
    "No one else can access my account by imitating my voice.",
  ],
];

/* ── VOICE CALIBRATION — 3 rounds, all chunks accumulated ── */
function VoiceCalibration() {
  const store = useAppStore();
  const [phase,   setPhase]   = useState<"idle"|"recording"|"done">("idle");
  const [round,   setRound]   = useState(1);
  const [clarity, setClarity] = useState(0);
  const [bars,    setBars]    = useState<number[]>(new Array(9).fill(3));
  const [voiceId, setVoiceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const mrRef       = useRef<MediaRecorder|null>(null);
  const allChunks   = useRef<Blob[]>([]);
  const animRef     = useRef<number>(0);
  const streamRef   = useRef<MediaStream|null>(null);

  async function startRec() {
    setErr("");
    streamRef.current?.getTracks().forEach(t=>t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    streamRef.current = stream;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an  = ctx.createAnalyser(); an.fftSize=128; src.connect(an);
    const tick = () => {
      const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d);
      setBars(Array.from(d.slice(0,9)).map(v=>3+Math.floor(v/255*22)));
      // Real-time clarity: RMS energy of all frequency bins → 0-100%
      const rms = Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length);
      const raw = Math.min(100, Math.round(rms * 100 / 72)); // 72 ≈ clear speech level
      setClarity(c => Math.round(c * 0.72 + raw * 0.28));    // smooth: avoids flickering
      animRef.current = requestAnimationFrame(tick);
    }; tick();
    const mr = new MediaRecorder(stream, {mimeType:"audio/webm"});
    mrRef.current = mr;
    mr.ondataavailable = e => { if(e.data.size>0) allChunks.current.push(e.data); };
    mr.start(500);
    setPhase("recording");
  }

  function stopRec() {
    cancelAnimationFrame(animRef.current);
    return new Promise<void>(resolve => {
      const mr = mrRef.current;
      if (mr && mr.state !== "inactive") {
        mr.onstop = () => { resolve(); };
        mr.stop();
      } else {
        resolve();
      }
    });
  }

  async function handleStop() {
    await stopRec();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setPhase("done");
  }

  async function nextRound() {
    await stopRec();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if (round < 3) {
      setRound(r=>r+1);
      setPhase("idle");
      setClarity(0);
      setBars(new Array(9).fill(3));
    } else {
      setPhase("done");
      await submit();
    }
  }

  async function submit() {
    if (allChunks.current.length === 0) {
      setErr("No audio recorded. Please record at least one round.");
      return;
    }
    setLoading(true); setErr("");
    try {
      const token = localStorage.getItem("pilot_token")!;
      const role  = store.user?.role || "developer";
      const enroll = await api("POST","/enrollment/start",{name:store.user?.name||"User",role});
      const blob = new Blob(allChunks.current, {type:"audio/webm"});
      if (blob.size < 1000) { setErr("Recording too short. Please try again."); return; }
      const fd = new FormData();
      fd.append("speaker_id", String(enroll.speaker_id));
      fd.append("audio", blob, "enrollment.webm");
      const res = await fetch("/api/v1/enrollment/audio",{
        method:"POST", headers:{Authorization:`Bearer ${token}`}, body:fd
      }).then(r=>r.json());
      setVoiceId(res.voice_id || `#${String(enroll.speaker_id).padStart(6,"0")}`);
      store.setVoiceEnrolled(true);
      setTimeout(()=>store.setPage("dashboard"), 1500);
    } catch(e:any) {
      setErr(e.message||"Enrollment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const phaseDots=[
    {l:"Reading\nStarted", done:phase!=="idle"},
    {l:"Voice\nCaptured",  done:phase==="done"},
    {l:"Embedding\nGenerated", done:!!voiceId},
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex",
                  flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
      <div style={{ color:C.amberDark,fontSize:"0.78rem",fontWeight:700,
                    letterSpacing:"0.06em",marginBottom:"0.4rem" }}>⚡ STEP 4 OF 4</div>
      <h2 style={{ fontSize:"1.9rem",fontWeight:900,marginBottom:"0.4rem" }}>Voice Calibration</h2>
      <p style={{ color:C.text3,textAlign:"center",maxWidth:480,marginBottom:"1.75rem",fontSize:"0.88rem" }}>
        Please read the following text naturally. This allows PILOT to build a secure biometric model of your voice.
      </p>

      <div style={{ background:"var(--white)",borderRadius:20,padding:"2rem",width:"100%",maxWidth:600,
                    boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                      paddingBottom:"1rem",borderBottom:`1px solid ${C.border}`,marginBottom:"1rem" }}>
          <div>
            <div style={{ fontWeight:600,fontSize:"0.88rem" }}>Voice Profile Role</div>
            <div style={{ fontSize:"0.75rem",color:C.text3 }}>Fixed to your account role — assigned at signup.</div>
          </div>
          <div style={{ padding:"0.4rem 1rem",borderRadius:20,background:C.amberBg,
                       border:`1.5px solid ${C.amber}`,fontSize:"0.82rem",
                       fontWeight:700,color:C.amberDark }}>
            {(store.user?.role||"developer").toUpperCase()}
          </div>
        </div>

        <div style={{ display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.9rem" }}>
          {[1,2,3].map(r=>(
            <div key={r} style={{ flex:1,height:5,borderRadius:3,transition:"background 0.3s",
                                  background:round>r?C.green:round===r?C.amber:C.border }}/>
          ))}
          <span style={{ fontSize:"0.72rem",color:C.text3,whiteSpace:"nowrap" }}>Round {round}/3</span>
        </div>

        <div style={{ marginBottom:"1.1rem" }}>
          <div style={{ display:"inline-block",padding:"0.2rem 0.65rem",borderRadius:20,
                        background:C.amber,color:"#fff",fontSize:"0.65rem",
                        fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.55rem" }}>
            CALIBRATION TEXT — ROUND {round}
          </div>
          <div style={{ background:"#F9F8F6",border:`1.5px solid ${C.border}`,borderRadius:10,
                        padding:"0.9rem 1rem",fontSize:"0.95rem",fontWeight:500,lineHeight:1.65,
                        color:C.text1,marginBottom:"0.5rem" }}>
            "{CALIBRATION_PASSAGES[round - 1][0]}"
          </div>
          <div style={{ background:"#F9F8F6",border:`1.5px solid ${C.border}`,borderRadius:10,
                        padding:"0.9rem 1rem",fontSize:"0.95rem",fontWeight:500,lineHeight:1.65,
                        color:C.text1 }}>
            "{CALIBRATION_PASSAGES[round - 1][1]}"
          </div>
        </div>

        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"0.6rem" }}>
          <button onClick={phase==="recording"?handleStop:startRec}
            style={{ width:58,height:58,borderRadius:"50%",
                     background:phase==="recording"?"#EF4444":C.amberDark,
                     border:"none",fontSize:"1.3rem",color:"#fff",cursor:"pointer",
                     boxShadow:phase==="recording"?"0 0 0 8px rgba(239,68,68,0.15)":"none",
                     transition:"all 0.2s" }}>
            {phase==="recording"?"⏹":"🎤"}
          </button>
          <div style={{ display:"flex",alignItems:"flex-end",gap:"3px",height:24 }}>
            {bars.map((h,i)=>(
              <div key={i} style={{ width:4,borderRadius:2,background:C.amberDark,
                                    height:phase==="recording"?h:3,transition:"height 0.1s" }}/>
            ))}
          </div>
          <div style={{ fontSize:"0.78rem",color:C.text3 }}>
            {phase==="idle"?`Tap mic to start Round ${round}`:
             phase==="recording"?"Recording… read both passages above":
             `Round ${round} captured ✓`}
          </div>
          {phase!=="idle"&&(
            <div style={{ width:"100%",marginTop:"0.2rem" }}>
              <div style={{ display:"flex",justifyContent:"space-between",
                            fontSize:"0.7rem",fontWeight:700,color:C.text3,marginBottom:"0.25rem" }}>
                <span>CLARITY SCORE</span><span style={{ color:C.green }}>{clarity}%</span>
              </div>
              <div style={{ height:8,background:C.border,borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",background:C.green,borderRadius:4,
                              width:`${clarity}%`,transition:"width 0.3s" }}/>
              </div>
            </div>
          )}
          {err&&<div style={{color:C.red,fontSize:"0.78rem",marginTop:"0.25rem"}}>{err}</div>}
          {phase==="done"&&(
            <button onClick={nextRound}
              style={{ padding:"0.55rem 1.4rem",borderRadius:10,background:C.amber,
                       border:"none",color:"#fff",fontWeight:600,fontSize:"0.85rem",cursor:"pointer" }}>
              {loading?"Saving…":(round<3?`Continue to Round ${round+1} →`:"Complete Enrollment →")}
            </button>
          )}
        </div>

        <div style={{ display:"flex",alignItems:"center",marginTop:"1.25rem" }}>
          {phaseDots.map((ph,i)=>(
            <React.Fragment key={i}>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem" }}>
                <div style={{ width:30,height:30,borderRadius:"50%",display:"flex",
                              alignItems:"center",justifyContent:"center",fontSize:"0.8rem",
                              background:ph.done?C.green:"#E5E2DA",
                              color:ph.done?"#fff":"#AAA" }}>
                  {ph.done?"✓":"···"}
                </div>
                <div style={{ fontSize:"0.62rem",textAlign:"center",whiteSpace:"pre-line",
                              color:ph.done?C.text1:"#AAA",fontWeight:500 }}>{ph.l}</div>
              </div>
              {i<phaseDots.length-1&&<div style={{ flex:1,height:2,background:ph.done?C.green:C.border,margin:"0 4px 16px" }}/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                    width:"100%",maxWidth:600,marginTop:"1.25rem" }}>
        <button onClick={()=>store.setPage("dashboard")}
          style={{ background:"none",border:"none",color:C.text3,fontSize:"0.88rem",cursor:"pointer" }}>
          Cancel
        </button>
        {voiceId&&(
          <div style={{ display:"flex",alignItems:"center",gap:"0.35rem",
                        padding:"0.35rem 0.9rem",background:"var(--amber-bg)",borderRadius:20,
                        fontSize:"0.75rem",color:C.text2 }}>
            🔒 ID: {voiceId}
          </div>
        )}
        <button onClick={submit} disabled={loading}
          style={{ padding:"0.6rem 1.5rem",borderRadius:10,border:"none",
                   background:phase==="done"?C.amberDark:"#E5E2DA",
                   color:phase==="done"?"#fff":"#AAA",
                   fontWeight:600,fontSize:"0.88rem",cursor:"pointer" }}>
          {loading?"Saving…":voiceId?"Done ✓":"Finish"}
        </button>
      </div>
    </div>
  );
}
