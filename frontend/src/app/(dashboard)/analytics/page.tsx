"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Tag, Skeleton, PageHeader, Tabs, KpiCard, RingProgress,
  Surface, Grid, Icon, Button, Dropdown,
} from "@hemut2025/design-system";
import type { TabItem } from "@hemut2025/design-system";
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fetcher } from "@/lib/api";
import { DoraMetrics, AuditMetrics, FunnelStage, NegotiationDepthBucket, QualityPerDay } from "@/lib/types";
import { useAgentSelectorStore } from "@/lib/store";

function fmtDur(sec: number): string {
  if (!sec || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Format an ISO date (YYYY-MM-DD, UTC) as "M/D" for the x-axis. Falls back
 *  to the raw value if parsing fails so a backend format change doesn't blank
 *  the chart. */
function fmtDay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [, m, d] = parts;
  return `${Number(m)}/${Number(d)}`;
}

/* ── Recharts theming via Hemut tokens ─────────────────────────────────── */

const TOOLTIP_STYLE = {
  background: "var(--bg-neutral-primary)",
  border: "1px solid var(--border-neutral-subtle)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  color: "var(--text-neutral-primary)",
  boxShadow: "0 4px 12px rgba(31, 31, 42, 0.08)",
};

/* ── Outcome card theming ──────────────────────────────────────────────
 *
 * Map every known classification / legacy outcome to a *semantic* colour so
 * the same label always renders with the same colour across reloads, agent
 * switches, and time-range changes. The previous palette recycled six colours
 * by positional index — with 8+ outcome categories the donut ended up with
 * two yellows and two blues, which made it hard to read at a glance.
 *
 * Buckets (loose):
 *   green   — successful bookings
 *   blue    — handed to a human (transfer / callback)
 *   red     — carrier rejected the rate
 *   purple  — load wasn't available / not a fit
 *   amber   — agent/system error
 *   grey    — caller side issues (drops, hang-ups, voicemail)
 */
const OUTCOME_COLOR: Record<string, string> = {
  // Success
  "Success":                              "var(--chart-green)",
  "Booked":                               "var(--chart-green)",
  // Human handoff (still a positive outcome — call was useful)
  "Ask For Transfer":                     "var(--chart-blue)",
  "Transferred":                          "var(--chart-blue)",
  "Checking With Driver":                 "var(--chart-blue-soft)",
  // Rate rejected
  "Rate Too High":                        "var(--chart-red)",
  "Declined":                             "var(--chart-orange)",
  // Load not a fit
  "Covered":                              "var(--chart-purple)",
  "Already Booked":                       "var(--chart-purple-bold)",
  "Alternate Dates":                      "var(--chart-purple-soft)",
  "Alternate Equipment":                  "var(--chart-violet)",
  "Load Not Found":                       "var(--chart-fuchsia)",
  "Wrong Load":                           "var(--chart-fuchsia)",
  // Off-target / wrong target
  "Wrong Number":                         "var(--chart-rose)",   // rose — "you reached the wrong place"
  "Capacity Only":                        "var(--chart-teal)",   // teal — "carrier just offered trucks, no load"
  // Errors
  "Error Or Confused":                    "var(--chart-amber)",
  // Caller-side drops / hold-states (muted greys — dark slates in dark mode)
  "Dropped":                              "var(--chart-neutral)",
  "Caller Put On Hold Assistant Hung Up": "var(--chart-neutral-strong)",
  "Carrier Put On Hold":                  "var(--chart-neutral-strong)",
  "Voicemail":                            "var(--chart-neutral)",
  "No Answer":                            "var(--chart-neutral-soft)",
};

/** Stable fallback palette for any outcome not in OUTCOME_COLOR. Hashing the
 *  label keeps the colour stable across reloads even though the index in the
 *  data array can shift as counts change. */
const OUTCOME_FALLBACK = [
  "var(--chart-indigo)", "var(--chart-teal)", "var(--chart-lime)",
  "var(--chart-rose)", "var(--chart-sky)", "var(--chart-pink)",
];
function fallbackColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return OUTCOME_FALLBACK[h % OUTCOME_FALLBACK.length];
}
function outcomeColor(label: string): string {
  return OUTCOME_COLOR[label] ?? fallbackColor(label);
}

