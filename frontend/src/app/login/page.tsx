"use client";

import { useState, FormEvent, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Cat mark ──────────────────────────────────────────────────────────────────
function CatMark({ size = 48, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none"
      stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="13" r="8" strokeWidth="1.5" />
      <path d="M4 10 L3 2 L9 7" strokeWidth="1.5" />
      <path d="M13 7 L19 2 L18 10" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.2" fill={color} stroke="none" />
      <circle cx="14" cy="12" r="1.2" fill={color} stroke="none" />
      <path d="M10 14.5 L11 15.5 L12 14.5" strokeWidth="1.2" />
      <line x1="1"  y1="13.5" x2="7.5"  y2="14"   strokeWidth="0.7" />
      <line x1="1"  y1="15.5" x2="7.5"  y2="15.5" strokeWidth="0.7" />
      <line x1="21" y1="13.5" x2="14.5" y2="14"   strokeWidth="0.7" />
      <line x1="21" y1="15.5" x2="14.5" y2="15.5" strokeWidth="0.7" />
    </svg>
  );
}

// ── Left panel stat ───────────────────────────────────────────────────────────
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500,
        letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

// ── Blinking cursor ───────────────────────────────────────────────────────────
function Cursor() {
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVis((v) => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      display: "inline-block", width: 8, height: 15,
      background: vis ? "#4ade80" : "transparent",
      verticalAlign: "middle", marginLeft: 1,
      transition: "background 0.05s",
    }} />
  );
}

// ── Typewriter line ───────────────────────────────────────────────────────────
function TypeLine({ text, delay = 0, color = "#4ade80" }: { text: string; delay?: number; color?: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, 28);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return <span style={{ color }}>{shown}</span>;
}

