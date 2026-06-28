/**
 * Workflow JSON helpers — adapters and validators for the v1.0 schema.
 *
 * The canvas (`@xyflow/react`) wants nodes shaped as
 * `{ id, type, position, data: { label, config } }`, but the persisted
 * source-of-truth shape is the typed `WorkflowSchemaV1` (or, transitionally,
 * the legacy `{ nodes, edges }` shape with `WorkflowNode[]` / `WorkflowEdge[]`
 * already in canvas form). This file owns the conversions in both directions
 * plus pure helpers that the backend mirrors:
 *
 *  - {@link deriveDependsOn}     — adjacency map computed from edges
 *  - {@link validateWorkflow}    — light cross-graph checks for instant feedback
 *  - {@link toReactFlow}         — schema → canvas
 *  - {@link fromReactFlow}       — canvas + meta → schema
 *  - {@link normalizeWorkflow}   — accept either shape, return canvas form
 *
 * Keep this file in lockstep with `backend/app/models/workflow_schema.py`.
 */

import {
  AgentWorkflowJSON,
  ClassifyConfig,
  ExtractConfig,
  IOField,
  NodeData,
  NodeInput,
  SchemaEdge,
  SchemaNode,
  SchemaNodeType,
  TriggerConfig,
  WORKFLOW_SCHEMA_VERSION,
  WorkflowEdge,
  WorkflowMeta,
  WorkflowNode,
  WorkflowSchemaV1,
  WorkflowVariable,
  isWorkflowSchemaV1,
} from "@/lib/types";

// ── deriveDependsOn ──────────────────────────────────────────────────────────

/**
 * For each node, return the IDs of nodes whose outgoing edges point at it.
 * Edges remain the canonical source of truth for graph topology — this just
 * inverts them into a quick "what feeds me?" map for runtime + UI hints.
 */
export function deriveDependsOn(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  for (const n of nodes) deps[n.id] = [];
  for (const e of edges) {
    if (!(e.target in deps)) deps[e.target] = [];
    deps[e.target].push(e.source);
  }
  return deps;
}

// ── validateWorkflow (frontend mirror) ───────────────────────────────────────

export interface WorkflowIssue {
  level: "error" | "warning";
  nodeId?: string;
  edgeId?: string;
  message: string;
}

/**
 * Cross-graph validator that mirrors the backend rules in
 * `WorkflowSchema._structural_checks`. Provides instant feedback in the
 * canvas before the user hits Save (the backend remains the authoritative
 * gate on write).
 */
