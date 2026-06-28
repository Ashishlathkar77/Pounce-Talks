"use client";

import { use, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { fetcher, apiFetch } from "@/lib/api";
import { Campaign, Lead } from "@/lib/types";
import {
  ArrowLeft, Phone, CheckCircle2, Clock,
  Zap, Play, Pause, X, Users, CalendarCheck, Loader2,
  ChevronRight, PhoneCall, PhoneOff, PhoneMissed, Pencil,
} from "lucide-react";

// Only the top N leads are shown / callable per campaign.
const MAX_LEADS = 10;

// Shared column template for the leads table (header + rows must match).
// checkbox | edit | Name | Company | Phone | Email | Location | Employees | Status | Score
const LEAD_GRID = "44px 36px 1.2fr 1.2fr 1.15fr 1.3fr 1.1fr 92px 104px 58px";

// Visible vertical column divider + a full-height cell wrapper so the line
// spans the whole row/header.
const COL_LINE = "1px solid var(--border-neutral-secondary)";
const LEAD_CELL: React.CSSProperties = {
  height: "100%", minWidth: 0,
  display: "flex", alignItems: "center",
  padding: "0 10px",
};
import { Tag } from "@hemut2025/design-system";
import Link from "next/link";

// ── Step pipeline definition ──────────────────────────────────────────────────

type StepId = "created" | "leads" | "started" | "calling" | "done";

interface PipelineStep {
  id: StepId;
  label: string;
  detail: string;
  icon: React.ElementType;
}

const STEPS: PipelineStep[] = [
  { id: "created",  label: "Campaign Created",  detail: "Named & configured",         icon: CheckCircle2 },
  { id: "leads",    label: "Leads Imported",    detail: "Orange Slice query ran",      icon: Users        },
  { id: "started",  label: "Campaign Started",  detail: "Alex is ready to call",       icon: Play         },
  { id: "calling",  label: "Alex Calling",      detail: "Live outbound calls",         icon: PhoneCall    },
  { id: "done",     label: "Results In",        detail: "Meetings booked or wrapped",  icon: CalendarCheck},
];

function currentStep(c: Campaign, hasLeads: boolean): StepId {
  if (c.status === "completed" || c.status === "cancelled") return "done";
  if (c.status === "running") return c.total_dialed > 0 ? "calling" : "started";
  if (c.status === "paused")  return c.total_dialed > 0 ? "calling" : "started";
  if (hasLeads) return "leads";
  return "created";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function leadStatusCfg(s: Lead["status"]) {
  const m: Record<Lead["status"], { label: string; color: string; bg: string; icon: React.ElementType }> = {
    new:            { label: "New",           color: "#9ba1ad",  bg: "rgba(155,161,173,0.1)",  icon: Clock       },
    queued:         { label: "Queued",        color: "#60a5fa",  bg: "rgba(96,165,250,0.1)",   icon: Clock       },
    calling:        { label: "Calling…",      color: "#FFD33B",  bg: "rgba(255,211,59,0.12)",  icon: PhoneCall   },
    qualified:      { label: "Qualified",     color: "#22c55e",  bg: "rgba(34,197,94,0.12)",   icon: CheckCircle2},
    not_qualified:  { label: "Not Qualified", color: "#ef4444",  bg: "rgba(239,68,68,0.1)",    icon: PhoneOff    },
    meeting_booked: { label: "Booked ✓",      color: "#818cf8",  bg: "rgba(129,140,248,0.12)", icon: CalendarCheck},
    no_answer:      { label: "No Answer",     color: "#f97316",  bg: "rgba(249,115,22,0.1)",   icon: PhoneMissed },
    failed:         { label: "Failed",        color: "#ef4444",  bg: "rgba(239,68,68,0.1)",    icon: PhoneOff    },
  };
  return m[s] ?? m.new;
}

function camStatusColor(s: Campaign["status"]) {
  const m: Record<Campaign["status"], { color: string; bg: string }> = {
    draft:     { color: "#9ba1ad", bg: "rgba(155,161,173,0.1)" },
    running:   { color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
    paused:    { color: "#FFD33B", bg: "rgba(255,211,59,0.1)"  },
    completed: { color: "#818cf8", bg: "rgba(129,140,248,0.12)"},
    cancelled: { color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  };
  return m[s] ?? m.draft;
}

// ── Step Pipeline UI ──────────────────────────────────────────────────────────

function StepPipeline({ step }: { step: StepId }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 14, overflow: "hidden",
      marginBottom: "2rem",
    }}>
      {STEPS.map((s, i) => {
        const done    = i < activeIdx;
        const active  = i === activeIdx;
        const pending = i > activeIdx;
        const Icon = s.icon;
        return (
          <div key={s.id} style={{ flex: 1, position: "relative" }}>
            {/* Connector arrow between steps */}
            {i < STEPS.length - 1 && (
              <div style={{
                position: "absolute", right: -13, top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2,
                width: 0, height: 0,
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: `13px solid ${done ? "rgba(34,197,94,0.3)" : active ? "rgba(255,211,59,0.3)" : "var(--border)"}`,
              }} />
            )}
            <div style={{
              padding: "1.125rem 1rem",
              background: done
                ? "rgba(34,197,94,0.06)"
                : active
                ? "rgba(255,211,59,0.07)"
                : "transparent",
              borderRight: i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
              display: "flex", flexDirection: "column", gap: 5,
              transition: "background 0.3s ease",
              minWidth: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: done
                    ? "rgba(34,197,94,0.18)"
                    : active
                    ? "rgba(255,211,59,0.18)"
                    : "var(--bg-elevated)",
                  border: `1px solid ${done ? "rgba(34,197,94,0.4)" : active ? "rgba(255,211,59,0.4)" : "var(--border)"}`,
                }}>
                  {done ? (
                    <CheckCircle2 style={{ width: 12, height: 12, color: "#22c55e" }} />
                  ) : (
                    <Icon style={{
                      width: 11, height: 11,
                      color: active ? "#FFD33B" : "var(--text-muted)",
                    }} />
                  )}
                </div>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: active || done ? 700 : 500,
                  color: done ? "#22c55e" : active ? "#FFD33B" : "var(--text-muted)",
                  letterSpacing: "-0.01em", lineHeight: 1.2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {s.label}
                </span>
                {active && (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                    style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFD33B", flexShrink: 0 }}
                  />
                )}
              </div>
              <span style={{
                fontSize: "0.625rem", color: "var(--text-muted)",
                paddingLeft: 28, lineHeight: 1.3,
                display: pending ? "none" : "block",
              }}>
                {s.detail}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Context action card (what to do next) ─────────────────────────────────────

function NextActionCard({
  step, campaign, busy, findingLeads,
  onStart, onPause, onCancel, onFindLeads,
}: {
  step: StepId;
  campaign: Campaign;
  busy: boolean;
  findingLeads: boolean;
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onFindLeads: () => void;
}) {
  const configs: Partial<Record<StepId, { title: string; body: string; cta: string; ctaAction: () => void; ctaStyle?: React.CSSProperties; secondary?: { label: string; action: () => void } }>> = {
    created: {
      title: "Step 2 — Import Leads from Orange Slice",
      body:  "Query LinkedIn for the top 10 freight-broker companies. Phone numbers come in blank and editable — drop your own number into a row to test.",
      cta:   findingLeads ? "Searching LinkedIn…" : "Find Leads via Orange Slice",
      ctaAction: onFindLeads,
      ctaStyle: { background: "rgba(255,211,59,0.15)", color: "#FFD33B", border: "1px solid rgba(255,211,59,0.3)" },
    },
    leads: {
      title: "Step 3 — Edit a phone, select rows, and call",
      body:  "Click any phone cell to edit it (e.g. put your own number in one row). Tick the rows you want, then hit “Call Selected.” Or Start to dial every lead with a valid number.",
      cta:   "Start Campaign",
      ctaAction: onStart,
    },
  };

  const cfg = configs[step];
  if (!cfg) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: "1.75rem", padding: "1.25rem 1.5rem",
        border: "1px solid rgba(255,211,59,0.2)",
        background: "rgba(255,211,59,0.04)",
        borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFD33B", marginBottom: 4 }}>
          Next Step
        </div>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: "0.25rem", letterSpacing: "-0.02em" }}>
          {cfg.title}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {cfg.body}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        {cfg.secondary && (
          <button onClick={cfg.secondary.action} style={{
            padding: "0.5rem 1rem", borderRadius: 8,
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {cfg.secondary.label}
          </button>
        )}
        <button
          onClick={cfg.ctaAction}
          disabled={busy || findingLeads}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.5rem 1.25rem", borderRadius: 8,
            background: "var(--accent)", color: "#000", border: "none",
            fontSize: "0.875rem", fontWeight: 700,
            cursor: busy || findingLeads ? "not-allowed" : "pointer",
            opacity: busy || findingLeads ? 0.7 : 1,
            fontFamily: "inherit",
            ...(cfg.ctaStyle ?? {}),
          }}
        >
          {(busy || findingLeads) && <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />}
          {cfg.cta}
          {!busy && !findingLeads && <ChevronRight style={{ width: 13, height: 13 }} />}
        </button>
      </div>
    </motion.div>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditableCell({
  value, placeholder, mono, center, inputId, onSave,
}: {
  value: string;
  placeholder?: string;
  mono?: boolean;
  center?: boolean;
  inputId?: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Keep local draft in sync when the row re-renders with a new server value.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setDraft(value); }

  const dirty = draft !== value;
  return (
    <input
      id={inputId}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (dirty) onSave(draft.trim()); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%", background: "transparent", border: "1px solid transparent",
        borderRadius: 6, padding: "4px 6px", margin: "-4px -6px",
        fontSize: 13, color: "var(--text-neutral-primary)", fontFamily: mono ? "var(--font-mono, monospace)" : "inherit",
        outline: "none", transition: "border 0.15s, background 0.15s",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        textAlign: center ? "center" : "left",
      }}
      onFocus={(e) => {
        e.target.style.border = "1px solid var(--accent, #FFD33B)";
        e.target.style.background = "var(--bg-neutral-secondary)";
      }}
      onMouseEnter={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = "1px solid var(--border-neutral-subtle)"; }}
      onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = "1px solid transparent"; }}
    />
  );
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        border: `1.5px solid ${checked || indeterminate ? "var(--accent, #FFD33B)" : "var(--border-neutral-subtle)"}`,
        background: checked || indeterminate ? "var(--accent, #FFD33B)" : "transparent",
        transition: "all 0.15s",
      }}
    >
      {checked && <CheckCircle2 style={{ width: 12, height: 12, color: "#000" }} />}
      {!checked && indeterminate && <div style={{ width: 8, height: 2, background: "#000", borderRadius: 1 }} />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [busy, setBusy] = useState(false);
  const [findingLeads, setFindingLeads] = useState(false);
  const [findResult, setFindResult] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [calling, setCalling] = useState(false);

  const { data: campaign, mutate: mutateCam } = useSWR<Campaign>(
    `/api/campaigns/${id}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: leadsData, mutate: mutateLeads } = useSWR<{ leads: Lead[]; campaign_id: string }>(
    `/api/campaigns/${id}/leads`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const allLeads = leadsData?.leads ?? [];
  // Show only the top N leads per campaign.
  const leads = useMemo(() => allLeads.slice(0, MAX_LEADS), [allLeads]);
  const hasLeads = leads.length > 0;

  const selectedInView = useMemo(
    () => leads.filter((l) => selected.has(l.id)),
    [leads, selected]
  );
  const allSelected = leads.length > 0 && selectedInView.length === leads.length;
  const someSelected = selectedInView.length > 0 && !allSelected;

  function toggleAll() {
    setSelected((prev) => {
      if (leads.every((l) => prev.has(l.id))) return new Set();
      return new Set(leads.map((l) => l.id));
    });
  }
  function toggleOne(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  }

  // Optimistic inline edit of a lead field.
  async function updateLeadField(leadId: string, field: keyof Lead, value: string) {
    mutateLeads(
      (cur) => cur && {
        ...cur,
        leads: cur.leads.map((l) => (l.id === leadId ? { ...l, [field]: value } : l)),
      },
      false
    );
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      mutateLeads();
    }
  }

  // Fire calls for the currently-selected leads.
  async function callSelected() {
    if (selectedInView.length === 0) return;
    setCalling(true);
    try {
      await apiFetch(`/api/campaigns/${id}/call`, {
        method: "POST",
        body: JSON.stringify({ lead_ids: selectedInView.map((l) => l.id) }),
      });
      setSelected(new Set());
      await mutateLeads();
      await mutateCam();
    } catch (e) {
      console.error(e);
    } finally {
      setCalling(false);
    }
  }

  const step = campaign ? currentStep(campaign, hasLeads) : "created";
  const sc = campaign ? camStatusColor(campaign.status) : camStatusColor("draft");

  async function doAction(verb: "start" | "pause" | "cancel") {
    setBusy(true);
    try {
      await apiFetch(`/api/campaigns/${id}/${verb}`, { method: "POST" });
      mutateCam();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function findLeads() {
    setFindingLeads(true); setFindResult(null);
    try {
      const res = await apiFetch<{ created: number }>("/api/orange-slice/find-leads", {
        method: "POST",
        body: JSON.stringify({ campaign_id: id, icp_description: "freight brokers" }),
      });
      setFindResult(res.created);
      await mutateLeads();
      await mutateCam();
    } catch (e) { console.error(e); }
    finally { setFindingLeads(false); }
  }

  if (!campaign) {
    return (
      <div style={{ padding: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: "0.75rem" }}>
        <Loader2 style={{ width: 20, height: 20, color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Loading campaign…</span>
      </div>
    );
  }

  const callingLeads = leads.filter((l) => l.status === "calling");
  const bookedLeads  = leads.filter((l) => l.status === "meeting_booked");

  return (
    <div style={{ padding: "2.5rem 2.5rem 5rem", maxWidth: "100%", width: "100%" }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "1.75rem", gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
          <Link href="/campaigns" style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            color: "var(--text-muted)", textDecoration: "none", fontSize: "0.8125rem", flexShrink: 0,
          }}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Campaigns
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          <span style={{
            fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280,
          }}>
            {campaign.name}
          </span>
          <span style={{
            fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase", color: sc.color, background: sc.bg,
            padding: "0.15rem 0.6rem", borderRadius: 99, flexShrink: 0,
          }}>
            {campaign.status}
          </span>
          {campaign.status === "running" && (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }}
            />
          )}
        </div>

        {/* Controls — only shown when actively running/pausable */}
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {campaign.status === "running" && (
            <button onClick={() => doAction("pause")} disabled={busy} style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4375rem 0.875rem", borderRadius: 8,
              background: "rgba(255,211,59,0.1)", color: "#FFD33B",
              border: "1px solid rgba(255,211,59,0.2)",
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
              opacity: busy ? 0.6 : 1, fontFamily: "inherit",
            }}>
              <Pause style={{ width: 11, height: 11 }} />
              Pause
            </button>
          )}
          {campaign.status === "paused" && (
            <button onClick={() => doAction("start")} disabled={busy} style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4375rem 0.875rem", borderRadius: 8,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
              opacity: busy ? 0.6 : 1, fontFamily: "inherit",
            }}>
              <Play style={{ width: 11, height: 11 }} />
              Resume
            </button>
          )}
          {(campaign.status === "draft" || campaign.status === "running" || campaign.status === "paused") && (
            <button onClick={() => doAction("cancel")} disabled={busy} style={{
              width: 34, height: 34, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(239,68,68,0.08)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.18)",
              cursor: "pointer", opacity: busy ? 0.6 : 1,
            }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Step pipeline ─────────────────────────────────────────────────── */}
      <StepPipeline step={step} />

      {/* ── Next-action card (context-aware prompt) ───────────────────────── */}
      <AnimatePresence mode="wait">
        {(step === "created" || step === "leads") && (
          <NextActionCard
            key={step}
            step={step}
            campaign={campaign}
            busy={busy}
            findingLeads={findingLeads}
            onStart={() => doAction("start")}
            onPause={() => doAction("pause")}
            onCancel={() => doAction("cancel")}
            onFindLeads={findLeads}
          />
        )}
      </AnimatePresence>

      {/* Find leads success banner */}
      <AnimatePresence>
        {findResult !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              marginBottom: "1.5rem", padding: "0.75rem 1rem", borderRadius: 10,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", gap: "0.5rem",
              fontSize: "0.875rem", color: "#22c55e", fontWeight: 600,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16 }} />
            {findResult} leads imported from Orange Slice — click "Start Campaign" to begin calling.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1px",
        background: "var(--border)", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden", marginBottom: "2rem",
      }}>
        {[
          { icon: Users,       label: "Total Leads",     value: leads.length,              color: "var(--text-primary)",  sub: null },
          { icon: Phone,       label: "Dialed",          value: campaign.total_dialed,      color: "var(--text-primary)",  sub: `of ${campaign.total_targets || leads.length}` },
          { icon: CheckCircle2,label: "Qualified",       value: campaign.total_qualified,   color: "#22c55e",              sub: null },
          { icon: CalendarCheck,label: "Meetings Booked",value: campaign.total_booked,      color: "#818cf8",              sub: null },
          { icon: PhoneCall,   label: "Calling Now",     value: callingLeads.length,        color: callingLeads.length > 0 ? "#FFD33B" : "var(--text-muted)", sub: null },
        ].map(({ icon: Icon, label, value, color, sub }, i) => (
          <div key={i} style={{ background: "var(--bg-surface)", padding: "1rem", textAlign: "center" }}>
            <Icon style={{ width: 16, height: 16, color, margin: "0 auto 0.375rem" }} />
            <div style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.04em", color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: "0.5625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
            {sub && <div style={{ fontSize: "0.5625rem", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Booked meetings highlight ─────────────────────────────────────── */}
      <AnimatePresence>
        {bookedLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: "1.5rem", padding: "1rem 1.25rem", borderRadius: 12,
              background: "rgba(129,140,248,0.07)", border: "1px solid rgba(129,140,248,0.2)",
            }}
          >
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#818cf8", marginBottom: "0.625rem" }}>
              Meetings Booked
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {bookedLeads.map((l) => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <CalendarCheck style={{ width: 13, height: 13, color: "#818cf8", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{l.name}</span>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>— {l.company}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Leads list ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
          Leads
          {leads.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
              ({leads.length})
            </span>
          )}
        </h2>
        {campaign.status !== "running" && (
          <button
            onClick={findLeads}
            disabled={findingLeads || campaign.status === "completed" || campaign.status === "cancelled"}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.3rem 0.75rem", borderRadius: 7,
              background: "rgba(255,211,59,0.1)", color: "#FFD33B",
              border: "1px solid rgba(255,211,59,0.2)",
              fontSize: "0.75rem", fontWeight: 700,
              cursor: findingLeads ? "not-allowed" : "pointer",
              opacity: (campaign.status === "completed" || campaign.status === "cancelled") ? 0.4 : 1,
              fontFamily: "inherit",
            }}
          >
            {findingLeads
              ? <><Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> Searching…</>
              : <><Zap style={{ width: 11, height: 11 }} /> Find More Leads</>
            }
          </button>
        )}
      </div>

      {/* ── Selection action bar ── */}
      <AnimatePresence>
        {selectedInView.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            style={{
              marginBottom: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: 10,
              background: "rgba(255,211,59,0.07)", border: "1px solid rgba(255,211,59,0.25)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {selectedInView.length} selected
              </span>
              <button onClick={() => setSelected(new Set())} style={{
                fontSize: "0.75rem", color: "var(--text-muted)", background: "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
              }}>
                Clear
              </button>
            </div>
            <button
              onClick={callSelected}
              disabled={calling}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.45rem 1rem", borderRadius: 8,
                background: "var(--accent)", color: "#000", border: "none",
                fontSize: "0.8125rem", fontWeight: 700,
                cursor: calling ? "not-allowed" : "pointer", opacity: calling ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {calling
                ? <><Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> Dialing…</>
                : <><PhoneCall style={{ width: 13, height: 13 }} /> Call {selectedInView.length} Selected</>
              }
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {leads.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "4rem 1rem",
          border: "1px solid var(--border-neutral-subtle)", borderRadius: 12,
          background: "var(--bg-neutral-secondary)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "rgba(255,211,59,0.08)", border: "1px solid rgba(255,211,59,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <Zap style={{ width: 20, height: 20, color: "#FFD33B" }} />
          </div>
          <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-neutral-primary)", margin: "0 0 0.375rem", letterSpacing: "-0.02em" }}>
            No leads yet
          </p>
          <p style={{ color: "var(--text-neutral-secondary)", fontSize: "0.8125rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            Click "Find Leads via Orange Slice" to pull freight broker companies from LinkedIn.
          </p>
          <button
            onClick={findLeads} disabled={findingLeads}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.5rem 1.25rem", borderRadius: 8,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {findingLeads
              ? <><Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> Searching…</>
              : <><Zap style={{ width: 13, height: 13 }} /> Find Leads via Orange Slice</>
            }
          </button>
        </div>
      ) : (
        <div style={{
          border: "1px solid var(--border-neutral-secondary)",
          borderRadius: 10, overflowX: "auto", overflowY: "hidden",
          background: "var(--bg-neutral-primary)",
        }}>
          {/* ── Table header ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: LEAD_GRID,
            minWidth: 1020,
            padding: "0 16px",
            height: 40,
            background: "var(--bg-neutral-secondary)",
            borderBottom: COL_LINE,
            alignItems: "stretch",
          }}>
            <div style={{ ...LEAD_CELL, justifyContent: "center", borderRight: COL_LINE }}>
              <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
            </div>
            <div style={{ ...LEAD_CELL, justifyContent: "center", borderRight: COL_LINE, padding: 0 }}>
              <Pencil style={{ width: 12, height: 12, color: "var(--text-neutral-secondary)" }} />
            </div>
            {["Name", "Company", "Phone", "Email", "Location", "Employees", "Status", "Score"].map((h, i, arr) => (
              <div key={h} style={{ ...LEAD_CELL, justifyContent: "center", borderRight: i < arr.length - 1 ? COL_LINE : "none" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                  textTransform: "uppercase", color: "var(--text-neutral-secondary)",
                  textAlign: "center",
                }}>
                  {h}
                </span>
              </div>
            ))}
          </div>

          {/* ── Rows ── */}
          {leads.map((lead, i) => {
            const lsc = leadStatusCfg(lead.status);
            const isCalling  = lead.status === "calling";
            const isBooked   = lead.status === "meeting_booked";
            const isSelected = selected.has(lead.id);

            // status → DS Tag variant
            const tagVariant = (
              lead.status === "meeting_booked" ? "success" :
              lead.status === "qualified"      ? "success" :
              lead.status === "calling"        ? "warning" :
              lead.status === "not_qualified"  ? "error"   :
              lead.status === "no_answer"      ? "neutral" :
              lead.status === "queued"         ? "info"    :
              "neutral"
            ) as "success" | "error" | "warning" | "info" | "neutral";

            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                onClick={() => toggleOne(lead.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: LEAD_GRID,
                  minWidth: 1020,
                  padding: "0 16px",
                  height: 52,
                  cursor: "pointer",
                  borderBottom: i < leads.length - 1 ? COL_LINE : "none",
                  background: isSelected ? "rgba(255,211,59,0.06)"
                             : isCalling ? "rgba(255,211,59,0.03)"
                             : isBooked ? "rgba(34,197,94,0.03)"
                             : "transparent",
                  alignItems: "stretch",
                  transition: "background 0.2s",
                }}
              >
                {/* Select */}
                <div style={{ ...LEAD_CELL, justifyContent: "center", borderRight: COL_LINE }}>
                  <Checkbox checked={isSelected} onChange={() => toggleOne(lead.id)} />
                </div>

                {/* Edit affordance — focuses the row's first editable field */}
                <div style={{ ...LEAD_CELL, justifyContent: "center", borderRight: COL_LINE, padding: 0 }}>
                  <button
                    title="Edit this lead"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById(`lead-name-${lead.id}`)?.focus();
                    }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 24, height: 24, borderRadius: 6, cursor: "pointer",
                      background: "transparent", border: "1px solid var(--border-neutral-subtle)",
                      color: "var(--text-neutral-secondary)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,211,59,0.12)"; e.currentTarget.style.color = "#FFD33B"; e.currentTarget.style.borderColor = "rgba(255,211,59,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-neutral-secondary)"; e.currentTarget.style.borderColor = "var(--border-neutral-subtle)"; }}
                  >
                    <Pencil style={{ width: 12, height: 12 }} />
                  </button>
                </div>

                {/* Name (editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.name || ""} placeholder="Name" center
                    inputId={`lead-name-${lead.id}`}
                    onSave={(v) => updateLeadField(lead.id, "name", v)} />
                </div>

                {/* Company (editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.company || ""} placeholder="Company" center
                    onSave={(v) => updateLeadField(lead.id, "company", v)} />
                </div>

                {/* Phone (editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.phone || ""} placeholder="+1… add #" mono center
                    onSave={(v) => updateLeadField(lead.id, "phone", v)} />
                </div>

                {/* Email / Website (editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.email || ""} placeholder="Email / site" center
                    onSave={(v) => updateLeadField(lead.id, "email", v)} />
                </div>

                {/* Location (role, editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.role || ""} placeholder="Location" center
                    onSave={(v) => updateLeadField(lead.id, "role", v)} />
                </div>

                {/* Employees (notes, editable) */}
                <div style={{ ...LEAD_CELL, borderRight: COL_LINE }} onClick={(e) => e.stopPropagation()}>
                  <EditableCell value={lead.notes || ""} placeholder="—" mono center
                    onSave={(v) => updateLeadField(lead.id, "notes", v)} />
                </div>

                {/* Status */}
                <div onClick={(e) => e.stopPropagation()} style={{ ...LEAD_CELL, justifyContent: "center", borderRight: COL_LINE }}>
                  {isCalling ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <motion.div
                        animate={{ opacity: [1, 0.25, 1] }}
                        transition={{ repeat: Infinity, duration: 1.1 }}
                        style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFD33B", flexShrink: 0 }}
                      />
                      <Tag size="xm" variant="warning">{lsc.label}</Tag>
                    </span>
                  ) : (
                    <Tag size="xm" variant={tagVariant}>{lsc.label}</Tag>
                  )}
                </div>

                {/* Score */}
                <div style={{ ...LEAD_CELL, justifyContent: "center" }}>
                  {lead.qualification_score !== null && lead.qualification_score !== undefined ? (
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: lead.qualification_score >= 7 ? "var(--text-success-primary)"
                           : lead.qualification_score >= 5 ? "#b45309"
                           : "var(--text-error-primary)",
                    }}>
                      {lead.qualification_score}
                      <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-neutral-secondary)" }}>/10</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-neutral-secondary)" }}>—</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
