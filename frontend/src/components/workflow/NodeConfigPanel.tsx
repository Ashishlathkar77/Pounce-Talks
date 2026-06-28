"use client";

/**
 * NodeConfigPanel — floating side panel for editing the selected workflow node.
 *
 * Lives as an absolutely-positioned overlay on top of the React Flow canvas
 * (NOT a DS Drawer — Drawer slides in from the viewport edge and would cover
 * other UI; we want a panel that floats inside the canvas region, leaving the
 * left palette + bottom controls visible).
 *
 * Visual chrome is built from DS primitives only:
 *   • `Surface` for the panel container (neutral-primary card with shadow).
 *   • `Stack`   for vertical rhythm.
 *   • `Tag`     for the node-type pill in the header.
 *   • `Input`   for label, description, fields, routes, URL.
 *   • `Dropdown` for direction, model, action, HTTP method.
 *   • `Button`  for Delete node / close / instructions toggle.
 *
 * Edits auto-propagate to the workflow store as the user types — there is
 * no longer an "Apply changes" commit step (its absence was a UX trap that
 * silently dropped panel edits when users clicked "Save workflow" first).
 * A footer hint reminds users to click "Save workflow" on the canvas to
 * persist to the backend.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Surface,
  Stack,
  Tag,
  Button,
  Input,
  Dropdown,
  Avatar,
  Typography,
} from "@hemut2025/design-system";
import { ReactNode } from "react";
import { useViewport, useStore } from "@xyflow/react";
import { IOField, NodeData, NodeInput, VariableType, WorkflowNode } from "@/lib/types";
import { useWorkflowStore } from "@/lib/store";
import { TOOL_CATALOG, TOOL_NAMES, getToolSpec } from "@/lib/toolCatalog";
import { NODE_WIDTH } from "@/components/workflow/nodes/BaseNode";

// ── Catalogue ────────────────────────────────────────────────────────────────
//
// Action-node tool list comes from the generated catalog
// (`@/lib/toolCatalog`) which mirrors `backend/voice_agent/tools/catalog.py`.
// Re-run `python -m scripts.export_workflow_jsonschema` from `backend/`
// after adding a new tool there.

/**
 * Per-type tag variant for the type pill in the header. Mirrors the tones in
 * `BaseNode.tsx` so the panel header reads as the same family as the node it
 * configures.
 */
/**
 * Header identity per node type — the Phosphor slug shown in the avatar tile
 * (mirrors the on-canvas node icons in Canvas.tsx) plus a short subtitle that
 * reads under the title, giving the compact header an app-style "icon + name +
 * what it is" line like the reference.
 */
const NODE_ICON: Record<string, string> = {
  trigger:         "phone",
  ai_conversation: "chat-circle-text",
  classify:        "git-branch",
  extract:         "scissors",
  action:          "lightning",
  webhook:         "globe",
};

const NODE_SUBTITLE: Record<string, string> = {
  trigger:         "Workflow entry point",
  ai_conversation: "LLM dialogue turn",
  classify:        "Branch on a value",
  extract:         "Pull structured data",
  action:          "Call a tool",
  webhook:         "External HTTP call",
};

/**
 * Section — a whitespace-divided group inside the panel body. No borders, no
 * card chrome: an optional uppercase-style label sits above its fields and the
 * surrounding `Stack gap` provides the only separation. This is what gives the
 * body its clean "sections divided by white space" feel (vs. the old nested
 * bordered Surface cards).
 */
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Stack gap="sm">
      {title && (
        <Typography variant="label-sm-semibold" color="tertiary">
          {title}
        </Typography>
      )}
      <Stack gap="md">{children}</Stack>
    </Stack>
  );
}

