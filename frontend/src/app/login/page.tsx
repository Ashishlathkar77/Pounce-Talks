"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── Cat SVG mark (same paths as sidebar) ─────────────────────────────────────
function CatMark({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  const s = size / 22;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="13" r="8" strokeWidth="1.5" />
      <path d="M4 10 L3 2 L9 7" strokeWidth="1.5" />
      <path d="M13 7 L19 2 L18 10" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="1.2" fill={color} stroke="none" />
      <circle cx="14" cy="12" r="1.2" fill={color} stroke="none" />
      <path d="M10 14.5 L11 15.5 L12 14.5" strokeWidth="1.2" />
      <line x1="1"  y1="13.5" x2="7.5"  y2="14"    strokeWidth="0.7" />
      <line x1="1"  y1="15.5" x2="7.5"  y2="15.5"  strokeWidth="0.7" />
      <line x1="21" y1="13.5" x2="14.5" y2="14"    strokeWidth="0.7" />
      <line x1="21" y1="15.5" x2="14.5" y2="15.5"  strokeWidth="0.7" />
    </svg>
  );
}

// ── Feature row ───────────────────────────────────────────────────────────────
function Feature({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#facc15", flexShrink: 0, marginTop: 7,
      }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", lineHeight: 1.3 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Login form (needs useSearchParams so wrapped in Suspense) ─────────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") || "/campaigns";

  const [tab,      setTab]      = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

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
    setError("Signup is invite-only. Contact the Hemut team.");
  }

  return (
    <form onSubmit={tab === "login" ? handleLogin : handleSignup} style={{ width: "100%" }}>
      {/* Tab switcher */}
      <div style={{
        display: "flex", borderRadius: 10, background: "#f3f4f6",
        padding: 3, marginBottom: 28, gap: 3,
      }}>
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(""); }}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#111" : "#6b7280",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {t === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hemut.com"
            required
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
              transition: "border-color 0.15s",
              color: "#111",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#facc15")}
            onBlur={(e)  => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
              transition: "border-color 0.15s",
              color: "#111",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#facc15")}
            onBlur={(e)  => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12, padding: "9px 12px", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fecaca",
          fontSize: 13, color: "#dc2626",
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", marginTop: 20, padding: "11px 0", borderRadius: 8,
          border: "none", cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#e5e7eb" : "#111",
          color: loading ? "#9ca3af" : "#fff",
          fontSize: 14, fontWeight: 600, fontFamily: "inherit",
          transition: "background 0.15s",
          letterSpacing: "-0.01em",
        }}
      >
        {loading ? "Signing in…" : tab === "login" ? "Sign in" : "Request access"}
      </button>

      {tab === "login" && (
        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 16, marginBottom: 0 }}>
          Pounce is currently invite-only.{" "}
          <a href="https://hemut.com" target="_blank" rel="noreferrer"
            style={{ color: "#6b7280", textDecoration: "underline" }}>
            Learn more
          </a>
        </p>
      )}
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div style={{
      display: "flex", minHeight: "100vh", fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      {/* ── LEFT — branding panel ── */}
      <div style={{
        flex: "0 0 50%", background: "#0a0a0a", color: "#fff",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 52px", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        {/* Top: logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <CatMark size={32} color="#facc15" />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.04em", color: "#fff" }}>
            Pounce
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#facc15", letterSpacing: "0.08em",
            background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)",
            borderRadius: 4, padding: "2px 6px", marginLeft: 4,
          }}>
            YC X25
          </span>
        </div>

        {/* Middle: hero copy */}
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
          <div>
            <div style={{
              fontSize: 38, fontWeight: 800, letterSpacing: "-0.04em",
              lineHeight: 1.1, color: "#fff", marginBottom: 14,
            }}>
              We call before<br />
              they close<br />
              the tab.
            </div>
            <div style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.65, maxWidth: 340 }}>
              Pounce is Hemut&apos;s AI outbound SDR — it dials your freight prospects,
              qualifies them live on the phone, and books demos without a human touching the pipeline.
            </div>
          </div>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Feature
              label="Command · Core · Forge · Reach"
              desc="Full AI operational stack for carriers and brokers — sits on top of your existing TMS."
            />
            <Feature
              label="Live outbound calls"
              desc="Paul dials, qualifies, and books — naturally, in real-time, with your branding."
            />
            <Feature
              label="Instant qualification"
              desc="Team size, TMS, decision-maker. Scored automatically. Only warm leads reach your calendar."
            />
            <Feature
              label="Cal.com booking"
              desc="Prospect picks a slot on the call. Meeting lands in your calendar before they hang up."
            />
          </div>
        </div>

        {/* Bottom: Hemut tag */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4b5563" }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Built by <span style={{ color: "#9ca3af" }}>Hemut</span> · Fresno, CA · YC X25
          </span>
        </div>
      </div>

      {/* ── RIGHT — auth card ── */}
      <div style={{
        flex: "0 0 50%", background: "#fafafa",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 40px",
      }}>
        <div style={{
          width: "100%", maxWidth: 380,
          background: "#fff", borderRadius: 16,
          border: "1.5px solid #e5e7eb",
          padding: "36px 32px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          {/* Card header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111", letterSpacing: "-0.03em" }}>
              Welcome back
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
              Sign in to your Pounce dashboard
            </div>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
