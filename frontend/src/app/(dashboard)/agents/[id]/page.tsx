"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  PageHeader,
  Tabs,
  Tag,
  Skeleton,
  Surface,
  Stack,
  Input,
  Toggle,
  Dropdown,
  Drawer,
  Modal,
  Typography,
} from "@hemut2025/design-system";
import type { TabItem } from "@hemut2025/design-system";
import { fetcher, updateAgent, deleteAgent, pingTMS, testCall, TestCallParams } from "@/lib/api";
import { AgentConfig, WorkflowNode, WorkflowEdge, WorkflowMeta } from "@/lib/types";
import { useWorkflowStore } from "@/lib/store";
import { fromReactFlow, normalizeWorkflow } from "@/lib/workflow";
import { DEFAULT_WORKFLOW_BY_TYPE, DEFAULT_PROMPT_BY_TYPE } from "@/lib/defaults";
import { agentTypeLabel, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useUnsavedChanges, confirmDiscard } from "@/hooks/use-unsaved-changes";
import dynamic from "next/dynamic";

const Canvas = dynamic(() => import("@/components/workflow/Canvas"), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-neutral-secondary)",
    }}>
      <Skeleton width={220} height={14} />
    </div>
  ),
});

const VARIABLE_HINTS = [
  "[carrier_name]", "[reference_number]", "[our_last_offer]", "[load_origin]",
  "[load_destination]", "[mc_number]", "[driver_name]", "[pickup_time]", "[delivery_time]",
];

// ElevenLabs voice IDs — these are real EL library voices
const VOICE_IDS = [
  { id: "a0e99841-438c-4a64-b679-ae501e7d6091", label: "Paul — Converse house voice (Male, US)" },
  { id: "21m00Tcm4TlvDq8ikWAM",                 label: "Rachel (Female, US — warm)" },
  { id: "pNInz6obpgDQGcFmaJgB",                 label: "Adam (Male, US — deep)" },
  { id: "EXAVITQu4vr4xnSDxMaL",                 label: "Bella (Female, US — friendly)" },
  { id: "ErXwobaYiN019PkySvjV",                  label: "Antoni (Male, US — confident)" },
  { id: "TxGEqnHWrfWFTfGW9XjX",                 label: "Josh (Male, US — authoritative)" },
  { id: "VR6AewLTigWG4xSOukaG",                  label: "Arnold (Male, US — strong)" },
  { id: "MF3mGyEYCl7XYWbV9V6O",                 label: "Elli (Female, US — energetic)" },
  { id: "yoZ06aMxZJJ28mfd3POQ",                  label: "Sam (Male, US — conversational)" },
];

// Tabs are rendered via the design-system <Tabs> component. Each tab's
// `icon` is a Phosphor slug string (the DS resolves it to the icon font);
// see TabItem in @hemut2025/design-system.
const TAB_ITEMS: TabItem[] = [
  { id: "workflow", label: "Workflow", icon: "flow-arrow" },
  { id: "prompt",   label: "Prompt",   icon: "terminal-window" },
  { id: "settings", label: "Settings", icon: "gear-six" },
];

// ── Tool definitions ──────────────────────────────────────────────────────────

interface ToolDef {
  key: string;
  label: string;
  description: string;
  category: "core" | "tms" | "outbound" | "utility";
}

const ALL_TOOLS: ToolDef[] = [
  { key: "verify_carrier",    label: "Verify Carrier",      description: "MC# lookup via api.hemut.com + trackingapi.hemut.com — Gate 1",  category: "core" },
  { key: "find_load",         label: "Find Load",            description: "Load lookup from api.hemut.com by reference number — Gate 2",    category: "core" },
  { key: "negotiate_rate",    label: "Negotiate Rate",       description: "Pure-Python rate negotiation engine — Gate 3",                    category: "core" },
  { key: "book_load",         label: "Book Load",            description: "Dispatch order via api.hemut.com after rate accepted",            category: "core" },
  { key: "transfer_to_human", label: "Transfer to Human",   description: "SIP REFER — escalate to live dispatcher",                         category: "utility" },
  { key: "capture_location",  label: "Capture Location",    description: "Log driver ETA + location to trackingapi.hemut.com",              category: "tms" },
  { key: "ask_for_more_loads",label: "Ask for More Loads",  description: "Outbound: check if carrier has more available trucks",             category: "outbound" },
  { key: "get_load_status",   label: "Get Load Status",     description: "Movement status from trackingapi.hemut.com",                      category: "tms" },
  { key: "search_loads",      label: "Search Loads",        description: "Find available loads via api.hemut.com scheduling endpoint",       category: "tms" },
  { key: "get_carrier_history",label:"Carrier History",     description: "Movement history + on-time % from trackingapi.hemut.com",         category: "core" },
  { key: "get_market_rates",  label: "Market Rates",        description: "Lane rate benchmarks from rfpapi.hemut.com",                      category: "tms" },
  { key: "verify_insurance",  label: "Verify Insurance",    description: "Confirm carrier insurance meets coverage minimums",               category: "core" },
  { key: "get_available_loads",label:"Available Loads",     description: "Show loads near carrier's position via api.hemut.com",            category: "tms" },
  { key: "update_load_notes", label: "Update Load Notes",   description: "Write a note to the order record via api.hemut.com",             category: "tms" },
  { key: "schedule_callback", label: "Schedule Callback",   description: "Queue a human dispatcher callback request",                      category: "utility" },
  { key: "get_detention_claim",label:"Detention Claim",     description: "Retrieve detention time + claim status from api.hemut.com",      category: "tms" },
  { key: "get_rate_confirmation",label:"Rate Confirmation", description: "Fetch rate confirmation from api.hemut.com",                     category: "tms" },
];

