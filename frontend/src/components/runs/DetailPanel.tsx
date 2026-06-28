"use client";

/**
 * RunDetailPanel — slide-out detail view for a single call/run.
 *
 * Migrated end-to-end onto the Hemut design system. Every previously
 * hand-rolled chrome surface is now built from DS primitives:
 *
 *   • PanelTopBar buttons          → DS `Button` (ghost icon)
 *   • Header status pills          → DS `Tag` (success/info/warning/error/neutral)
 *   • Tabs row                     → DS `Tabs` (primary variant) + count badge
 *   • Audit + analytics cards      → DS `Surface` + `Stack`
 *   • Progress bars in audit       → DS `LinearProgress` with semantic tone
 *   • Loading / not-found states   → DS `Skeleton` / `EmptyState`
 *   • RecordingBar                 → already DS-token-driven (previous pass)
 *
 * ChatBubble + ToolRow + GraphTab keep their bespoke layouts (they're
 * narrow-purpose primitives the DS doesn't ship), but every colour now
 * resolves through `var(--bg-…)` / `var(--text-…)` / `var(--border-…)` /
 * `var(--green|red|blue|yellow|brand|grey-N)` tokens so they track theme
 * changes alongside everything else.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  Button,
  Divider,
  EmptyState,
  KpiCard,
  LinearProgress,
  Skeleton,
  Stack,
  Surface,
  Tabs,
  Tag,
  Typography,
} from "@hemut2025/design-system";
import type { TabItem, TagProps } from "@hemut2025/design-system";
import { fetcher } from "@/lib/api";
import { RunDetail, TranscriptTurn, CallAuditResult } from "@/lib/types";
import { formatDuration, formatCurrency, formatPhoneNumber, humanizeTranscript, agentTypeLabel } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCallTs(ts: string | number | undefined): string {
  if (ts === undefined) return "";
  if (typeof ts === "number") {
    const m = Math.floor(ts / 60), s = Math.floor(ts % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return ""; }
}

function fmtPanelDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function tsNum(ts: string | number | undefined, fallback: number): number {
  if (ts === undefined) return fallback;
  if (typeof ts === "number") return ts;
  const d = new Date(ts).getTime();
  return isNaN(d) ? fallback : d;
}

/** Map a free-form classification string to a DS Tag variant. The runs
 *  table + filter dropdown share this vocabulary; keep them in sync. */
function classificationVariant(v: string): TagProps["variant"] {
  const k = v.toLowerCase();
  if (["success", "booked", "accepted"].includes(k))                                return "success";
  if (["rate_too_high", "error_or_confused", "declined", "user_declined_load"].includes(k)) return "error";
  if (["checking_with_driver", "pending", "voicemail"].includes(k))                 return "warning";
  if (["ask_for_transfer", "transferred", "capacity_only"].includes(k))             return "info";
  return "neutral";
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ turn }: { turn: TranscriptTurn }) {
  const isAgent = turn.role === "agent" || turn.role === "assistant";
  const tsLabel = turn.ts !== undefined ? fmtCallTs(turn.ts) : "";
  const text = humanizeTranscript(turn.text);

  const onRight = isAgent;

  return (
    <div style={{ display: "flex", justifyContent: onRight ? "flex-end" : "flex-start", padding: "var(--space-xxs) 0" }}>
      <Stack gap="xxs" align={onRight ? "end" : "start"} style={{ maxWidth: "76%" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-xs1)",
          flexDirection: onRight ? "row-reverse" : "row",
        }}>
          <Typography variant="overline-medium" color="tertiary">
            {isAgent ? "Agent" : "Caller"}
          </Typography>
          {tsLabel && (
            <Typography variant="caption-regular" color="disabled">{tsLabel}</Typography>
          )}
        </div>
        <Surface
          variant={onRight ? "inverse" : "secondary"}
          radius="2xl"
          padding="sm"
          border="none"
          style={{
            borderTopLeftRadius: onRight ? undefined : 8,
            borderTopRightRadius: onRight ? 8 : undefined,
          }}
        >
          <Typography
            variant="body-sm-regular"
            color={onRight ? "inverse" : "primary"}
            style={{ lineHeight: 1.6, wordBreak: "break-word", whiteSpace: "pre-wrap" }}
          >
            {text}
          </Typography>
        </Surface>
      </Stack>
    </div>
  );
}

