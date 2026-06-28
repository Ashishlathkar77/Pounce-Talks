"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Surface,
  Stack,
  Tag,
  Icon,
  KpiCard,
  Tabs,
  PageHeader as DSPageHeader,
} from "@hemut2025/design-system";
import type { TagProps, TabItem } from "@hemut2025/design-system";
import { PanelHeader, Section, CodeBlock, KeyValueGrid } from "@/components/panels/panel-ui";

// ── Tab definitions ──────────────────────────────────────────────────────────
//
// The Guide page collects the product/onboarding docs that used to live as
// tabs inside Settings. They're informational, not configuration, so they have
// their own home here while Settings stays focused on workspace config.

type TabId = "getting-started" | "use-cases" | "voice-pipeline";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "getting-started", label: "Getting Started", icon: "book-open"  },
  { id: "use-cases",       label: "Use Cases",       icon: "git-branch" },
  { id: "voice-pipeline",  label: "Voice Pipeline",  icon: "microphone" },
];

const TAB_ITEMS: TabItem[] = TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }));

// ── Content: Getting Started ──────────────────────────────────────────────────

interface SetupStep { n: number; title: string; desc: string; code?: string }

const SETUP_STEPS: SetupStep[] = [
  {
    n: 1,
    title: "Create an account & workspace",
    desc: "Sign up at converse.ai or use your invite link. Each workspace maps to one freight brokerage or carrier company. You'll get a free trial with 100 call minutes.",
  },
  {
    n: 2,
    title: "Connect your TMS",
    desc: "Go to Settings → TMS Setup. Enter your McLeod PowerBroker credentials (OAuth2 client_id + secret) or Samsara API key. Converse will auto-test the connection.",
    code: "$ curl -X GET /api/tms/ping → {status: connected, adapter: mcleod}",
  },
  {
    n: 3,
    title: "Add a Twilio phone number",
    desc: "In Settings → Integrations, enter your Twilio Account SID, Auth Token, and a phone number. This is the number callers will reach (or that Converse will call from for outbound).",
  },
  {
    n: 4,
    title: "Pick a template & configure your agent",
    desc: "Go to Templates, pick one of the 7 pre-built workflows (Carrier Sales is recommended first). Click 'Use Template' to create an agent. Edit the system prompt and node settings as needed.",
  },
  {
    n: 5,
    title: "Test a call, go live",
    desc: "Click 'Test Call' on your agent — Converse will call you. Verify the workflow works end to end. Flip the agent to 'Active'. All calls to your Twilio number now route to the AI agent.",
    code: "$ Status: ACTIVE → calls routing to converse-agent-id-xxxx",
  },
];

/**
 * StepRow — one node in the quickstart timeline. The left column holds a
 * numbered badge and a connector rail that runs down to the next node (drawn
 * for every step but the last). The final "go live" step is tinted green to
 * read as the finish line.
 */