// Default tools per agent type — shown pre-selected when no saved preference exists
const DEFAULT_TOOLS_BY_TYPE: Record<string, string[]> = {
  carrier_sales:     ["verify_carrier", "move_on", "find_load_by_reference", "find_loads_by_lane", "evaluate_offer", "book_load", "transfer_to_carrier_sales_rep", "ask_for_more_loads", "log_call", "hang_up"],
  driver_eta:        ["find_load", "capture_location", "get_load_status", "transfer_to_human"],
  customer_eta:      ["find_load", "get_load_status", "capture_location", "transfer_to_human"],
  receptionist:      ["transfer_to_human", "schedule_callback"],
  sdr:               ["ask_for_more_loads", "search_loads", "get_available_loads", "transfer_to_human"],
  pod_collection:    ["find_load", "update_load_notes", "transfer_to_human"],
  detention_monitor: ["find_load", "get_detention_claim", "capture_location", "update_load_notes", "transfer_to_human"],
  assign_driver:     ["find_load", "verify_carrier", "verify_insurance", "transfer_to_human"],
  equipment_change:  ["find_load", "update_load_notes", "transfer_to_human"],
  reschedule:        ["find_load", "update_load_notes", "schedule_callback", "transfer_to_human"],
  outbound_carrier_sales: ["find_load", "verify_carrier", "negotiate_rate", "book_load", "get_market_rates", "transfer_to_human"],
};

const TOOL_CATEGORY_COLORS: Record<string, string> = {
  core:     "rgba(34,197,94,0.5)",
  tms:      "rgba(96,165,250,0.5)",
  outbound: "rgba(244,114,182,0.5)",
  utility:  "rgba(148,163,184,0.5)",
};

// ── Test call parameter definitions per agent type ────────────────────────────

interface TestParamDef {
  key: keyof TestCallParams;
  label: string;
  placeholder: string;
  example: string;
}

const TEST_PARAMS_BY_TYPE: Record<string, TestParamDef[]> = {
  carrier_sales: [
    // Carrier calls in — they provide MC# live. No pre-fill needed.
    // The agent will ask for it as part of the flow.
  ],
  driver_eta: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",                example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
  ],
  customer_eta: [
    { key: "caller_name",      label: "Customer Name",      placeholder: "e.g. Sarah at Target DC",         example: "Sarah at Target DC" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
  ],
  receptionist: [
    { key: "caller_name",      label: "Caller Name",        placeholder: "e.g. John Smith",                 example: "John Smith" },
  ],
  sdr: [
    { key: "caller_name",      label: "Carrier Contact",    placeholder: "e.g. Tom Garcia",                 example: "Tom Garcia" },
    { key: "carrier_name",     label: "Carrier Company",    placeholder: "e.g. Swift Logistics LLC",        example: "Swift Logistics LLC" },
  ],
  pod_collection: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",               example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "carrier_name",     label: "Carrier Company",    placeholder: "e.g. Swift Logistics LLC",        example: "Swift Logistics LLC" },
  ],
  detention_monitor: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",               example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
  ],
  assign_driver: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",               example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
    { key: "load_equipment",   label: "Equipment Type",     placeholder: "e.g. Dry Van 53ft",               example: "Dry Van 53ft" },
    { key: "load_pickup_date", label: "Pickup Date/Time",   placeholder: "e.g. tomorrow at 8am",            example: "tomorrow at 8am" },
  ],
  equipment_change: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",               example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
    { key: "load_equipment",   label: "Equipment Type",     placeholder: "e.g. Reefer 48ft",                example: "Reefer 48ft" },
  ],
  reschedule: [
    { key: "caller_name",      label: "Driver Name",        placeholder: "e.g. Mike Johnson",               example: "Mike Johnson" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
  ],
  outbound_carrier_sales: [
    { key: "caller_name",      label: "Carrier Contact",    placeholder: "e.g. Tom Garcia",                 example: "Tom Garcia" },
    { key: "carrier_name",     label: "Carrier Company",    placeholder: "e.g. Swift Logistics LLC",        example: "Swift Logistics LLC" },
    { key: "reference_number", label: "Load Reference #",   placeholder: "e.g. HEM-00234",                  example: "HEM-00234" },
    { key: "load_origin",      label: "Load Origin",        placeholder: "e.g. Dallas, TX",                 example: "Dallas, TX" },
    { key: "load_destination", label: "Load Destination",   placeholder: "e.g. Atlanta, GA",                example: "Atlanta, GA" },
    { key: "load_equipment",   label: "Equipment Type",     placeholder: "e.g. Dry Van 53ft",               example: "Dry Van 53ft" },
    { key: "posted_rate",      label: "Posted Rate",        placeholder: "e.g. $1,450",                     example: "$1,450" },
  ],
};

