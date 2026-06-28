"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") || "/campaigns";

  const [tab,      setTab]      = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push(next);
      } else {
        const { error: msg } = await res.json().catch(() => ({}));
        setError(msg || "Invalid email or password.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError("Pounce is invite-only. Reach out to get access.");
  }

  const inputStyle = (name: string) => ({
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${focused === name ? "#a78bfa" : "#e4e4e7"}`,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s, box-shadow 0.15s",
    color: "#09090b",
    background: "#fff",
    boxShadow: focused === name ? "0 0 0 3px rgba(167,139,250,0.12)" : "none",
  });

  return (
    <form onSubmit={tab === "login" ? handleLogin : handleSignup} style={{ width: "100%" }}>
      {/* Tabs */}
      <div style={{
        display: "flex", borderRadius: 12, background: "#f4f4f5",
        padding: 3, marginBottom: 28, gap: 2,
      }}>
        {(["login", "signup"] as const).map((t) => (
          <button key={t} type="button"
            onClick={() => { setTab(t); setError(""); }}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 9, border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.18s",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#09090b" : "#71717a",
              boxShadow: tab === t ? "0 1px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" : "none",
              fontFamily: "inherit",
            }}>
            {t === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46", display: "block", marginBottom: 6, letterSpacing: "0.01em" }}>
            Email address
          </label>
          <input type="email" value={email} required
            placeholder="you@company.com"
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            style={inputStyle("email")}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46", letterSpacing: "0.01em" }}>
              Password
            </label>
          </div>
          <input type="password" value={password} required
            placeholder="••••••••••"
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            style={inputStyle("password")}
          />
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 10,
          background: "#fff1f2", border: "1px solid #fecdd3",
          fontSize: 13, color: "#e11d48", lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{
          width: "100%", marginTop: 22, padding: "12px 0", borderRadius: 10,
          border: "none", cursor: loading ? "not-allowed" : "pointer",
          background: loading
            ? "#e4e4e7"
            : "linear-gradient(135deg, #1c1c1e 0%, #3f3f46 100%)",
          color: loading ? "#a1a1aa" : "#fff",
          fontSize: 14, fontWeight: 600, fontFamily: "inherit",
          letterSpacing: "-0.01em",
          transition: "opacity 0.15s, transform 0.1s",
          boxShadow: loading ? "none" : "0 2px 12px rgba(0,0,0,0.18)",
        }}
        onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        {loading ? "Signing in…" : tab === "login" ? "Continue →" : "Request access"}
      </button>

      <p style={{ textAlign: "center", fontSize: 12, color: "#a1a1aa", marginTop: 18, marginBottom: 0, lineHeight: 1.5 }}>
        {tab === "login"
          ? "Invite-only. Don't have access? "
          : "We'll reach out within 24 hours. "}
        <a href="mailto:team@pounce.ai"
          style={{ color: "#71717a", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {tab === "login" ? "Get in touch" : "Questions?"}
        </a>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── LEFT — dark brand panel ─────────────────────────────────────────── */}
      <div style={{
        flex: "0 0 52%",
        background: "#09090b",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "44px 56px",
        position: "relative", overflow: "hidden",
      }}>

        {/* Background glow blobs */}
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "5%", right: "-10%",
          width: 360, height: 360, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%",
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(250,204,21,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Dot grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }} />

        {/* Top wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, position: "relative", zIndex: 1 }}>
          <CatMark size={26} color="rgba(255,255,255,0.9)" />
          <span style={{
            fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)",
            letterSpacing: "-0.04em",
          }}>
            Pounce
          </span>
        </div>

        {/* Center hero */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", gap: 36,
        }}>
          {/* Big cat mark */}
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(124,58,237,0.2)",
          }}>
            <CatMark size={40} color="rgba(255,255,255,0.85)" />
          </div>

          <div>
            <h1 style={{
              fontSize: 42, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.05em", lineHeight: 1.08,
              margin: 0, marginBottom: 16,
            }}>
              Your AI SDR,<br />
              always on<br />
              <span style={{
                background: "linear-gradient(90deg, #a78bfa, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                the phone.
              </span>
            </h1>
            <p style={{
              fontSize: 14, color: "rgba(255,255,255,0.42)",
              lineHeight: 1.7, maxWidth: 320, margin: 0,
            }}>
              Pounce dials your freight prospects, qualifies them live,
              and books demos — with zero human effort on your end.
            </p>
          </div>

          {/* Capability pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              "Live outbound calls",
              "AI qualification",
              "Auto demo booking",
              "CRM sync",
              "Real-time transcripts",
              "Freight-native",
            ].map((pill) => (
              <span key={pill} style={{
                fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 100, padding: "5px 11px",
                letterSpacing: "0.01em",
              }}>
                {pill}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: 36,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}>
            <Stat value="< 2s"  label="Time to first word" />
            <Stat value="3 Qs"  label="To qualify a lead" />
            <Stat value="24/7"  label="Always dialing" />
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          position: "relative", zIndex: 1,
          fontSize: 11, color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.02em",
        }}>
          POUNCE · AI OUTBOUND SDR
        </div>
      </div>

      {/* ── RIGHT — auth panel ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: "#fafafa",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 40px",
        position: "relative",
      }}>
        {/* Subtle top border */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 1, background: "linear-gradient(90deg, transparent, #e4e4e7 30%, #e4e4e7 70%, transparent)",
        }} />

        <div style={{ width: "100%", maxWidth: 368 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 100,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              marginBottom: 20,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", letterSpacing: "0.02em" }}>
                System online
              </span>
            </div>
            <h2 style={{
              fontSize: 24, fontWeight: 700, color: "#09090b",
              letterSpacing: "-0.04em", margin: 0, marginBottom: 6,
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0 }}>
              Sign in to your Pounce workspace
            </p>
          </div>

          {/* Form card */}
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e4e4e7",
            padding: "28px 28px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04)",
          }}>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          {/* Footer note */}
          <p style={{
            textAlign: "center", fontSize: 11, color: "#d4d4d8",
            marginTop: 24, letterSpacing: "0.01em",
          }}>
            Protected workspace · Session expires in 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