// ── ToolRow ───────────────────────────────────────────────────────────────────

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  ts?: string | number;
}

function ToolRow({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isTransfer = typeof call.tool === "string" && call.tool.startsWith("transfer");
  const action = call.result?.action as string | undefined;
  const tStatus = call.result?.status as string | undefined;
  const tDetail = (call.result?.outcome_detail ?? call.result?.reason) as string | undefined;

  let status: "success" | "fail" | "pending";
  if (isTransfer) {
    if (action === "transfer_failed" || tStatus === "failed") status = "fail";
    else if (tStatus === "connected" || action === "transfer_connected") status = "success";
    else status = "pending";
  } else {
    status = !call.result?.error && call.result?.success !== false ? "success" : "fail";
  }
  const success = status === "success";
  const tsLabel = call.ts !== undefined ? fmtCallTs(call.ts) : "";
  const outputStr = JSON.stringify(call.result, null, 2);

  const accent     = status === "fail" ? "var(--red-500)" : "var(--blue-500)";
  const accentText = status === "fail" ? "var(--red-700)" : "var(--blue-700)";
  const accentBg   = status === "fail" ? "var(--red-50)"  : "var(--blue-50)";

  return (
    <Surface
      variant="secondary"
      radius="2xl"
      padding="none"
      style={{
        overflow: "hidden",
        margin: "var(--space-xs2) 0",
      }}
    >
      <button
        onClick={() => setExpanded((o) => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "var(--space-xs)", padding: "var(--space-xs) var(--space-sm)",
          textAlign: "left", fontFamily: "inherit",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 9, flexShrink: 0,
          background: accentBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph ph-terminal" style={{ fontSize: 13, color: accent }} />
        </div>
        <Typography
          variant="body-sm-semibold"
          color="primary"
          style={{
            flex: 1, textAlign: "left",
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          }}
        >
          {call.tool}
        </Typography>
        <Tag size="xm" variant={status === "success" ? "success" : status === "fail" ? "error" : "warning"}>
          {isTransfer
            ? status === "success"
              ? "✓ Transfer connected"
              : status === "fail"
                ? `✕ Transfer failed${tDetail ? ` — ${tDetail}` : ""}`
                : "● Transfer started"
            : success
              ? "✓ Success"
              : "✕ Failed"}
        </Tag>
        {tsLabel && (
          <Typography variant="caption-regular" color="tertiary" style={{ flexShrink: 0 }}>
            {tsLabel}
          </Typography>
        )}
        <i
          className={expanded ? "ph ph-caret-up" : "ph ph-caret-down"}
          style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", flexShrink: 0 }}
        />
      </button>

      {expanded && (
        <div>
          <Divider decorative />
          <Stack gap="xs" style={{ padding: "var(--space-xs) var(--space-sm)" }}>
            <Typography variant="overline-semibold" color="tertiary">Input</Typography>
            <Surface
              as="pre"
              variant="tertiary"
              radius="lg"
              style={{
                fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                fontSize: 11,
                color: "var(--text-neutral-primary)",
                whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
                padding: "var(--space-xs1) var(--space-xs)",
                maxHeight: 160, overflowY: "auto",
              }}
            >
              {JSON.stringify(call.args, null, 2)}
            </Surface>
          </Stack>
          <Divider decorative />
          <Stack gap="xs" style={{ padding: "var(--space-xs) var(--space-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="overline-semibold" color="tertiary">Output</Typography>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={copied ? "check" : "copy"}
                onClick={() =>
                  navigator.clipboard?.writeText(outputStr).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                }
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Surface
              as="pre"
              variant="tertiary"
              radius="lg"
              style={{
                fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                fontSize: 11,
                color: success ? "var(--text-neutral-primary)" : accentText,
                whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
                padding: "var(--space-xs1) var(--space-xs)",
                maxHeight: 200, overflowY: "auto",
              }}
            >
              {outputStr}
            </Surface>
          </Stack>
        </div>
      )}
    </Surface>
  );
}

// ── SystemEvent ───────────────────────────────────────────────────────────────

function SystemEvent({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", padding: "var(--space-xs) 0" }}>
      <Divider decorative style={{ flex: 1 }} />
      <Typography variant="caption-medium" color="tertiary" style={{ whiteSpace: "nowrap" }}>
        {label}
      </Typography>
      <Divider decorative style={{ flex: 1 }} />
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

type TLItem =
  | { kind: "turn"; data: TranscriptTurn; idx: number }
  | { kind: "tool"; data: ToolCall; idx: number }
  | { kind: "event"; label: string; order: number };

function Timeline({ turns, toolCalls }: { turns: TranscriptTurn[]; toolCalls: ToolCall[] }) {
  const items: TLItem[] = [
    { kind: "event" as const, label: "Call connected", order: -1 },
    ...turns.map((t, i) => ({ kind: "turn" as const, data: t, idx: i })),
    ...toolCalls.map((tc, i) => ({ kind: "tool" as const, data: tc, idx: i })),
    { kind: "event" as const, label: "Call ended", order: 9999999 },
  ].sort((a, b) => {
    const getTs = (item: TLItem): number => {
      if (item.kind === "event") return item.order;
      if (item.kind === "turn") return tsNum(item.data.ts, item.idx * 1000);
      return tsNum(item.data.ts, item.idx * 1000 + 500);
    };
    return getTs(a) - getTs(b);
  });

  if (turns.length === 0 && toolCalls.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon="chat-slash"
        title="No transcript available"
        description="The call didn't capture any utterances."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xxs)" }}>
      {items.map((item, i) => {
        if (item.kind === "event") return <SystemEvent key={`ev-${i}`} label={item.label} />;
        if (item.kind === "turn") return <ChatBubble key={`turn-${item.idx}`} turn={item.data} />;
        return <ToolRow key={`tool-${item.idx}`} call={item.data} />;
      })}
    </div>
  );
}

// ── AuditSection ──────────────────────────────────────────────────────────────

function scoreTone(value: number): "success" | "warning" | "danger" {
  return value >= 75 ? "success" : value >= 50 ? "warning" : "danger";
}

function AuditScore({ label, value }: { label: string; value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const pct = Math.min(100, value);
  return (
    <LinearProgress
      label={label}
      value={pct}
      tone={scoreTone(pct)}
      size="sm"
    />
  );
}

function AuditSection({ audit }: { audit: CallAuditResult }) {
  const overall = audit.overall_score;
  return (
    <Surface variant="secondary" radius="lg" padding="lg" border="none">
      <Stack gap="md">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs1)" }}>
          <i className="ph ph-shield-check" style={{ fontSize: 14, color: "var(--text-neutral-tertiary)" }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-neutral-tertiary)",
          }}>
            AI Audit
          </span>
          {overall != null && (
            <span style={{
              marginLeft: "auto", fontSize: 14, fontWeight: 700,
              color: overall >= 75
                ? "var(--green-700)"
                : overall >= 50
                  ? "var(--brand-700)"
                  : "var(--red-700)",
            }}>
              {Math.round(overall)}/100
            </span>
          )}
        </div>

        {audit.summary && (
          <p style={{
            fontSize: 13, color: "var(--text-neutral-secondary)",
            lineHeight: 1.6, margin: 0,
          }}>
            {audit.summary}
          </p>
        )}

        <Stack gap="sm">
          <AuditScore label="Conversation Quality" value={audit.conversation_quality_score} />
          <AuditScore label="Efficiency" value={audit.efficiency_score} />
          <AuditScore
            label="Tool Accuracy"
            value={audit.tool_selection_accuracy != null ? audit.tool_selection_accuracy * 100 : undefined}
          />
        </Stack>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs1)" }}>
          {([
            { label: "Goal Achieved",  val: audit.goal_achieved },
            { label: "Autonomous",     val: audit.autonomous_resolution },
          ] as { label: string; val: boolean | null | undefined }[]).map(({ label, val }) =>
            val == null ? null : (
              <Tag key={label} size="sm" variant={val ? "success" : "error"}>
                {val ? "✓" : "✗"} {label}
              </Tag>
            )
          )}
        </div>

        {audit.recommendations && audit.recommendations.length > 0 && (
          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--text-neutral-tertiary)",
              margin: "0 0 var(--space-xs)",
            }}>
              Recommendations
            </p>
            <Stack gap="xs">
              {audit.recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", gap: "var(--space-xs)", alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0,
                    width: 16, height: 16, borderRadius: 4,
                    fontSize: 9, fontWeight: 800,
                    background: "var(--bg-neutral-tertiary)",
                    color: "var(--text-neutral-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text-neutral-primary)", lineHeight: 1.5 }}>
                    {rec}
                  </span>
                </div>
              ))}
            </Stack>
          </div>
        )}
      </Stack>
    </Surface>
  );
}

