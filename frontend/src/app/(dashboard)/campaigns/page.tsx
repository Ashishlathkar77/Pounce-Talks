"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import { fetcher, apiFetch } from "@/lib/api";
import { Campaign } from "@/lib/types";
import {
  Phone, CheckCircle2, BarChart3, Users, Play, Pause, X,
  Plus, Megaphone, Zap, ChevronRight, Loader2,
} from "lucide-react";
import Link from "next/link";

// ── Status config ──────────────────────────────────────────────────────────────

function statusCfg(s: Campaign["status"]) {
  const m: Record<Campaign["status"], { label: string; color: string; bg: string }> = {
    draft:     { label: "Draft",     color: "#9ba1ad",  bg: "rgba(155,161,173,0.1)" },
    running:   { label: "Running",   color: "#22c55e",  bg: "rgba(34,197,94,0.12)"  },
    paused:    { label: "Paused",    color: "#FFD33B",  bg: "rgba(255,211,59,0.1)"  },
    completed: { label: "Completed", color: "#818cf8",  bg: "rgba(129,140,248,0.12)"},
    cancelled: { label: "Cancelled", color: "#ef4444",  bg: "rgba(239,68,68,0.1)"  },
  };
  return m[s] ?? m.draft;
}

function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

async function action(path: string) {
  return apiFetch(path, { method: "POST" });
}

// ── Campaign card ──────────────────────────────────────────────────────────────

