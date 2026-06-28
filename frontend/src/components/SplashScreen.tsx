"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "converse_splash_shown";

export default function SplashScreen() {
  const [phase, setPhase] = useState<"driving" | "fadeout" | "done">(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY)) return "done";
    return "driving";
  });
  const truckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === "done") return;
    const el = truckRef.current;
    if (!el) return;
    const handleEnd = () => {
      setPhase("fadeout");
      setTimeout(() => {
        setPhase("done");
        sessionStorage.setItem(STORAGE_KEY, "1");
      }, 500);
    };
    el.addEventListener("animationend", handleEnd);
    return () => el.removeEventListener("animationend", handleEnd);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--bg-primary)",
        overflow: "hidden",
        opacity: phase === "fadeout" ? 0 : 1,
        transition: "opacity 500ms cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: phase === "fadeout" ? "none" : "all",
      }}
    >
      {/* Road */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: "50%", marginTop: 28,
        height: 1.5,
        background: "var(--border)",
      }} />
      {/* Dashed lane */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: "50%", marginTop: 28,
        height: 2, overflow: "hidden",
      }}>
        <div style={{
          display: "flex", gap: 12,
          width: "200%",
          animation: "road-move 0.5s linear infinite",
        }}>
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} style={{ width: 16, height: 2, borderRadius: 999, background: "var(--text-muted)", opacity: 0.25, flexShrink: 0 }} />
          ))}
        </div>
      </div>

      {/* Truck */}
      <div
        ref={truckRef}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          marginTop: -20,
          animation: "truck-drive-across 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        }}
      >
        <div style={{ animation: "truck-bounce 0.7s ease-in-out infinite" }}>
          <svg width="130" height="56" viewBox="0 0 130 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Trailer */}
            <rect x="0" y="8" width="78" height="34" rx="5" fill="var(--bg-elevated)" stroke="var(--border-hover)" strokeWidth="1.5" />
            {/* Converse branding on trailer */}
            <rect x="20" y="17" width="38" height="16" rx="3" fill="#FFD33B" opacity="0.12" />
            <text x="39" y="28" textAnchor="middle" fill="#FFD33B" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="-0.5">CONVERSE</text>
            {/* Cab */}
            <rect x="78" y="13" width="40" height="29" rx="5" fill="var(--bg-elevated)" stroke="var(--border-hover)" strokeWidth="1.5" />
            {/* Windshield */}
            <rect x="99" y="17" width="15" height="11" rx="3" fill="#FFD33B" opacity="0.18" />
            {/* Headlight */}
            <circle cx="117" cy="35" r="2.5" fill="#FFD33B" />
            <circle cx="117" cy="35" r="4" fill="#FFD33B" opacity="0.15" />
            {/* Wheels */}
            <g style={{ transformOrigin: "24px 48px", animation: "wheel-spin 0.7s linear infinite" }}>
              <circle cx="24" cy="48" r="7.5" fill="var(--bg-hover)" stroke="var(--text-muted)" strokeWidth="2" />
              <circle cx="24" cy="48" r="2.5" fill="var(--text-muted)" />
            </g>
            <g style={{ transformOrigin: "60px 48px", animation: "wheel-spin 0.7s linear infinite" }}>
              <circle cx="60" cy="48" r="7.5" fill="var(--bg-hover)" stroke="var(--text-muted)" strokeWidth="2" />
              <circle cx="60" cy="48" r="2.5" fill="var(--text-muted)" />
            </g>
            <g style={{ transformOrigin: "102px 48px", animation: "wheel-spin 0.7s linear infinite" }}>
              <circle cx="102" cy="48" r="7.5" fill="var(--bg-hover)" stroke="var(--text-muted)" strokeWidth="2" />
              <circle cx="102" cy="48" r="2.5" fill="var(--text-muted)" />
            </g>
          </svg>
        </div>
      </div>

      {/* Logo centered */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "0.75rem",
        marginTop: -60,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--accent-muted)",
          border: "1px solid rgba(255,211,59,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse 2s ease-in-out infinite",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hemut-logo.png" alt="Converse" width={30} height={30} style={{ borderRadius: 8 }} />
        </div>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Converse</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Voice AI Platform</div>
      </div>
    </div>
  );
}
