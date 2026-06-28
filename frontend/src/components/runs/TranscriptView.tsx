"use client";

import { useState } from "react";
import { TranscriptTurn } from "@/lib/types";
import { Terminal, ChevronDown, ChevronRight, CheckCircle2, XCircle, Bot, User } from "lucide-react";

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  ts?: string | number;
}

export interface TranscriptViewProps {
  turns: TranscriptTurn[];
  toolCalls?: ToolCall[];
}

// ─── Timeline item union ──────────────────────────────────────────────────────
type TimelineItem =
  | { kind: "turn"; data: TranscriptTurn; idx: number }
  | { kind: "tool"; data: ToolCall; idx: number };

function tsNum(ts: string | number | undefined, fallback: number): number {
  if (ts === undefined) return fallback;
  if (typeof ts === "number") return ts;
  const d = new Date(ts).getTime();
  return isNaN(d) ? fallback : d;
}

function formatTs(ts: string | number | undefined): string {
  if (ts === undefined) return "";
  if (typeof ts === "number") {
    const m = Math.floor(ts / 60);
    const s = Math.floor(ts % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return ""; }
}

// Render a value for display inside a tool card (compact)
function renderVal(v: unknown, depth = 0): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    if (depth > 0) return `[${v.length}]`;
    return v.map((x) => renderVal(x, depth + 1)).slice(0, 3).join(", ") + (v.length > 3 ? "…" : "");
  }
  if (typeof v === "object") {
    const e = Object.entries(v as Record<string, unknown>);
    if (e.length === 0) return "{}";
    if (depth > 0) return `{…}`;
    return e.map(([k, x]) => `${k}: ${renderVal(x, 1)}`).slice(0, 4).join("  ·  ");
  }
  return String(v);
}

