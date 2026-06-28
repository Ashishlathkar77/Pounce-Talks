"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Surface,
  Stack,
  Tag,
  Button,
  Icon,
  Skeleton,
  PageHeader as DSPageHeader,
} from "@hemut2025/design-system";
import { fetcher, createAgent } from "@/lib/api";
import { AgentTemplate } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

// ── Agent-type metadata ───────────────────────────────────────────────────────
//
// Each template type maps to a Phosphor icon slug + a display label. The grid
// renders every icon in a single neutral tile (the per-type colors were
// decorative, not semantic — the names carry the differentiation), so all
// tokens used here are theme-aware and the grid flips correctly in dark mode.

const AGENT_TYPE_META: Record<string, { icon: string; label: string }> = {
  carrier_sales:          { icon: "truck",               label: "Carrier Sales" },
  driver_eta:             { icon: "map-pin",             label: "Driver ETA" },
  customer_eta:           { icon: "users",               label: "Customer ETA" },
  receptionist:           { icon: "headset",             label: "Receptionist" },
  sdr:                    { icon: "trend-up",            label: "SDR" },
  pod_collection:         { icon: "file-text",           label: "POD Collection" },
  detention_monitor:      { icon: "warning",             label: "Detention Monitor" },
  assign_driver:          { icon: "identification-card", label: "Assign Driver" },
  equipment_change:       { icon: "swap",                label: "Equipment Change" },
  reschedule:             { icon: "clock",               label: "Reschedule" },
  outbound_carrier_sales: { icon: "currency-dollar",     label: "Outbound Carrier Sales" },
};

function IconTile({ icon }: { icon: string }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 9,
      background: "var(--bg-neutral-secondary)",
      border: "1px solid var(--border-neutral-subtle)",
      color: "var(--text-neutral-secondary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon name={icon} size="sm" />
    </div>
  );
}

// ── Fallback templates (when the API returns nothing) ─────────────────────────