const NODE_INSTRUCTIONS: Record<string, { title: string; body: string }> = {
  trigger: {
    title: "Trigger Node",
    body: `Starts the workflow when a call arrives. Set direction to Inbound for calls coming in to your number, or Outbound for calls your agent makes.

Every workflow must begin with exactly one Trigger node. Connect it to an AI Conversation or Action node to start the flow.`,
  },
  ai_conversation: {
    title: "AI Conversation Node",
    body: `An open-ended LLM turn where the agent talks, listens, and decides what to do next. The LLM can speak naturally, ask questions, and call tools automatically based on the conversation.

Set the model (gpt-4.1 is best for complex reasoning) and the maximum number of turns before escalating to a human. Connect to Action nodes for tool calls, or Classify nodes to branch based on what was said.`,
  },
  classify: {
    title: "Classify / Route Node",
    body: `Branches the workflow based on a detected value or decision. Use this to route calls differently depending on intent, carrier status, or outcome.

Add comma-separated route labels (e.g. "accepted, declined, transferred"). Each label becomes an output handle you can connect to the next step.`,
  },
  extract: {
    title: "Extract Node",
    body: `Pulls structured data from the conversation — like MC numbers, reference numbers, rate offers, or locations. The LLM extracts these values and makes them available to downstream nodes.

Add comma-separated field names for what you want to capture (e.g. "mc_number, reference_number, carrier_name").`,
  },
  action: {
    title: "Action / Tool Node",
    body: `Calls a specific tool during the conversation. The LLM triggers this automatically when the right moment arrives in the flow.

Available tools:
• verify_carrier — verify MC via Highway API
• move_on — transition from carrier verification to load finding
• find_load — look up a load by reference number
• find_loads_by_lane — search loads by origin + equipment
• evaluate_offer — run negotiation logic
• book_load — book the load in TMS
• transfer_to_human — warm transfer to a rep
• hang_up — end the call
• log_call — record the call outcome
• capture_location — log driver location / ETA
• ask_for_more_loads — check for additional capacity
• get_load_status — check load status in TMS`,
  },
  webhook: {
    title: "Webhook Node",
    body: `Makes an HTTP call to any external URL when this step is reached. Use this to notify your TMS, trigger a Slack alert, update a CRM, or call any custom endpoint.

Set the URL and method (POST is most common). The payload includes the current call context. The response is available to downstream nodes.`,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ddSingle(value: string, options: { value: string; label: string }[], onChange: (v: string) => void, label: string) {
  return (
    <Dropdown
      label={label}
      size="md"
      value={value}
      onChange={(v) => onChange(typeof v === "string" ? v : v[0] ?? "")}
      options={options}
    />
  );
}

/** Small row spanning the panel width: title + helper + an "Add" button. */
function SectionHeading({
  title,
  helper,
  onAdd,
}: {
  title: string;
  helper?: string;
  onAdd: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-neutral-tertiary)",
          marginBottom: 2,
        }}>
          {title}
        </div>
        {helper && (
          <div style={{
            fontSize: 11,
            color: "var(--text-neutral-tertiary)",
            lineHeight: 1.4,
          }}>
            {helper}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" leftIcon="plus" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 12,
      color: "var(--text-neutral-tertiary)",
      padding: "8px 10px",
      background: "var(--bg-neutral-secondary)",
      border: "1px dashed var(--border-neutral-subtle)",
      borderRadius: 6,
    }}>
      {label}
    </div>
  );
}

/**
 * IORow — single input/output editor row.
 *
 * `withFrom` toggles the source-mapping textbox: inputs always show it,
 * outputs never do (outputs are *produced* by the node, not pulled from
 * elsewhere). The `from` field is a free-text textbox so users can author
 * any of: `n3.outputs.foo`, `$variables.x`, `$context.caller_phone`,
 * `$state.attempts`, `literal:hello`. A future pass can swap this for a
 * structured source picker.
 */
