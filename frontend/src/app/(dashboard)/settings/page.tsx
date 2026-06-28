"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import TeamMembers from "@/components/team/TeamMembers";
import {
  Surface,
  Stack,
  Tag,
  Button,
  Icon,
  Input,
  Toggle,
  Tabs,
  PageHeader as DSPageHeader,
} from "@hemut2025/design-system";
import type { TabItem } from "@hemut2025/design-system";
import { PanelHeader, Section, StatusDot, KeyValueGrid } from "@/components/panels/panel-ui";
import {
  createTransferDestination,
  deleteTransferDestination,
  fetcher,
  getAgents,
  listTransferDestinations,
  pingTMS,
  setOutboundTrunk,
  updateTransferDestination,
} from "@/lib/api";
import type {
  AgentConfig,
  AgentType,
  TransferDestination,
} from "@/lib/types";
import { useAuthStore } from "@/lib/store";
import { agentTypeLabel } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import ApiKeysManager from "@/components/api-keys/ApiKeysManager";

// ── Tab definitions ──────────────────────────────────────────────────────────

type TabId =
  | "tms-setup"
  | "transfer-routing"
  | "integrations"
  | "api-keys"
  | "team";

interface Tab {
  id: TabId;
  label: string;
  sub: string;
  /** Phosphor slug — resolved by the DS `Icon` component. */
  icon: string;
}

const TABS: Tab[] = [
  { id: "tms-setup",        label: "TMS Setup",         sub: "McLeod · Samsara",   icon: "database"        },
  { id: "transfer-routing", label: "Transfer Routing",  sub: "Phone numbers",       icon: "phone-outgoing"  },
  { id: "integrations",     label: "Integrations",      sub: "API status",          icon: "plugs-connected" },
  { id: "api-keys",         label: "API Keys",          sub: "Credentials",         icon: "shield-check"    },
  { id: "team",             label: "Team",              sub: "Members & invites",   icon: "users-three"     },
];

/** DS Tabs items — derived from TABS so the primary tab bar and the panel
 *  registry stay in lock-step. Icon + label only (the `sub` line was a rail
 *  affordance; horizontal tabs read cleaner without it). */
const TAB_ITEMS: TabItem[] = TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }));

// ── Content: TMS Setup ────────────────────────────────────────────────────────