// ── Terminal login form ───────────────────────────────────────────────────────
function TerminalForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") || "/campaigns";

  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [authLines, setAuthLines] = useState<string[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  const MONO = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
  const GREEN = "#4ade80";
  const DIM   = "rgba(74,222,128,0.4)";
  const RED   = "#f87171";

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAuthLines([]);
    setLoading(true);

    const lines = [
      "Connecting to pounce-auth.sdr...",
      "Verifying identity...",
      "Checking workspace permissions...",
    ];
    for (let i = 0; i < lines.length; i++) {
      await new Promise((r) => setTimeout(r, 340));
      setAuthLines((prev) => [...prev, lines[i]]);
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setAuthLines((prev) => [...prev, "✓ Authenticated. Loading workspace..."]);
        await new Promise((r) => setTimeout(r, 500));
        router.push(next);
      } else {
        const { error: msg } = await res.json().catch(() => ({}));
        setAuthLines([]);
        setError(msg || "Authentication failed. Check credentials and retry.");
      }
    } catch {
      setAuthLines([]);
      setError("Connection refused. Check network and retry.");
    } finally {
      setLoading(false);
    }
  }

  function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("Access is invite-only. Send a request to team@pounce.ai");
  }

  const inputBase: React.CSSProperties = {
    background: "transparent",
    border: "none",
    outline: "none",
    color: GREEN,
    fontFamily: MONO,
    fontSize: 13,
    flex: 1,
    caretColor: GREEN,
    letterSpacing: "0.02em",
    padding: 0,
  };

  return (
    <div style={{ fontFamily: MONO }}>
      {/* Mode toggle — terminal style */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: `1px solid rgba(74,222,128,0.15)`,
        marginBottom: 20,
      }}>
        {(["login", "signup"] as const).map((m, i) => (
          <button key={m} type="button"
            onClick={() => { setMode(m); setError(""); setAuthLines([]); }}
            style={{
              background: "none", border: "none",
              borderBottom: mode === m ? `2px solid ${GREEN}` : "2px solid transparent",
              color: mode === m ? GREEN : DIM,
              fontFamily: MONO, fontSize: 12, fontWeight: 500,
              padding: "6px 14px 8px",
              cursor: "pointer", letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: -1,
              transition: "color 0.15s",
            }}>
            {m === "login" ? "$ auth" : "$ request"}
          </button>
        ))}
      </div>

      <form onSubmit={mode === "login" ? handleLogin : handleSignup}>
        {/* Email row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 0",
          borderBottom: `1px solid rgba(74,222,128,0.08)`,
          marginBottom: 2,
        }}>
          <span style={{ color: DIM, fontSize: 12, userSelect: "none", whiteSpace: "nowrap" }}>
            user@pounce:~$
          </span>
          <span style={{ color: DIM, fontSize: 12, userSelect: "none" }}>email</span>
          <span style={{ color: GREEN, fontSize: 12, userSelect: "none" }}>▸</span>
          <input
            ref={emailRef}
            type="email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={loading}
            style={{
              ...inputBase,
              // override autofill yellow
            }}
          />
        </div>

        {/* Password row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 0",
          borderBottom: `1px solid rgba(74,222,128,0.08)`,
          marginBottom: 20,
        }}>
          <span style={{ color: DIM, fontSize: 12, userSelect: "none", whiteSpace: "nowrap" }}>
            user@pounce:~$
          </span>
          <span style={{ color: DIM, fontSize: 12, userSelect: "none" }}>passwd</span>
          <span style={{ color: GREEN, fontSize: 12, userSelect: "none" }}>▸</span>
          <input
            type="password" value={password} required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            disabled={loading}
            style={inputBase}
          />
        </div>

        {/* Auth log lines */}
        {authLines.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {authLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 11, fontFamily: MONO,
                color: line.startsWith("✓") ? GREEN : "rgba(74,222,128,0.55)",
                padding: "2px 0", letterSpacing: "0.02em",
              }}>
                {line.startsWith("✓") ? line : `  ${line}`}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 14, padding: "8px 12px",
            background: "rgba(248,113,113,0.06)",
            border: `1px solid rgba(248,113,113,0.2)`,
            borderRadius: 6,
            fontSize: 11, color: RED, fontFamily: MONO, letterSpacing: "0.02em",
          }}>
            <span style={{ color: "rgba(248,113,113,0.6)" }}>✗ error: </span>{error}
          </div>
        )}

        {/* Submit button */}
        <button type="submit" disabled={loading}
          style={{
            width: "100%", padding: "10px 0",
            background: loading ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.1)",
            border: `1px solid ${loading ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.3)"}`,
            borderRadius: 6,
            color: loading ? DIM : GREEN,
            fontFamily: MONO, fontSize: 12, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,0.16)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = loading
              ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.1)";
          }}
        >
          {loading ? (
            <>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              <span>authenticating</span>
              <Cursor />
            </>
          ) : (
            <>
              <span>▸</span>
              <span>{mode === "login" ? "authenticate" : "send request"}</span>
            </>
          )}
        </button>
      </form>

      {/* Footer prompt */}
      <div style={{
        marginTop: 18, fontSize: 11, color: "rgba(74,222,128,0.25)",
        fontFamily: MONO, letterSpacing: "0.02em",
      }}>
        {mode === "login"
          ? "# session duration: 7d · workspace: pounce.ai"
          : "# invite-only · contact team@pounce.ai"}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(74,222,128,0.25) !important; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0d1117 inset !important;
          -webkit-text-fill-color: #4ade80 !important;
          caret-color: #4ade80;
        }
      `}</style>

      <div style={{
        display: "flex", minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}>

        {/* ── LEFT — brand panel ──────────────────────────────────────────── */}
        <div style={{
          flex: "0 0 52%",
          background: "#09090b",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "44px 56px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Glow blobs */}
          <div style={{
            position: "absolute", top: "-8%", left: "-8%",
            width: 520, height: 520, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: "0%", right: "-12%",
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          }} />

          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, position: "relative", zIndex: 1 }}>
            <CatMark size={26} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.04em" }}>
              Pounce
            </span>
          </div>

          {/* Hero */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 36 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 48px rgba(124,58,237,0.22)",
            }}>
              <CatMark size={40} color="rgba(255,255,255,0.82)" />
            </div>

            <div>
              <h1 style={{
                fontSize: 44, fontWeight: 800, color: "#fff",
                letterSpacing: "-0.05em", lineHeight: 1.06,
                margin: 0, marginBottom: 16,
              }}>
                Your AI SDR,<br />always on<br />
                <span style={{
                  background: "linear-gradient(90deg, #a78bfa 0%, #34d399 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>the phone.</span>
              </h1>
              <p style={{
                fontSize: 14, color: "rgba(255,255,255,0.38)",
                lineHeight: 1.72, maxWidth: 310, margin: 0,
              }}>
                Pounce dials freight prospects, qualifies them live, and
                books demos — no human effort, no missed windows.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {["Live outbound calls","AI qualification","Auto demo booking","Freight-native","Real-time transcripts","24 / 7"].map((p) => (
                <span key={p} style={{
                  fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 100, padding: "5px 11px", letterSpacing: "0.01em",
                }}>
                  {p}
                </span>
              ))}
            </div>

            <div style={{
              display: "flex", gap: 36, paddingTop: 28,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              <Stat value="< 2s"  label="First word" />
              <Stat value="3 Qs"  label="To qualify" />
              <Stat value="24/7"  label="Always on" />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            position: "relative", zIndex: 1,
            fontSize: 11, color: "rgba(255,255,255,0.18)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            POUNCE · AI OUTBOUND SDR
          </div>
        </div>

        {/* ── RIGHT — terminal panel ──────────────────────────────────────── */}
        <div style={{
          flex: 1,
          background: "#0d1117",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 40px",
          position: "relative",
        }}>
          {/* Subtle scanlines texture */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
          }} />

          <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
            {/* Terminal window */}
            <div style={{
              background: "#0a0f14",
              border: "1px solid rgba(74,222,128,0.12)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 0 0 1px rgba(74,222,128,0.04), 0 24px 60px rgba(0,0,0,0.6), 0 0 80px rgba(74,222,128,0.04)",
            }}>
              {/* Title bar */}
              <div style={{
                background: "#111820",
                borderBottom: "1px solid rgba(74,222,128,0.08)",
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#ff5f57","#febc2e","#28c840"].map((c) => (
                    <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
                  ))}
                </div>
                <span style={{
                  flex: 1, textAlign: "center",
                  fontSize: 11, color: "rgba(74,222,128,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.04em",
                }}>
                  pounce — auth@sdr
                </span>
              </div>

              {/* Terminal body */}
              <div style={{ padding: "22px 24px 26px" }}>
                {/* Boot header */}
                <div style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  marginBottom: 22,
                  borderBottom: "1px solid rgba(74,222,128,0.07)",
                  paddingBottom: 18,
                }}>
                  <div style={{ fontSize: 11, color: "rgba(74,222,128,0.6)", lineHeight: 1.8 }}>
                    <TypeLine text="Pounce SDR  v1.0.0  (stable)" delay={0} color="rgba(74,222,128,0.7)" />
                    <br />
                    <TypeLine text="Workspace: pounce.ai  ·  Region: us-east-1" delay={280} color="rgba(74,222,128,0.35)" />
                    <br />
                    <TypeLine text="─────────────────────────────────────────" delay={560} color="rgba(74,222,128,0.12)" />
                  </div>
                </div>

                <Suspense>
                  <TerminalForm />
                </Suspense>
              </div>
            </div>

            {/* Below card note */}
            <div style={{
              textAlign: "center", marginTop: 20,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: "rgba(74,222,128,0.18)",
              letterSpacing: "0.04em",
            }}>
              # encrypted session · HMAC-SHA256 · httpOnly cookie
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