const AGENT_DIRECTION: Record<string, "inbound" | "outbound" | "both"> = {
  carrier_sales:     "inbound",
  driver_eta:        "both",
  customer_eta:      "outbound",
  receptionist:      "inbound",
  sdr:               "outbound",
  pod_collection:    "outbound",
  detention_monitor: "outbound",
  assign_driver:     "outbound",
  equipment_change:  "both",
  reschedule:        "both",
  outbound_carrier_sales: "outbound",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem", letterSpacing: "0.02em" }}>
      {children}
    </p>
  );
}

/**
 * SettingsSection — DS Surface card with a title row, optional description,
 * and an optional headerActions cluster (e.g. "Reset to defaults" + counter on
 * the Tools section). Keeps every settings group on the same visual rhythm so
 * the page reads as a single configuration form, not five disjoint blocks.
 */
function SettingsSection({
  icon,
  title,
  description,
  headerActions,
  children,
}: {
  icon?: string;
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface variant="primary" padding="lg" radius="xl">
      <Stack gap="md">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            {icon && (
              <i className={`ph ph-${icon}`} style={{ fontSize: 16, color: "var(--text-neutral-secondary)", marginTop: 1 }} />
            )}
            <Stack gap="xxs">
              <Typography variant="body-md-semibold" color="primary">{title}</Typography>
              {description && (
                <Typography variant="caption-regular" color="tertiary">{description}</Typography>
              )}
            </Stack>
          </div>
          {headerActions}
        </div>
        {children}
      </Stack>
    </Surface>
  );
}

/**
 * ToggleRow — labelled toggle laid out as `[ label / description ........... [Toggle] ]`.
 * The DS `<Toggle>` exposes its own `label` prop but stacks the label *above*
 * the switch — for the two-column layout we want here we own the label.
 */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <Surface variant="secondary" radius="lg" padding="none">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, padding: "12px 14px",
      }}>
        <Stack gap="xxs">
          <Typography variant="body-sm-semibold" color="primary">{label}</Typography>
          {description && (
            <Typography variant="caption-regular" color="tertiary">{description}</Typography>
          )}
        </Stack>
        <Toggle size="md" checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </Surface>
  );
}