// ── GraphTab ──────────────────────────────────────────────────────────────────

function GraphTab({ toolCalls }: { toolCalls: ToolCall[] }) {
  const steps = [
    { label: "Call Started", status: "done" as const, tool: null as ToolCall | null },
    ...toolCalls.map((tc) => ({
      label: tc.tool.replace(/_/g, " "),
      status: (!tc.result?.error && tc.result?.success !== false ? "done" : "error") as "done" | "error",
      tool: tc,
    })),
    { label: "Call Ended", status: "done" as const, tool: null as ToolCall | null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((step, i) => {
        const dotColor    = step.status === "error" ? "var(--red-500)"   : "var(--green-500)";
        const dotRing     = step.status === "error" ? "var(--red-50)"    : "var(--green-50)";
        const labelColor  = step.status === "error" ? "var(--red-700)"   : "var(--text-neutral-primary)";
        return (
          <div key={i} style={{ display: "flex", alignItems: "stretch", gap: "var(--space-xs)" }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              width: 18, flexShrink: 0,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: "var(--space-xxs)",
                background: dotColor,
                boxShadow: `0 0 0 3px ${dotRing}`,
              }} />
              {i < steps.length - 1 && (
                <div style={{
                  width: 1, flex: 1, minHeight: 18,
                  background: "var(--border-neutral-subtle)",
                }} />
              )}
            </div>
            <div style={{ paddingBottom: i < steps.length - 1 ? 12 : 0, flex: 1 }}>
              <span style={{
                fontSize: 12.5, fontWeight: 600, textTransform: "capitalize",
                color: labelColor,
              }}>
                {step.label}
              </span>
              {step.tool && (
                <div style={{ marginTop: "var(--space-xs2)" }}>
                  <ToolRow call={step.tool} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── RecordingBar ──────────────────────────────────────────────────────────────

function RecordingBar({ src, runId }: { src: string; runId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    playing ? el.pause() : el.play();
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }, [duration]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handlers = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setCurrentTime(el.currentTime),
      loadedmetadata: () => { setDuration(el.duration); setLoading(false); },
      canplay: () => setLoading(false),
    };
    Object.entries(handlers).forEach(([evt, fn]) => el.addEventListener(evt, fn));
    return () => Object.entries(handlers).forEach(([evt, fn]) => el.removeEventListener(evt, fn));
  }, []);

  const fmt = (s: number) => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={loading ? "Loading recording" : playing ? "Pause" : "Play"}
        style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: loading ? "var(--bg-neutral-secondary)" : "var(--text-neutral-primary)",
          border: "none",
          cursor: loading ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        <i
          className={loading ? "ph ph-circle-notch" : playing ? "ph-fill ph-pause" : "ph-fill ph-play"}
          style={{
            fontSize: 13,
            color: loading ? "var(--text-neutral-disabled)" : "var(--bg-neutral-primary)",
            marginLeft: playing || loading ? 0 : 1,
          }}
        />
      </button>
      <span style={{
        fontSize: 12, fontWeight: 600, color: "var(--text-neutral-primary)",
        flexShrink: 0, minWidth: 36, fontVariantNumeric: "tabular-nums",
      }}>
        {fmt(currentTime)}
      </span>
      <div
        onClick={seek}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        style={{
          flex: 1, height: 4, borderRadius: 4,
          background: "var(--bg-neutral-tertiary)",
          cursor: "pointer", position: "relative",
        }}
      >
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress}%`,
          background: "var(--text-neutral-primary)",
          borderRadius: 4,
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `${progress}%`,
          width: 10, height: 10, borderRadius: "50%",
          background: "var(--text-neutral-primary)",
          border: "2px solid var(--bg-neutral-primary)",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 1px 3px rgba(31,31,42,0.18)",
        }} />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 500, color: "var(--text-neutral-tertiary)",
        flexShrink: 0, minWidth: 36, textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}>
        {fmt(duration)}
      </span>
      <a
        href={src}
        download={`recording-${runId}.ogg`}
        target="_blank"
        rel="noopener noreferrer"
        title="Download recording"
        style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border-neutral-subtle)",
          color: "var(--text-neutral-tertiary)",
          textDecoration: "none",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <i className="ph ph-download-simple" style={{ fontSize: 13 }} />
      </a>
    </div>
  );
}

function NoRecordingBar() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--space-xs)",
      color: "var(--text-neutral-tertiary)",
      fontSize: 12.5,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "var(--bg-neutral-secondary)",
        border: "1px solid var(--border-neutral-subtle)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-neutral-disabled)",
      }}>
        <i className="ph ph-microphone-slash" style={{ fontSize: 14 }} />
      </span>
      <span>No recording available for this call.</span>
    </div>
  );
}

// ── PanelChromeButtons ───────────────────────────────────────────────────────

function PanelChromeButtons({
  onClose,
  onToggleExpanded,
  expanded,
  onNarrow,
  onWiden,
}: {
  onClose?: () => void;
  onToggleExpanded?: () => void;
  expanded?: boolean;
  onNarrow?: () => void;
  onWiden?: () => void;
}) {
  if (!onClose && !onToggleExpanded && !onNarrow && !onWiden) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xxs)", flexShrink: 0 }}>
      {!expanded && onNarrow && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon="caret-left"
          aria-label="Narrow panel"
          title="Narrow panel"
          onClick={onNarrow}
        />
      )}
      {!expanded && onWiden && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon="caret-right"
          aria-label="Widen panel"
          title="Widen panel"
          onClick={onWiden}
        />
      )}
      {(onNarrow || onWiden) && !expanded && (onToggleExpanded || onClose) && (
        <div style={{ width: 1, height: 16, background: "var(--border-neutral-subtle)", margin: "0 var(--space-xxs)" }} />
      )}
      {onToggleExpanded && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={expanded ? "arrows-in" : "arrows-out"}
          aria-label={expanded ? "Minimize panel" : "Maximize panel"}
          aria-pressed={expanded}
          title={expanded ? "Minimize panel" : "Maximize panel"}
          onClick={onToggleExpanded}
        />
      )}
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon="x"
          aria-label="Close panel"
          title="Close panel"
          onClick={onClose}
        />
      )}
    </div>
  );
}

// ── Loading + not-found chrome ───────────────────────────────────────────────

function PanelShell({
  children,
  chrome,
}: {
  children: React.ReactNode;
  chrome: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-neutral-primary)",
    }}>
      {chrome && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "var(--space-xs1) var(--space-sm)", flexShrink: 0,
          borderBottom: "1px solid var(--border-neutral-subtle)",
        }}>
          {chrome}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Analytics chip grid ──────────────────────────────────────────────────────

function AnalyticsSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
        <i className={`ph ph-${icon}`} style={{ fontSize: 16, color: "var(--text-neutral-secondary)" }} />
        <Typography variant="body-md-semibold" color="primary">{title}</Typography>
      </div>
      {children}
    </Stack>
  );
}

function DetailGroup({ icon, title, items }: {
  icon: string;
  title: string;
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <AnalyticsSection icon={icon} title={title}>
      <Surface variant="secondary" radius="lg" padding="md" border="none">
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: "var(--space-base)", columnGap: "var(--space-md)",
        }}>
          {items.map((it) => (
            <div key={it.label} style={{ minWidth: 0 }}>
              <Typography variant="caption-regular" color="tertiary" style={{ display: "block", marginBottom: "var(--space-xxs)" }}>
                {it.label}
              </Typography>
              <Typography
                variant="body-sm-medium"
                color="primary"
                style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {it.value}
              </Typography>
            </div>
          ))}
        </div>
      </Surface>
    </AnalyticsSection>
  );
}

// ── RunStatusChips ──────────────────────────────────────────────────────────

export function RunStatusChips({ data }: { data: RunDetail }) {
  const totalSteps     = (data.transcript?.length ?? 0) + (data.tool_calls?.length ?? 0);
  const durationSec    = data.duration_sec ?? data.duration_seconds ?? null;
  const classification = data.classification ?? data.outcome ?? data.negotiation_outcome ?? null;
  const id             = (data.session_id ?? data.id ?? "").slice(0, 8);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs1)", flexWrap: "wrap" }}>
      <Tag size="sm" variant="success">● Completed</Tag>

      <span style={{
        fontSize: 11, color: "var(--text-neutral-tertiary)",
        fontVariantNumeric: "tabular-nums",
      }}>
        #{id} · {totalSteps} steps · {formatDuration(durationSec)}
      </span>

      {data.direction && (
        <Tag size="sm" variant={data.direction === "inbound" ? "info" : "warning"}>
          {data.direction === "inbound" ? "Inbound" : "Outbound"}
        </Tag>
      )}

      {classification && (
        <Tag size="sm" variant={classificationVariant(classification)}>
          {classification.replace(/_/g, " ")}
        </Tag>
      )}
    </div>
  );
}

// ── RunDetailPanel ────────────────────────────────────────────────────────────

export function RunDetailPanel({
  sessionId,
  onClose,
  onToggleExpanded,
  expanded,
  onNarrow,
  onWiden,
  embedded = false,
}: {
  sessionId: string;
  onClose?: () => void;
  onToggleExpanded?: () => void;
  expanded?: boolean;
  onNarrow?: () => void;
  onWiden?: () => void;
  embedded?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "analytics" | "graph">("details");
  const { data, isLoading } = useSWR<RunDetail>(`/api/runs/${sessionId}`, fetcher);

  const chromeButtons = (
    <PanelChromeButtons
      onClose={onClose}
      onToggleExpanded={onToggleExpanded}
      expanded={expanded}
      onNarrow={onNarrow}
      onWiden={onWiden}
    />
  );

  if (isLoading) {
    return (
      <PanelShell chrome={chromeButtons}>
        <div style={{ padding: "var(--space-base) var(--space-md)", flex: 1 }}>
          <Stack gap="md">
            <Skeleton width="60%" height={20} />
            <div style={{ display: "flex", gap: "var(--space-xs1)" }}>
              <Skeleton width={84} height={20} />
              <Skeleton width={120} height={20} />
              <Skeleton width={70} height={20} />
            </div>
            <Skeleton width="100%" height={2} />
            <Stack gap="sm">
              <Skeleton width="80%" height={48} />
              <Skeleton width="60%" height={48} />
              <Skeleton width="75%" height={48} />
            </Stack>
          </Stack>
        </div>
      </PanelShell>
    );
  }

  if (!data) {
    return (
      <PanelShell chrome={chromeButtons}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState
            size="md"
            icon="phone-x"
            title="Run not found"
            description="The call you're looking for has been deleted or never existed."
          />
        </div>
      </PanelShell>
    );
  }

  const call = data;
  const rawTranscript = (data.transcript ?? []) as unknown as Array<{
    role: string; text: string; ts: string | number; tool?: string;
  }>;

  // Spoken turns (user/agent). role="tool" markers are split out below so they
  // render as distinct tool rows in the timeline, not chat bubbles.
  const transcript: TranscriptTurn[] = rawTranscript
    .filter((t) => t.role !== "tool")
    .map((t, i) => ({
      id: String(i), turn: i,
      role: (t.role === "assistant" ? "agent" : t.role === "user" ? "caller" : t.role) as "agent" | "caller",
      text: t.text, ts: t.ts,
    }));

  // Tool-call markers captured during the call (which tool fired, when, args),
  // merged with any structured tool_calls the backend provides.
  const toolCalls: ToolCall[] = [
    ...rawTranscript
      .filter((t) => t.role === "tool")
      .map((t, i) => ({
        id: `tool-${i}`,
        tool: t.tool || "tool",
        ts: t.ts,
        result: { detail: t.text, success: true },
      })) as unknown as ToolCall[],
    ...((data.tool_calls ?? []) as ToolCall[]),
  ];
  const durationSec = call.duration_sec ?? call.duration_seconds ?? null;
  const classification = call.classification ?? call.outcome ?? call.negotiation_outcome ?? null;
  const audit = data.audit_result;
  const totalSteps = transcript.length + toolCalls.length;

  const agentMsgs = transcript.filter((t) => t.role === "agent").length;
  const negotiationRounds = call.negotiation_rounds ?? call.offer_attempts ?? null;
  const agentLabel = call.agent_name || (call.agent_type ? agentTypeLabel(call.agent_type) : null);

  const TAB_ITEMS: TabItem[] = [
    { id: "details",   label: "Details" },
    { id: "analytics", label: "Analytics" },
    { id: "graph",     label: "Graph", badge: toolCalls.length > 0 ? toolCalls.length : undefined },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-neutral-primary)", overflow: "hidden",
    }}>
      <div className="run-detail-header" style={{
        padding: embedded ? "14px 20px 0" : "12px 12px 0 20px",
        flexShrink: 0,
        borderBottom: "1px solid var(--border-neutral-subtle)",
      }}>
        {!embedded && (
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: "var(--space-sm)", marginBottom: "var(--space-xs)",
          }}>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: "var(--text-neutral-primary)",
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              paddingTop: "var(--space-xs2)",
            }}>
              {fmtPanelDate(call.created_at)}
            </div>
            {chromeButtons}
          </div>
        )}

        {!embedded && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <RunStatusChips data={data} />
          </div>
        )}

        <Tabs
          items={TAB_ITEMS}
          value={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          variant="primary"
          ariaLabel="Run detail sections"
        />
      </div>

      {activeTab === "details" && (
        <div style={{ flexShrink: 0, padding: "var(--space-sm) var(--space-md) 0" }}>
          <Surface variant="secondary" radius="xl" padding="md">
            {call.recording_url
              ? <RecordingBar src={call.recording_url} runId={String(call.id)} />
              : <NoRecordingBar />}
          </Surface>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "var(--space-base) var(--space-md) var(--space-xl2)" }}>

          {activeTab === "details" && (
            <Timeline turns={transcript} toolCalls={toolCalls} />
          )}

          {activeTab === "analytics" && (
            <Stack gap="lg">
              <AnalyticsSection icon="chart-line-up" title="Call performance">
                <div className="kpi-flat" style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "var(--space-xs)",
                  alignItems: "start",
                }}>
                  <KpiCard size="sm" icon="chats-circle" tone="info" label="Total interactions" value={totalSteps} />
                  <KpiCard size="sm" icon="robot" tone="brand" label="Agent messages" value={agentMsgs} />
                  <KpiCard size="sm" icon="terminal" label="Tool calls" value={toolCalls.length} />
                </div>
              </AnalyticsSection>

              <DetailGroup
                icon="robot"
                title="Agent data"
                items={[
                  { label: "Session duration", value: formatDuration(durationSec) },
                  ...(negotiationRounds != null ? [{ label: "Negotiation rounds", value: String(negotiationRounds) }] : []),
                  ...(agentLabel ? [{ label: "Agent", value: agentLabel }] : []),
                  { label: "Direction", value: call.direction === "inbound" ? "Inbound" : "Outbound" },
                ]}
              />

              <DetailGroup
                icon="identification-card"
                title="Call details"
                items={[
                  { label: "Date", value: new Date(call.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                  { label: "Caller", value: call.caller_name || formatPhoneNumber(call.caller_phone) || "—" },
                  { label: "Carrier", value: call.carrier_name || "—" },
                  { label: "MC #", value: call.mc_number_hash || call.verified_mc_hash || "—" },
                  ...(call.reference_number || call.load_ref ? [{ label: "Load #", value: call.reference_number ?? call.load_ref ?? "—" }] : []),
                  ...(call.posted_rate ? [{ label: "Posted Rate", value: formatCurrency(call.posted_rate) }] : []),
                  ...(call.agreed_rate ? [{ label: "Agreed Rate", value: formatCurrency(call.agreed_rate) }] : []),
                  ...(classification ? [{ label: "Outcome", value: classification.replace(/_/g, " ") }] : []),
                ]}
              />

              {audit ? (
                <AuditSection audit={audit} />
              ) : (
                <Surface variant="secondary" radius="lg" padding="md" border="none">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                    <i className="ph ph-shield-check" style={{
                      fontSize: 18, color: "var(--text-neutral-disabled)",
                    }} />
                    <div>
                      <div style={{
                        fontSize: 12.5, fontWeight: 600,
                        color: "var(--text-neutral-primary)",
                      }}>
                        AI Audit
                      </div>
                      <div style={{
                        fontSize: 11.5, color: "var(--text-neutral-tertiary)",
                      }}>
                        Pending analysis
                      </div>
                    </div>
                  </div>
                </Surface>
              )}
            </Stack>
          )}

          {activeTab === "graph" && (
            toolCalls.length > 0 ? (
              <GraphTab toolCalls={toolCalls} />
            ) : (
              <EmptyState
                size="sm"
                icon="graph"
                title="No tool calls recorded"
                description="The agent didn't invoke any tools during this call."
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
