"use client";

import { useState, FormEvent, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MONO = "'JetBrains Mono','Fira Code','Cascadia Code','Courier New',monospace";
const G    = "#4ade80";   // primary green
const G2   = "rgba(74,222,128,0.45)";
const G3   = "rgba(74,222,128,0.18)";
const G4   = "rgba(74,222,128,0.08)";
const BG   = "#0b0f0b";

// ── Blinking cursor ───────────────────────────────────────────────────────────
function Cursor({ on = true }: { on?: boolean }) {
  const [vis, setVis] = useState(true);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setVis(v => !v), 520);
    return () => clearInterval(t);
  }, [on]);
  return (
    <span style={{
      display: "inline-block", width: 7, height: 14,
      background: on && vis ? G : "transparent",
      verticalAlign: "middle", marginLeft: 1,
    }} />
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function TW({ text, delay = 0, speed = 22, color = G2 }: {
  text: string; delay?: number; speed?: number; color?: string;
}) {
  const [shown, setShown] = useState(delay > 0 ? "" : text);
  const done = useRef(delay === 0);
  useEffect(() => {
    if (done.current) return;
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length) { done.current = true; clearInterval(iv); }
      }, speed);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <span style={{ color, fontFamily: MONO }}>{shown}</span>;
}

// ── Left: terminal info panel ─────────────────────────────────────────────────
function InfoPanel() {
  return (
    <div style={{
      flex: "0 0 75%", borderRight: `1px solid ${G3}`,
      padding: "44px 52px", display: "flex", flexDirection: "column",
      gap: 36, overflowY: "auto",
    }}>

      {/* Prompt + ASCII brand */}
      <div>
        <div style={{ fontSize: 11, color: G2, fontFamily: MONO, marginBottom: 14 }}>
          <TW text="$ pounce --info" delay={0} color={G} />
        </div>

        {/* Block-letter POUNCE */}
        <pre style={{
          margin: 0, fontFamily: MONO, fontSize: 13, lineHeight: 1.25,
          color: G, letterSpacing: "0.04em", userSelect: "none",
        }}>{`
 ██████╗  ██████╗ ██╗   ██╗███╗  ██╗ ██████╗███████╗
 ██╔══██╗██╔═══██╗██║   ██║████╗ ██║██╔════╝██╔════╝
 ██████╔╝██║   ██║██║   ██║██╔██╗██║██║     █████╗
 ██╔═══╝ ██║   ██║██║   ██║██║╚████║██║     ██╔══╝
 ██║     ╚██████╔╝╚██████╔╝██║ ╚███║╚██████╗███████╗
 ╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚══╝ ╚═════╝╚══════╝
`.trim()}</pre>

        <div style={{
          marginTop: 14, fontSize: 12, fontFamily: MONO,
          color: G2, letterSpacing: "0.04em",
        }}>
          <TW text="AI Outbound SDR · Freight Industry · v1.0.0-stable" delay={400} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${G3}` }} />

      {/* System output */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ fontSize: 11, color: G3, fontFamily: MONO, marginBottom: 4 }}>
          <TW text="$ pounce --describe" delay={700} color={G3} />
        </div>
        {[
          ["Dials freight prospects live on the phone", 900],
          ["Qualifies with 3 smart discovery questions", 1100],
          ["Books demos directly into your calendar", 1300],
          ["Transcribes and scores every call automatically", 1500],
          ["Runs 24/7 — zero human effort on your end", 1700],
        ].map(([text, delay]) => (
          <div key={text as string} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: G3, fontFamily: MONO, fontSize: 12, userSelect: "none", flexShrink: 0 }}>▸</span>
            <span style={{ fontSize: 12, fontFamily: MONO }}>
              <TW text={text as string} delay={delay as number} color={G2} />
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${G3}` }} />

      {/* Stats as terminal readout */}
      <div>
        <div style={{ fontSize: 11, color: G3, fontFamily: MONO, marginBottom: 14 }}>
          <TW text="$ pounce --stats" delay={1900} color={G3} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "time_to_first_word", val: "< 2s",  bar: 0.96, delay: 2100 },
            { key: "questions_to_qualify", val: "3",    bar: 0.30, delay: 2250 },
            { key: "qualification_rate",   val: "43%",  bar: 0.43, delay: 2400 },
            { key: "demo_book_rate",       val: "31%",  bar: 0.31, delay: 2550 },
            { key: "uptime",               val: "99.9%",bar: 0.999,delay: 2700 },
          ].map(({ key, val, bar, delay }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 11 }}>
              <span style={{ color: G3, width: 180, flexShrink: 0 }}>
                <TW text={key} delay={delay} color={G3} speed={14} />
              </span>
              <BarLine pct={bar} delay={delay + 100} />
              <span style={{ color: G, fontWeight: 700, width: 44 }}>
                <TW text={val} delay={delay + 200} color={G} speed={14} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${G3}` }} />

      {/* Capabilities */}
      <div>
        <div style={{ fontSize: 11, color: G3, fontFamily: MONO, marginBottom: 14 }}>
          <TW text="$ pounce --modules" delay={2900} color={G3} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            ["COMMAND","AI layer on existing TMS"],
            ["CORE","End-to-end AI-native TMS"],
            ["FORGE","RFP bidding & lane mgmt"],
            ["REACH","AI outbound SDR (this)"],
            ["CUSTOM","Bespoke full-stack builds"],
          ].map(([name, desc]) => (
            <div key={name} style={{
              border: `1px solid ${G3}`, borderRadius: 6,
              padding: "7px 12px",
              display: "flex", flexDirection: "column", gap: 2,
              background: G4,
            }}>
              <span style={{ fontSize: 10, fontFamily: MONO, color: G, fontWeight: 700, letterSpacing: "0.08em" }}>
                {name}
              </span>
              <span style={{ fontSize: 10, fontFamily: MONO, color: G3 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom prompt */}
      <div style={{ fontSize: 11, fontFamily: MONO, color: G3, marginTop: "auto" }}>
        <TW text="# authenticate on the right to access your workspace →" delay={3200} color={G3} />
      </div>
    </div>
  );
}

// ── Animated progress bar ─────────────────────────────────────────────────────
function BarLine({ pct, delay }: { pct: number; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  const total = 20;
  const filled = Math.round(w * total);
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, color: G3, userSelect: "none", transition: "all 0.6s" }}>
      {"▓".repeat(filled)}{"░".repeat(total - filled)}
    </span>
  );
}

// ── Right: terminal login ─────────────────────────────────────────────────────
function LoginPanel() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") || "/campaigns";

  const [mode,      setMode]      = useState<"login"|"signup">("login");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [logLines,  setLogLines]  = useState<{ text: string; ok?: boolean }[]>([]);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus]  = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(""); setLogLines([]); setLoading(true);
    const steps = [
      "connecting to pounce-auth.sdr...",
      "verifying identity...",
      "checking workspace permissions...",
    ];
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 320));
      setLogLines(p => [...p, { text: s }]);
    }
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setLogLines(p => [...p, { text: "✓ authenticated. loading workspace...", ok: true }]);
        await new Promise(r => setTimeout(r, 480));
        router.push(next);
      } else {
        const { error: msg } = await res.json().catch(() => ({}));
        setLogLines([]);
        setError(msg || "authentication failed.");
        setLoading(false);
      }
    } catch {
      setLogLines([]);
      setError("connection refused. check network.");
      setLoading(false);
    }
  }

  function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("invite-only. contact team@pounce.ai");
  }

  const inputStyle: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none",
    color: G, fontFamily: MONO, fontSize: 13,
    flex: 1, caretColor: G, letterSpacing: "0.02em", padding: 0,
    minWidth: 0,
  };

  return (
    <div style={{
      flex: 1, padding: "44px 28px",
      display: "flex", flexDirection: "column", justifyContent: "center",
      gap: 28,
    }}>

      {/* Header prompt */}
      <div>
        <div style={{ fontSize: 11, color: G3, fontFamily: MONO, marginBottom: 6 }}>
          pounce-sdr  ·  auth module
        </div>
        <div style={{ fontSize: 11, color: G2, fontFamily: MONO }}>
          $ login --workspace pounce.ai
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${G3}` }}>
        {(["login","signup"] as const).map(m => (
          <button key={m} type="button"
            onClick={() => { setMode(m); setError(""); setLogLines([]); }}
            style={{
              background: "none", border: "none",
              borderBottom: mode === m ? `1.5px solid ${G}` : "1.5px solid transparent",
              color: mode === m ? G : G3,
              fontFamily: MONO, fontSize: 11, padding: "5px 12px 7px",
              cursor: "pointer", letterSpacing: "0.06em",
              textTransform: "uppercase", marginBottom: -1,
            }}>
            {m === "login" ? "[ auth ]" : "[ request ]"}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={mode === "login" ? handleLogin : handleSignup}
        style={{ display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Email */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 0", borderBottom: `1px solid ${emailFocus ? G3 : "rgba(74,222,128,0.06)"}`,
          transition: "border-color 0.15s",
        }}>
          <span style={{ color: G3, fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap", userSelect: "none" }}>
            ~$
          </span>
          <span style={{ color: G2, fontFamily: MONO, fontSize: 11, userSelect: "none" }}>email</span>
          <span style={{ color: G3, fontFamily: MONO, fontSize: 11, userSelect: "none" }}>▸</span>
          <input type="email" value={email} required disabled={loading}
            placeholder="you@company.com"
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setEmailFocus(true)}
            onBlur={() => setEmailFocus(false)}
            style={inputStyle}
          />
          {emailFocus && <Cursor />}
        </div>

        {/* Password */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 0", borderBottom: `1px solid ${passFocus ? G3 : "rgba(74,222,128,0.06)"}`,
          marginBottom: 16, transition: "border-color 0.15s",
        }}>
          <span style={{ color: G3, fontFamily: MONO, fontSize: 11, whiteSpace: "nowrap", userSelect: "none" }}>
            ~$
          </span>
          <span style={{ color: G2, fontFamily: MONO, fontSize: 11, userSelect: "none" }}>passwd</span>
          <span style={{ color: G3, fontFamily: MONO, fontSize: 11, userSelect: "none" }}>▸</span>
          <input type="password" value={password} required disabled={loading}
            placeholder="••••••••••"
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setPassFocus(true)}
            onBlur={() => setPassFocus(false)}
            style={inputStyle}
          />
          {passFocus && <Cursor />}
        </div>

        {/* Auth log */}
        {logLines.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {logLines.map((l, i) => (
              <div key={i} style={{
                fontFamily: MONO, fontSize: 10,
                color: l.ok ? G : G2,
                padding: "1px 0", letterSpacing: "0.02em",
              }}>
                {l.ok ? l.text : `  ${l.text}`}
                {i === logLines.length - 1 && !l.ok && <Cursor />}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: MONO, fontSize: 10, color: "#f87171",
            padding: "8px 10px", marginBottom: 10,
            border: "1px solid rgba(248,113,113,0.15)",
            borderRadius: 4, background: "rgba(248,113,113,0.04)",
            letterSpacing: "0.02em",
          }}>
            <span style={{ color: "rgba(248,113,113,0.5)" }}>✗ error: </span>{error}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading}
          style={{
            background: loading ? G4 : "rgba(74,222,128,0.1)",
            border: `1px solid ${loading ? G4 : G3}`,
            borderRadius: 5, padding: "10px 0",
            color: loading ? G3 : G,
            fontFamily: MONO, fontSize: 11,
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.1em", textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,0.16)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = loading ? G4 : "rgba(74,222,128,0.1)"; }}
        >
          {loading
            ? <><span>authenticating</span><Cursor /></>
            : <><span>▸</span><span>{mode === "login" ? "authenticate" : "send request"}</span></>
          }
        </button>
      </form>

      {/* Footer */}
      <div style={{
        fontFamily: MONO, fontSize: 10, color: G3,
        lineHeight: 1.7, borderTop: `1px solid ${G4}`, paddingTop: 16,
      }}>
        <div># session: 7d · httpOnly cookie</div>
        <div># invite-only workspace</div>
        {mode === "signup" && <div># contact: team@pounce.ai</div>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG}; }
        input::placeholder { color: rgba(74,222,128,0.2) !important; font-family: ${MONO}; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px ${BG} inset !important;
          -webkit-text-fill-color: ${G} !important;
          caret-color: ${G};
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(74,222,128,0.15); border-radius: 2px; }
      `}</style>

      {/* Full-page scanline texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)",
      }} />

      {/* Terminal window */}
      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: BG,
      }}>
        {/* Title bar */}
        <div style={{
          background: "#0f1a0f",
          borderBottom: `1px solid ${G3}`,
          padding: "10px 18px",
          display: "flex", alignItems: "center", gap: 14,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 7 }}>
            {["#ff5f57","#febc2e","#28c840"].map(c => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, opacity: 0.9 }} />
            ))}
          </div>
          <span style={{
            flex: 1, textAlign: "center",
            fontFamily: MONO, fontSize: 11, color: G3, letterSpacing: "0.05em",
          }}>
            pounce-sdr  —  bash  —  auth@workspace
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: G4 }}>v1.0.0</span>
        </div>

        {/* Body — info + login side by side */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <InfoPanel />
          <div style={{ borderLeft: `1px solid ${G3}` }} />
          <Suspense>
            <LoginPanel />
          </Suspense>
        </div>

        {/* Status bar */}
        <div style={{
          background: G, padding: "3px 18px",
          display: "flex", alignItems: "center", gap: 20,
          flexShrink: 0,
        }}>
          {[
            "POUNCE SDR",
            "AI OUTBOUND",
            "FREIGHT INDUSTRY",
            "WORKSPACE: pounce.ai",
          ].map(s => (
            <span key={s} style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: "#0b0f0b", letterSpacing: "0.07em",
            }}>
              {s}
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "rgba(11,15,11,0.6)" }}>
            UTF-8  ·  LF  ·  AUTH
          </span>
        </div>
      </div>
    </>
  );
}