function StepRow({ step, isLast }: { step: SetupStep; isLast: boolean }) {
  const done = isLast; // last step = "go live" → success tint
  // Semantic (theme-aware) tokens so the badges flip correctly in dark mode.
  const badgeBg     = done ? "var(--bg-success-subtle)"      : "var(--bg-brand-subtle)";
  const badgeBorder = done ? "var(--border-success-primary)" : "var(--border-brand-primary)";
  const badgeText   = done ? "var(--text-success-primary)"   : "var(--text-brand-primary)";

  return (
    <div style={{ display: "flex", gap: 14 }}>
      {/* Rail column — badge + connector line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 999,
          background: badgeBg,
          border: `1px solid ${badgeBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {done
            ? <Icon name="check" size="sm" style={{ color: badgeText }} />
            : <span style={{ fontSize: 12, fontWeight: 700, color: badgeText }}>
                {String(step.n).padStart(2, "0")}
              </span>}
        </div>
        {!isLast && (
          <div style={{ flex: 1, width: 2, background: "var(--border-neutral-subtle)", marginTop: 2 }} />
        )}
      </div>

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 20 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: "var(--text-neutral-primary)",
          letterSpacing: "-0.01em", marginBottom: 4, paddingTop: 5,
        }}>
          {step.title}
        </div>
        <div style={{
          fontSize: 12.5, color: "var(--text-neutral-secondary)",
          lineHeight: 1.6, marginBottom: step.code ? 8 : 0,
        }}>
          {step.desc}
        </div>
        {step.code && <CodeBlock>{step.code}</CodeBlock>}
      </div>
    </div>
  );
}

function GettingStartedPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="Deploy your first voice agent"
        description="Converse turns your freight operations on autopilot — carrier calls, driver check-ins, shipper updates, all handled by AI. Follow these steps to go live."
      />

      <Stack gap="md">
        <Section title="5-step quickstart" description="Setup typically takes 20–30 minutes end-to-end.">
          <div>
            {SETUP_STEPS.map((s, i) => (
              <StepRow key={s.n} step={s} isLast={i === SETUP_STEPS.length - 1} />
            ))}
          </div>
        </Section>

        <Section
          title="Architecture overview"
          description="Voice traffic flows through Twilio → LiveKit → Agent Worker, with three swappable model layers."
        >
          <CodeBlock>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--green-500)", fontWeight: 600 }}>CALLER</span>
              <span style={{ color: "var(--text-neutral-tertiary)" }}> → </span>
              Twilio SIP Trunk
              <span style={{ color: "var(--text-neutral-tertiary)" }}> → </span>
              LiveKit Cloud (~60ms)
              <span style={{ color: "var(--text-neutral-tertiary)" }}> → </span>
              Agent Worker
            </div>
            <Stack gap="none">
              {[
                ["STT",  "Deepgram Nova-3",  "best WER for freight terminology"],
                ["LLM",  "GPT-4.1-mini",     "400–700ms TTFT, $0.045/min total"],
                ["TTS",  "Cartesia Sonic-3", "90ms TTFA, 80+ voices"],
                ["GATE", "CallState machine", "max_buy never in LLM context"],
              ].map(([k, v, hint]) => (
                <div key={k} style={{ display: "flex", gap: 12, lineHeight: 1.9 }}>
                  <span style={{ color: "var(--text-neutral-tertiary)", width: 50, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: "var(--text-neutral-primary)", width: 170, flexShrink: 0 }}>{v}</span>
                  <span style={{ color: "var(--text-neutral-tertiary)" }}>{`// ${hint}`}</span>
                </div>
              ))}
            </Stack>
          </CodeBlock>
        </Section>

        <Section
          title="Cost & performance"
          description="All-in cost per minute and average voice latency for the default pipeline."
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <KpiCard
              icon="currency-dollar"
              tone="success"
              label="Cost per minute"
              value="$0.045–0.057"
              helperText="All-in (STT · LLM · TTS)"
            />
            <KpiCard
              icon="gauge"
              tone="info"
              label="Voice latency"
              value="~410ms"
              helperText="TTFT + TTS end-to-end"
            />
            <KpiCard
              icon="lightning"
              tone="brand"
              label="Powered by"
              value="Hemut"
              helperText="Freight tech infrastructure"
            />
          </div>
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Content: Use Cases ────────────────────────────────────────────────────────

interface UseCase {
  id: string;
  iconName: string;
  label: string;
  tag: string;
  tagVariant: NonNullable<TagProps["variant"]>;
  headline: string;
  desc: string;
  flow: ReadonlyArray<{ step: string; note: string }>;
  config: ReadonlyArray<readonly [string, string]>;
  highlight: string;
}

const USE_CASES: ReadonlyArray<UseCase> = [
  {
    id: "carrier-sales",
    iconName: "truck",
    label: "Carrier Sales",
    tag: "Inbound",
    tagVariant: "info",
    headline: "24/7 inbound carrier call handling",
    desc: "When a carrier calls asking about a load, Converse verifies their MC#, looks up the load in your TMS, quotes the posted rate, negotiates automatically, and books — without a human dispatcher.",
    flow: [
      { step: "Carrier calls your Twilio number", note: "" },
      { step: "Converse greets, asks for MC number", note: "" },
      { step: "verify_carrier(mc) → Highway API", note: "Gate 1: max 3 attempts" },
      { step: "Ask for load reference number", note: "" },
      { step: "find_load(ref) → TMS lookup", note: "Gate 2: requires Gate 1" },
      { step: "Quote posted rate", note: "LLM generates natural language" },
      { step: "negotiate_rate() — 3-round engine", note: "90% → 95% → 100% of max_buy" },
      { step: "book_load() or transfer_to_human()", note: "Gate 3: accepted + verified" },
    ],
    config: [
      ["template",     "carrier_sales"],
      ["direction",    "inbound"],
      ["tms_required", "true"],
      ["highway_api",  "required for carrier verify"],
      ["avg_duration", "3–5 min"],
      ["booking_rate", "target: >35%"],
    ],
    highlight: "Security: max_buy NEVER sent to LLM context. Pure Python negotiation engine only.",
  },
  {
    id: "driver-eta",
    iconName: "map-pin",
    label: "Driver ETA Check",
    tag: "Inbound + Outbound",
    tagVariant: "success",
    headline: "Automated driver location & ETA updates",
    desc: "Converse calls drivers to get their current location and estimated arrival time, then writes the ETA back to your TMS automatically. Also handles inbound calls from drivers reporting their status.",
    flow: [
      { step: "Outbound: Converse dials the driver's number", note: "or inbound driver calls in" },
      { step: "AI greets, identifies the load/trip", note: "" },
      { step: "capture_location(location, load_id)", note: "extracts city/state from speech" },
      { step: "Calculate ETA from location + TMS route", note: "" },
      { step: "update_eta(load_id, eta_min, location)", note: "writes back to TMS" },
      { step: "Notify shipper if late (optional webhook)", note: "" },
    ],
    config: [
      ["template",     "driver_eta"],
      ["direction",    "both"],
      ["tms_required", "true"],
      ["avg_duration", "1–2 min"],
      ["check_calls",  "target: 2–3 per load"],
    ],
    highlight: "Reduces dispatcher check-call workload by ~80%. Runs on schedule or event-triggered.",
  },
  {
    id: "customer-eta",
    iconName: "users",
    label: "Customer ETA Update",
    tag: "Outbound",
    tagVariant: "warning",
    headline: "Proactive shipper status notifications",
    desc: "Converse calls your shippers/customers with proactive ETA updates, keeping them informed without dispatcher involvement. Triggered by TMS events or a schedule.",
    flow: [
      { step: "TMS event triggers outbound call", note: "or manual campaign" },
      { step: "Converse calls shipper contact number", note: "" },
      { step: "Greets, identifies the shipment by ref#", note: "" },
      { step: "Reads ETA from TMS (pulled at call time)", note: "" },
      { step: "Answers questions about delivery", note: "LLM handles natural Q&A" },
      { step: "Logs interaction to TMS + webhook", note: "" },
    ],
    config: [
      ["template",     "customer_eta"],
      ["direction",    "outbound"],
      ["tms_required", "true"],
      ["avg_duration", "1–3 min"],
      ["trigger",      "tms webhook or campaign schedule"],
    ],
    highlight: "Works with Campaigns feature. Schedule daily ETA updates for all active loads.",
  },
  {
    id: "receptionist",
    iconName: "phone",
    label: "AI Receptionist",
    tag: "Inbound",
    tagVariant: "brand",
    headline: "Smart call routing & intake",
    desc: "Converse answers all inbound calls, identifies the caller's intent (carrier inquiring about load, driver with delivery issue, shipper asking for status), and routes them to the right department or agent.",
    flow: [
      { step: "Call arrives on main company number", note: "" },
      { step: "Converse greets: \"You've reached [Company]\"", note: "" },
      { step: "Classify intent: carrier / driver / shipper", note: "LLM classify node" },
      { step: "Gather key info based on intent", note: "extract MC#, load ref, etc." },
      { step: "transfer_to_human(dept) or route to agent", note: "" },
      { step: "Log intake data to TMS before transfer", note: "" },
    ],
    config: [
      ["template",     "receptionist"],
      ["direction",    "inbound"],
      ["tms_required", "optional"],
      ["avg_duration", "1–2 min"],
      ["routing",      "SIP REFER warm transfer"],
    ],
    highlight: "Eliminates hold times. Every call answered instantly, screened, and routed correctly.",
  },
];

function UseCaseCard({ uc, expanded, onToggle }: {
  uc: UseCase;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Surface variant="primary" padding="none" radius="lg" border="primary" shadow="none">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: "100%", textAlign: "left",
          background: expanded ? "var(--bg-neutral-secondary)" : "transparent",
          border: "none",
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
          fontFamily: "inherit",
          transition: "background 0.14s",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: expanded ? "var(--bg-brand-subtle)" : "var(--bg-neutral-secondary)",
          border: `1px solid ${expanded ? "var(--border-brand-primary)" : "var(--border-neutral-subtle)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          color: expanded ? "var(--icon-brand-primary)" : "var(--text-neutral-secondary)",
          transition: "background 0.14s, border-color 0.14s, color 0.14s",
        }}>
          <Icon name={uc.iconName} size="sm" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: "var(--text-neutral-primary)", letterSpacing: "-0.01em",
            }}>
              {uc.label}
            </span>
            <Tag size="sm" variant={uc.tagVariant}>{uc.tag}</Tag>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-neutral-secondary)" }}>{uc.headline}</div>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ color: "var(--text-neutral-tertiary)", flexShrink: 0, display: "flex" }}
        >
          <Icon name="caret-right" size="sm" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "0 16px 16px",
              borderTop: "1px solid var(--border-neutral-subtle)",
            }}>
              <div style={{ paddingTop: 14 }}>
                <p style={{
                  fontSize: 13, color: "var(--text-neutral-secondary)",
                  lineHeight: 1.65, margin: "0 0 16px",
                }}>
                  {uc.desc}
                </p>

                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, color: "var(--text-neutral-tertiary)",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    fontWeight: 600, marginBottom: 10,
                  }}>
                    Call flow
                  </div>
                  {/* Connected mini-timeline — shares the rail/dot language with
                      the Getting Started quickstart so the tabs read as one
                      system. Dots + connectors use theme-aware neutral tokens. */}
                  <div>
                    {uc.flow.map((f, i) => {
                      const last = i === uc.flow.length - 1;
                      return (
                        <div key={i} style={{ display: "flex", gap: 10 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div style={{
                              width: 7, height: 7, borderRadius: 999,
                              background: "var(--icon-neutral-secondary)",
                              marginTop: 6,
                            }} />
                            {!last && (
                              <div style={{ flex: 1, width: 2, background: "var(--border-neutral-subtle)", marginTop: 3 }} />
                            )}
                          </div>
                          <div style={{
                            flex: 1, minWidth: 0,
                            paddingBottom: last ? 0 : 9,
                            display: "flex", gap: 10, alignItems: "baseline",
                            justifyContent: "space-between",
                          }}>
                            <span style={{ fontSize: 13, color: "var(--text-neutral-primary)", lineHeight: 1.4 }}>
                              {f.step}
                            </span>
                            {f.note && (
                              <span style={{
                                fontSize: 11.5, color: "var(--text-neutral-tertiary)",
                                flexShrink: 0, textAlign: "right",
                              }}>
                                {f.note}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11, color: "var(--text-neutral-tertiary)",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    fontWeight: 600, marginBottom: 8,
                  }}>
                    Agent config
                  </div>
                  <KeyValueGrid rows={uc.config} labelWidth={120} />
                </div>

                <div style={{
                  padding: "10px 12px",
                  background: "var(--bg-brand-subtle)",
                  border: "1px solid var(--border-brand-primary)",
                  borderRadius: 8,
                  fontSize: 12.5, color: "var(--text-neutral-secondary)",
                  lineHeight: 1.6,
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <span style={{ color: "var(--icon-brand-primary)", flexShrink: 0, display: "flex", paddingTop: 1 }}>
                    <Icon name="lightning" size="sm" />
                  </span>
                  <span>{uc.highlight}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}

function UseCasesPanel() {
  const [expanded, setExpanded] = useState<string>("carrier-sales");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="4 Core Workflows"
        description="Each workflow is a pre-built agent template. Click a card to see the full call flow, configuration, and setup notes."
      />

      <Stack gap="sm">
        {USE_CASES.map((uc) => (
          <UseCaseCard
            key={uc.id}
            uc={uc}
            expanded={expanded === uc.id}
            onToggle={() => setExpanded(expanded === uc.id ? "" : uc.id)}
          />
        ))}
      </Stack>

      <div style={{ height: 16 }} />

      <Section
        title="Enterprise (FDE)"
        description="10-day white-glove onboarding for custom workflows."
        headerActions={<Tag size="sm" variant="brand">Contact sales</Tag>}
      >
        <div style={{ fontSize: 13, color: "var(--text-neutral-secondary)", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 12px" }}>
            <strong style={{ color: "var(--text-neutral-primary)", fontWeight: 600 }}>
              FDE (Full-Deployment Enterprise)
            </strong>{" "}
            agents are custom-built from scratch, including:
          </p>
          <Stack gap="xs">
            {[
              "Voice cloning from a 30-second sample (ElevenLabs Flash v2.5)",
              "Custom node graph: any combination of AI Conversation, Extract, Classify, Action, Webhook nodes",
              "Direct McLeod DFMR certification & deep TMS integration",
              "Custom negotiation parameters (max_buy per lane, carrier tier)",
              "SLA monitoring + Hemut tracking backend integration via API",
              "Dedicated account manager + Slack support channel",
            ].map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--brand-500)", flexShrink: 0, paddingTop: 2 }}>
                  <Icon name="caret-right" size="xs" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </Stack>
          <div style={{ marginTop: 14 }}>
            <CodeBlock>
              <span style={{ color: "var(--text-neutral-tertiary)" }}>Contact: </span>
              <span style={{ color: "var(--brand-500)" }}>sales@converse.ai</span>
              <span style={{ color: "var(--text-neutral-tertiary)" }}> — or book via /settings → support</span>
            </CodeBlock>
          </div>
        </div>
      </Section>
    </motion.div>
  );
}

// ── Content: Voice Pipeline ───────────────────────────────────────────────────

interface PipelineLayer {
  layer: string;
  name: string;
  note: string;
  latency: string;
  variant: NonNullable<TagProps["variant"]>;
}

const PIPELINE: ReadonlyArray<PipelineLayer> = [
  { layer: "Telephony",     name: "Twilio SIP Trunk",  note: "Industry standard. Handles all carrier-grade telephony.",    latency: "PSTN",       variant: "error"   },
  { layer: "Orchestration", name: "LiveKit Cloud",     note: "1 worker per call, no vendor lock-in. Barge-in via CNN.",    latency: "~60ms",      variant: "info"    },
  { layer: "STT",           name: "Deepgram Nova-3",   note: "Best WER for freight terminology (MC#, load refs, cities).", latency: "300ms",      variant: "success" },
  { layer: "LLM (primary)", name: "GPT-4.1-mini",      note: "Handles all natural language. Never sees max_buy.",          latency: "400–700ms",  variant: "info"    },
  { layer: "LLM (filler)",  name: "GPT-4.1-nano",      note: "\"Let me check on that…\" while primary LLM processes.",     latency: "~200ms",     variant: "warning" },
  { layer: "TTS",           name: "Cartesia Sonic-3",  note: "Default TTS. FDE option: ElevenLabs Flash v2.5 (clone).",    latency: "90ms",       variant: "success" },
];

function VoicePipelinePanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="3-layer architecture"
        description="Why not duplex models (OpenAI Realtime, Gemini Live): 7–15s latency spikes on PSTN. Unusable for phone calls."
      />

      <Stack gap="md">
        <Section title="Pipeline layers" description="Each layer is independently swappable.">
          <Stack gap="none">
            {PIPELINE.map((p, i) => (
              <div
                key={p.layer}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 180px 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-neutral-subtle)",
                }}
              >
                <span style={{
                  fontSize: 11, color: "var(--text-neutral-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
                }}>{p.layer}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)" }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text-neutral-secondary)" }}>
                  {p.note}
                </span>
                <Tag size="sm" variant={p.variant}>{p.latency}</Tag>
              </div>
            ))}
          </Stack>
        </Section>

        <Section title="Security rules" description="Hard boundaries enforced in code, not just policy.">
          <Stack gap="md">
            {[
              { rule: "max_buy isolation",  detail: "CallState.to_llm_context() + LoadInfo.to_llm_context() both explicitly exclude max_buy. Verified by unit test test_max_buy_not_in_llm_context." },
              { rule: "Webhook validation", detail: "Twilio RequestValidator on all /webhooks/twilio/* routes. Rejects spoofed requests." },
              { rule: "JWT auth",           detail: "All API routes require Authorization: Bearer {token} except /health, /webhooks/*, /api/auth/login." },
              { rule: "MC hash storage",    detail: "CallState logs sha256(mc)[:16] not raw MC number. Never stored in plaintext." },
              { rule: "Session TTL",        detail: "Redis session expires after 4 hours max. No persistent call state." },
            ].map(({ rule, detail }) => (
              <div key={rule} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Tag size="sm" variant="success">RULE</Tag>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)" }}>
                    {rule}
                  </div>
                  <div style={{
                    fontSize: 12.5, color: "var(--text-neutral-secondary)",
                    lineHeight: 1.55, marginTop: 2,
                  }}>
                    {detail}
                  </div>
                </div>
              </div>
            ))}
          </Stack>
        </Section>

        <Section title="Negotiation engine" description="Pure-Python rate negotiation — never delegated to the LLM.">
          <KeyValueGrid
            rows={[
              ["Attempt 1", "counter at 90% of max_buy, round to $25"],
              ["Attempt 2", "counter at 95% of max_buy, round to $25"],
              ["Attempt 3", "counter at 100% of max_buy, round to $25"],
              ["Any time",  "if caller_offer <= max_buy: accept immediately"],
              ["After 3",   "if still no deal: decline + transfer_to_human()"],
            ]}
            labelWidth={100}
          />
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PANEL_MAP: Record<TabId, React.ComponentType> = {
  "getting-started": GettingStartedPanel,
  "use-cases":       UseCasesPanel,
  "voice-pipeline":  VoicePipelinePanel,
};

export default function GuidePage() {
  const [active, setActive] = useState<TabId>("getting-started");

  const ActivePanel = PANEL_MAP[active];

  return (
    <div
      className="converse-fullbleed-page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-neutral-secondary)",
      }}
    >
      <DSPageHeader
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title="Guide"
        info="Product docs — onboarding, core workflows, and the voice pipeline."
      />

      <div style={{
        flexShrink: 0,
        background: "var(--bg-neutral-secondary)",
      }}>
        <Tabs
          variant="primary"
          ariaLabel="Guide sections"
          items={TAB_ITEMS}
          value={active}
          onChange={(id) => setActive(id as TabId)}
        />
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "24px 20px 32px",
        background: "var(--bg-neutral-secondary)",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            <ActivePanel key={active} />
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