function TmsSetupPanel() {
  const [tested, setTested] = useState<null | "ok" | "fail" | "loading">(null);

  async function handlePing() {
    setTested("loading");
    try {
      await pingTMS();
      setTested("ok");
    } catch {
      setTested("fail");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="TMS integrations"
        description="Converse connects to your TMS to look up loads, book carriers, and write ETA updates. All communication is over HTTP — no direct database access."
      />

      <Stack gap="md">
        {/* McLeod */}
        <Section
          title="McLeod PowerBroker"
          description="OAuth2 client credentials flow. Tokens cached in Redis with TTL matching expiry. ~40% US freight broker market."
          headerActions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot status="ok" />
              <Tag size="sm" variant="success">Connected</Tag>
              <Tag size="sm" variant="brand">P0</Tag>
            </div>
          }
        >
          <KeyValueGrid
            rows={[
              ["MCLEOD_BASE_URL",      "https://your-instance.mcleod.com/api"],
              ["MCLEOD_CLIENT_ID",     "your_client_id"],
              ["MCLEOD_CLIENT_SECRET", "your_client_secret"],
            ]}
            labelWidth={210}
          />

          <div style={{
            fontSize: 12, color: "var(--text-neutral-tertiary)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--text-neutral-secondary)", fontWeight: 600 }}>
              Capabilities:
            </strong>{" "}
            find_load() · book_load() · get_load_status() · update_eta() · health_check()
          </div>

          <div>
            <Button
              variant={tested === "ok" ? "outline" : tested === "fail" ? "outline" : "primary"}
              tone={tested === "fail" ? "destructive" : "neutral"}
              size="sm"
              onClick={handlePing}
              disabled={tested === "loading"}
              loading={tested === "loading"}
              leftIcon={
                tested === "ok"   ? "check-circle" :
                tested === "fail" ? "x-circle" :
                                    "arrows-clockwise"
              }
            >
              {tested === "loading" ? "Testing…" :
               tested === "ok"      ? "Connected" :
               tested === "fail"    ? "Connection failed — retry" :
                                      "Test connection"}
            </Button>
          </div>
        </Section>

        {/* Samsara */}
        <Section
          title="Samsara"
          description="API key authentication. Used for ELD data, GPS location, and driver check-in workflows."
          headerActions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot status="warn" />
              <Tag size="sm" variant="warning">Not configured</Tag>
            </div>
          }
        >
          <KeyValueGrid rows={[["SAMSARA_API_KEY", "your_samsara_api_key"]]} labelWidth={170} />
        </Section>

        {/* Hemut Tracking */}
        <Section
          title="Hemut Tracking Backend"
          description="API-only integration. Converse NEVER connects directly to the Hemut database — all access goes through published HTTP endpoints."
          headerActions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot status="ok" />
              <Tag size="sm" variant="success">Connected</Tag>
            </div>
          }
        >
          <KeyValueGrid
            rows={[
              ["Base URL",  "https://api.hemut.com (configured per env)"],
              ["Auth",      "Bearer token from Hemut API key"],
              ["Endpoints", "POST /tracking/eta · GET /loads/{id} · POST /events"],
            ]}
            labelWidth={120}
          />

          <div style={{
            padding: "10px 12px",
            background: "var(--bg-error-subtle)",
            border: "1px solid var(--border-error-primary)",
            borderRadius: 8,
            fontSize: 12.5, color: "var(--text-error-primary)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="prohibit" size="sm" />
            <span>No direct DB access to Hemut PROD, QA, MCP, or any customer DB — ever.</span>
          </div>
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Content: Integrations ─────────────────────────────────────────────────────

interface Integration {
  name: string;
  type: string;
  ok: boolean;
  detail: string;
  iconName: string;
}

const INTEGRATIONS: ReadonlyArray<Integration> = [
  { name: "Deepgram",    type: "Speech-to-Text",     ok: true,  detail: "Nova-3 · 300ms endpointing",        iconName: "microphone"    },
  { name: "Cartesia",    type: "Text-to-Speech",     ok: true,  detail: "Sonic-3 · 90ms TTFA",               iconName: "speaker-high"  },
  { name: "ElevenLabs",  type: "Voice Clone (FDE)",  ok: true,  detail: "Flash v2.5 · 75ms latency",         iconName: "magic-wand"    },
  { name: "Highway API", type: "Carrier Verify",     ok: false, detail: "MC# verification — not configured", iconName: "shield-check"  },
  { name: "OpenAI",      type: "LLM",                ok: true,  detail: "GPT-4.1-mini · 400–700ms TTFT",     iconName: "lightning"     },
  { name: "LiveKit",     type: "Orchestration",      ok: true,  detail: "Cloud · ~60ms RTT · 3 workers",     iconName: "broadcast"     },
  { name: "Twilio",      type: "Telephony",          ok: true,  detail: "SIP Trunk · PSTN",                  iconName: "phone"         },
];

// ── Content: Transfer Routing ────────────────────────────────────────────────
//
// Lets a customer configure per-AGENT warm-transfer destinations and an
// optional outbound SIP trunk override. Backend resolver (3-tier hierarchy:
// agent_config > agent_type > catch-all) lives in
// backend/app/services/transfer_routing.py; this panel exposes Tier 1
// (per-agent override, primary surface) + Tier 3 (customer catch-all).
// Tier 2 (per-agent_type) is still resolvable server-side but isn't
// authored here — most customers have at most a handful of agents and
// addressing them by name is clearer than addressing by type, especially
// when the customer has multiple agents of the same type.

interface RowDraft {
  /** Canonical E.164 value persisted to the backend (dialCode + national). */
  phone: string;
  /** Presentational only — drives the DS phone-input country picker. */
  country: string;
  dialCode: string;
  extension: string;
  active: boolean;
}

/** E.164: leading +, first digit 1–9, total 8–15 digits. Mirrors the
 *  Pydantic regex used by the backend so we surface validation errors at
 *  the same place. */
const E164_RE = /^\+[1-9]\d{1,14}$/;

// The DS phone input stores national digits + a separate country, but the
// backend stores/validates E.164. We default to US (+1) — a US-freight product
// — and re-derive the E.164 string on every edit. A stored non-US number still
// shows until the user re-picks its country from the input's flag menu.
const DEFAULT_DIAL_CODE = "+1";
const DEFAULT_COUNTRY = "US";

/** National (subscriber) digits for the phone input's `value`, derived by
 *  stripping the dial-code prefix off the E.164 string. */
function nationalDigits(phone: string, dialCode: string = DEFAULT_DIAL_CODE): string {
  if (!phone) return "";
  if (dialCode && phone.startsWith(dialCode)) return phone.slice(dialCode.length);
  return phone.replace(/^\+/, "");
}

function rowFromDestination(d: TransferDestination | undefined): RowDraft {
  return {
    phone:     d?.phone_e164 ?? "",
    country:   DEFAULT_COUNTRY,
    dialCode:  DEFAULT_DIAL_CODE,
    extension: d?.extension ?? "",
    active:    d?.active ?? true,
  };
}

// Country/dialCode are presentational and derived from `phone`, so dirty
// detection only compares the canonical persisted fields.
function rowEquals(a: RowDraft, b: RowDraft): boolean {
  return a.phone === b.phone && a.extension === b.extension && a.active === b.active;
}

interface DestinationRowProps {
  scopeKey: string;                          // "catchall" or agent_type slug
  rowLabel: string;                          // display name
  description?: string;
  existing: TransferDestination | undefined;
  draft: RowDraft;
  onDraftChange: (next: RowDraft) => void;
  onSave: () => Promise<void>;
  onClear: () => Promise<void>;
  saving: boolean;
  /** Render as a flush table row (no card wrapper, no per-input labels) — the
   *  parent supplies the container, column headers, and row dividers. */
  flush?: boolean;
}

// Shared column template so the header row and every data row align exactly:
// Agent · Phone · Extension · Active · Actions.
const ROW_GRID = "minmax(0, 1.3fr) minmax(150px, 1.5fr) 92px 56px 116px";

/** Column-header strip rendered once above a list of flush DestinationRows. */
function DestinationHeader() {
  const cell = {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
    textTransform: "uppercase" as const, color: "var(--text-neutral-tertiary)",
  };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: ROW_GRID, gap: 12,
      padding: "0 14px 8px", alignItems: "center",
    }}>
      <span style={cell}>Agent</span>
      <span style={cell}>Phone</span>
      <span style={cell}>Extension</span>
      <span style={{ ...cell, textAlign: "center" }}>Active</span>
      <span />
    </div>
  );
}