function IORow({
  io,
  withFrom,
  onChange,
  onDelete,
}: {
  io: IOField | NodeInput;
  withFrom?: boolean;
  onChange: (next: IOField | NodeInput) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 10,
      background: "var(--bg-neutral-secondary)",
      border: "1px solid var(--border-neutral-subtle)",
      borderRadius: 6,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <Input
            kind="text"
            size="sm"
            placeholder="name"
            value={io.name}
            onChange={(e) => onChange({ ...io, name: e.currentTarget.value })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <Dropdown
            size="sm"
            value={io.type}
            onChange={(v) => onChange({ ...io, type: (typeof v === "string" ? v : v[0] ?? "string") as VariableType })}
            options={VARIABLE_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </div>
        <Button
          variant="ghost"
          tone="destructive"
          size="sm"
          leftIcon="trash"
          aria-label="Delete row"
          onClick={onDelete}
        />
      </div>
      {withFrom && (
        <Input
          kind="text"
          size="sm"
          placeholder="from — e.g. n3.outputs.mc_number"
          value={(io as NodeInput).from ?? ""}
          onChange={(e) => onChange({ ...io, from: e.currentTarget.value })}
        />
      )}
      <Input
        kind="text"
        size="sm"
        placeholder="description (optional)"
        value={io.description ?? ""}
        onChange={(e) => onChange({ ...io, description: e.currentTarget.value })}
      />
    </div>
  );
}

// ── Action node form (catalog-driven) ────────────────────────────────────────

/**
 * ActionNodeForm — purpose-built UI for the v1.0 `action` node type.
 *
 * Action nodes call a predefined tool from the registry. Their input and
 * output schemas are NOT free-form — they're derived from the tool's
 * catalog spec (`@/lib/toolCatalog`) which mirrors the backend's
 * `voice_agent.tools.catalog.TOOL_CATALOG`. This form therefore renders:
 *
 *   1. A tool picker (Dropdown) backed by `TOOL_NAMES`.
 *   2. The selected tool's description (read-only blurb so the author
 *      knows what it does without leaving the canvas).
 *   3. One row per tool input parameter, with a single source-ref textbox
 *      (e.g. `n3.outputs.mc_number`, `$variables.api_key`,
 *      `$context.caller_phone`, `literal:hello`). Required params are
 *      flagged; missing required mappings will 422 from the backend.
 *   4. A read-only Outputs preview with copy-friendly chips so the author
 *      can paste `nX.outputs.<field>` references into downstream nodes.
 *   5. An optional Result alias section to rename specific outputs (the
 *      backend honours both `result_alias` and the legacy `result_mapping`).
 *
 * What this form does NOT expose: free-form inputs[] / outputs[]. The
 * backend `apply_tool_catalog` validator overwrites those with the catalog
 * shape on save, so editing them in the UI would just be confusing.
 */
function ActionNodeForm({
  tool,
  argMapping,
  resultAlias,
  onChange,
}: {
  tool: string;
  argMapping: Record<string, string>;
  resultAlias: Record<string, string>;
  onChange: (patch: {
    tool?: string;
    argMapping?: Record<string, string>;
    resultAlias?: Record<string, string>;
  }) => void;
}) {
  const spec = tool ? getToolSpec(tool) : undefined;

  const toolOptions = [
    { value: "", label: "Select a tool…" },
    ...TOOL_NAMES.map((t) => ({
      value: t,
      label: TOOL_CATALOG[t].description ? `${t} — ${TOOL_CATALOG[t].description.slice(0, 60)}` : t,
    })),
  ];

  function setArg(name: string, value: string) {
    const next = { ...argMapping };
    if (!value.trim()) {
      delete next[name];
    } else {
      next[name] = value;
    }
    onChange({ argMapping: next });
  }

  function setAlias(originalName: string, alias: string) {
    const next = { ...resultAlias };
    if (!alias.trim() || alias === originalName) {
      delete next[originalName];
    } else {
      next[originalName] = alias;
    }
    onChange({ resultAlias: next });
  }

  return (
    <Stack gap="md">
      <Dropdown
        label="Tool to call"
        size="md"
        value={tool}
        onChange={(v) => onChange({ tool: typeof v === "string" ? v : v[0] ?? "" })}
        options={toolOptions}
        searchable
        searchPlaceholder="Search tools…"
      />

      {spec ? (
        <>
          {/* Tool description */}
          {spec.description && (
            <Surface
              variant="primary"
              radius="lg"
              border="primary"
              padding="md"
              style={{ background: "var(--bg-info-subtle, var(--bg-neutral-secondary))" }}
            >
              <div style={{
                fontSize: 12,
                color: "var(--text-neutral-secondary)",
                lineHeight: 1.5,
              }}>
                {spec.description}
              </div>
            </Surface>
          )}

          {/* Argument mapping */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-neutral-tertiary)",
              marginBottom: 6,
            }}>
              Argument mapping
            </div>
            <div style={{
              fontSize: 11, color: "var(--text-neutral-tertiary)",
              marginBottom: 10, lineHeight: 1.4,
            }}>
              Wire each tool parameter to a source: <code>n3.outputs.foo</code>,{" "}
              <code>$variables.x</code>, <code>$context.caller_phone</code>, or{" "}
              <code>literal:value</code>. Required params must be mapped.
            </div>
            {spec.inputs.length === 0 && (
              <EmptyHint label="This tool takes no parameters." />
            )}
            <Stack gap="xs">
              {spec.inputs.map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: 10,
                    background: "var(--bg-neutral-secondary)",
                    border: "1px solid var(--border-neutral-subtle)",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: "var(--text-neutral-primary)",
                      fontFamily: "var(--font-mono, monospace)",
                    }}>
                      {p.name}
                    </span>
                    <Tag size="xm" variant="neutral">{p.type}</Tag>
                    {p.required ? (
                      <Tag size="xm" variant="warning">required</Tag>
                    ) : (
                      <Tag size="xm" variant="neutral">optional</Tag>
                    )}
                  </div>
                  {p.description && (
                    <div style={{
                      fontSize: 11,
                      color: "var(--text-neutral-tertiary)",
                      lineHeight: 1.4,
                    }}>
                      {p.description}
                    </div>
                  )}
                  <Input
                    kind="text"
                    size="sm"
                    placeholder={p.required ? "Required — e.g. n3.outputs.mc_number" : "Optional source ref"}
                    value={argMapping[p.name] ?? ""}
                    onChange={(e) => setArg(p.name, e.currentTarget.value)}
                  />
                </div>
              ))}
            </Stack>
          </div>

          {/* Outputs preview */}
          {spec.outputs.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-neutral-tertiary)",
                marginBottom: 6,
              }}>
                Tool outputs
              </div>
              <div style={{
                fontSize: 11, color: "var(--text-neutral-tertiary)",
                marginBottom: 10, lineHeight: 1.4,
              }}>
                Downstream nodes can reference any of these as
                {" "}<code>nX.outputs.&lt;name&gt;</code>. Add a Result alias below to
                rename one without changing the catalog.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {spec.outputs.map((o) => {
                  const alias = resultAlias[o.name];
                  return (
                    <Tag
                      key={o.name}
                      size="sm"
                      variant={alias ? "brand" : "neutral"}
                      title={o.description ?? ""}
                    >
                      {alias ? `${o.name} → ${alias}` : o.name}
                      <span style={{
                        marginLeft: 6,
                        opacity: 0.6,
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 10,
                      }}>
                        :{o.type}
                      </span>
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}

          {/* Result alias editor — collapsed if no aliases yet, expandable */}
          <details style={{ marginTop: 4 }}>
            <summary style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-neutral-tertiary)",
              cursor: "pointer",
            }}>
              Result aliases
              {Object.keys(resultAlias).length > 0 && (
                <span style={{ marginLeft: 6, color: "var(--text-neutral-secondary)" }}>
                  ({Object.keys(resultAlias).length})
                </span>
              )}
            </summary>
            <div style={{ marginTop: 10 }}>
              <Stack gap="xs">
                {spec.outputs.map((o) => (
                  <div key={o.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      flex: 1, fontSize: 12,
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--text-neutral-secondary)",
                    }}>
                      {o.name}
                    </span>
                    <span style={{ color: "var(--text-neutral-tertiary)", fontSize: 12 }}>→</span>
                    <div style={{ flex: 1 }}>
                      <Input
                        kind="text"
                        size="sm"
                        placeholder="(no alias)"
                        value={resultAlias[o.name] ?? ""}
                        onChange={(e) => setAlias(o.name, e.currentTarget.value)}
                      />
                    </div>
                  </div>
                ))}
              </Stack>
            </div>
          </details>
        </>
      ) : (
        tool && (
          <EmptyHint
            label={`Tool '${tool}' is not in the catalog. Add it to backend/voice_agent/tools/catalog.py and re-run the export script.`}
          />
        )
      )}
    </Stack>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface NodeConfigPanelProps {
  node: WorkflowNode;
}