export function validateWorkflow(wf: WorkflowSchemaV1): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const nodeById = new Map(wf.nodes.map((n) => [n.id, n] as const));

  // Entrypoint
  const entry = nodeById.get(wf.meta.entrypoint);
  if (!entry) {
    issues.push({
      level: "error",
      message: `meta.entrypoint='${wf.meta.entrypoint}' is not a known node id`,
    });
  } else if (entry.type !== "trigger") {
    issues.push({
      level: "error",
      nodeId: entry.id,
      message: `meta.entrypoint must reference a trigger node; '${entry.id}' is type '${entry.type}'`,
    });
  }

  // Edge endpoints
  for (const e of wf.edges) {
    if (!nodeById.has(e.source)) {
      issues.push({
        level: "error",
        edgeId: e.id,
        message: `edge '${e.id}' source '${e.source}' is not a known node id`,
      });
    }
    if (!nodeById.has(e.target)) {
      issues.push({
        level: "error",
        edgeId: e.id,
        message: `edge '${e.id}' target '${e.target}' is not a known node id`,
      });
    }
  }

  // Variables / prompt vars
  const varNames = new Set((wf.variables ?? []).map((v) => v.name));
  for (const v of wf.meta.primary_prompt_vars ?? []) {
    if (!varNames.has(v)) {
      issues.push({
        level: "error",
        message: `meta.primary_prompt_vars references undeclared variable '${v}'`,
      });
    }
  }

  // Classify branches must each have an outgoing edge
  for (const n of wf.nodes) {
    if (n.type !== "classify") continue;
    const outgoing = wf.edges.filter((e) => e.source === n.id);
    const covered = new Set<string>();
    for (const e of outgoing) {
      if (e.when?.kind === "branch") covered.add(e.when.value);
      else if (e.label) covered.add(e.label);
    }
    const missing = (n.config as ClassifyConfig).branches
      .map((b) => b.name)
      .filter((b) => !covered.has(b));
    if (missing.length) {
      issues.push({
        level: "warning",
        nodeId: n.id,
        message: `classify '${n.id}' has branches with no outgoing edge: ${missing.join(", ")}`,
      });
    }
  }

  // Source ref resolution (best-effort — does not enforce $context/$state shapes)
  for (const n of wf.nodes) {
    for (const inp of n.inputs ?? []) {
      const ref = inp.from;
      if (!ref) continue;
      if (ref.startsWith("$variables.")) {
        const name = ref.slice("$variables.".length);
        if (!varNames.has(name)) {
          issues.push({
            level: "error",
            nodeId: n.id,
            message: `input '${inp.name}' references undeclared variable '${name}'`,
          });
        }
        continue;
      }
      if (
        ref.startsWith("$context.") ||
        ref.startsWith("$state.") ||
        ref.startsWith("$secrets.") ||
        ref.startsWith("literal:")
      ) {
        continue;
      }
      if (ref.includes(".outputs.")) {
        const [producerId, fieldName] = ref.split(".outputs.");
        if (producerId === n.id) {
          issues.push({
            level: "error",
            nodeId: n.id,
            message: `input '${inp.name}' source '${ref}' references its own outputs`,
          });
          continue;
        }
        const producer = nodeById.get(producerId);
        if (!producer) {
          issues.push({
            level: "error",
            nodeId: n.id,
            message: `input '${inp.name}' references unknown node '${producerId}'`,
          });
          continue;
        }
        const declared = new Set((producer.outputs ?? []).map((o) => o.name));
        if (producer.type === "extract") {
          for (const f of (producer.config as ExtractConfig).fields) declared.add(f.name);
        }
        if (declared.size > 0 && fieldName && !declared.has(fieldName)) {
          issues.push({
            level: "error",
            nodeId: n.id,
            message: `input '${inp.name}' references missing output '${fieldName}' on '${producerId}'`,
          });
        }
        continue;
      }
      issues.push({
        level: "error",
        nodeId: n.id,
        message: `input '${inp.name}' source '${ref}' is not a recognised form`,
      });
    }
  }

  return issues;
}

// ── Canvas adapters ──────────────────────────────────────────────────────────

/**
 * Convert a typed v1.0 schema node into the React Flow shape the canvas
 * components expect (`{ id, type, position, data: { label, config } }`).
 *
 * The full structured `config` is stored verbatim under `data.config` — the
 * existing `BaseNode.tsx` / per-type renderers already read `data.config.*`
 * loosely, so they work unchanged. The new structured fields (inputs,
 * outputs, function, description) are stashed alongside config so the
 * NodeConfigPanel can edit them and `fromReactFlow` can put them back.
 */
export function schemaNodeToReactFlow(n: SchemaNode): WorkflowNode {
  const data: NodeData & {
    function?: string;
    inputs?: NodeInput[];
    outputs?: IOField[];
  } = {
    label: n.label,
    description: n.description,
    config: { ...n.config },
    function: n.function,
    inputs: n.inputs ?? [],
    outputs: n.outputs ?? [],
  };
  return {
    id: n.id,
    type: n.type,
    position: n.position ?? { x: 0, y: 0 },
    data,
  };
}

export function schemaEdgeToReactFlow(e: SchemaEdge): WorkflowEdge {
  // Surface the routing condition as the edge label when nothing better is
  // set, so the user can see "verified" / "default" / "intent" right on the
  // arrow without opening the edge editor.
  let label = e.label;
  if (!label && e.when) {
    if (e.when.kind === "branch") label = e.when.value;
    else if (e.when.kind === "default") label = "default";
    else label = e.when.kind;
  }
  return { id: e.id, source: e.source, target: e.target, label };
}

