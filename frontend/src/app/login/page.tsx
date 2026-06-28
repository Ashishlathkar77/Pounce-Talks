"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CatMark({ size = 32, color = "currentColor" }: { size?: number; color?: string }) {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tab === "signup") { setError("Invite-only. Contact team@pounce.ai"); return; }
    setError(""); setLoading(true);
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

  const inp = (name: string): React.CSSProperties => ({
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1.5px solid ${focused === name ? "#6366f1" : "#e4e4e7"}`,
    fontSize: 14, outline: "none", fontFamily: "inherit",
    boxSizing: "border-box", color: "#09090b", background: "#fff",
    boxShadow: focused === name ? "0 0 0 3px rgba(99,102,241,0.1)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div style={{ display: "flex", background: "#f4f4f5", borderRadius: 10, padding: 3, gap: 2, marginBottom: 24 }}>
        {(["login", "signup"] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", transition: "all 0.15s",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#09090b" : "#71717a",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            {t === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46", display: "block", marginBottom: 6 }}>Email</label>
          <input type="email" value={email} required placeholder="you@company.com"
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
            style={inp("email")} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46", display: "block", marginBottom: 6 }}>Password</label>
          <input type="password" value={password} required placeholder="••••••••••"
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
            style={inp("password")} />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#fff1f2", border: "1px solid #fecdd3", fontSize: 13, color: "#e11d48" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{
          width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10,
          border: "none", cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#e4e4e7" : "#09090b",
          color: loading ? "#a1a1aa" : "#fff",
          fontSize: 14, fontWeight: 600, fontFamily: "inherit",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        {loading ? "Signing in…" : tab === "login" ? "Continue →" : "Request access"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── LEFT — 70% ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: "0 0 70%", background: "#09090b",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 64px", position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "0%", right: "-8%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "32px 32px", maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <CatMark size={28} color="rgba(255,255,255,0.85)" />
          <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.04em" }}>Pounce</span>
        </div>

        {/* Hero */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 52, fontWeight: 800, color: "#fff", letterSpacing: "-0.05em", lineHeight: 1.06, margin: "0 0 24px" }}>
            Calls leads.<br />
            Qualifies them.<br />
            <span style={{ background: "linear-gradient(90deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Books the demo.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: "0 0 48px", maxWidth: 400 }}>
            AI outbound SDR built for freight — dials your prospects, qualifies live, and books demos into your calendar. No human effort.
          </p>

          {/* 3 key stats from research */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { num: "42 hrs", label: "Avg industry response time", src: "HBR, Oldroyd et al. 2011" },
              { num: "7×",     label: "Qualification odds — same-day contact", src: "Same HBR study" },
              { num: "$0.10",  label: "Per minute vs. $61.50/hr human SDR", src: "Vapi · Bland · Salary.com" },
            ].map((s, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)", padding: "20px 22px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em", marginBottom: 6 }}>{s.num}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.45, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.02em" }}>{s.src}</div>
              </div>
            ))}
          </div>

          {/* Competitive edge — one line */}
          <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Unoccupied space: </span>
              HappyRobot and Parade.ai cover inbound only. 11x/Artisan handle email. Nobody owns outbound freight broker → shipper prospecting.{" "}
              <span style={{ color: "#818cf8" }}>That&apos;s Pounce.</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
          POUNCE · AI OUTBOUND SDR
        </div>
      </div>

      {/* ── RIGHT — 30% ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, background: "#fafafa",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 36px",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 100, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 18 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", letterSpacing: "0.02em" }}>System online</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#09090b", letterSpacing: "-0.04em", margin: "0 0 4px" }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0 }}>Sign in to your Pounce workspace</p>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4e4e7", padding: "26px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "#d4d4d8", marginTop: 20 }}>
            Protected · Session expires in 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
