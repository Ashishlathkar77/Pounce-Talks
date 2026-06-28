"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Surface,
  Stack,
  Tag,
  Icon,
  KpiCard,
  EmptyState,
  PageHeader as DSPageHeader,
} from "@hemut2025/design-system";
import type { TagProps } from "@hemut2025/design-system";
import { ActiveCall, LiveEvent, LiveTranscriptTurn } from "@/lib/types";
import { formatPhoneNumber, humanizeTranscript } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function formatElapsed(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function agentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    carrier_sales:    "Carrier Sales",
    driver_eta:       "Driver ETA",
    customer_eta:     "Customer ETA",
    receptionist:     "Receptionist",
    sdr:              "SDR",
    pod_collection:   "POD Collection",
    detention_monitor: "Detention Monitor",
    assign_driver:    "Assign Driver",
    equipment_change: "Equipment Change",
    reschedule:       "Reschedule",
    outbound_carrier_sales: "Outbound Carrier Sales",
  };
  return labels[type] ?? type;
}

// ── Live "pulsing" dot — theme-aware, reused for the live indicator + waiting
//    state. Color is a CSS var so it flips correctly in dark mode. ────────────
function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      style={{ width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }}
    />
  );
}

function TranscriptBubble({ turn }: { turn: LiveTranscriptTurn }) {
  const isAgent = turn.role === "agent";
  // Agent → brand tint, caller → info tint. All theme-aware.
  const tileBg     = isAgent ? "var(--bg-brand-subtle)"      : "var(--bg-info-subtle)";
  const tileBorder = isAgent ? "var(--border-brand-primary)" : "var(--border-info-primary)";
  const tileIcon   = isAgent ? "var(--icon-brand-primary)"   : "var(--icon-info-primary)";

  return (
    <motion.div
      initial={{ opacity: 0, x: isAgent ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 10,
        flexDirection: isAgent ? "row" : "row-reverse",
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: tileBg,
        border: `1px solid ${tileBorder}`,
        color: tileIcon,
      }}>
        <Icon name={isAgent ? "robot" : "microphone"} size="xs" />
      </div>
      <div style={{
        maxWidth: "75%",
        padding: "7px 11px",
        borderRadius: isAgent ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
        background: tileBg,
        border: `1px solid ${tileBorder}`,
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--text-neutral-primary)",
      }}>
        {humanizeTranscript(turn.text)}
      </div>
    </motion.div>
  );
}

function ActiveCallCard({ call }: { call: ActiveCall }) {
  const [elapsed, setElapsed] = useState(formatElapsed(call.started_at));
  const inbound = call.direction === "inbound";

  useEffect(() => {
    const t = setInterval(() => setElapsed(formatElapsed(call.started_at)), 1000);
    return () => clearInterval(t);
  }, [call.started_at]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Surface
        variant="primary"
        padding="none"
        radius="lg"
        border="primary"
        shadow="none"
        style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Card header */}
        <div style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-neutral-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          background: "var(--bg-neutral-secondary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <PulseDot color="var(--green-500)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
                  color: "var(--text-neutral-primary)",
                }}>
                  {agentTypeLabel(call.agent_type)}
                </span>
                <Tag size="sm" variant={inbound ? "info" : "success"} leftIcon={inbound ? "arrow-down-left" : "arrow-up-right"}>
                  {inbound ? "Inbound" : "Outbound"}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatPhoneNumber(call.caller_phone) || "Unknown caller"}
              </div>
            </div>
          </div>
          <div style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
            color: "var(--text-neutral-secondary)",
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
            flexShrink: 0,
          }}>
            {elapsed}
          </div>
        </div>

        {/* Live transcript */}
        <div style={{ flex: 1, padding: "12px 14px", maxHeight: 280, overflowY: "auto", minHeight: 80 }}>
          {call.transcript.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
              <PulseDot color="var(--text-neutral-tertiary)" size={6} />
              <span style={{ fontSize: 13, color: "var(--text-neutral-tertiary)" }}>Waiting for speech…</span>
            </div>
          ) : (
            call.transcript.map((turn, i) => <TranscriptBubble key={i} turn={turn} />)
          )}
        </div>
      </Surface>
    </motion.div>
  );
}

// Outcome → DS semantic tone + Phosphor icon for the ended-call toast.
const OUTCOME_META: Record<string, { tone: "success" | "error" | "info" | "neutral"; icon: string }> = {
  booked:      { tone: "success", icon: "check-circle" },
  declined:    { tone: "error",   icon: "x-circle" },
  transferred: { tone: "info",    icon: "arrow-bend-up-right" },
  dropped:     { tone: "neutral", icon: "phone-disconnect" },
};
const TONE_BG: Record<string, string> = {
  success: "var(--bg-success-subtle)", error: "var(--bg-error-subtle)",
  info: "var(--bg-info-subtle)", neutral: "var(--bg-neutral-secondary)",
};
const TONE_BORDER: Record<string, string> = {
  success: "var(--border-success-primary)", error: "var(--border-error-primary)",
  info: "var(--border-info-primary)", neutral: "var(--border-neutral-subtle)",
};
const TONE_TEXT: Record<string, string> = {
  success: "var(--text-success-primary)", error: "var(--text-error-primary)",
  info: "var(--text-info-primary)", neutral: "var(--text-neutral-secondary)",
};