// ─── Tool call card ───────────────────────────────────────────────────────────
function ToolCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const success = !call.result?.error && call.result?.success !== false;
  const statusColor = success ? "#22c55e" : "#ef4444";
  const accentBg   = success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)";
  const accentBorder = success ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";

  // Key values to show in collapsed preview
  const preview: string[] = [];
  const r = call.result;
  if (r?.carrier_name)  preview.push(`carrier: ${r.carrier_name}`);
  if (r?.load_id)       preview.push(`load: ${r.load_id}`);
  if (r?.action)        preview.push(`action: ${r.action}`);
  if (r?.counter_offer) preview.push(`counter: $${r.counter_offer}`);
  if (r?.agreed_rate)   preview.push(`rate: $${r.agreed_rate}`);
  if (r?.message && !preview.length) {
    const m = String(r.message);
    preview.push(m.length > 80 ? m.slice(0, 80) + "…" : m);
  }
  if (r?.error) preview.push(`error: ${String(r.error).slice(0, 80)}`);

  const argEntries = Object.entries(call.args ?? {});
  const resultEntries = Object.entries(call.result ?? {}).filter(([k]) => k !== "message");

  return (
    <div style={{
      margin: "0.25rem 0",
      borderRadius: 10,
      border: `1px solid ${accentBorder}`,
      background: accentBg,
      overflow: "hidden",
      fontSize: "0.75rem",
    }}>
      {/* ── Header row ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.5rem 0.75rem", textAlign: "left",
        }}
      >
        {/* icon */}
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Terminal style={{ width: 11, height: 11, color: statusColor }} />
        </div>

        {/* tool name */}
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.6875rem", color: "var(--text-primary)", letterSpacing: "0.01em" }}>
          {call.tool}
        </span>

        {/* status icon */}
        {success
          ? <CheckCircle2 style={{ width: 12, height: 12, color: "#22c55e" }} />
          : <XCircle style={{ width: 12, height: 12, color: "#ef4444" }} />}

        {/* timestamp */}
        {call.ts !== undefined && (
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginLeft: 2 }}>
            {formatTs(call.ts)}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {open
            ? <ChevronDown style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
            : <ChevronRight style={{ width: 12, height: 12, color: "var(--text-muted)" }} />}
        </div>
      </button>

      {/* ── Collapsed preview ── */}
      {!open && preview.length > 0 && (
        <div style={{ padding: "0 0.75rem 0.5rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {preview.map((p, i) => (
            <span key={i} style={{
              fontFamily: "monospace", fontSize: "0.625rem",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
              padding: "0.125rem 0.4rem", borderRadius: 4,
              border: "1px solid var(--border)",
            }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* ── Expanded body ── */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Input */}
          <div style={{ padding: "0.625rem 0.75rem", borderBottom: argEntries.length > 0 && resultEntries.length > 0 ? "1px solid var(--border)" : "none" }}>
            <p style={{ fontSize: "0.5625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
              Input
            </p>
            {argEntries.length === 0 ? (
              <span style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--text-muted)" }}>—</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                {argEntries.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.6875rem", lineHeight: 1.6 }}>
                    <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "var(--text-primary)", wordBreak: "break-all" }}>{renderVal(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Output */}
          {resultEntries.length > 0 && (
            <div style={{ padding: "0.625rem 0.75rem" }}>
              <p style={{ fontSize: "0.5625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                Output
              </p>
              <div style={{
                display: "flex", flexDirection: "column", gap: "0.125rem",
                maxHeight: 180, overflowY: "auto",
              }}>
                {resultEntries.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.6875rem", lineHeight: 1.6 }}>
                    <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{ color: success ? "var(--text-primary)" : "#ef4444", wordBreak: "break-all" }}>{renderVal(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function TurnBubble({ turn }: { turn: TranscriptTurn }) {
  const isAgent    = turn.role === "agent" || turn.role === "assistant";
  // "operator" = the browser user who placed the call (left side, like agent)
  const isOperator = turn.role === "operator";
  // Everything else ("caller", "user") = the remote party (right side)
  const isLeft = isAgent || isOperator;

  return (
    <div style={{
      display: "flex",
      flexDirection: isLeft ? "row" : "row-reverse",
      alignItems: "flex-start",
      gap: "0.625rem",
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isAgent ? "var(--accent)" : "var(--bg-elevated)",
        border: isAgent ? "none" : "1px solid var(--border)",
        marginTop: 2,
      }}>
        {isAgent
          ? <Bot style={{ width: 14, height: 14, color: "#000" }} />
          : <User style={{ width: 13, height: 13, color: "var(--text-muted)" }} />}
      </div>

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: isLeft ? "flex-start" : "flex-end",
        maxWidth: "72%",
        gap: "0.25rem",
      }}>
        {/* Role label + HR-style badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", paddingInline: "0.25rem" }}>
          <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {isAgent ? "Agent" : isOperator ? "Operator" : "Caller"}
          </span>
          {turn.grouped && (
            <span style={{
              fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em",
              padding: "0.1rem 0.35rem", borderRadius: 3,
              background: "var(--bg-elevated)", color: "var(--text-muted)",
              border: "1px solid var(--border)", textTransform: "uppercase",
            }}>GROUPED</span>
          )}
          {turn.interrupted && (
            <span style={{
              fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em",
              padding: "0.1rem 0.35rem", borderRadius: 3,
              background: "rgba(239,68,68,0.10)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.25)", textTransform: "uppercase",
            }}>INTERRUPTED</span>
          )}
        </div>

        {/* Bubble */}
        <div style={{
          padding: "0.625rem 0.875rem",
          borderRadius: isLeft ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
          fontSize: "0.8125rem",
          lineHeight: 1.55,
          background: isAgent ? "var(--accent-muted)" : "var(--bg-elevated)",
          border: `1px solid ${isAgent ? "var(--accent-subtle)" : "var(--border)"}`,
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}>
          {turn.text}
        </div>

        {/* Timestamp */}
        {turn.ts !== undefined && (
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", paddingInline: "0.25rem" }}>
            {formatTs(turn.ts)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TranscriptView({ turns, toolCalls = [] }: TranscriptViewProps) {
  // Build merged timeline sorted by ts
  const items: TimelineItem[] = [
    ...turns.map((t, i) => ({ kind: "turn" as const, data: t, idx: i })),
    ...toolCalls.map((tc, i) => ({ kind: "tool" as const, data: tc, idx: i })),
  ].sort((a, b) => {
    const ta = a.kind === "turn" ? tsNum(a.data.ts, a.idx * 1000) : tsNum(a.data.ts, a.idx * 1000 + 500);
    const tb = b.kind === "turn" ? tsNum(b.data.ts, b.idx * 1000) : tsNum(b.data.ts, b.idx * 1000 + 500);
    return ta - tb;
  });

  if (items.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: "0.875rem" }}>
        No transcript available
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {items.map((item, i) =>
        item.kind === "turn" ? (
          <TurnBubble key={`turn-${item.idx}`} turn={item.data} />
        ) : (
          <ToolCard key={`tool-${item.idx}`} call={item.data} />
        )
      )}
    </div>
  );
}