/** Shorter display labels for outcomes whose Title-Cased enum value is too
 *  long to fit nicely in a one-line legend row. */
const OUTCOME_SHORT_LABEL: Record<string, string> = {
  "Caller Put On Hold Assistant Hung Up": "On hold (hung up)",
  "Checking With Driver":                 "Checking w/ driver",
  "Error Or Confused":                    "Error / confused",
  "Ask For Transfer":                     "Transfer requested",
};
function shortOutcome(label: string): string {
  return OUTCOME_SHORT_LABEL[label] ?? label;
}

const FALLBACK_DORA: DoraMetrics = {
  booking_rate: 0,
  avg_negotiation_attempts: 0,
  avg_call_duration_sec: 0,
  total_calls: 0,
};

/* ── Chart card wrapper (DS Surface) ───────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface variant="primary" padding="none" radius="lg" border="primary" shadow="none" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-neutral-subtle)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-neutral-primary)", letterSpacing: "-0.01em" }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        {actions}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </Surface>
  );
}

/* ── Inline empty state for a chart-card body ──────────────────────────────
 *
 * Renders inside a ChartCard so the card frame (title + border) still conveys
 * the page structure when a given metric has no data in the window — instead of
 * blanking the whole page. */
function ChartEmpty({ height = 220, message = "No data in this window yet" }: { height?: number; message?: string }) {
  return (
    <div style={{
      height,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 10, color: "var(--text-neutral-tertiary)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-neutral-tertiary)",
      }}>
        <Icon name="chart-bar" size="md" />
      </div>
      <span style={{ fontSize: 13 }}>{message}</span>
    </div>
  );
}

/* ── Inline loading state for a chart-card body ────────────────────────────
 *
 * A chart can't be shape-matched by a shimmer rectangle (it's axes + a line /
 * bars), so instead of a full-size block we keep the real card frame (title +
 * border) and render a small, centered loading affordance inside — the DS
 * `Skeleton`'s own shimmer carries the motion. Reads as "this chart is loading"
 * without faking content it isn't. */
function ChartLoading({ height = 220 }: { height?: number }) {
  return (
    <div style={{
      height,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 12,
    }}>
      <Skeleton width={40} height={40} radius="md" />
      <Skeleton width={120} height={10} radius="sm" />
    </div>
  );
}

/* ── Section heading ───────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-neutral-primary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

/* ── Outcome breakdown card ──────────────────────────────────────────── */

type OutcomeRow = { outcome: string; count: number };