function EndedCallToast({ session_id, outcome }: { session_id: string; outcome: string }) {
  const m = OUTCOME_META[outcome] ?? OUTCOME_META.dropped;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.25 }}
      style={{
        background: TONE_BG[m.tone],
        border: `1px solid ${TONE_BORDER[m.tone]}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 8,
      }}
    >
      <span style={{ color: TONE_TEXT[m.tone], display: "flex", flexShrink: 0 }}>
        <Icon name={m.icon} size="sm" />
      </span>
      <span style={{ fontSize: 13, color: "var(--text-neutral-secondary)" }}>
        Call ended — <strong style={{ color: TONE_TEXT[m.tone], textTransform: "capitalize" }}>{outcome}</strong>
      </span>
      <span style={{
        fontSize: 11, color: "var(--text-neutral-tertiary)", marginLeft: "auto",
        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
      }}>
        {session_id.slice(0, 8)}
      </span>
    </motion.div>
  );
}

export default function LivePage() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [recentEnded, setRecentEnded] = useState<{ session_id: string; outcome: string; id: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const toastId = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // EventSource doesn't support custom headers, so we pass the token as a query param
    let url = `${API_BASE}/api/live/calls`;
    try {
      const raw = localStorage.getItem("converse_auth");
      const token = raw ? JSON.parse(raw)?.state?.token : localStorage.getItem("converse_token");
      if (token) url += `?token=${encodeURIComponent(token)}`;
    } catch { /* ignore */ }
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event: LiveEvent = JSON.parse(e.data);

        if (event.type === "snapshot") {
          setActiveCalls(event.calls);
        } else if (event.type === "call_started") {
          setActiveCalls((prev) => [
            ...prev,
            {
              session_id: event.session_id,
              customer_id: "",
              agent_type: event.agent_type,
              direction: event.direction as "inbound" | "outbound",
              caller_phone: event.caller_phone,
              started_at: event.ts,
              transcript: [],
            },
          ]);
        } else if (event.type === "transcript_turn") {
          setActiveCalls((prev) =>
            prev.map((c) =>
              c.session_id === event.session_id
                ? {
                    ...c,
                    transcript: [
                      ...c.transcript,
                      { role: event.role as "agent" | "caller", text: event.text, ts: event.ts },
                    ],
                  }
                : c
            )
          );
        } else if (event.type === "call_ended") {
          setActiveCalls((prev) => prev.filter((c) => c.session_id !== event.session_id));
          const id = ++toastId.current;
          setRecentEnded((prev) => [{ session_id: event.session_id, outcome: event.outcome, id }, ...prev.slice(0, 4)]);
          setTimeout(() => setRecentEnded((prev) => prev.filter((t) => t.id !== id)), 8000);
        }
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  const inboundCount = activeCalls.filter((c) => c.direction === "inbound").length;
  const outboundCount = activeCalls.filter((c) => c.direction === "outbound").length;
  const connTone: NonNullable<TagProps["variant"]> = connected ? "success" : "warning";

  return (
    <div
      className="converse-fullbleed-page"
      style={{
        display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
        background: "var(--bg-neutral-secondary)",
      }}
    >
      <DSPageHeader
        bordered
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title="Live Monitor"
        info="Real-time view of active calls and their transcripts as they happen."
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PulseDot color={connected ? "var(--green-500)" : "var(--red-500)"} />
            <Tag size="sm" variant={connTone}>
              {connected ? "Connected" : "Reconnecting…"}
            </Tag>
          </div>
        }
      />

      <div style={{
        flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        padding: "16px 16px 0",
      }}>
        {/* Stats */}
        <div style={{
          flexShrink: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12, marginBottom: 16,
        }}>
          <KpiCard icon="broadcast"        tone="success" label="Active now" value={activeCalls.length} />
          <KpiCard icon="arrow-down-left"  tone="info"    label="Inbound"    value={inboundCount} />
          <KpiCard icon="arrow-up-right"   tone="brand"   label="Outbound"   value={outboundCount} />
        </div>

        {/* Main area — cards grid / empty state + toast overlay */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {activeCalls.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                icon="phone"
                title="No active calls"
                description="Live transcripts will appear here as calls come in."
              />
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 12,
              height: "100%",
              overflowY: "auto",
              paddingBottom: 16,
              alignContent: "start",
            }}>
              <AnimatePresence>
                {activeCalls.map((call) => (
                  <ActiveCallCard key={call.session_id} call={call} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Toast overlay — recent ended calls */}
          {recentEnded.length > 0 && (
            <div style={{ position: "absolute", top: 0, right: 0, width: 320, zIndex: 20 }}>
              <AnimatePresence>
                {recentEnded.map((t) => (
                  <EndedCallToast key={t.id} session_id={t.session_id} outcome={t.outcome} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