export default function AgentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    resetWorkflow,
    isDirty,
    setIsDirty,
    primaryPrompt,
    primaryPromptVars,
    variables,
    setPrimaryPrompt,
    setVariables,
  } = useWorkflowStore();

  // Seed the editor from the agents-list cache so clicking an agent renders
  // instantly instead of flashing the loading skeleton. The list page already
  // fetched every agent via "/api/agents/" (same AgentConfig shape), so this
  // useSWR dedupes to the cached array; we find this agent and hand it to the
  // detail fetch as fallbackData. SWR still revalidates "/api/agents/{id}" in
  // the background. On a cold/direct load the list isn't cached → fallback is
  // undefined → the skeleton shows as before.
  const { data: agentList } = useSWR<AgentConfig[]>("/api/agents/", fetcher);
  const seededAgent = agentList?.find((a) => a.id === id);

  const { data: agent, isLoading, mutate } = useSWR<AgentConfig>(
    `/api/agents/${id}`,
    fetcher,
    { fallbackData: seededAgent },
  );
  const { mutate: globalMutate } = useSWRConfig();

  const [activeTab, setActiveTab] = useState("workflow");
  const [agentName, setAgentName]     = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [voiceId, setVoiceId]         = useState("aura-asteria-en");
  const [active, setActive]           = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [tmsStatus, setTmsStatus]     = useState<"unknown" | "ok" | "error">("unknown");
  const [tmsPinging, setTmsPinging]   = useState(false);
  const [testPhone, setTestPhone]     = useState("+19404930104");
  const [isTesting, setIsTesting]     = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Session "last saved" stamp — shown in the footer. AgentConfig has no
  // updated_at, so this reflects saves made in the current session only.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [testParams, setTestParams]   = useState<TestCallParams>({});

  // Tracks whether the prompt textarea was seeded from the default (not a saved custom prompt)
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(false);

  useEffect(() => {
    if (agent) {
      setAgentName(agent.name);

      // Prompt: use saved override if present; fall back to per-type default starter
      if (agent.prompt_override) {
        setSystemPrompt(agent.prompt_override);
        setIsDefaultPrompt(false);
      } else {
        const defaultPrompt = DEFAULT_PROMPT_BY_TYPE[agent.agent_type as keyof typeof DEFAULT_PROMPT_BY_TYPE] ?? "";
        setSystemPrompt(defaultPrompt);
        setIsDefaultPrompt(true);
      }

      setPhoneNumber(agent.phone_number ?? "");
      setVoiceId(agent.voice_id ?? "a0e99841-438c-4a64-b679-ae501e7d6091");
      setActive(agent.status === "active");

      // Workflow: normalize whatever shape is stored (legacy { nodes, edges }
      // or v1.0 WorkflowSchema) into canvas-ready React Flow nodes. Falls
      // back to the per-type default diagram when the row hasn't been saved.
      const stored = normalizeWorkflow(agent.workflow_json ?? null);
      const defaultWf = DEFAULT_WORKFLOW_BY_TYPE[agent.agent_type as keyof typeof DEFAULT_WORKFLOW_BY_TYPE];
      setNodes(stored.nodes.length > 0 ? stored.nodes : (defaultWf?.nodes ?? []));
      setEdges(stored.edges.length > 0 ? stored.edges : (defaultWf?.edges ?? []));
      // Seed primary prompt + variables from the v1.0 envelope when present.
      // Legacy rows leave these empty until the author opens the Primary
      // Prompt editor and saves — at which point we upgrade the row to v1.0.
      if (stored.meta?.primary_prompt) {
        setPrimaryPrompt(stored.meta.primary_prompt, stored.meta.primary_prompt_vars ?? []);
      } else {
        setPrimaryPrompt("", []);
      }
      setVariables(stored.variables);
      setIsDirty(false);

      // Tools: use saved preference or fall back to per-type defaults
      setEnabledTools(agent.enabled_tools ?? DEFAULT_TOOLS_BY_TYPE[agent.agent_type] ?? []);
    }
    return () => resetWorkflow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  // ── Unsaved-changes tracking (all three tabs) ──────────────────────────────
  // Workflow dirtiness comes from the store (`isDirty`); Prompt and Settings
  // are compared against the loaded agent so switching tabs / navigating away
  // with pending edits is caught too.
  const promptBaseline = agent
    ? (agent.prompt_override ?? DEFAULT_PROMPT_BY_TYPE[agent.agent_type as keyof typeof DEFAULT_PROMPT_BY_TYPE] ?? "")
    : "";
  const toolsBaseline = agent ? (agent.enabled_tools ?? DEFAULT_TOOLS_BY_TYPE[agent.agent_type] ?? []) : [];
  const promptDirty = !!agent && systemPrompt !== promptBaseline;
  // Note: the "Active" toggle is intentionally excluded — the backend
  // `AgentConfigUpdate` schema has no status/active field, so it can't be
  // persisted via PATCH yet. Including it would leave a permanently-stuck
  // dirty flag after a settings save.
  const settingsDirty = !!agent && (
    agentName !== agent.name ||
    phoneNumber !== (agent.phone_number ?? "") ||
    voiceId !== (agent.voice_id ?? "a0e99841-438c-4a64-b679-ae501e7d6091") ||
    enabledTools.length !== toolsBaseline.length ||
    enabledTools.some((t) => !toolsBaseline.includes(t))
  );
  const dirty = isDirty || promptDirty || settingsDirty;

  // Guards reload / tab-close / external + internal SPA link navigation.
  useUnsavedChanges(dirty);

  // The editor's own "Back" button navigates programmatically (not an anchor
  // click), so it's guarded explicitly here.
  function handleBack() {
    if (confirmDiscard(dirty)) router.push("/agents");
  }

  // After any save, refresh the agents-list cache too so the directory shows
  // the new name / status / node-count without a hard reload.
  function refreshList() {
    globalMutate("/api/agents/");
  }

  async function handleSaveWorkflow(wNodes: WorkflowNode[], wEdges: WorkflowEdge[]) {
    setIsSaving(true);
    try {
      // When the user has authored a primary prompt OR variables, save in
      // v1.0 envelope form so the new schema features round-trip through the
      // backend. Otherwise stay on the legacy {nodes,edges} path so existing
      // rows are not silently upgraded.
      if (primaryPrompt || variables.length > 0) {
        const meta: WorkflowMeta = {
          agent_type: agent?.agent_type ?? "carrier_sales",
          name: agent?.name ?? "Workflow",
          entrypoint:
            wNodes.find((n) => n.type === "trigger")?.id ?? wNodes[0]?.id ?? "n1",
          primary_prompt: primaryPrompt || undefined,
          primary_prompt_vars: primaryPromptVars,
        };
        const envelope = fromReactFlow(wNodes, wEdges, meta, variables);
        await updateAgent(id, { workflow_json: envelope });
      } else {
        await updateAgent(id, { workflow_nodes: wNodes, workflow_edges: wEdges });
      }
      setIsDirty(false);
      mutate();
      refreshList();
      setLastSavedAt(new Date());
      toast({ title: "Workflow saved", variant: "success" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function handleSavePrompt() {
    setIsSaving(true);
    try {
      await updateAgent(id, { system_prompt: systemPrompt });
      mutate();
      refreshList();
      setLastSavedAt(new Date());
      toast({ title: "Prompt saved", variant: "success" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    try {
      await updateAgent(id, {
        name: agentName,
        phone_number: phoneNumber,
        voice_id: voiceId,
        enabled_tools: enabledTools,
      });
      mutate();
      refreshList();
      setLastSavedAt(new Date());
      toast({ title: "Settings saved", variant: "success" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  function toggleTool(key: string) {
    setEnabledTools((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  function resetToolsToDefault() {
    if (!agent) return;
    setEnabledTools(DEFAULT_TOOLS_BY_TYPE[agent.agent_type] ?? []);
  }

  // Performs the actual delete after the user confirms in the modal. Kept
  // separate from the trigger so the modal's "Delete" footer button is the
  // sole entry point — no risk of bypassing the confirmation step.
  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await deleteAgent(id);
      toast({ title: "Agent deleted" });
      setShowDeleteDialog(false);
      router.push("/agents");
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setIsDeleting(false);
    }
  }

  async function handlePingTMS() {
    setTmsPinging(true);
    try { await pingTMS(); setTmsStatus("ok"); }
    catch { setTmsStatus("error"); }
    finally { setTmsPinging(false); }
  }

  async function handleTestCall() {
    if (!testPhone.trim()) {
      toast({ title: "Enter a phone number", description: "E.164 format: +1 555 000 0000", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      // Filter out empty param values before sending
      const cleanParams: TestCallParams = {};
      for (const [k, v] of Object.entries(testParams)) {
        if (v && v.trim()) cleanParams[k as keyof TestCallParams] = v.trim();
      }
      await testCall(id, testPhone.trim(), Object.keys(cleanParams).length > 0 ? cleanParams : undefined);
      setShowCallDialog(false);
      toast({ title: "Calling " + testPhone.trim(), description: `Agent: ${agent?.name} — pick up your phone!` });
    } catch (err) {
      toast({ title: "Test call failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    // Only the *data-dependent* chrome reads as loading: the title (agent name
    // isn't known on a cold/direct load) and the node graph. Everything that's
    // static — the back affordance, the Workflow/Prompt/Settings tab strip, and
    // the Canvas shell (palette + control rail + dot grid) — renders for real,
    // so the load→loaded transition never jumps. The footer is fetched metadata
    // so it stays a skeleton until the agent resolves.
    return (
      <div className="converse-fullbleed-page" style={{
        display: "flex", flexDirection: "column", height: "100%",
        background: "var(--bg-neutral-primary)",
      }}>
        <PageHeader
          style={{ flexShrink: 0, background: "var(--bg-neutral-primary)" }}
          backAction={{ label: "Back to agents", onClick: handleBack }}
          title={<Skeleton width={200} height={18} />}
        />

        <div style={{
          flexShrink: 0,
          background: "var(--bg-neutral-primary)",
          padding: "0px 0px",
        }}>
          <Tabs
            items={TAB_ITEMS}
            value={activeTab}
            onChange={(id) => setActiveTab(id)}
            variant="primary"
            ariaLabel="Agent studio sections"
          />
        </div>

        {/* Real Canvas shell (palette + controls + dot grid); the node graph
            shows skeleton cards via `isLoading`. */}
        <div style={{
          flex: 1, minHeight: 0, overflow: "hidden",
          background: "var(--bg-neutral-primary)",
          display: "flex", flexDirection: "column",
        }}>
          <Canvas onSave={handleSaveWorkflow} isSaving={isSaving} isLoading />
        </div>

        {/* Status footer — fetched metadata, so skeleton until the agent loads. */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 40, padding: "0 20px",
          background: "var(--bg-neutral-primary)",
          borderTop: "1px solid var(--border-neutral-subtle)",
        }}>
          <Skeleton width={180} height={12} />
          <Skeleton width={210} height={12} />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{
        padding: "40px 24px",
        fontSize: 13,
        color: "var(--text-neutral-secondary)",
      }}>
        Agent not found.
      </div>
    );
  }

  // Direction label for the footer.
  const dir = AGENT_DIRECTION[agent.agent_type] ?? "both";
  const dirLabel = dir === "inbound" ? "Inbound" : dir === "outbound" ? "Outbound" : "Both";

  return (
    <div className="converse-fullbleed-page" style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-neutral-primary)",
    }}>

      {/* ── Top bar — DS PageHeader. backAction returns to the list; the title
          carries just the agent name (type / direction / status / created live
          in the footer; Test call + Delete live in the floating canvas
          toolbar — see <Canvas onTestCall/onDelete>). */}
      <PageHeader
        style={{ flexShrink: 0, background: "var(--bg-neutral-primary)" }}
        backAction={{ label: "Back to agents", onClick: handleBack }}
        title={agent.name}
      />

      {/* ── Tab bar (DS Tabs) ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: "var(--bg-neutral-primary)",
        padding: "0px 0px",
      }}>
        <Tabs
          items={TAB_ITEMS}
          value={activeTab}
          onChange={(id) => setActiveTab(id)}
          variant="primary"
          ariaLabel="Agent studio sections"
        />
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "workflow" && (
          <motion.div
            key="workflow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.07 } }}
            transition={{ duration: 0.16 }}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              background: "var(--bg-neutral-primary)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Canvas fills the full tab area edge-to-edge — no chrome, no
                inset padding. The palette + ReactFlow surface own the visual
                boundaries themselves. */}
            <Canvas
              onSave={handleSaveWorkflow}
              isSaving={isSaving}
              onTestCall={() => setShowCallDialog(true)}
              onDelete={() => setShowDeleteDialog(true)}
            />
          </motion.div>
        )}

        {activeTab === "prompt" && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.07 } }}
            transition={{ duration: 0.16 }}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 24px",
              background: "var(--bg-neutral-secondary)",
            }}
          >
            <div style={{ maxWidth: 720, margin: "0 auto" }}>

              {/* Page header — standalone, mirrors the Settings tab */}
              <Stack gap="xxs" style={{ marginBottom: 16 }}>
                <Typography variant="heading-h5" color="primary">Agent instructions</Typography>
                <Typography variant="caption-regular" color="tertiary">
                  Free-text prompt sent to the LLM at the start of every call.
                </Typography>
              </Stack>

              <Stack gap="md">
                {/* Prompt editor card — banner + variable chips + textarea */}
                <Surface variant="primary" padding="lg" radius="xl">
                  <Stack gap="md">
                    {/* Default-prompt banner — flat secondary surface; the warning
                        Tag carries the "this is still the template default" signal. */}
                    {isDefaultPrompt && (
                      <Surface variant="secondary" radius="lg" padding="sm">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Tag variant="warning" size="sm">Template default</Tag>
                          <Typography variant="caption-regular" color="secondary">
                            Edit and save to create your custom version — overrides the default for every call.
                          </Typography>
                        </div>
                      </Surface>
                    )}

                    {/* Variable hints */}
                    <Stack gap="xs">
                      <Typography variant="overline-medium" color="tertiary">
                        Available variables — click to insert
                      </Typography>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {VARIABLE_HINTS.map((v) => (
                          <button
                            key={v}
                            onClick={() => setSystemPrompt((p) => p + " " + v)}
                            style={{ all: "unset", cursor: "pointer" }}
                            aria-label={`Insert ${v}`}
                          >
                            <Tag variant="brand" size="sm">{v}</Tag>
                          </button>
                        ))}
                      </div>
                    </Stack>

                    {/* Prompt textarea */}
                    <Input
                      kind="textarea"
                      size="md"
                      value={systemPrompt}
                      onChange={(e) => { setSystemPrompt(e.currentTarget.value); setIsDefaultPrompt(false); }}
                      placeholder={"You are a carrier sales agent for Hemut Freight. Your goal is to negotiate the best possible rate for load [reference_number]...\n\nWhen a carrier calls:\n1. Greet them professionally\n2. Ask for their MC number\n3. Verify them via verify_carrier()\n4. Find the load via find_load()\n5. Negotiate rate with negotiate_rate()"}
                      rows={18}
                      caption={`${systemPrompt.length} characters`}
                    />
                  </Stack>
                </Surface>

                {/* Save — bottom-right, mirrors the Settings tab */}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSavePrompt}
                    disabled={isSaving || !promptDirty}
                    loading={isSaving}
                    leftIcon="floppy-disk"
                  >
                    {isSaving ? "Saving…" : "Save prompt"}
                  </Button>
                </div>
              </Stack>
            </div>
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.07 } }}
            transition={{ duration: 0.16 }}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 24px",
              background: "var(--bg-neutral-secondary)",
            }}
          >
            <div style={{ maxWidth: 720, margin: "0 auto" }}>

              {/* Page header — standalone, mirrors the Prompt tab */}
              <Stack gap="xxs" style={{ marginBottom: 16 }}>
                <Typography variant="heading-h5" color="primary">Configuration</Typography>
                <Typography variant="caption-regular" color="tertiary">
                  Identity, phone number, voice, and tools for this agent.
                </Typography>
              </Stack>

              <Stack gap="md">

                {/* ── Basic ─────────────────────────────────────────────────── */}
                <SettingsSection
                  icon="identification-card"
                  title="Basic"
                  description="Identity and runtime status."
                >
                  <Stack gap="md">
                    <Input
                      kind="text"
                      size="md"
                      label="Agent name"
                      placeholder="Carrier Sales Bot"
                      value={agentName}
                      onChange={(e) => setAgentName(e.currentTarget.value)}
                    />
                    <ToggleRow
                      label="Active"
                      description="Enable to receive and make calls."
                      checked={active}
                      onChange={(e) => setActive(e.currentTarget.checked)}
                    />
                  </Stack>
                </SettingsSection>

                {/* ── Phone ─────────────────────────────────────────────────── */}
                <SettingsSection
                  icon="phone"
                  title="Phone"
                  description="The number that routes inbound calls to this agent."
                >
                  <Input
                    kind="text"
                    size="md"
                    label="Assigned number"
                    placeholder="+1 555 000 0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.currentTarget.value)}
                    caption="Calls to this number route to this agent."
                  />
                </SettingsSection>

                {/* ── Voice ─────────────────────────────────────────────────── */}
                <SettingsSection
                  icon="waveform"
                  title="Voice"
                  description="Pick the TTS voice the agent speaks with."
                >
                  <Dropdown
                    label="Voice model"
                    size="md"
                    value={voiceId}
                    onChange={(v) => setVoiceId(typeof v === "string" ? v : v[0] ?? "")}
                    options={VOICE_IDS.map((v) => ({ value: v.id, label: v.label }))}
                    searchable
                    searchPlaceholder="Search voices…"
                  />
                </SettingsSection>

                {/* ── Tools ─────────────────────────────────────────────────── */}
                <SettingsSection
                  icon="wrench"
                  title="Tools"
                  description="Choose which @function_tool calls the LLM can invoke."
                  headerActions={
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <Typography variant="caption-regular" color="tertiary">
                        {enabledTools.length}/{ALL_TOOLS.length} enabled
                      </Typography>
                      <Button variant="outline" size="sm" onClick={resetToolsToDefault}>
                        Reset to defaults
                      </Button>
                    </div>
                  }
                >
                  {/* Category legend */}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {(["core", "tms", "outbound", "utility"] as const).map((cat) => (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: TOOL_CATEGORY_COLORS[cat],
                        }} />
                        <Typography variant="overline-medium" color="tertiary">{cat}</Typography>
                      </div>
                    ))}
                  </div>

                  {/* Tool list */}
                  <Stack gap="xs">
                    {ALL_TOOLS.map((tool) => {
                      const isOn = enabledTools.includes(tool.key);
                      const isAlwaysOn = tool.key === "log_call" || tool.key === "hang_up";
                      return (
                        <Surface
                          key={tool.key}
                          variant={isOn ? "primary" : "secondary"}
                          radius="lg"
                          padding="none"
                          onClick={() => { if (!isAlwaysOn) toggleTool(tool.key); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 12px",
                            border: `1px solid ${isOn
                              ? "var(--border-brand-subtle, rgba(245,166,35,0.4))"
                              : "transparent"}`,
                            background: isOn
                              ? "var(--bg-brand-subtle, rgba(245,166,35,0.06))"
                              : undefined,
                            cursor: isAlwaysOn ? "default" : "pointer",
                            transition: "background 0.12s, border-color 0.12s",
                          }}
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: TOOL_CATEGORY_COLORS[tool.category],
                            flexShrink: 0,
                          }} />

                          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                            <Toggle
                              size="sm"
                              checked={isOn}
                              disabled={isAlwaysOn}
                              onChange={() => toggleTool(tool.key)}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Typography variant={isOn ? "body-sm-semibold" : "body-sm-medium"} color="primary">
                                {tool.label}
                              </Typography>
                              {isAlwaysOn && (
                                <Tag variant="neutral" size="xm">Always on</Tag>
                              )}
                            </div>
                            <Typography
                              variant="caption-regular"
                              color="tertiary"
                              style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {tool.description}
                            </Typography>
                          </div>
                        </Surface>
                      );
                    })}
                  </Stack>
                </SettingsSection>

                {/* ── TMS connection ────────────────────────────────────────── */}
                <SettingsSection
                  icon="plugs-connected"
                  title="TMS connection"
                  description="Verify the agent can reach your TMS / CRM webhook."
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePingTMS}
                      disabled={tmsPinging}
                      loading={tmsPinging}
                      leftIcon="arrows-clockwise"
                    >
                      Test connection
                    </Button>
                    {tmsStatus === "ok"    && <Tag variant="success" size="sm">Connected</Tag>}
                    {tmsStatus === "error" && <Tag variant="error"   size="sm">Failed</Tag>}
                  </div>
                </SettingsSection>

                {/* Save */}
                <div style={{
                  display: "flex", justifyContent: "flex-end",
                  paddingTop: 8,
                }}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveSettings}
                    disabled={isSaving || !settingsDirty}
                    loading={isSaving}
                    leftIcon="floppy-disk"
                  >
                    {isSaving ? "Saving…" : "Save settings"}
                  </Button>
                </div>

              </Stack>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status footer ───────────────────────────────────────────────────
          Carries the at-a-glance metadata moved out of the header: live status
          + type/direction on the left, node count / created / last-saved on the
          right. Mirrors the reference editor footer. */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, padding: "0 20px", height: 40,
        background: "var(--bg-neutral-primary)",
        borderTop: "1px solid var(--border-neutral-subtle)",
        fontSize: 12, color: "var(--text-neutral-tertiary)",
      }}>
        {/* Left — status + identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background:
                agent.status === "active" ? "var(--green-500)"
                : agent.status === "paused" ? "var(--brand-400)"
                : "var(--text-neutral-disabled)",
            }} />
            <span style={{ color: "var(--text-neutral-secondary)", fontWeight: 500, textTransform: "capitalize" }}>
              {agent.status}
            </span>
          </span>
          <span style={{ color: "var(--border-neutral-bold)" }}>·</span>
          <span>{agentTypeLabel(agent.agent_type)}</span>
          <span style={{ color: "var(--border-neutral-bold)" }}>·</span>
          <span>{dirLabel}</span>
        </div>

        {/* Right — workflow + timestamps */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i className="ph ph-graph" style={{ fontSize: 13 }} />
            {nodes.length} node{nodes.length === 1 ? "" : "s"}
          </span>
          <span style={{ color: "var(--border-neutral-bold)" }}>·</span>
          <span>Created {formatDate(agent.created_at)}</span>
          {lastSavedAt && (
            <>
              <span style={{ color: "var(--border-neutral-bold)" }}>·</span>
              <span style={{ color: "var(--text-neutral-secondary)" }}>
                Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Test Call Drawer ────────────────────────────────────────────────
          DS `Drawer` handles the slide animation, focus trap, ESC close, and
          backdrop dismissal. The body is a Stack of DS form controls so it
          shares rhythm with the Settings tab. */}
      <Drawer
        open={showCallDialog}
        onClose={() => setShowCallDialog(false)}
        title="Test call"
        subtitle={
          agent.agent_type === "carrier_sales"
            ? `${agent.name} — caller provides MC# live. Just enter your phone.`
            : `${agent.name} — fill in the scenario params so the agent has real context.`
        }
        placement="right"
        size="md"
      >
        <Drawer.Body>
          <Stack gap="md">
            <Input
              kind="phone"
              size="md"
              label="Your phone number"
              placeholder="940 493 0104"
              defaultCountry="US"
              value={testPhone}
              onChange={(e) => setTestPhone(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowCallDialog(false);
                if (e.key === "Enter") handleTestCall();
              }}
              autoFocus={showCallDialog}
            />

            {(() => {
              const paramDefs = TEST_PARAMS_BY_TYPE[agent.agent_type] ?? [];
              if (paramDefs.length === 0) return null;
              return (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                    color: "var(--text-neutral-tertiary)",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}>
                    Scenario params
                  </div>
                  {paramDefs.map((def) => (
                    <Input
                      key={def.key}
                      kind="text"
                      size="md"
                      label={def.label}
                      placeholder={def.placeholder}
                      value={testParams[def.key] ?? ""}
                      onChange={(e) => {
                        const v = e.currentTarget?.value ?? "";
                        setTestParams((p) => ({ ...p, [def.key]: v }));
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleTestCall(); }}
                    />
                  ))}
                </>
              );
            })()}

            <div style={{
              fontSize: 12,
              color: "var(--text-neutral-tertiary)",
              marginTop: 4,
              lineHeight: 1.5,
            }}>
              Twilio will call your number. The agent answers with the params
              above pre-loaded as context.
            </div>
          </Stack>
        </Drawer.Body>
        <Drawer.Footer align="between">
          <Button variant="ghost" size="md" onClick={() => setShowCallDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleTestCall}
            disabled={isTesting}
            loading={isTesting}
            leftIcon="phone"
          >
            {isTesting ? "Placing call…" : "Place test call"}
          </Button>
        </Drawer.Footer>
      </Drawer>

      {/* ── Delete confirmation modal ───────────────────────────────────────
          Replaces the old window.confirm() so the destructive action gets a
          themed, accessible double-confirmation. `role="alertdialog"` tells
          assistive tech this prompt requires a decision before dismissal,
          and `closeOnBackdropClick={false}` prevents accidental confirms
          (e.g. clicking outside in a hurry). The modal stays open while the
          delete request is in flight (`loading`), so users can't fire a
          second delete by clicking again. */}
      <Modal
        open={showDeleteDialog}
        onClose={() => { if (!isDeleting) setShowDeleteDialog(false); }}
        role="alertdialog"
        size="sm"
        title="Delete agent?"
        leadingIcon={<i className="ph ph-warning" style={{ fontSize: 20, color: "var(--text-error-primary)" }} />}
        closeOnBackdropClick={false}
        loading={isDeleting}
        loadingLabel="Deleting agent…"
      >
        <Modal.Body>
          <div style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-neutral-secondary)",
          }}>
            You're about to permanently delete{" "}
            <strong style={{ color: "var(--text-neutral-primary)", fontWeight: 600 }}>
              {agent.name}
            </strong>. This will remove its workflow, prompt, and call routing.
            Past run history will remain.
          </div>
          <div style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "var(--bg-error-subtle)",
            border: "1px solid var(--border-error-primary)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-error-primary)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ fontSize: 14 }} />
            <span>This action cannot be undone.</span>
          </div>
        </Modal.Body>
        <Modal.Footer align="between">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            tone="destructive"
            size="md"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            loading={isDeleting}
            leftIcon="trash"
          >
            {isDeleting ? "Deleting…" : "Delete agent"}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}
