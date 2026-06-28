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

      {/* ── LEFT — research + brand panel ──────────────────────────────────── */}
      <div style={{
        flex: "0 0 70%",
        background: "#09090b",
        display: "flex", flexDirection: "column",
        padding: "40px 52px",
        position: "relative", overflowY: "auto",
        gap: 36,
      }}>

        {/* Glow blobs */}
        <div style={{ position: "absolute", top: "-8%", left: "-6%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-8%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)" }} />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, position: "relative", zIndex: 1, flexShrink: 0 }}>
          <CatMark size={26} color="rgba(255,255,255,0.9)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.04em" }}>Pounce</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 6 }}>AI Outbound SDR</span>
        </div>

        {/* ── PITCH COPY ── */}
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
          <div style={{
            borderLeft: "2px solid rgba(167,139,250,0.5)",
            paddingLeft: 18,
          }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.75)", fontWeight: 400 }}>
              The average company takes{" "}
              <span style={{ color: "#f87171", fontWeight: 700 }}>42 hours</span>{" "}
              to respond to a web lead.{" "}
              <span style={{ color: "rgba(255,255,255,0.4)" }}>23% never respond at all.</span>{" "}
              Companies that reach out the same day are{" "}
              <span style={{ color: "#4ade80", fontWeight: 700 }}>7× more likely</span>{" "}
              to qualify the lead.
            </p>
            <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.75)" }}>
              <span style={{
                background: "linear-gradient(90deg, #a78bfa, #34d399)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                fontWeight: 700,
              }}>
                Pounce reaches out and books actual meetings same day.
              </span>{" "}
              <span style={{ color: "rgba(255,255,255,0.35)" }}>
                A freight SDR costs $100–145K/yr fully loaded. We do it at infrastructure cost — ~$0.10/min.
              </span>
            </p>
          </div>
        </div>

        {/* ── RESEARCH TABLE ── */}
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              The Data
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 120px 1fr",
              background: "rgba(255,255,255,0.04)",
              padding: "9px 16px", gap: 12,
            }}>
              {["Claim", "Number", "Source"].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>

            {[
              { claim: "Avg lead response time", num: "42 hours", src: "HBR 2011, Oldroyd et al.", numColor: "#f87171" },
              { claim: "Companies that never respond to web leads", num: "23%", src: "Same HBR study", numColor: "#fb923c" },
              { claim: "Response same day → qualification odds", num: "7× more likely", src: "Same HBR study", numColor: "#4ade80" },
              { claim: "Fully-loaded human SDR cost", num: "$100–145K/yr", src: "Glassdoor · LeadGenius · Salary.com", numColor: "#f87171" },
              { claim: "Human SDR hourly cost", num: "~$61.50/hr", src: "Derived: $128K ÷ 2,080 hrs", numColor: "#fb923c" },
              { claim: "AI voice infrastructure cost", num: "$0.07–0.25/min", src: "Vapi · Bland · Retell (vendor-stated)", numColor: "#4ade80" },
            ].map((row, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 120px 1fr",
                padding: "10px 16px", gap: 12,
                background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{row.claim}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.numColor, letterSpacing: "-0.01em" }}>{row.num}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.4 }}>{row.src}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COMPETITIVE GAP ── */}
        <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              The Competitive Gap
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>Verified</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "HappyRobot", note: "$44M Series B", desc: "Inbound carrier calls only — no outbound shipper sales", tag: "inbound only" },
              { name: "Parade.ai CoDriver", note: "Apr 2025", desc: "Inbound capacity management only", tag: "inbound only" },
              { name: "11x · Artisan · AiSDR", note: "Horizontal", desc: "Email SDR only — weak voice, zero freight domain knowledge", tag: "no voice" },
            ].map((c) => (
              <div key={c.name} style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "11px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{c.note}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>{c.desc}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "#fb923c",
                  background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)",
                  borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0, marginTop: 1,
                }}>{c.tag}</span>
              </div>
            ))}

            {/* The gap */}
            <div style={{
              padding: "12px 14px", borderRadius: 8,
              background: "rgba(167,139,250,0.07)",
              border: "1px solid rgba(167,139,250,0.2)",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", flexShrink: 0, marginTop: 5 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", display: "block", marginBottom: 3 }}>
                  The unoccupied space
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  Outbound freight broker → shipper prospecting with load board signal enrichment.
                  That gap is real, unoccupied, and it&apos;s exactly what Pounce is built for.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stamp */}
        <div style={{ position: "relative", zIndex: 1, fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", marginTop: "auto", paddingTop: 8 }}>
          POUNCE · AI OUTBOUND SDR · ALL FIGURES INDEPENDENTLY SOURCED
        </div>
      </div>

      {/* ── RIGHT — auth panel ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: "#fafafa",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        position: "relative",
      }}>
        {/* Subtle top border */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 1, background: "linear-gradient(90deg, transparent, #e4e4e7 30%, #e4e4e7 70%, transparent)",
        }} />

        <div style={{ width: "100%", maxWidth: 380 }}>
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