// Reads `data.inputs` / `data.outputs` placed there by `schemaNodeToReactFlow`
// in @/lib/workflow. Legacy nodes (no inputs/outputs on data) start with
// empty arrays and the user can add fields as they author the v1.0 graph.
interface NodeDataWithIO extends NodeData {
  function?: string;
  inputs?: NodeInput[];
  outputs?: IOField[];
}

const VARIABLE_TYPES: VariableType[] = [
  "string", "number", "integer", "boolean", "object", "array",
];

export default function NodeConfigPanel({ node }: NodeConfigPanelProps) {
  const { nodes, setNodes, setSelectedNode, setIsDirty } = useWorkflowStore();
  const [label, setLabel]             = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description ?? "");
  const [config, setConfig]           = useState<Record<string, unknown>>(node.data.config ?? {});
  const [inputs, setInputs]           = useState<NodeInput[]>(((node.data as NodeDataWithIO).inputs) ?? []);
  const [outputs, setOutputs]         = useState<IOField[]>(((node.data as NodeDataWithIO).outputs) ?? []);
  const [showInstructions, setShowInstructions] = useState(false);

  const instructions = NODE_INSTRUCTIONS[node.type];

  // ── Sync panel-local state into the canvas store ─────────────────────────
  //
  // The previous design needed the user to click "Apply changes" before
  // panel edits propagated to the workflow store; without it, clicking
  // "Save workflow" would silently drop arg_mapping / prompt edits because
  // the canvas store still held the un-edited node. This is the bug pattern
  // that made saves *appear* to fail even when the backend 200'd.
  //
  // Now: every change to label / description / config / inputs / outputs
  // is mirrored into the store immediately. The "Save workflow" button
  // therefore always sees the latest panel state. We also preserve the
  // skip-on-mount behaviour so opening a node doesn't dirty-flag the
  // workflow purely from initial state copy.
  const initialisedFor = useState({ id: "" })[0];
  useEffect(() => {
    // Reset panel-local state when a different node is selected.
    setLabel(node.data.label);
    setDescription(node.data.description ?? "");
    setConfig(node.data.config ?? {});
    setInputs(((node.data as NodeDataWithIO).inputs) ?? []);
    setOutputs(((node.data as NodeDataWithIO).outputs) ?? []);
    initialisedFor.id = node.id;
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Skip the very first render after a node selection — that's the
    // mount-time hydration, not a user edit.
    if (initialisedFor.id !== node.id) return;
    const updatedData: NodeDataWithIO = {
      ...node.data,
      label,
      description,
      config,
      inputs,
      outputs,
    };
    // No-op if nothing actually changed (cheap shallow check on the
    // primitives most edits touch). Saves a re-render and avoids
    // accidentally flipping `isDirty` when a node is just reselected.
    const same =
      node.data.label === label &&
      (node.data.description ?? "") === description &&
      node.data.config === config &&
      (node.data as NodeDataWithIO).inputs === inputs &&
      (node.data as NodeDataWithIO).outputs === outputs;
    if (same) return;

    const updatedNode: WorkflowNode = { ...node, data: updatedData };
    setNodes(nodes.map((n) => (n.id === node.id ? updatedNode : n)));
    setSelectedNode(updatedNode);
    setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, description, config, inputs, outputs]);

  function deleteNode() {
    setNodes(nodes.filter((n) => n.id !== node.id));
    setSelectedNode(null);
    setIsDirty(true);
  }

  // Closing the panel must also clear ReactFlow's own `selected` flag on the
  // node — that flag (not the store's `selectedNode`) is what drives the card's
  // highlighted border. Clearing only `selectedNode` left the card looking
  // selected after the panel closed.
  function closePanel() {
    setNodes(
      nodes.map((n) =>
        (n as WorkflowNode & { selected?: boolean }).selected
          ? { ...n, selected: false }
          : n
      )
    );
    setSelectedNode(null);
  }

  function setConfigField(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  // ── Anchor the panel beside the selected node ────────────────────────────────
  //
  // The panel used to sit in one fixed spot; instead it now floats next to the
  // node it edits and tracks pan/zoom. `useViewport` re-renders on every
  // transform change, and the React Flow store gives the pane's pixel size — so
  // we can convert the node's flow coords to container-relative screen coords and
  // place the card to its right (flipping to the left when there's no room).
  const viewport = useViewport();
  const paneW = useStore((s) => s.width);
  const paneH = useStore((s) => s.height);

  const PANEL_W = 420;
  const PANEL_MAX_H = 600;
  const GAP = 16;
  const MARGIN = 12;

  // Node's top-left in container pixels (transform is translate(vp) · scale(zoom)).
  const nodeLeft = node.position.x * viewport.zoom + viewport.x;
  const nodeTop  = node.position.y * viewport.zoom + viewport.y;
  const nodeRight = nodeLeft + NODE_WIDTH * viewport.zoom;

  // Prefer the right of the node; flip left if the panel would overflow.
  let panelLeft = nodeRight + GAP;
  if (panelLeft + PANEL_W > paneW - MARGIN) {
    const flipped = nodeLeft - GAP - PANEL_W;
    panelLeft = flipped >= MARGIN ? flipped : Math.max(MARGIN, paneW - PANEL_W - MARGIN);
  }

  // Align near the node's top, clamped so the card stays fully on-screen.
  const panelMaxH = Math.min(PANEL_MAX_H, paneH - MARGIN * 2);
  const panelTop = Math.max(
    MARGIN,
    Math.min(nodeTop, paneH - panelMaxH - MARGIN),
  );

  return (
    // Left-docked layer. It's click-through (`pointer-events: none`) so only
    // the card itself captures clicks — the rest of the canvas (nodes, pan/zoom,
    // dot grid) stays interactive around the floating popout. Anchored to the
    // left so the selected node card on the canvas stays visible while editing.
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        // Click-through layer — only the card captures clicks, so the canvas
        // (nodes, pan/zoom, dot grid) stays interactive around the floating card.
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={{
          // Anchored beside the selected node; follows pan/zoom (see above).
          position: "absolute",
          left: panelLeft,
          top: panelTop,
          width: PANEL_W,
          maxHeight: panelMaxH,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
      <Surface
        variant="primary"
        radius="lg"
        border="primary"
        shadow="lg"
        padding="none"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Compact header — avatar tile + title/subtitle on one row, with the
            info + close actions trailing. No tag pill and no heavy divider; the
            header just sits flush above the body for a clean, app-style chrome. */}
        <div style={{
          padding: "12px 14px 12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}>
          <Avatar
            shape="rounded"
            size="md"
            iconName={NODE_ICON[node.type] ?? "circle"}
            aria-label={`${node.type} node`}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body-md-semibold"
              color="primary"
              as="div"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label || "Untitled node"}
            </Typography>
            <Typography variant="body-sm-regular" color="tertiary" as="div">
              {NODE_SUBTITLE[node.type] ?? node.type.replace(/_/g, " ")}
            </Typography>
          </div>

          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <Button
              variant={showInstructions ? "secondary" : "ghost"}
              size="sm"
              leftIcon="info"
              aria-label="Toggle instructions"
              title="Toggle instructions"
              onClick={() => setShowInstructions((v) => !v)}
            />
            <Button
              variant="ghost"
              size="sm"
              leftIcon="x"
              aria-label="Close panel"
              onClick={closePanel}
            />
          </div>
        </div>

        {/* Scrollable body — white (neutral-primary), with generous vertical
            rhythm so sections read as separated by whitespace rather than by
            borders or cards. */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 20px 20px",
          background: "var(--bg-neutral-primary)",
        }}>
          <Stack gap="lg">

            {/* Instructions */}
            <AnimatePresence>
              {showInstructions && instructions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  {/* Instructions stay in a subtle filled callout (the one
                      surface that *should* stand apart from the white body — it's
                      transient help, not a field group). */}
                  <Surface
                    variant="secondary"
                    radius="lg"
                    border="primary"
                    padding="md"
                  >
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-neutral-tertiary)",
                      marginBottom: 8,
                    }}>
                      How to use
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "var(--text-neutral-secondary)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-line",
                    }}>
                      {instructions.body}
                    </div>
                  </Surface>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Common fields — no card wrapper; just the inputs, whitespace
                separates them from the next section. */}
            <Section>
              <Input
                kind="text"
                size="md"
                label="Label"
                placeholder="Node label"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
              />
              <Input
                kind="text"
                size="md"
                label="Description (optional)"
                placeholder="Describe what this node does"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </Section>

            {/* Per-type fields */}
            <Section title="Configuration">

                {node.type === "trigger" && ddSingle(
                  (config.direction as string) ?? "inbound",
                  [
                    { value: "inbound",  label: "Inbound — caller reaches your number" },
                    { value: "outbound", label: "Outbound — agent places the call" },
                  ],
                  (v) => setConfigField("direction", v),
                  "Call direction",
                )}

                {node.type === "ai_conversation" && (
                  <>
                    {ddSingle(
                      (config.model as string) ?? "gpt-4.1",
                      [
                        { value: "gpt-4.1",      label: "gpt-4.1 — best quality" },
                        { value: "gpt-4.1-mini", label: "gpt-4.1-mini — faster" },
                        { value: "gpt-4o",       label: "gpt-4o" },
                        { value: "gpt-4o-mini",  label: "gpt-4o-mini" },
                      ],
                      (v) => setConfigField("model", v),
                      "LLM model",
                    )}
                    <Input
                      kind="text"
                      size="md"
                      label="Max turns before escalation"
                      placeholder="20"
                      inputMode="numeric"
                      value={String((config.max_turns as number) ?? 20)}
                      onChange={(e) => {
                        const n = Number(e.currentTarget.value);
                        setConfigField("max_turns", Number.isFinite(n) ? n : 20);
                      }}
                    />
                  </>
                )}

                {node.type === "action" && (
                  <ActionNodeForm
                    tool={(config.tool as string) ?? (config.action_name as string) ?? ""}
                    argMapping={(config.arg_mapping as Record<string, string>) ?? {}}
                    resultAlias={
                      ((config.result_alias as Record<string, string>) ??
                        (config.result_mapping as Record<string, string>) ??
                        {})
                    }
                    onChange={(patch) => {
                      // Partial merge — undefined keys leave existing values
                      // untouched. Never write `action_name` going forward;
                      // the canonical field is `tool`.
                      if (patch.tool !== undefined)         setConfigField("tool", patch.tool);
                      if (patch.argMapping !== undefined)   setConfigField("arg_mapping", patch.argMapping);
                      if (patch.resultAlias !== undefined)  setConfigField("result_alias", patch.resultAlias);
                    }}
                  />
                )}

                {node.type === "webhook" && (
                  <>
                    <Input
                      kind="text"
                      size="md"
                      label="Endpoint URL"
                      placeholder="https://your-webhook.com/path"
                      value={(config.url as string) ?? ""}
                      onChange={(e) => setConfigField("url", e.currentTarget.value)}
                    />
                    {ddSingle(
                      (config.method as string) ?? "POST",
                      [
                        { value: "POST", label: "POST" },
                        { value: "GET",  label: "GET" },
                        { value: "PUT",  label: "PUT" },
                      ],
                      (v) => setConfigField("method", v),
                      "HTTP method",
                    )}
                  </>
                )}

                {node.type === "extract" && (
                  <Input
                    kind="textarea"
                    size="md"
                    label="Fields to extract (comma-separated)"
                    placeholder="mc_number, reference_number, rate_offer"
                    rows={3}
                    // Accept both shapes: legacy `string[]` and v1.0
                    // `IOField[] = {name, type, ...}[]`. Render names only.
                    value={(() => {
                      const raw = config.fields;
                      if (!Array.isArray(raw)) return "";
                      return raw
                        .map((f) =>
                          typeof f === "string"
                            ? f
                            : (f && typeof f === "object" && "name" in f)
                              ? String((f as { name: unknown }).name)
                              : "",
                        )
                        .filter(Boolean)
                        .join(", ");
                    })()}
                    onChange={(e) => {
                      // Edits drop back to the legacy `string[]` shape; the
                      // backend lifter will re-stamp typed IOFields on save.
                      setConfigField(
                        "fields",
                        e.currentTarget.value
                          .split(",")
                          .map((f) => f.trim())
                          .filter(Boolean),
                      );
                    }}
                  />
                )}

                {node.type === "classify" && (
                  <Input
                    kind="textarea"
                    size="md"
                    label="Branch labels (comma-separated)"
                    placeholder="accepted, declined, transferred"
                    rows={3}
                    // Accept legacy `routes: string[]` AND v1.0
                    // `branches: ClassifyBranch[]`. Prefer branches.
                    value={(() => {
                      const raw = config.branches ?? config.routes;
                      if (!Array.isArray(raw)) return "";
                      return raw
                        .map((b) =>
                          typeof b === "string"
                            ? b
                            : (b && typeof b === "object" && "name" in b)
                              ? String((b as { name: unknown }).name)
                              : "",
                        )
                        .filter(Boolean)
                        .join(", ");
                    })()}
                    onChange={(e) => {
                      // Persist as the v1.0 `branches: [{name}]` shape so
                      // the lifter's edge-condition promotion works (and
                      // older `routes` reads still fall back if untouched).
                      const names = e.currentTarget.value
                        .split(",")
                        .map((r) => r.trim())
                        .filter(Boolean);
                      setConfigField(
                        "branches",
                        names.map((name) => ({ name })),
                      );
                    }}
                  />
                )}
            </Section>

            {/* ── Inputs / Outputs (v1.0 schema) ───────────────────────────
                Authors declare the variables a node consumes (with a `from`
                source mapping) and produces. Triggers don't take inputs;
                webhooks/extracts produce outputs that downstream nodes can
                reference via `n<id>.outputs.<field>`.

                Action nodes are intentionally excluded from this section —
                their inputs and outputs are derived from the tool catalog
                in `<ActionNodeForm>` above. The backend validator
                (`apply_tool_catalog`) overwrites any author-supplied IO
                with the catalog shape on save anyway, so showing free-form
                rows here would just confuse the author. */}
            {node.type !== "trigger" && node.type !== "action" && (
              <Section>
                <SectionHeading
                  title="Inputs"
                  helper="Values this node reads from upstream nodes, variables, context, or constants."
                  onAdd={() => setInputs((prev) => [
                    ...prev,
                    { name: `input_${prev.length + 1}`, type: "string", from: "" },
                  ])}
                />
                {inputs.length === 0 && (
                  <EmptyHint label="No inputs yet — add one to map an upstream value." />
                )}
                {inputs.map((inp, i) => (
                  <IORow
                    key={`in-${i}`}
                    io={inp}
                    withFrom
                    onChange={(next) =>
                      setInputs((prev) => prev.map((x, j) => (j === i ? (next as NodeInput) : x)))
                    }
                    onDelete={() =>
                      setInputs((prev) => prev.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </Section>
            )}

            {node.type !== "action" && (
              <Section>
                <SectionHeading
                  title="Outputs"
                  helper="Values this node publishes for downstream nodes to read."
                  onAdd={() => setOutputs((prev) => [
                    ...prev,
                    { name: `output_${prev.length + 1}`, type: "string" },
                  ])}
                />
                {outputs.length === 0 && (
                  <EmptyHint label="No outputs declared. Downstream nodes can still read free-form fields." />
                )}
                {outputs.map((out, i) => (
                  <IORow
                    key={`out-${i}`}
                    io={out}
                    onChange={(next) =>
                      setOutputs((prev) => prev.map((x, j) => (j === i ? next : x)))
                    }
                    onDelete={() =>
                      setOutputs((prev) => prev.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </Section>
            )}
          </Stack>
        </div>

        {/* Footer — clean two-action bar. Edits auto-propagate to the store as
            you type (no "Apply"), so the primary action just confirms + closes
            the panel; Delete stays on the left as the destructive escape hatch.
            Separated from the body by a thin divider, mirroring the reference. */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-neutral-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
          background: "var(--bg-neutral-primary)",
        }}>
          <Button
            variant="ghost"
            tone="destructive"
            size="sm"
            leftIcon="trash"
            onClick={deleteNode}
          >
            Delete
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={closePanel}
          >
            Done
          </Button>
        </div>
      </Surface>
      </motion.div>
    </div>
  );
}