function DestinationRow({
  scopeKey, rowLabel, description, existing, draft, onDraftChange, onSave, onClear, saving, flush,
}: DestinationRowProps) {
  const base = rowFromDestination(existing);
  const dirty = !rowEquals(base, draft);
  const phoneValid = draft.phone === "" || E164_RE.test(draft.phone);
  const canSave = dirty && phoneValid && !saving && draft.phone !== "";
  const canClear = !!existing && !saving;

  // Fall back to the US defaults so a draft missing the presentational
  // country/dialCode (e.g. preserved across a hot-reload) never crashes.
  const dialCode = draft.dialCode ?? DEFAULT_DIAL_CODE;
  const country = draft.country ?? DEFAULT_COUNTRY;

  // Only the validation error is surfaced (the "leave empty to clear" hint was
  // redundant with the trash button). Rendered on its own line below the grid.
  const captionText =
    !phoneValid && draft.phone !== ""
      ? "Use E.164 format, e.g. +14155550100"
      : "";

  const body = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: ROW_GRID, gap: 12, alignItems: flush ? "center" : "end" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowLabel}</div>
          {description && (
            <div style={{ fontSize: 11.5, color: "var(--text-neutral-tertiary)", marginTop: 2 }}>{description}</div>
          )}
        </div>
        <Input
          kind="phone"
          size="md"
          label={flush ? undefined : "Phone"}
          placeholder="(555) 555-0100"
          country={country}
          value={nationalDigits(draft.phone, dialCode)}
          status={captionText ? "error" : "default"}
          onChange={(_e, meta) => {
            const national = meta?.rawValue ?? "";
            onDraftChange({ ...draft, country, dialCode, phone: national ? dialCode + national : "" });
          }}
          onCountryChange={(c) => {
            const national = nationalDigits(draft.phone, dialCode);
            onDraftChange({
              ...draft,
              country: c.code,
              dialCode: c.dialCode,
              phone: national ? c.dialCode + national : "",
            });
          }}
        />
        <Input
          kind="text"
          size="md"
          label={flush ? undefined : "Extension"}
          placeholder="opt"
          value={draft.extension}
          onChange={(e) => onDraftChange({ ...draft, extension: e.currentTarget.value.trim() })}
        />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Toggle
            size="sm"
            checked={draft.active}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onDraftChange({ ...draft, active: e.currentTarget.checked })
            }
          />
        </div>
        {/* Actions — fixed-width so the trash stays column-aligned whether or
            not the Save/Add button is showing. The button appears only once a
            row is actually editable (dirty), so resting rows stay quiet. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          {dirty && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => { void onSave(); }}
              disabled={!canSave}
            >
              {saving ? "Saving…" : existing ? "Save" : "Add"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { void onClear(); }}
            disabled={!canClear}
            aria-label={`Remove ${rowLabel}`}
          >
            <Icon name="trash" />
          </Button>
        </div>
      </div>
      {captionText && (
        <div style={{ display: "grid", gridTemplateColumns: ROW_GRID, gap: 12, marginTop: 4 }}>
          <div />
          <div style={{ fontSize: 11.5, color: "var(--text-error-primary)" }}>
            {captionText}
          </div>
        </div>
      )}
      <div data-scope={scopeKey} style={{ display: "none" }} />
    </>
  );

  if (flush) {
    // Parent owns the container + dividers; the row is just padded content.
    return <div style={{ padding: "12px 14px" }}>{body}</div>;
  }
  return (
    <Surface variant="primary" padding="md" radius="md" border="primary">
      {body}
    </Surface>
  );
}

function TransferRoutingPanel() {
  // Load destinations + agents + customer profile in parallel.
  const { data: destinations, mutate: refreshDests } = useSWR<TransferDestination[]>(
    "/api/transfer-destinations/",
    () => listTransferDestinations(),
  );
  const { data: agents } = useSWR<AgentConfig[]>("/api/agents/", () => getAgents());
  const { data: me, mutate: refreshMe } = useSWR<{ workspace_config?: Record<string, unknown> }>(
    "/api/auth/me",
    fetcher,
  );

  // Group destinations by scope:
  //   - "agent:<id>" → Tier 1 override pinned to that agent_config
  //   - "catchall"   → Tier 3 customer-wide default
  // Tier 2 (agent_type) rows from the DB are not surfaced here; they remain
  // resolvable server-side but aren't authored from this panel.
  // When multiple active rows exist within the same scope (legacy / power
  // user case), the lowest-priority one is presented as the "primary" row —
  // matches the resolver's pick at call time.
  const byScope = useMemo<Record<string, TransferDestination | undefined>>(() => {
    const map: Record<string, TransferDestination | undefined> = {};
    if (!destinations) return map;
    for (const d of destinations) {
      let key: string | null = null;
      if (d.agent_config_id) {
        key = `agent:${d.agent_config_id}`;
      } else if (d.agent_type === null) {
        key = "catchall";
      } else {
        // Tier 2 row — recognised, but no UI surface in this panel.
        continue;
      }
      const cur = map[key];
      if (!cur || d.priority < cur.priority) map[key] = d;
    }
    return map;
  }, [destinations]);

  // Surface every non-paused agent the customer owns. Each agent gets its
  // own row so customers with multiple agents of the same type (e.g.
  // "Inbound Carrier Sales" and "Inbound Carrier Sales II (LiveKit)") can
  // route them independently.
  const activeAgents = useMemo<AgentConfig[]>(() => {
    if (!agents) return [];
    return agents
      .filter((a) => a.status !== "paused")
      .slice()
      .sort((a, b) => {
        // Keep agents of the same type grouped, then sort by name within a
        // type. Stable + predictable across reloads.
        if (a.agent_type !== b.agent_type) return a.agent_type.localeCompare(b.agent_type);
        return a.name.localeCompare(b.name);
      });
  }, [agents]);

  // Drafts: one RowDraft per scope key. Lazily seeded from `byScope` on
  // first render (and reset on subsequent loads via the key fall-through).
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingScope, setSavingScope] = useState<string | null>(null);

  function draftFor(scope: string): RowDraft {
    return drafts[scope] ?? rowFromDestination(byScope[scope]);
  }

  function setDraft(scope: string, next: RowDraft) {
    setDrafts((d) => ({ ...d, [scope]: next }));
  }

  function clearDraft(scope: string) {
    setDrafts((d) => {
      const { [scope]: _, ...rest } = d;
      return rest;
    });
  }

  /** Resolve the create-time fields for a scope key.
   *  - "agent:<id>" → Tier 1, pinned to that agent_config
   *  - "catchall"   → Tier 3, both columns NULL
   */
  function scopeFields(scope: string): {
    agent_config_id: string | null;
    agent_type: AgentType | null;
    label: string;
  } {
    if (scope === "catchall") {
      return { agent_config_id: null, agent_type: null, label: "Default (catch-all)" };
    }
    if (scope.startsWith("agent:")) {
      const id = scope.slice("agent:".length);
      const a = agents?.find((x) => x.id === id);
      return {
        agent_config_id: id,
        agent_type: null,
        // Fall back to a slug-style label if the agents API hasn't returned
        // yet, but in practice activeAgents drives the render so `a` is set.
        label: a ? a.name : `Agent ${id.slice(0, 8)}`,
      };
    }
    return { agent_config_id: null, agent_type: null, label: scope };
  }

  async function saveRow(scope: string) {
    const existing = byScope[scope];
    const draft = draftFor(scope);
    if (!E164_RE.test(draft.phone)) {
      toast({ title: "Invalid phone", description: "Use E.164 format, e.g. +14155550100", variant: "destructive" });
      return;
    }
    const { agent_config_id, agent_type, label } = scopeFields(scope);
    setSavingScope(scope);
    try {
      if (existing) {
        await updateTransferDestination(existing.id, {
          phone_e164: draft.phone,
          extension: draft.extension || null,
          active: draft.active,
        });
      } else {
        await createTransferDestination({
          agent_config_id,
          agent_type,
          label,
          phone_e164: draft.phone,
          extension: draft.extension || null,
          active: draft.active,
          priority: 100,
        });
      }
      await refreshDests();
      clearDraft(scope);
      toast({ title: "Saved", description: `${label} → ${draft.phone}` });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingScope(null);
    }
  }

  async function clearRow(scope: string) {
    const existing = byScope[scope];
    if (!existing) return;
    setSavingScope(scope);
    try {
      await deleteTransferDestination(existing.id);
      await refreshDests();
      clearDraft(scope);
      toast({ title: "Removed", description: existing.label });
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingScope(null);
    }
  }

  // Outbound trunk state — separate save flow because it touches workspace_config
  // on customers, not transfer_destinations.
  const currentTrunk = ((me?.workspace_config as Record<string, unknown> | undefined)?.outbound_trunk_id as string | undefined) ?? "";
  const [trunkDraft, setTrunkDraft] = useState<string | null>(null);
  const [savingTrunk, setSavingTrunk] = useState(false);
  const effectiveTrunk = trunkDraft ?? currentTrunk;
  const trunkDirty = effectiveTrunk.trim() !== currentTrunk.trim();

  async function saveTrunk() {
    setSavingTrunk(true);
    try {
      const value = effectiveTrunk.trim();
      await setOutboundTrunk(value === "" ? null : value);
      await refreshMe();
      setTrunkDraft(null);
      toast({ title: value ? "Trunk updated" : "Trunk cleared" });
    } catch (err) {
      toast({
        title: "Trunk save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingTrunk(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="Where calls get transferred"
        description="When an agent calls transfer_to_carrier_sales_rep, Converse dials the phone number you configure here. Per-agent_type rules win over the customer default."
      />

      <Stack gap="md">
        <Section
          title="Per agent"
          description={
            activeAgents.length === 0
              ? "Create an agent in the Agents tab and it will appear here."
              : "Each row is a per-agent override. Wins over the customer default below at call time."
          }
        >
          {activeAgents.length > 0 && (
            <Surface variant="primary" radius="lg" border="primary" padding="none">
              <div style={{ padding: "12px 0 0" }}>
                <DestinationHeader />
              </div>
              {activeAgents.map((a) => {
                const scopeKey = `agent:${a.id}`;
                return (
                  <div
                    key={a.id}
                    style={{ borderTop: "1px solid var(--border-neutral-subtle)" }}
                  >
                    <DestinationRow
                      flush
                      scopeKey={scopeKey}
                      rowLabel={a.name}
                      description={agentTypeLabel(a.agent_type)}
                      existing={byScope[scopeKey]}
                      draft={draftFor(scopeKey)}
                      onDraftChange={(next) => setDraft(scopeKey, next)}
                      onSave={() => saveRow(scopeKey)}
                      onClear={() => clearRow(scopeKey)}
                      saving={savingScope === scopeKey}
                    />
                  </div>
                );
              })}
            </Surface>
          )}
        </Section>

        <Section
          title="Customer default (catch-all)"
          description="Used when no agent_type-specific rule matches. Leave empty to require an explicit per-type rule for every agent."
        >
          <DestinationRow
            scopeKey="catchall"
            rowLabel="Default"
            existing={byScope["catchall"]}
            draft={draftFor("catchall")}
            onDraftChange={(next) => setDraft("catchall", next)}
            onSave={() => saveRow("catchall")}
            onClear={() => clearRow("catchall")}
            saving={savingScope === "catchall"}
          />
        </Section>

        <Section
          title="Outbound SIP trunk (advanced)"
          description="Override the LiveKit outbound trunk used to dial the rep. Leave empty to use the Converse-wide default. Change this only if your dispatcher is in a country / on a Twilio sub-account that requires a different trunk."
        >
          <div>
            {/* Caption lives below the grid (not on the Input) so the input box
                and Save button stay equal-height and bottom-align cleanly. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
              <Input
                kind="text"
                size="md"
                label="Trunk ID"
                placeholder="ST_xxxxxxxxxxxxxxxx"
                value={effectiveTrunk}
                onChange={(e) => setTrunkDraft(e.currentTarget.value)}
              />
              <Button
                size="md"
                variant={trunkDirty ? "primary" : "secondary"}
                onClick={() => { void saveTrunk(); }}
                disabled={!trunkDirty || savingTrunk}
              >
                {savingTrunk ? "Saving…" : "Save"}
              </Button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-neutral-tertiary)", marginTop: 6 }}>
              {currentTrunk
                ? `Currently: ${currentTrunk}`
                : "Not set — using Converse-wide default trunk."}
            </div>
          </div>
        </Section>
      </Stack>
    </motion.div>
  );
}

function IntegrationsPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="API status"
        description="All third-party integrations used in the voice pipeline."
      />

      <Stack gap="md">
        <Section title="Status" description="Live status of each upstream provider.">
          <Stack gap="none">
            {INTEGRATIONS.map((ig, i) => (
              <div
                key={ig.name}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-neutral-subtle)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  // Semantic, theme-aware tokens — the raw `--green-*` scale
                  // didn't flip for dark mode and rendered as bright white tiles.
                  background: ig.ok ? "var(--bg-success-subtle)" : "var(--bg-neutral-secondary)",
                  border: `1px solid ${ig.ok ? "var(--border-success-primary)" : "var(--border-neutral-subtle)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: ig.ok ? "var(--text-success-primary)" : "var(--text-neutral-tertiary)",
                }}>
                  <Icon name={ig.iconName} size="sm" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)" }}>
                      {ig.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-neutral-tertiary)" }}>
                      {ig.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-neutral-secondary)", marginTop: 1 }}>
                    {ig.detail}
                  </div>
                </div>

                <StatusDot status={ig.ok ? "ok" : "error"} />
                <Tag size="sm" variant={ig.ok ? "success" : "error"}>
                  {ig.ok ? "OK" : "FAIL"}
                </Tag>
              </div>
            ))}
          </Stack>
        </Section>

        <Section
          title="Required environment variables"
          description="Set these in your deployment environment (.env, Doppler, etc.)."
        >
          <KeyValueGrid
            rows={[
              ["DATABASE_URL",        "postgresql+asyncpg://..."],
              ["REDIS_URL",           "redis://localhost:6379/0"],
              ["LIVEKIT_URL",         "wss://your-project.livekit.cloud"],
              ["OPENAI_API_KEY",      "sk-..."],
              ["DEEPGRAM_API_KEY",    "..."],
              ["CARTESIA_API_KEY",    "..."],
              ["TWILIO_ACCOUNT_SID",  "AC..."],
              ["TWILIO_AUTH_TOKEN",   "..."],
              ["TWILIO_PHONE_NUMBER", "+1xxxxxxxxxx"],
              ["HIGHWAY_API_KEY",     "... (carrier verify)"],
              ["SECRET_KEY",          "32+ char random string (JWT)"],
            ]}
            labelWidth={200}
          />
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Content: API Keys ─────────────────────────────────────────────────────────

interface ApiKeyRow { name: string; key: string; created: string; active: boolean }

const API_KEYS: ReadonlyArray<ApiKeyRow> = [
  { name: "Deepgram",    key: "dg_••••••••••••••••",   created: "Today", active: true  },
  { name: "Cartesia",    key: "sk_car_••••••••••••",   created: "Today", active: true  },
  { name: "ElevenLabs",  key: "sk_••••••••••••••••",   created: "Today", active: true  },
  { name: "OpenAI",      key: "sk-proj-••••••••••••",  created: "Today", active: true  },
  { name: "LiveKit API", key: "API••••••••••••••••",   created: "Today", active: true  },
  { name: "Highway API", key: "— not set —",            created: "—",     active: false },
];

function ApiKeysPanel() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="Credentials"
        description="All API keys are stored encrypted server-side. Keys shown here are partial — never logged in full."
      />

      <Stack gap="md">
        <Section title="Vault" description="Provider keys used by the voice pipeline.">
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "160px 1fr 100px 80px",
              padding: "0 0 10px",
              borderBottom: "1px solid var(--border-neutral-subtle)",
              fontSize: 11, color: "var(--text-neutral-tertiary)",
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
            }}>
              <span>Service</span>
              <span>Key (masked)</span>
              <span>Added</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>

            {API_KEYS.map((k) => (
              <div
                key={k.name}
                style={{
                  display: "grid", gridTemplateColumns: "160px 1fr 100px 80px",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-neutral-subtle)",
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: k.active ? "var(--text-neutral-primary)" : "var(--text-neutral-tertiary)",
                }}>
                  {k.name}
                </span>
                <span style={{
                  fontSize: 12.5, color: "var(--text-neutral-secondary)",
                  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                }}>
                  {k.key}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-neutral-tertiary)" }}>
                  {k.created}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Tag size="sm" variant={k.active ? "success" : "error"}>
                    {k.active ? "OK" : "FAIL"}
                  </Tag>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Converse API"
          description="Your platform keys — let external systems (webhooks, custom integrations) authenticate with Converse. Create, copy, and revoke keys here."
        >
          <ApiKeysManager variant="embedded" />
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Content: Team ─────────────────────────────────────────────────────────────

function TeamPanel() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <PanelHeader
          title="Members & invites"
          description="Contact your workspace admin to manage team members."
        />
        <Section title="Access restricted" description="Only workspace admins can manage team membership.">
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <Icon name="lock" size="sm" />
            <span style={{ fontSize: 13, color: "var(--text-neutral-secondary)" }}>
              Your role is <strong>Member</strong>. Ask an Admin to invite or remove users.
            </span>
          </div>
        </Section>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelHeader
        title="Members & invites"
        description="Invite teammates to your workspace, change their roles, or remove access. Invites are sent by email via Clerk."
      />
      {/* Custom DS-native member management, driven by Clerk's useOrganization
          hooks (replaces the embedded <OrganizationProfile />). */}
      <TeamMembers />
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PANEL_MAP: Record<TabId, React.ComponentType> = {
  "tms-setup":        TmsSetupPanel,
  "transfer-routing": TransferRoutingPanel,
  "integrations":     IntegrationsPanel,
  "api-keys":         ApiKeysPanel,
  "team":             TeamPanel,
};

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>("tms-setup");

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

      {/* ── Page header ───────────────────────────────────────────────────
          Page-level title. Tabs live directly below it as the primary nav
          (replacing the old left vertical rail). */}
      <DSPageHeader
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title="Settings"
        info="Platform configuration — onboarding, voice pipeline, TMS, routing, and team."
      />

      {/* ── Primary tabs ──────────────────────────────────────────────────
          DS Tabs (primary underline variant). Switches the active panel via
          local state — these are filter-style tabs, not aria tabpanels, so
          `controlsPanels` is left off. The DS list paints its own full-width
          underline, so no extra border here. Horizontal inset matches the
          PageHeader so the first tab lines up under the title. */}
      <div style={{
        flexShrink: 0,
        background: "var(--bg-neutral-secondary)",
      }}>
        <Tabs
          variant="primary"
          ariaLabel="Settings sections"
          items={TAB_ITEMS}
          value={active}
          onChange={(id) => setActive(id as TabId)}
        />
      </div>

      {/* ── Content pane ── */}
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