function OutcomeBreakdownCard({ data, days }: { data: OutcomeRow[]; days: number }) {
  // Sort high → low and pre-compute % so the donut, list bars, and tooltip
  // all agree about the denominator.
  const total = data.reduce((s, d) => s + d.count, 0);
  const rows = [...data]
    .sort((a, b) => b.count - a.count)
    .map(d => ({
      ...d,
      color: outcomeColor(d.outcome),
      pct: total > 0 ? (d.count / total) * 100 : 0,
    }));

  const topOutcome = rows[0];

  return (
    <ChartCard
      title="Outcome distribution"
      subtitle={`${total.toLocaleString()} classified calls · last ${days} days`}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 32,
          alignItems: "center",
        }}
      >
        {/* Donut + center label */}
        <div style={{ position: "relative", width: 220, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="outcome"
                stroke="var(--bg-neutral-primary)"
                strokeWidth={2}
              >
                {rows.map(r => (
                  <Cell key={r.outcome} fill={r.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, n: string) => [
                  `${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`,
                  shortOutcome(n),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-neutral-tertiary)",
              }}
            >
              Total
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--text-neutral-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {total.toLocaleString()}
            </div>
            {topOutcome && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-neutral-tertiary)",
                  marginTop: 6,
                  maxWidth: 120,
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                Top: <span style={{ color: topOutcome.color, fontWeight: 600 }}>
                  {shortOutcome(topOutcome.outcome)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Ranked list with mini bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(r => (
            <div
              key={r.outcome}
              style={{
                display: "grid",
                gridTemplateColumns: "10px minmax(0, 1fr) 44px 44px",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: r.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text-neutral-primary)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={r.outcome}
                >
                  {shortOutcome(r.outcome)}
                </span>
                <div
                  style={{
                    height: 4,
                    background: "var(--bg-neutral-tertiary)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(2, r.pct)}%`,
                      background: r.color,
                      borderRadius: 2,
                      transition: "width 400ms ease-out",
                    }}
                  />
                </div>
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-neutral-primary)",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                }}
              >
                {r.count}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-neutral-tertiary)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                }}
              >
                {r.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

/* ── Conversion funnel card ──────────────────────────────────────────── */

/** Per-stage colour gradient. Inbound is neutral; each downstream stage
 *  shifts further toward the success green so the eye traces the conversion
 *  path top → bottom even when bars are similar in width. */
const FUNNEL_STAGE_COLOR: Record<string, string> = {
  total:      "var(--chart-neutral)",
  verified:   "var(--chart-blue-soft)",
  load_found: "var(--chart-blue)",
  quoted:     "var(--chart-sky)",
  negotiated: "var(--chart-emerald)",
  booked:     "var(--chart-green)",
};

function FunnelCard({ stages, days }: { stages: FunnelStage[]; days: number }) {
  if (stages.length === 0) return null;
  const overallConv = stages[stages.length - 1].pct_of_total;

  return (
    <ChartCard
      title="Conversion funnel"
      subtitle={`Stage-by-stage drop-off · dialed → connected → qualified → booked · last ${days} days`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stages.map((s, i) => {
          const color = FUNNEL_STAGE_COLOR[s.key] ?? "var(--chart-indigo)";
          const widthPct = Math.max(2, s.pct_of_total * 100);
          const stepConvPct = s.pct_of_previous != null ? Math.round(s.pct_of_previous * 100) : null;
          return (
            <div
              key={s.key}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 60px",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Stage label */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-neutral-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                {s.label}
              </div>

              {/* Bar with inline count + total % */}
              <div
                style={{
                  position: "relative",
                  height: 30,
                  background: "var(--bg-neutral-tertiary)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${widthPct}%`,
                    background: color,
                    borderRadius: 6,
                    transition: "width 500ms ease-out",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: widthPct > 18 ? "#fff" : "var(--text-neutral-primary)",
                  }}
                >
                  <span>{s.count.toLocaleString()}</span>
                  <span style={{ marginLeft: 8, opacity: 0.85, fontWeight: 500 }}>
                    {(s.pct_of_total * 100).toFixed(0)}% of total
                  </span>
                </div>
              </div>

              {/* Step-conversion chip (this stage / previous stage) */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color:
                    stepConvPct == null
                      ? "var(--text-neutral-disabled)"
                      : stepConvPct >= 80
                      ? "var(--green-500)"
                      : stepConvPct >= 50
                      ? "var(--text-neutral-secondary)"
                      : "var(--red-500)",
                  textAlign: "right",
                }}
                title={i === 0 ? "First stage" : `${stepConvPct}% of "${stages[i - 1].label}"`}
              >
                {stepConvPct == null ? "—" : `${stepConvPct}%`}
              </div>
            </div>
          );
        })}

        {/* Footer summary */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 12,
            borderTop: "1px solid var(--border-neutral-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-neutral-tertiary)",
          }}
        >
          <span>End-to-end conversion (Inbound → Booked)</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: overallConv >= 0.2 ? "var(--green-500)" : "var(--text-neutral-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {(overallConv * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </ChartCard>
  );
}

/* ── Negotiation depth histogram ─────────────────────────────────────── */

/** Colour buckets: zero rounds = grey (no negotiation), 1–2 = green (clean
 *  accepts / quick deal), 3 = amber (working for it), 4+ = red (grinding). */
function negDepthColor(roundsMin: number): string {
  if (roundsMin === 0) return "var(--chart-neutral-soft)";
  if (roundsMin <= 2) return "var(--chart-green)";
  if (roundsMin === 3) return "var(--chart-amber)";
  return "var(--chart-red)";
}

function NegotiationDepthCard({ buckets, days }: { buckets: NegotiationDepthBucket[]; days: number }) {
  if (buckets.length === 0) return null;
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const rows = buckets
    .slice()
    .sort((a, b) => a.rounds_min - b.rounds_min)
    .map(b => ({
      ...b,
      color: negDepthColor(b.rounds_min),
      pct: total > 0 ? (b.count / total) * 100 : 0,
    }));

  return (
    <ChartCard
      title="Negotiation depth"
      subtitle={`Distribution of negotiation rounds · ${total.toLocaleString()} carrier_sales calls · last ${days} days`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 16, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-neutral-subtle)" vertical={false} />
          <XAxis
            dataKey="rounds_label"
            tick={{ fontSize: 12, fill: "var(--text-neutral-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-neutral-tertiary)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [`${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, "Calls"]}
            labelFormatter={(label: string) => `${label} round${label === "1" ? "" : "s"}`}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {rows.map(r => (
              <Cell key={r.rounds_label} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend strip */}
      <div
        style={{
          marginTop: 4,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 11,
          color: "var(--text-neutral-tertiary)",
        }}
      >
        {[
          ["var(--chart-neutral-soft)", "0 — no negotiation"],
          ["var(--chart-green)", "1–2 — clean accept"],
          ["var(--chart-amber)", "3 — working for it"],
          ["var(--chart-red)", "4+ — grinding"],
        ].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

/* ── Quality / sentiment over time ──────────────────────────────────── */

function QualityOverTimeCard({
  quality,
  sentimentDistribution,
  days,
}: {
  quality: QualityPerDay[];
  sentimentDistribution?: Array<{ label: string; count: number }>;
  days: number;
}) {
  if (quality.length === 0) return null;
  // Recharts likes finite numbers; map nulls to `null` (which it skips) and
  // convert sentiment (-1..1) to a 0..100 scale so it shares a y-axis with
  // overall_score without dragging the axis below zero.
  const rows = quality.map(q => ({
    label: fmtDay(q.date),
    audited: q.audited_count,
    overall: q.avg_overall_score,
    sentiment100:
      q.avg_sentiment_score != null
        ? Math.round((q.avg_sentiment_score + 1) * 50) // map -1..1 → 0..100
        : null,
  }));

  const sentTotal = (sentimentDistribution ?? []).reduce((s, b) => s + b.count, 0);
  const sentColor: Record<string, string> = {
    Negative: "var(--chart-red)",
    Neutral:  "var(--chart-neutral)",
    Positive: "var(--chart-green)",
  };

  return (
    <ChartCard
      title="Quality & sentiment over time"
      subtitle={`Daily averages from the post-call auditor · last ${days} days`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 12, right: 16, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-neutral-subtle)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-neutral-tertiary)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--text-neutral-tertiary)" }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 25, 50, 75, 100]}
          />
          {/* Sentiment neutral mid-line (50 on the mapped scale = 0 sentiment) */}
          <ReferenceLine y={50} stroke="var(--border-neutral-subtle)" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // Recharts types `value` as `ValueType` (string | number | Array),
            // even though our series are all numeric. Narrow at runtime so we
            // can format the sentiment line in its original -1..1 scale.
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              if (!Number.isFinite(v)) return ["—", String(name)];
              if (name === "Sentiment") {
                const raw = ((v - 50) / 50).toFixed(2);
                return [`${raw} (${v}/100)`, String(name)];
              }
              return [`${v}`, String(name)];
            }}
          />
          <Line
            type="monotone"
            dataKey="overall"
            name="Overall score"
            stroke="var(--chart-blue)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "var(--chart-blue)" }}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="sentiment100"
            name="Sentiment"
            stroke="var(--chart-green)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Inline legend + sentiment distribution */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-neutral-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 2, background: "var(--chart-blue)", borderRadius: 1 }} />
            Overall score (0–100)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 2,
                background:
                  "repeating-linear-gradient(to right, var(--chart-green) 0 5px, transparent 5px 9px)",
                borderRadius: 1,
              }}
            />
            Sentiment (–1 to +1)
          </div>
        </div>

        {sentTotal > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-neutral-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Sentiment mix
            </span>
            <div
              style={{
                display: "flex",
                height: 10,
                width: 180,
                borderRadius: 5,
                overflow: "hidden",
                background: "var(--bg-neutral-tertiary)",
              }}
              title={(sentimentDistribution ?? [])
                .map(b => `${b.label}: ${b.count} (${Math.round((b.count / sentTotal) * 100)}%)`)
                .join(" · ")}
            >
              {(sentimentDistribution ?? []).map(b => (
                <div
                  key={b.label}
                  style={{
                    width: `${(b.count / sentTotal) * 100}%`,
                    background: sentColor[b.label] ?? "var(--chart-neutral-soft)",
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

/* ── Audit ring gauge (DS RingProgress) ──────────────────────────────── */

/** Shared score-to-tone mapping. RingProgress tones are
 *  brand|info|success|warning|danger (note: "danger", not "error"). */
type RingTone = "success" | "warning" | "danger";
function ringTone(score: number | null | undefined): RingTone {
  const s = score ?? 0;
  if (s >= 75) return "success";
  if (s >= 50) return "warning";
  return "danger";
}

function AuditRing({ score, label }: { score: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <RingProgress
        variant="ring"
        value={Math.max(0, Math.min(100, Math.round(score)))}
        tone={ringTone(score)}
        size="xl"
        valueFormat={(v) => `${v}`}
      />
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-neutral-tertiary)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const TIME_RANGES = ["7 days", "14 days", "30 days", "90 days"] as const;
type TimeRange = typeof TIME_RANGES[number];
const RANGE_DAYS: Record<TimeRange, number> = {
  "7 days": 7, "14 days": 14, "30 days": 30, "90 days": 90,
};

/* ── Meetings booked — with whom, when, email, link ──────────────────────── */

interface BookedMeeting {
  call_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  meeting_time: string | null;
  meeting_link: string | null;
  booked_at: string | null;
  qualification_score: number | null;
}

function MeetingsBooked({ days }: { days: number }) {
  const window = Math.max(days, 30);
  const { data } = useSWR<{ meetings: BookedMeeting[]; total: number }>(
    `/api/analytics/meetings?days=${window}`, fetcher,
  );
  const meetings = data?.meetings ?? [];
  const cell: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, color: "var(--text-neutral-primary)",
    borderBottom: "1px solid var(--border-neutral-subtle)", verticalAlign: "middle",
  };
  const head: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
    textTransform: "uppercase", color: "var(--text-neutral-secondary)", textAlign: "left",
    borderBottom: "1px solid var(--border-neutral-secondary)",
  };
  return (
    <ChartCard
      title="Meetings booked"
      subtitle={`${meetings.length} demo${meetings.length === 1 ? "" : "s"} booked · last ${window} days`}
    >
      {meetings.length === 0 ? (
        <ChartEmpty message="No meetings booked yet — booked demos show here with the attendee, time, and calendar link." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={head}>With</th>
                <th style={head}>Email</th>
                <th style={head}>Meeting time</th>
                <th style={head}>Booked</th>
                <th style={head}>Invite</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.call_id}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{m.name || m.company || "—"}</div>
                    {m.company && m.name && m.company !== m.name && (
                      <div style={{ fontSize: 11.5, color: "var(--text-neutral-secondary)" }}>{m.company}</div>
                    )}
                  </td>
                  <td style={{ ...cell, color: "var(--text-neutral-secondary)" }}>{m.email || "—"}</td>
                  <td style={cell}>{m.meeting_time || "—"}</td>
                  <td style={{ ...cell, color: "var(--text-neutral-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {m.booked_at ? new Date(m.booked_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </td>
                  <td style={cell}>
                    {m.meeting_link ? (
                      <a href={m.meeting_link} target="_blank" rel="noopener noreferrer"
                         style={{ color: "var(--text-brand-primary, #b45309)", textDecoration: "underline", fontWeight: 600 }}>
                        Open invite ↗
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

const TAB_ITEMS: TabItem[] = [
  { id: "overview", label: "Overview", icon: "chart-line" },
  { id: "meetings", label: "Meetings", icon: "calendar-check" },
];

/* ── Page ────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const { selectedAgentType, selectedAgentName } = useAgentSelectorStore();
  const [timeRange, setTimeRange] = useState<TimeRange>("7 days");

  // Persist the active tab in the URL (`?tab=`) so a refresh / shared link
  // lands on the same section instead of resetting to Overview.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState(
    TAB_ITEMS.some((t) => t.id === tabParam) ? (tabParam as string) : "overview",
  );
  function handleTabChange(id: string) {
    setTab(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const days = RANGE_DAYS[timeRange];

  // Build URLs. Both endpoints now accept agent_type=null (= all agent types),
  // so we just omit the param when nothing is selected — the backend default
  // is also None.
  const doraQs = new URLSearchParams({ days: String(days) });
  if (selectedAgentType) doraQs.set("agent_type", selectedAgentType);
  const doraUrl = `/api/analytics/dora?${doraQs.toString()}`;

  const auditQs = new URLSearchParams({ days: String(days) });
  if (selectedAgentType) auditQs.set("agent_type", selectedAgentType);
  const auditUrl = `/api/analytics/audit?${auditQs.toString()}`;

  const { data: metrics, isLoading, mutate } = useSWR<DoraMetrics>(doraUrl, fetcher);
  const { data: auditMetrics, mutate: mutateAudit } = useSWR<AuditMetrics>(auditUrl, fetcher);

  const dora = metrics ?? FALLBACK_DORA;
  const hasData = dora.total_calls > 0;
  const bookingPct = dora.booking_rate * 100;

  // Prefer the server's authoritative total_duration_sec; only fall back to
  // count × avg if an older backend version omits it (avoids over-counting
  // when some calls have NULL duration).
  const totalMinutes = Math.round(
    (dora.total_duration_sec ?? dora.total_calls * (dora.avg_call_duration_sec ?? 0)) / 60
  );

  // calls_per_day always arrives from the backend (zero-filled across the
  // window). The fallback below only runs in the loading / fetch-error edge
  // where SWR has no data yet — it just keeps the chart from collapsing.
  const callsPerDay = (dora.calls_per_day ?? []).map(row => ({
    label: fmtDay(row.date),
    count: row.count,
  }));

  // Backend always returns outcome_distribution (possibly empty). No fake
  // hard-coded "Declined = 30%" fallback — if there's no data, the empty
  // state below renders instead.
  const outcomeData = (dora.outcome_distribution ?? []).filter(d => d.count > 0);

  // Per-tab data availability.
  const hasFunnel  = !!dora.funnel && dora.funnel.length > 0;
  const hasNegDepth = !!dora.negotiation_depth && dora.negotiation_depth.some(b => b.count > 0);
  const hasAudit   = !!auditMetrics && (auditMetrics.total_audited ?? 0) > 0;

  /* ── Page shell (shared across loading / empty / loaded) ─────────────── */

  const header = (
    <PageHeader
      style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Analytics
          <Tag size="sm" variant="neutral" style={{ background: "var(--bg-neutral-primary)" }}>
            {selectedAgentName}
          </Tag>
        </span>
      }
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 124 }}>
            <Dropdown
              size="sm"
              value={timeRange}
              onChange={(v) => setTimeRange((Array.isArray(v) ? v[0] : v) as TimeRange)}
              options={TIME_RANGES.map(r => ({ value: r, label: r }))}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon="arrows-clockwise"
            onClick={() => { mutate(); mutateAudit(); }}
            aria-label="Refresh analytics"
            title="Refresh"
          />
        </div>
      }
    />
  );

  if (isLoading) {
    // Mirror the loaded Overview tab, keeping every *static* element real — the
    // header, tabs, KPI labels + icons + card frame, and chart-card titles — and
    // skeletoning only the *data* (KPI values via the DS `loading` prop, chart
    // plot areas via a Skeleton). So nothing shifts when data lands, and we
    // never blank out chrome that's known before the fetch.
    return (
      <div className="converse-fullbleed-page" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-neutral-secondary)", overflow: "hidden" }}>
        {header}

        {/* Tabs band (real tabs — interactive, no shift on load) */}
        <div style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}>
          <Tabs items={TAB_ITEMS} value={tab} onChange={handleTabChange} variant="primary" ariaLabel="Analytics sections" />
        </div>

        {/* Scrollable content — matches the loaded gutter + spacing. The
            skeleton mirrors whichever tab is active (persisted in the URL) so a
            refresh on Carrier Sales / Quality doesn't flash the Overview shape. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ padding: "20px 16px 48px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {tab === "overview" && (
                <>
                  <Grid columns={3} gap="md">
                    <KpiCard label="Total calls"        value="" icon="phone" tone="brand"   loading />
                    <KpiCard label="Total call minutes" value="" icon="clock" tone="info"    loading />
                    <KpiCard label="Avg call duration"  value="" icon="timer" tone="neutral" loading />
                  </Grid>
                  <ChartCard title="Calls per day" subtitle={`Last ${days} days`}>
                    <ChartLoading height={260} />
                  </ChartCard>
                  <ChartCard title="Outcome distribution" subtitle={`Last ${days} days`}>
                    <ChartLoading height={220} />
                  </ChartCard>
                </>
              )}

              {tab === "carrier" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                    <KpiCard label="Booking rate"           value="" icon="trophy"             tone="success" loading />
                    <KpiCard label="Avg negotiation rounds" value="" icon="arrows-clockwise"   tone="neutral" loading />
                    <KpiCard label="Deals closed"           value="" icon="check-circle"       tone="success" loading />
                    <KpiCard label="Transfers"              value="" icon="arrow-bend-up-right" tone="info"    loading />
                    <KpiCard label="Goal achieved"          value="" icon="target"             tone="brand"   loading />
                  </div>
                  <ChartCard title="Carrier sales conversion funnel" subtitle={`Last ${days} days`}>
                    <ChartLoading height={260} />
                  </ChartCard>
                  <ChartCard title="Negotiation depth" subtitle={`Last ${days} days`}>
                    <ChartLoading height={220} />
                  </ChartCard>
                </>
              )}

              {tab === "quality" && (
                <>
                  <ChartCard title="Audit scoring" subtitle={`Last ${days} days`}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, justifyItems: "center" }}>
                      {["Overall", "Conversation", "Efficiency", "Tool accuracy"].map((label) => (
                        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <Skeleton width={96} height={96} radius="full" />
                          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-neutral-tertiary)" }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                  <ChartCard title="Quality & sentiment over time" subtitle={`Last ${days} days`}>
                    <ChartLoading height={220} />
                  </ChartCard>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="converse-fullbleed-page" style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-neutral-secondary)", overflow: "hidden",
    }}>
      {header}

      {/* Tabs band */}
      <div style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}>
        <Tabs
          items={TAB_ITEMS}
          value={tab}
          onChange={handleTabChange}
          variant="primary"
          ariaLabel="Analytics sections"
        />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "20px 16px 48px" }}>

          {!hasData && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderRadius: 12,
                background: "var(--bg-neutral-primary)",
                border: "1px solid var(--border-neutral-subtle)",
                fontSize: 13, color: "var(--text-neutral-secondary)",
              }}>
                <Icon name="info" size="sm" />
                <span>No call data in the last {days} days yet — this is the layout. Widgets fill in as your agents handle calls.</span>
              </div>
            </div>
          )}

          <>
              {/* ── OVERVIEW ─────────────────────────────────────────────── */}
              {tab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <Grid columns={3} gap="md">
                    <KpiCard label="Total calls"        value={dora.total_calls.toLocaleString()} icon="phone" tone="brand" />
                    <KpiCard label="Meetings booked"    value={String(dora.total_booked ?? 0)} icon="calendar-check" tone="success" />
                    <KpiCard label="Booking rate"       value={`${bookingPct.toFixed(1)}%`} icon="trophy" tone="success" />
                    <KpiCard label="Qualified"          value={String(dora.total_successful ?? 0)} icon="check-circle" tone="info" />
                    <KpiCard label="Total call minutes" value={totalMinutes.toLocaleString()}     icon="clock" tone="info" />
                    <KpiCard label="Avg call duration"  value={fmtDur(dora.avg_call_duration_sec)} icon="timer" tone="neutral" />
                  </Grid>

                  {hasFunnel && <FunnelCard stages={dora.funnel!} days={days} />}

                  <ChartCard title="Calls per day" subtitle={`${dora.total_calls.toLocaleString()} calls in the last ${days} days`}>
                    {callsPerDay.some(d => d.count > 0) ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={callsPerDay} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  style={{ stopColor: "var(--chart-green)", stopOpacity: 0.22 }} />
                            <stop offset="95%" style={{ stopColor: "var(--chart-green)", stopOpacity: 0.02 }} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-neutral-subtle)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-neutral-tertiary)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-neutral-tertiary)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Calls"]} />
                        <Area type="monotone" dataKey="count" stroke="var(--chart-green)" strokeWidth={2} fill="url(#gradC)" name="Calls" dot={false} activeDot={{ r: 4, fill: "var(--chart-green)" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                    ) : (
                      <ChartEmpty height={260} message="No calls in this window yet" />
                    )}
                  </ChartCard>

                  {outcomeData.length > 0 ? (
                    <OutcomeBreakdownCard data={outcomeData} days={days} />
                  ) : (
                    <ChartCard title="Outcome distribution" subtitle={`Last ${days} days`}>
                      <ChartEmpty message="No classified calls in this window yet" />
                    </ChartCard>
                  )}
                </div>
              )}

              {/* ── MEETINGS BOOKED ──────────────────────────────────────── */}
              {tab === "meetings" && <MeetingsBooked days={days} />}

              {/* ── QUALITY ──────────────────────────────────────────────── */}
              {tab === "quality" && (
                hasAudit ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <ChartCard
                      title="Audit scoring"
                      subtitle={`Avg score across ${auditMetrics!.total_audited} audited calls · last ${days} days`}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, justifyItems: "center" }}>
                        <AuditRing score={auditMetrics!.avg_overall_score ?? 0}        label="Overall" />
                        <AuditRing score={auditMetrics!.avg_conversation_quality ?? 0} label="Conversation" />
                        <AuditRing score={auditMetrics!.avg_efficiency_score ?? 0}     label="Efficiency" />
                        <AuditRing score={(auditMetrics!.avg_tool_accuracy ?? 0) * 100} label="Tool accuracy" />
                      </div>

                      {(auditMetrics!.autonomous_resolution_rate != null || auditMetrics!.escalation_rate != null) && (
                        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-neutral-subtle)", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                          <KpiCard
                            label="Autonomous resolution"
                            value={auditMetrics!.autonomous_resolution_rate != null ? `${(auditMetrics!.autonomous_resolution_rate * 100).toFixed(0)}%` : "—"}
                            helperText="Calls resolved without a human handoff"
                            // Higher = better — agent resolved without a human.
                            tone={auditMetrics!.autonomous_resolution_rate == null ? "neutral"
                                  : auditMetrics!.autonomous_resolution_rate >= 0.5 ? "success"
                                  : auditMetrics!.autonomous_resolution_rate >= 0.2 ? "warning" : "error"}
                            icon="robot"
                          />
                          <KpiCard
                            label="Escalation requested"
                            value={auditMetrics!.escalation_rate != null ? `${(auditMetrics!.escalation_rate * 100).toFixed(0)}%` : "—"}
                            helperText="Callers who asked for a human or supervisor"
                            // Lower = better — caller asked for a human (failure mode).
                            tone={auditMetrics!.escalation_rate == null ? "neutral"
                                  : auditMetrics!.escalation_rate <= 0.1 ? "success"
                                  : auditMetrics!.escalation_rate <= 0.25 ? "warning" : "error"}
                            icon="hand-palm"
                          />
                        </div>
                      )}

                      {auditMetrics!.top_quality_flags && auditMetrics!.top_quality_flags.length > 0 && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-neutral-subtle)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-neutral-tertiary)", marginBottom: 8 }}>Most common flags</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {auditMetrics!.top_quality_flags.slice(0, 8).map((f: { flag: string; count: number }) => (
                              <Tag key={f.flag} variant="warning" size="sm" leftIcon="warning">{f.flag} ({f.count})</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </ChartCard>

                    {auditMetrics!.quality_per_day && (
                      <QualityOverTimeCard
                        quality={auditMetrics!.quality_per_day}
                        sentimentDistribution={auditMetrics!.sentiment_distribution}
                        days={days}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <ChartCard title="Audit scoring" subtitle={`Last ${days} days`}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, justifyItems: "center", opacity: 0.4 }}>
                        <AuditRing score={0} label="Overall" />
                        <AuditRing score={0} label="Conversation" />
                        <AuditRing score={0} label="Efficiency" />
                        <AuditRing score={0} label="Tool accuracy" />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <ChartEmpty height={60} message="No audited calls in this window yet" />
                      </div>
                    </ChartCard>
                    <ChartCard title="Quality & sentiment over time" subtitle={`Last ${days} days`}>
                      <ChartEmpty message="No audited calls in this window yet" />
                    </ChartCard>
                  </div>
                )
              )}
            </>
        </div>
      </div>
    </div>
  );
}