function CampaignCard({ c, onMutate }: { c: Campaign; onMutate: () => void }) {
  const sc = statusCfg(c.status);
  const [busy, setBusy] = useState(false);

  async function doAction(verb: "start" | "pause" | "cancel") {
    setBusy(true);
    try { await action(`/api/campaigns/${c.id}/${verb}`); onMutate(); }
    catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  const bookRate = pct(c.total_booked, c.total_dialed);
  const progress = pct(c.total_dialed, c.total_targets);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1.25rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <span style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: sc.color,
              background: sc.bg, padding: "0.125rem 0.5rem", borderRadius: 99,
            }}>
              {sc.label}
            </span>
            {c.status === "running" && (
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
            )}
          </div>
          <Link
            href={`/campaigns/${c.id}`}
            style={{
              display: "block",
              fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)",
              letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", textDecoration: "none",
            }}
          >
            {c.name}
          </Link>
          {c.description && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, alignItems: "center" }}>
          {(c.status === "draft" || c.status === "paused") && (
            <button
              onClick={() => doAction("start")} disabled={busy}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.875rem", borderRadius: 8,
                background: "var(--accent)", color: "#000", border: "none",
                fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Play style={{ width: 11, height: 11 }} />
              {c.status === "paused" ? "Resume" : "Start"}
            </button>
          )}
          {c.status === "running" && (
            <button
              onClick={() => doAction("pause")} disabled={busy}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.75rem", borderRadius: 8,
                background: "rgba(255,211,59,0.12)", color: "#FFD33B",
                border: "1px solid rgba(255,211,59,0.2)",
                fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Pause style={{ width: 11, height: 11 }} />
              Pause
            </button>
          )}
          {(c.status === "draft" || c.status === "running" || c.status === "paused") && (
            <button
              onClick={() => doAction("cancel")} disabled={busy}
              style={{
                width: 30, height: 30, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(239,68,68,0.1)", color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.15)", cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          )}
          <Link
            href={`/campaigns/${c.id}`}
            style={{
              width: 30, height: 30, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-elevated)", color: "var(--text-muted)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}
          >
            <ChevronRight style={{ width: 13, height: 13 }} />
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Progress</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            {c.total_dialed} / {c.total_targets || "—"}
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ height: "100%", background: "var(--accent)", borderRadius: 99 }}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)", paddingTop: "0.875rem" }}>
        {[
          { icon: Phone, label: "Dialed", value: c.total_dialed, color: "var(--text-primary)" },
          { icon: CheckCircle2, label: "Booked", value: c.total_booked, color: "#22c55e" },
          { icon: BarChart3, label: "Book Rate", value: `${bookRate}%`, color: bookRate >= 30 ? "#22c55e" : bookRate >= 15 ? "#FFD33B" : "#ef4444" },
          { icon: Users, label: "Targets", value: c.total_targets, color: "var(--text-secondary)" },
        ].map(({ label, value, color }, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.03em", color }}>{value}</div>
            <div style={{ fontSize: "0.5625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Create Campaign Modal ──────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "0.55rem 0.875rem", color: "var(--text-primary)",
    fontSize: "0.875rem", outline: "none", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.6875rem", fontWeight: 700,
    color: "var(--text-muted)", marginBottom: "0.375rem", letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/api/campaigns/", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
    } finally { setLoading(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-neutral-primary)", border: "1px solid var(--border-neutral-subtle)",
          borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(31,31,42,0.16)",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          New Campaign
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Create a campaign, then click "Find Leads" to populate it via Orange Slice.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={lbl}>Campaign Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              style={inp} placeholder="e.g. Hemut — Freight Brokers Q3"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label style={lbl}>Description (optional)</label>
            <input
              value={description} onChange={(e) => setDescription(e.target.value)}
              style={inp} placeholder="Outbound to mid-size freight brokers in the Midwest"
            />
          </div>

          {error && (
            <div style={{ padding: "0.625rem 0.875rem", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.8125rem", color: "#ef4444" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "0.625rem", borderRadius: 8,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-secondary)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
            }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={loading} style={{
              flex: 2, padding: "0.625rem", borderRadius: 8,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.875rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            }}>
              {loading && <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />}
              {loading ? "Creating…" : "Create Campaign"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Find Leads Modal ──────────────────────────────────────────────────────────

function FindLeadsModal({ campaigns, onClose, onDone }: {
  campaigns: Campaign[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; leads: unknown[] } | null>(null);
  const [error, setError] = useState("");

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "0.55rem 0.875rem", color: "var(--text-primary)",
    fontSize: "0.875rem", outline: "none", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.6875rem", fontWeight: 700,
    color: "var(--text-muted)", marginBottom: "0.375rem", letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  async function handleFind() {
    if (!campaignId) { setError("Select a campaign"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await apiFetch<{ created: number; leads: unknown[] }>("/api/orange-slice/find-leads", {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaignId, icp_description: "freight brokers" }),
      });
      setResult(res);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Orange Slice API error");
    } finally { setLoading(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-neutral-primary)", border: "1px solid var(--border-neutral-subtle)",
          borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(31,31,42,0.16)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,211,59,0.12)", border: "1px solid rgba(255,211,59,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap style={{ width: 16, height: 16, color: "#FFD33B" }} />
          </div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            Find Leads via Orange Slice
          </h2>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Queries LinkedIn for freight broker companies (10–500 employees). In demo mode, all calls route to your phone.
        </p>

        {!result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={lbl}>Assign to Campaign</label>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: 8, background: "rgba(255,211,59,0.06)", border: "1px solid rgba(255,211,59,0.12)" }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#FFD33B", marginBottom: "0.375rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>SQL Query</div>
              <code style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", lineHeight: 1.6, display: "block" }}>
                SELECT company_name, first_name, last_name, title, email, phone<br />
                FROM linkedin_company<br />
                WHERE industry IN (&apos;Transportation&apos;, &apos;Freight&apos;...)<br />
                AND employee_count BETWEEN 10 AND 500<br />
                LIMIT 10
              </code>
            </div>

            {error && (
              <div style={{ padding: "0.625rem 0.875rem", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.8125rem", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "0.625rem", borderRadius: 8,
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
              }}>
                Cancel
              </button>
              <button onClick={handleFind} disabled={loading} style={{
                flex: 2, padding: "0.625rem", borderRadius: 8,
                background: loading ? "rgba(255,211,59,0.6)" : "var(--accent)", color: "#000",
                border: "none", fontSize: "0.875rem", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
                {loading ? (
                  <><Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> Searching LinkedIn…</>
                ) : (
                  <><Zap style={{ width: 13, height: 13 }} /> Find Leads</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-0.04em", marginBottom: "0.5rem" }}>
              {result.created}
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              leads imported from Orange Slice
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              All phones routed to demo number — start the campaign to call.
            </div>
            <button onClick={onClose} style={{
              padding: "0.625rem 2rem", borderRadius: 8,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { data, mutate } = useSWR<{ campaigns: Campaign[] }>(
    "/api/campaigns/",
    fetcher,
    { refreshInterval: 5000 }
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showFindLeads, setShowFindLeads] = useState(false);

  const campaigns = data?.campaigns ?? [];
  const running = campaigns.filter((c) => c.status === "running").length;
  const totalDialed = campaigns.reduce((s, c) => s + c.total_dialed, 0);
  const totalBooked = campaigns.reduce((s, c) => s + c.total_booked, 0);

  return (
    <div style={{ padding: "2.5rem 2.5rem 4rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.5rem" }}>
            Outbound
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1, margin: 0 }}>
            Campaigns
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button
            onClick={() => setShowFindLeads(true)}
            disabled={campaigns.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4375rem 0.875rem", borderRadius: 8,
              background: "rgba(255,211,59,0.12)", color: "#FFD33B",
              border: "1px solid rgba(255,211,59,0.2)",
              fontSize: "0.8125rem", fontWeight: 700, cursor: campaigns.length === 0 ? "not-allowed" : "pointer",
              opacity: campaigns.length === 0 ? 0.5 : 1,
            }}
          >
            <Zap style={{ width: 12, height: 12 }} />
            Find Leads
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.4375rem 0.875rem", borderRadius: 8,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus style={{ width: 12, height: 12 }} />
            New Campaign
          </button>
        </div>
      </div>

      {/* Global stats */}
      <div style={{
        display: "flex",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        marginBottom: "2rem", paddingTop: "1.25rem", paddingBottom: "1.25rem",
      }}>
        {[
          { label: "Active Now",    value: running,     color: running > 0 ? "#22c55e" : "var(--text-primary)" },
          { label: "Total Dialed",  value: totalDialed, color: "var(--text-primary)" },
          { label: "Meetings Booked", value: totalBooked, color: "#22c55e" },
          { label: "Campaigns",     value: campaigns.length, color: "var(--text-primary)" },
        ].map(({ label, value, color }, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ fontSize: "clamp(1.5rem, 2vw, 2.5rem)", fontWeight: 900, letterSpacing: "-0.04em", color }}>{value}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Campaigns grid */}
      {campaigns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 0", textAlign: "center" }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "rgba(255,211,59,0.08)", border: "1px solid rgba(255,211,59,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem",
          }}>
            <Megaphone style={{ width: 28, height: 28, color: "#FFD33B" }} />
          </div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "0.5rem", margin: "0 0 0.5rem" }}>
            No campaigns yet
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.65, margin: "0 0 1.5rem" }}>
            Create a campaign, then use "Find Leads" to pull freight broker contacts from Orange Slice — Pounce calls them automatically.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.625rem 1.25rem", borderRadius: 10,
              background: "var(--accent)", color: "#000", border: "none",
              fontSize: "0.875rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Create your first campaign
          </button>
        </motion.div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} c={c} onMutate={() => mutate()} />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal onClose={() => setShowCreate(false)} onCreated={() => mutate()} />
        )}
        {showFindLeads && (
          <FindLeadsModal
            campaigns={campaigns.filter((c) => ["draft", "paused"].includes(c.status))}
            onClose={() => setShowFindLeads(false)}
            onDone={() => { mutate(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
