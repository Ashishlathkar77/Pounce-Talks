"use client";

/**
 * NewAgentModal — modal-based agent creation flow.
 *
 * Replaces the old full-page `/agents/new` wizard. Opens from the "New agent"
 * CTA (and the empty-state action) on the Agent Studio list, shows the template
 * catalogue as a searchable list, and creates + opens the agent inline. Built
 * exclusively from DS components + semantic tokens (no raw colours, no
 * lucide icons) so it reskins / dark-mode flips cleanly.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Modal,
  Input,
  Icon,
  Tag,
  Skeleton,
  Typography,
} from "@hemut2025/design-system";
import { fetcher, createAgent } from "@/lib/api";
import { AgentTemplate } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

// Used when the API is unreachable so the flow still works offline (matches the
// previous /agents/new fallback set).
const FALLBACK_TEMPLATES: AgentTemplate[] = [
  { id: "carrier_sales", agent_type: "carrier_sales", name: "Carrier Sales", description: "Verify MC numbers, negotiate rates, and book loads autonomously on every inbound call.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "driver_eta", agent_type: "driver_eta", name: "Driver ETA", description: "Call drivers to get real-time location and ETA, then update TMS automatically.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "customer_eta", agent_type: "customer_eta", name: "Customer ETA", description: "Proactively notify shippers with load status and estimated delivery windows.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "receptionist", agent_type: "receptionist", name: "Receptionist", description: "Handle inbound calls, detect intent, and warm-transfer to the right team.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "sdr", agent_type: "sdr", name: "SDR Outbound", description: "Outbound prospecting to build new carrier and shipper relationships at scale.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "pod_collection", agent_type: "pod_collection", name: "POD Collection", description: "Follow up on proof of delivery documents from carriers and drivers automatically.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
  { id: "detention_monitor", agent_type: "detention_monitor", name: "Detention Monitor", description: "Track detention time at facilities, capture charges, and minimize fees.", default_workflow_nodes: [], default_workflow_edges: [], default_system_prompt: "" },
];

const SCRATCH_ID = "__scratch__";

// ── Template / scratch row ─────────────────────────────────────────────────────

function CreateRow({
  name,
  description,
  nodeCount,
  disabled,
  onClick,
}: {
  name: string;
  description: string;
  nodeCount?: number | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lift = hovered && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        textAlign: "left", padding: "12px 14px", borderRadius: 10,
        background: lift ? "var(--bg-neutral-secondary)" : "var(--bg-neutral-primary)",
        border: `1px solid ${lift ? "var(--border-neutral-bold)" : "var(--border-neutral-subtle)"}`,
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography variant="body-sm-semibold" color="primary">{name}</Typography>
          {nodeCount != null && nodeCount > 0 && (
            <Tag size="xm" variant="neutral" leftIcon="tree-structure">{nodeCount}</Tag>
          )}
        </span>
        <Typography
          variant="caption-regular"
          color="tertiary"
          style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {description}
        </Typography>
      </span>

      <Icon
        name="arrow-right"
        size="sm"
        aria-hidden
        style={{ color: "var(--text-neutral-disabled)", flexShrink: 0 }}
      />
    </button>
  );
}

function RowSkeleton() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      border: "1px solid var(--border-neutral-subtle)",
    }}>
      <Skeleton width={38} height={38} radius="md" />
      <div style={{ flex: 1 }}>
        <Skeleton width={140} height={13} radius="sm" style={{ marginBottom: 6 }} />
        <Skeleton width="80%" height={10} radius="sm" />
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export default function NewAgentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useSWR<AgentTemplate[]>(
    open ? "/api/agents/templates/list" : null,
    fetcher,
  );
  const all = (templates && templates.length > 0)
    ? templates
    : (isLoading ? [] : FALLBACK_TEMPLATES);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
  }, [all, query]);

  async function create(payload: Parameters<typeof createAgent>[0], id: string) {
    if (creatingId) return;
    setCreatingId(id);
    try {
      const agent = await createAgent(payload);
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      toast({
        title: "Failed to create agent",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setCreatingId(null);
    }
  }

  function selectTemplate(t: AgentTemplate) {
    create({
      name: `${t.name} Agent`,
      agent_type: t.agent_type,
      prompt_override: t.default_system_prompt || null,
      workflow_json: { nodes: t.default_workflow_nodes ?? [], edges: t.default_workflow_edges ?? [] },
    } as Parameters<typeof createAgent>[0], t.id);
  }

  function buildFromScratch() {
    create({
      name: "Custom Agent",
      agent_type: "receptionist",
      prompt_override: null,
      workflow_json: { nodes: [], edges: [] },
    } as Parameters<typeof createAgent>[0], SCRATCH_ID);
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!creatingId) { setQuery(""); onClose(); } }}
      size="lg"
      accent="brand"
      leadingIcon={<Icon name="robot" size="sm" aria-hidden />}
      title="New agent"
      description="Start from a template or build your own from scratch."
      closeOnBackdropClick={!creatingId}
      loading={!!creatingId}
      loadingLabel="Creating agent…"
    >
      <Modal.Body padding="base" scrollable={false}>
        {/* Search — wrapped so the gap below sits on the field wrapper (the DS
            Input's own `style` lands on the inner input, not the field). */}
        <div style={{ marginBottom: 14 }}>
          <Input
            kind="text"
            size="md"
            leadingIcon="magnifying-glass"
            clearable
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>

        {/* Single scrollable column so every row — templates AND the
            build-from-scratch option — shares one width and one scrollbar
            gutter. Capped height keeps the modal from jumping as results
            filter. */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          maxHeight: 380, overflowY: "auto",
        }}>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <Typography
              variant="body-sm-regular"
              color="tertiary"
              style={{ padding: "24px 0", textAlign: "center" }}
            >
              No templates match "{query}".
            </Typography>
          ) : (
            filtered.map((t) => (
              <CreateRow
                key={t.id}
                name={t.name}
                description={t.description}
                nodeCount={t.node_count ?? t.default_workflow_nodes?.length ?? null}
                disabled={!!creatingId}
                onClick={() => selectTemplate(t)}
              />
            ))
          )}

          {/* Build from scratch — separated from the templated options. */}
          <div style={{ height: 1, background: "var(--border-neutral-subtle)", margin: "4px 0" }} />
          <CreateRow
            name="Build from scratch"
            description="Start with an empty workflow and design every node yourself."
            disabled={!!creatingId}
            onClick={buildFromScratch}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}