const FALLBACK_TEMPLATES: AgentTemplate[] = [
  {
    id: "tpl_carrier_sales",
    agent_type: "carrier_sales",
    name: "Carrier Sales",
    description: "Autonomously negotiate freight rates with carriers. Verifies MC numbers, handles multi-round rate negotiation, and books loads directly into TMS.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_driver_eta",
    agent_type: "driver_eta",
    name: "Driver ETA",
    description: "Outbound calls to drivers to collect real-time ETA and status updates. Automatically syncs updates to your TMS and sends customer notifications.",
    default_workflow_nodes: [{} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_customer_eta",
    agent_type: "customer_eta",
    name: "Customer ETA",
    description: "Proactively notify shippers and consignees about load status. Answers inbound ETA inquiries with real-time TMS data.",
    default_workflow_nodes: [{} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_receptionist",
    agent_type: "receptionist",
    name: "Receptionist",
    description: "Handle all inbound calls professionally. Routes callers to the right department, takes messages, and answers common questions about your operation.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_sdr",
    agent_type: "sdr",
    name: "SDR",
    description: "Outbound sales development to prospect new carrier and shipper relationships. Qualifies leads and books follow-up calls with your team.",
    default_workflow_nodes: [{} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_pod_collection",
    agent_type: "pod_collection",
    name: "POD Collection",
    description: "Follow up on missing proof of delivery documents. Calls carriers and drivers, collects PODs, and updates billing status in TMS.",
    default_workflow_nodes: [{} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_detention_monitor",
    agent_type: "detention_monitor",
    name: "Detention Monitor",
    description: "Monitor and resolve detention situations at pickup/delivery facilities. Escalates when thresholds are breached and tracks charges.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_assign_driver",
    agent_type: "assign_driver",
    name: "Assign Driver",
    description: "Call a driver to confirm load acceptance. Collects current location, ETA, and any issues. Syncs confirmation back to TMS automatically.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_equipment_change",
    agent_type: "equipment_change",
    name: "Equipment Change",
    description: "Confirm a driver can swap to different required equipment. Handles acceptance, rejection, and escalation if the driver can't accommodate.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_reschedule",
    agent_type: "reschedule",
    name: "Reschedule",
    description: "Communicate pickup or delivery time changes to drivers. Captures agreement or counter-proposals and logs the schedule change in TMS.",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
  {
    id: "tpl_outbound_carrier_sales",
    agent_type: "outbound_carrier_sales",
    name: "Outbound Carrier Sales",
    description: "Outbound counterpart to Carrier Sales — proactively call carriers and offer your loads with a 3-round counter strategy against your internal max rate (never revealed to the carrier).",
    default_workflow_nodes: [{} as never, {} as never, {} as never, {} as never, {} as never, {} as never],
    default_workflow_edges: [{} as never, {} as never, {} as never, {} as never, {} as never],
    default_system_prompt: "",
  },
];

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, index }: { template: AgentTemplate; index: number }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const meta = AGENT_TYPE_META[template.agent_type] ?? {
    icon: "file-text",
    label: template.agent_type,
  };
  // API rows carry `node_count` (derived server-side from workflow_json); the
  // local fallback templates carry an inline `default_workflow_nodes` array.
  const nodeCount = template.node_count ?? template.default_workflow_nodes?.length ?? 0;

  // Create the agent straight from the template and jump to the editor — no
  // intermediate /agents/new wizard screen.
  async function handleUse() {
    if (creating) return;
    setCreating(true);
    try {
      const agent = await createAgent({
        name: `${template.name} Agent`,
        agent_type: template.agent_type,
        prompt_override: template.default_system_prompt || null,
        workflow_json: {
          nodes: template.default_workflow_nodes ?? [],
          edges: template.default_workflow_edges ?? [],
        },
      } as Parameters<typeof createAgent>[0]);
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      toast({
        title: "Failed to create agent",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ height: "100%" }}
    >
      <Surface
        variant="primary"
        padding="none"
        radius="lg"
        border="primary"
        shadow="none"
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        {/* Body */}
        <div style={{ padding: 18, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
            <IconTile icon={meta.icon} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
                color: "var(--text-neutral-primary)",
              }}>
                {template.name}
              </div>
            </div>
          </div>
          <p style={{
            fontSize: 12.5, color: "var(--text-neutral-secondary)",
            lineHeight: 1.6, margin: 0,
          }}>
            {template.description}
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 18px",
          borderTop: "1px solid var(--border-neutral-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          {nodeCount > 0
            ? <Tag size="sm" variant="neutral" leftIcon="graph">{nodeCount} nodes</Tag>
            : <span />}
          <Button
            variant="primary"
            size="sm"
            rightIcon={creating ? undefined : "arrow-right"}
            loading={creating}
            disabled={creating}
            onClick={handleUse}
          >
            {creating ? "Creating…" : "Use template"}
          </Button>
        </div>
      </Surface>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <Surface variant="primary" padding="lg" radius="lg" border="primary" shadow="none">
      <Stack gap="md">
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Skeleton width={38} height={38} radius="md" />
          <Skeleton width={120} height={14} radius="sm" />
        </div>
        <Stack gap="xs">
          <Skeleton width="100%" height={11} radius="sm" />
          <Skeleton width="92%" height={11} radius="sm" />
          <Skeleton width="70%" height={11} radius="sm" />
        </Stack>
      </Stack>
    </Surface>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { data: templates, isLoading } = useSWR<AgentTemplate[]>("/api/agents/templates/list", fetcher);
  const displayTemplates = (templates && templates.length > 0)
    ? templates
    : (isLoading ? [] : FALLBACK_TEMPLATES);

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
        bordered
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Templates
            {!isLoading && (
              <Tag size="sm" variant="neutral" style={{ background: "var(--bg-neutral-primary)" }}>
                {displayTemplates.length} templates
              </Tag>
            )}
          </span>
        }
        info="Pre-built agent workflows for every freight operation — pick one to spin up an agent in minutes."
      />

      {/* Content gutter matches the PageHeader's horizontal inset so the grid's
          left edge lines up under the title (same pattern as the Runs page).
          Full-width grid — no max-width centering that would detach it from the
          left-aligned header. */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "16px 12px 28px",
        background: "var(--bg-neutral-secondary)",
      }}>
        {/* Template grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : displayTemplates.map((template, i) => (
                <TemplateCard key={template.id} template={template} index={i} />
              ))}
        </div>
      </div>
    </div>
  );
}