export function toReactFlow(wf: WorkflowSchemaV1): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  return {
    nodes: wf.nodes.map(schemaNodeToReactFlow),
    edges: wf.edges.map(schemaEdgeToReactFlow),
  };
}

/**
 * Reverse direction: take the React Flow nodes/edges currently on the
 * canvas plus the workflow-level meta/variables and produce a v1.0 schema
 * payload to PATCH back to the API.
 */
export function fromReactFlow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  meta: WorkflowMeta,
  variables: WorkflowVariable[] = [],
): WorkflowSchemaV1 {
  const schemaNodes = nodes.map((n): SchemaNode => {
    const d = n.data as NodeData & {
      function?: string;
      inputs?: NodeInput[];
      outputs?: IOField[];
    };
    const base = {
      id: n.id,
      label: d.label,
      description: d.description,
      position: n.position,
      function: d.function ?? defaultFunctionFor(n.type, d),
      inputs: d.inputs ?? [],
      outputs: d.outputs ?? [],
    };
    switch (n.type) {
      case "trigger":
        return { ...base, type: "trigger", config: d.config as unknown as TriggerConfig };
      case "ai_conversation":
        return { ...base, type: "ai_conversation", config: d.config as unknown as AIConversationConfigShape };
      case "classify":
        return { ...base, type: "classify", config: d.config as unknown as ClassifyConfig };
      case "extract":
        return { ...base, type: "extract", config: d.config as unknown as ExtractConfig };
      case "action":
        return { ...base, type: "action", config: d.config as unknown as ActionConfigShape };
      case "webhook":
        return { ...base, type: "webhook", config: d.config as unknown as WebhookConfigShape };
    }
  });

  const schemaEdges: SchemaEdge[] = edges.map((e) => {
    const out: SchemaEdge = { id: e.id, source: e.source, target: e.target };
    if (e.label) out.label = e.label;
    // Edge condition rehydration is handled separately by the NodeConfigPanel
    // when an edge is selected; we don't synthesize `when` from `label` here
    // because that would conflict with user-authored conditions.
    return out;
  });

  return {
    schema_version: WORKFLOW_SCHEMA_VERSION,
    meta,
    variables,
    nodes: schemaNodes,
    edges: schemaEdges,
  };
}

// Light type aliases so we don't pull in the full per-type config types just
// to satisfy the cast inside fromReactFlow's switch (TS can't narrow inside
// an unconditional cast). Keeping these minimal means changes to the rich
// shapes in types.ts don't ripple here.
type AIConversationConfigShape = SchemaNode extends { type: "ai_conversation"; config: infer C } ? C : never;
type ActionConfigShape         = SchemaNode extends { type: "action";          config: infer C } ? C : never;
type WebhookConfigShape        = SchemaNode extends { type: "webhook";         config: infer C } ? C : never;

function defaultFunctionFor(type: SchemaNodeType, d: NodeData): string {
  // For action nodes the canonical function is the tool name.
  if (type === "action") {
    const tool = (d.config as Record<string, unknown>).tool;
    if (typeof tool === "string" && tool.length > 0) return tool;
  }
  // Otherwise fall back to a stable slug derived from the label.
  return slugify(d.label || type);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64) || "step";
}

// ── normalizeWorkflow ────────────────────────────────────────────────────────

/**
 * Accept either a v1.0 envelope or the legacy `{ nodes, edges }` shape and
 * return the React Flow tuple the canvas can render directly. This is the
 * single entry-point the AgentEditor page should use when seeding the
 * workflow store from a fetched AgentConfig.
 */
export function normalizeWorkflow(payload: AgentWorkflowJSON | null | undefined): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta: WorkflowMeta | null;
  variables: WorkflowVariable[];
} {
  if (!payload) {
    return { nodes: [], edges: [], meta: null, variables: [] };
  }
  if (isWorkflowSchemaV1(payload)) {
    const { nodes, edges } = toReactFlow(payload);
    return {
      nodes,
      edges,
      meta: payload.meta,
      variables: payload.variables ?? [],
    };
  }
  // Legacy shape — already in canvas form.
  return {
    nodes: payload.nodes ?? [],
    edges: payload.edges ?? [],
    meta: null,
    variables: [],
  };
}
