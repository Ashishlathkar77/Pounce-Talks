"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  addEdge,
  Connection,
  BackgroundVariant,
  NodeTypes,
  useReactFlow,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "@/lib/store";
import { layoutNodes } from "@/lib/autoLayout";
import { WorkflowNode, WorkflowEdge, NodeData } from "@/lib/types";
import NodeConfigPanel from "@/components/workflow/NodeConfigPanel";
import TriggerNode from "@/components/workflow/nodes/TriggerNode";
import AIConversationNode from "@/components/workflow/nodes/AIConversationNode";
import ClassifyNode from "@/components/workflow/nodes/ClassifyNode";
import ExtractNode from "@/components/workflow/nodes/ExtractNode";
import ActionNode from "@/components/workflow/nodes/ActionNode";
import WebhookNode from "@/components/workflow/nodes/WebhookNode";
import { AnimatePresence } from "framer-motion";
import {
  Button as HemutButton,
  Divider,
  Grid,
  Icon,
  Input,
  Modal,
  Skeleton,
  Stack,
  Surface,
  Tooltip,
  Typography,
} from "@hemut2025/design-system";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Palette catalogue — `iconName` is a Phosphor slug consumed by the DS `Icon`
 * component (renders inline SVG so it's font-free and always visible). The
 * palette is fully neutral: a single monochrome icon treatment for every type
 * (no per-type colour accents), so the grid reads as a clean set of options.
 * Semantic tokens keep it dark-mode / reskin safe.
 *
 * `sub` is no longer rendered on the tile (tiles show icon + label only) — it's
 * kept for the collapsed-rail tooltip's description line.
 */
const NODE_PALETTE: Array<{
  type: WorkflowNode["type"];
  label: string;
  sub: string;
  iconName: string;
}> = [
  { type: "trigger",         label: "Trigger",         sub: "start workflow",  iconName: "phone"            },
  { type: "ai_conversation", label: "AI Conversation", sub: "llm dialogue",    iconName: "chat-circle-text" },
  { type: "classify",        label: "Classify",        sub: "branch on value", iconName: "git-branch"       },
  { type: "extract",         label: "Extract",         sub: "pull structured", iconName: "scissors"         },
  { type: "action",          label: "Action / API",    sub: "call a tool",     iconName: "lightning"        },
  { type: "webhook",         label: "Webhook",         sub: "external call",   iconName: "globe"            },
];

// Canvas grid — two decoupled lattices:
//
//  • DOT_GAP is the *visual* dot background: a fine reference texture.
//  • SNAP_GRID is the *invisible* lattice nodes actually snap to. It's a whole
//    multiple of DOT_GAP, so every snapped node still lands exactly on a dot,
//    but the coarser step gives an organised layout — uniform horizontal AND
//    vertical breathing room between cards instead of cramped 16px offsets.
//
// Nodes are not freely draggable: `snapToGrid` locks every drag (and the spawn
// position) to SNAP_GRID, so cards click into clean rows/columns. Bump
// SNAP_GRID to widen the gaps; keep it a multiple of DOT_GAP to stay on-dot.
const DOT_GAP = 16;
const SNAP_GRID = 48; // 3 × DOT_GAP

const NODE_TYPES: NodeTypes = {
  trigger:         TriggerNode,
  ai_conversation: AIConversationNode,
  classify:        ClassifyNode,
  extract:         ExtractNode,
  action:          ActionNode,
  webhook:         WebhookNode,
};

// ── PaletteItem ───────────────────────────────────────────────────────────────

/**
 * A single drag-to-canvas option in the left palette. Two render modes:
 *  • expanded → a square tile: centred monochrome icon on top, label beneath
 *    (no sub-text). Tiles sit in a 2-column grid (see the nav below).
 *  • collapsed → an icon-only square in the narrow rail, with a DS Tooltip
 *    carrying the label + sub as its description.
 *
 * Fully neutral by design — colour lives only in the on-canvas nodes, not the
 * palette. All surfaces use semantic neutral tokens so it stays dark-mode and
 * reskin safe.
 */
function PaletteItem({
  label, sub, iconName, collapsed, onClick,
}: {
  type: string;
  label: string;
  sub: string;
  iconName: string;
  /** When true, render as an icon-only square tile (collapsed rail mode). */
  collapsed?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Collapsed rail: just the icon, centred, with a DS Tooltip so the user still
  // gets the node-type name + description on hover.
  if (collapsed) {
    return (
      <Tooltip placement="right" content={label} description={sub}>
        <button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={`Add ${label} node`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            padding: 0,
            background: hovered ? "var(--bg-neutral-primary)" : "var(--bg-neutral-secondary)",
            border: `1px solid ${hovered ? "var(--border-neutral-bold)" : "var(--border-neutral-subtle)"}`,
            borderRadius: 6,
            cursor: "pointer",
            color: hovered ? "var(--text-neutral-primary)" : "var(--text-neutral-secondary)",
            transition: "background 0.12s, border-color 0.12s, color 0.12s",
          }}
        >
          {/* 18px to match the DS Sidebar nav-tab icon size (size="sm" is 20px). */}
          <Icon name={iconName} size={18} />
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Add ${label} node`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        width: "100%",
        minHeight: 54,
        padding: "8px 4px",
        // Recede against the primary card: subtle secondary fill, no shadow.
        // Hover lifts to the card colour + a bolder border for a quiet accent.
        background: hovered ? "var(--bg-neutral-primary)" : "var(--bg-neutral-secondary)",
        border: `1px solid ${hovered ? "var(--border-neutral-bold)" : "var(--border-neutral-subtle)"}`,
        borderRadius: 6,
        cursor: "pointer",
        color: hovered ? "var(--text-neutral-primary)" : "var(--text-neutral-secondary)",
        transition: "background 0.12s, border-color 0.12s, color 0.12s",
      }}
    >
      <Icon name={iconName} size="sm" />
      <Typography
        variant="label-sm-semibold"
        color="secondary"
        style={{ textAlign: "center", lineHeight: 1.2 }}
      >
        {label}
      </Typography>
    </button>
  );
}

// ── CanvasControls ────────────────────────────────────────────────────────────

/**
 * A single icon-only button in the vertical control rail. Square, ghost, with
 * a right-anchored tooltip. The disabled state dims the glyph (used for
 * undo/redo when the matching history stack is empty — matches the greyed-out
 * undo arrow in the reference).
 */
function ControlButton({
  iconName, label, onClick, disabled,
}: {
  iconName: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip placement="right" content={label}>
      <HemutButton
        variant="ghost"
        size="sm"
        leftIcon={iconName}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      />
    </Tooltip>
  );
}

/**
 * Floating vertical control rail — replaces React Flow's default <Controls>.
 * Three groups separated by hairline dividers, matching the reference:
 *   zoom in / zoom out  ·  undo / redo  ·  fit-view
 *
 * Zoom + fit talk to React Flow via `useReactFlow`; undo/redo are wired to the
 * workflow store's history (passed in as props so this stays a dumb view).
 * Anchored to the bottom-right corner (the conventional spot for editor zoom
 * controls); the MiniMap is offset to its left so the two never overlap.
 */
function CanvasControls({
  canUndo, canRedo, onUndo, onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const groupDivider = (
    <span
      style={{
        width: 20,
        height: 1,
        background: "var(--border-neutral-subtle)",
        margin: "4px 0",
      }}
    />
  );

  return (
    // Concentric corners: the inner DS buttons are square (--radius-lg = 8px),
    // padded 4px on every side, so the wrapper must be 8 + 4 = 12px (radius="xl")
    // for the corners to stay parallel. Matches the bottom action toolbar.
    <Surface
      variant="primary"
      radius="xl"
      border="primary"
      shadow="none"
      padding="none"
      aria-label="Canvas controls"
      style={{
        position: "absolute",
        bottom: 16,
        right: 12,
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: 4,
      }}
    >
      <ControlButton iconName="plus"  label="Zoom in"  onClick={() => zoomIn({ duration: 200 })} />
      <ControlButton iconName="minus" label="Zoom out" onClick={() => zoomOut({ duration: 200 })} />
      {groupDivider}
      <ControlButton iconName="arrow-arc-left"  label="Undo" onClick={onUndo} disabled={!canUndo} />
      <ControlButton iconName="arrow-arc-right" label="Redo" onClick={onRedo} disabled={!canRedo} />
      {groupDivider}
      <ControlButton
        iconName="frame-corners"
        label="Fit view"
        onClick={() => fitView({ duration: 300, padding: 0.25 })}
      />
    </Surface>
  );
}

// ── CanvasInner ───────────────────────────────────────────────────────────────

interface CanvasProps {
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  isSaving?: boolean;
  /** Agent-level actions surfaced in the floating canvas toolbar. */
  onTestCall?: () => void;
  onDelete?: () => void;
  /** While the agent config is still being fetched, show skeleton node cards in
   *  the canvas centre instead of the empty-state. The palette, control rail,
   *  and dot grid stay real — only the node graph reads as "loading". */
  isLoading?: boolean;
}

// localStorage key for the palette collapsed preference. Persisting means a
// user who prefers the icon-only rail keeps it across page reloads / agent
// switches without having to re-collapse every time.
const PALETTE_COLLAPSED_KEY = "converse.canvas.paletteCollapsed";

function CanvasInner({ onSave, isSaving, onTestCall, onDelete, isLoading }: CanvasProps) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    selectedNode,
    setSelectedNode,
    isDirty,
    primaryPrompt,
    primaryPromptVars,
    setPrimaryPrompt,
    variables,
    snapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowStore();
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Auto-arrange — snap the whole graph into a clean top-down layered layout,
  // then fit it into view. Positions are recomputed from the edge structure
  // (see lib/autoLayout), so a tangled hand-dragged graph becomes a tidy tree.
  function autoArrange() {
    if (nodes.length === 0) return;
    const laidOut = layoutNodes(nodes, edges, { grid: SNAP_GRID });
    setNodes(laidOut);
    // Fit after the new positions have painted.
    requestAnimationFrame(() =>
      fitView({ padding: 0.2, duration: 400 })
    );
  }

  // The MiniMap is hidden at rest and fades in only while the user is actively
  // dragging — a node or the canvas itself — when an overview is actually
  // useful. `interacting` is flipped by the drag/move start+stop handlers below.
  const [interacting, setInteracting] = useState(false);

  // Workflow-level primary prompt editor — opens a modal that edits the
  // persona/voice rules prompt prepended to every ai_conversation node at
  // runtime. Saving here writes to the Zustand store; the next "Save
  // workflow" click flushes it via the v1.0 envelope (see AgentEditorPage).
  const [showPrimaryPromptModal, setShowPrimaryPromptModal] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(primaryPrompt);
  const [draftVars, setDraftVars]     = useState<string>(primaryPromptVars.join(", "));
  useEffect(() => {
    if (showPrimaryPromptModal) {
      setDraftPrompt(primaryPrompt);
      setDraftVars(primaryPromptVars.join(", "));
    }
  }, [showPrimaryPromptModal, primaryPrompt, primaryPromptVars]);

  // Palette collapse state — defaults to expanded. We hydrate from
  // localStorage on mount (not in the initial useState, to avoid SSR /
  // hydration mismatch — the dynamic-imported Canvas already runs client-only
  // but keeping this pattern means future SSR-safe variants don't break).
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PALETTE_COLLAPSED_KEY);
      if (stored === "1") setPaletteCollapsed(true);
    } catch { /* localStorage unavailable — fall back to expanded */ }
  }, []);
  function togglePalette() {
    setPaletteCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(PALETTE_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // Render-time edge styling. Persisted edges carry only id/source/target/label,
  // so we layer the dashed smoothstep look on here rather than writing it into
  // the store. This makes every edge — freshly drawn or loaded from a saved
  // workflow — match the reference, and keeps `label` rendering as a midpoint
  // pill. `defaultEdgeOptions` only covers new connections; this covers the rest.
  const styledEdges = useMemo(
    () =>
      (edges as WorkflowEdge[]).map((e) => ({
        ...e,
        type: "smoothstep",
        animated: false,
        style: {
          strokeWidth: 1.5,
          stroke: "var(--border-neutral-bold)",
          strokeDasharray: "6 5",
        },
      })),
    [edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      snapshot();
      const newEdges = addEdge(connection, edges as never[]) as unknown as WorkflowEdge[];
      setEdges(newEdges);
    },
    [edges, setEdges, snapshot]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Record one undo step for structural edits (delete). Position changes
      // during a drag are snapshotted once at drag start instead, so the whole
      // drag collapses into a single undo.
      if (changes.some((c) => c.type === "remove")) snapshot();
      // React Flow emits `dimensions` (node measurement) and `select` changes
      // automatically on mount/interaction — those aren't user edits, so they
      // must NOT mark the workflow dirty. Only flag the graph dirty for real
      // structural/position changes.
      const meaningful = changes.some((c) => c.type !== "dimensions" && c.type !== "select");
      const updated = applyNodeChanges(changes, nodes as never[]) as unknown as WorkflowNode[];
      setNodes(updated, meaningful);
    },
    [nodes, setNodes, snapshot]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === "remove")) snapshot();
      // Same as nodes: selection-only changes shouldn't mark the graph dirty.
      const meaningful = changes.some((c) => c.type !== "select");
      const updated = applyEdgeChanges(changes, edges as never[]) as unknown as WorkflowEdge[];
      setEdges(updated, meaningful);
    },
    [edges, setEdges, snapshot]
  );

  // Keyboard undo/redo: ⌘Z / Ctrl+Z and ⌘⇧Z / Ctrl+Y. Ignored while typing in
  // a field (e.g. the primary-prompt modal) so it never clobbers text editing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  function addNode(type: WorkflowNode["type"]) {
    snapshot();
    const id = `${type}_${Date.now()}`;
    const raw = screenToFlowPosition({
      x: 340 + Math.random() * 120,
      y: 180 + Math.random() * 120,
    });
    // Snap the spawn point onto the same lattice the drag snap uses, so a freshly
    // added node sits on a grid intersection from the very first frame.
    const position = {
      x: Math.round(raw.x / SNAP_GRID) * SNAP_GRID,
      y: Math.round(raw.y / SNAP_GRID) * SNAP_GRID,
    };

    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: {
        label: NODE_PALETTE.find((n) => n.type === type)?.label ?? type,
        config: {},
      } as NodeData,
    };
    setNodes([...nodes, newNode]);
  }

  return (
    <div style={{ position: "relative", height: "100%", background: "var(--bg-neutral-primary)" }}>

      {/* ── Left Palette ──────────────────────────────────────────────────
          A compact floating DS `Surface` card that sits ON the canvas (inset
          from the edges, height = content) so the dot grid shows around it and
          it reads as the same floating family as the toolbar / node cards /
          config popout. Built entirely from DS primitives (Surface, Typography,
          Divider, Button, Grid).

          Collapsible: header chevron toggles between the full 220px card and a
          56px icon-only rail. The collapsed state is persisted to localStorage
          so it sticks across reloads. */}
      <Surface
        variant="primary"
        radius="lg"
        border="primary"
        shadow="none"
        padding="none"
        aria-label="Workflow node palette"
        style={{
          position: "absolute",
          // Vertically centred on the canvas — pinned to the mid-line and pulled
          // back half its own height, so it floats centred regardless of how many
          // node types the palette holds.
          top: "50%",
          left: 12,
          transform: "translateY(-50%)",
          width: paletteCollapsed ? 56 : 220,
          // Compact: size to content, only scroll if it ever exceeds the canvas.
          maxHeight: "calc(100% - 24px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 5,
          transition: "width 0.18s ease",
        }}
      >
        {/* Header — title (when expanded) + collapse toggle, both DS. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: paletteCollapsed ? "center" : "space-between",
            gap: 8,
            padding: paletteCollapsed ? "8px 0" : "10px 8px 10px 14px",
          }}
        >
          {!paletteCollapsed && (
            <Typography variant="label-md-semibold" color="primary">
              Node Types
            </Typography>
          )}

          <Tooltip
            placement="right"
            content={paletteCollapsed ? "Expand node palette" : "Collapse node palette"}
          >
            <HemutButton
              variant="ghost"
              size="sm"
              leftIcon={paletteCollapsed ? "caret-double-right" : "caret-double-left"}
              aria-label={paletteCollapsed ? "Expand node palette" : "Collapse node palette"}
              aria-expanded={!paletteCollapsed}
              onClick={togglePalette}
            />
          </Tooltip>
        </div>

        <Divider />

        {/* Item rail */}
        <nav
          aria-label="Node types"
          style={{
            overflowY: "auto",
            padding: paletteCollapsed ? "8px 0" : 8,
          }}
        >
          {paletteCollapsed ? (
            <Stack gap="xs" align="center">
              {NODE_PALETTE.map((item) => (
                <PaletteItem
                  key={item.type}
                  {...item}
                  collapsed
                  onClick={() => addNode(item.type as WorkflowNode["type"])}
                />
              ))}
            </Stack>
          ) : (
            <Grid columns={2} gap="xs">
              {NODE_PALETTE.map((item) => (
                <PaletteItem
                  key={item.type}
                  {...item}
                  onClick={() => addNode(item.type as WorkflowNode["type"])}
                />
              ))}
            </Grid>
          )}
        </nav>

      </Surface>

      {/* ── Canvas Area (full-bleed; ReactFlow fills the whole region so the
          dot grid shows around the floating palette / toolbar / config card) ── */}
      <div style={{ position: "absolute", inset: 0, background: "var(--bg-neutral-primary)" }}>
        <ReactFlow
          nodes={nodes as never[]}
          edges={styledEdges as never[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            const found = nodes.find((n) => n.id === node.id);
            setSelectedNode(found ?? null);
          }}
          onPaneClick={() => setSelectedNode(null)}
          // Reveal the MiniMap only during an active drag (node) or pan (canvas).
          onNodeDragStart={() => { snapshot(); setInteracting(true); }}
          onNodeDragStop={() => setInteracting(false)}
          onMoveStart={() => setInteracting(true)}
          onMoveEnd={() => setInteracting(false)}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          // Magnetic grid: nodes are not freely draggable — every drag locks to
          // the coarse SNAP_GRID lattice (a multiple of the finer dot spacing), so
          // cards align into clean rows/columns with uniform horizontal/vertical
          // gaps instead of landing at cramped arbitrary offsets.
          snapToGrid
          snapGrid={[SNAP_GRID, SNAP_GRID]}
          // Hide the default "React Flow" attribution badge.
          proOptions={{ hideAttribution: true }}
          // Orthogonal, rounded-corner connectors drawn as a dashed grey line —
          // matches the reference: links exit the bottom of a node, step at right
          // angles, and meet the next node's top handle.
          defaultEdgeOptions={{
            type: "smoothstep",
            style: {
              strokeWidth: 1.5,
              stroke: "var(--border-neutral-bold)",
              strokeDasharray: "6 5",
            },
            animated: false,
          }}
          style={{ background: "var(--bg-neutral-primary)" }}
        >
          {/* Uniform dot grid. The pattern scales with the viewport transform,
              so the dot spacing is the user's read on how far they've zoomed —
              the standard node-editor convention. A single fine, evenly-spaced
              layer (no major/minor distinction) to match the reference. */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={DOT_GAP}
            size={1.2}
            // Theme-aware so the grid is subtle in both modes: resolves to
            // grey-300 in light and a low-alpha white (rgba 255,255,255,0.16)
            // in dark, rather than a fixed light-grey that glares on dark.
            color="var(--border-neutral-bold)"
          />
          {/* Custom vertical control rail (replaces the default React Flow
              <Controls>): zoom in/out · undo/redo · fit-view, grouped with
              hairline dividers. See <CanvasControls /> below. */}
          <CanvasControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />
          {/* MiniMap — hidden at rest, fades in only while dragging/panning
              (see `interacting`). Kept mounted so the opacity transition runs;
              pointer-events are off when hidden so it never intercepts clicks. */}
          <MiniMap
            position="bottom-right"
            pannable
            style={{
              // Offset left of the bottom-right control rail (~44px wide +
              // 12px margin) so the two never overlap when both are visible.
              right: 68,
              background: "var(--bg-neutral-secondary)",
              border: "1px solid var(--border-neutral-subtle)",
              borderRadius: 8,
              opacity: interacting ? 1 : 0,
              pointerEvents: interacting ? "auto" : "none",
              transition: "opacity 0.18s ease",
            }}
            nodeColor={(node) => {
              const map: Record<string, string> = {
                trigger:         "var(--brand-300)",
                ai_conversation: "#60a5fa",
                classify:        "#fb923c",
                extract:         "#c084fc",
                action:          "var(--brand-300)",
                webhook:         "#94a3b8",
              };
              return map[node.type ?? ""] ?? "#444";
            }}
            maskColor="rgba(246,247,248,0.85)"
          />
        </ReactFlow>

        {/* Loading state — skeleton node cards down the canvas centre while the
            agent config is fetched. The palette + control rail + dot grid above
            stay real, so only the node graph reads as "loading". Mirrors
            BaseNode: 264px card, bold border + soft shadow, a type tab tucked
            behind the top-left edge, and vertical connectors between cards.
            Only when there are genuinely no nodes yet — if the store already
            holds a graph (e.g. switching agents without a remount), the real
            nodes win and the skeleton never flashes over present data. */}
        {isLoading && nodes.length === 0 && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {i > 0 && (
                  <div style={{ width: 2, height: 30, background: "var(--border-neutral-bold)", opacity: 0.45 }} />
                )}
                <div style={{ position: "relative", width: 264 }}>
                  <div style={{
                    position: "absolute", top: -22, left: 0, zIndex: 0,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 9px 9px 9px",
                    background: "var(--bg-neutral-secondary)",
                    border: "1px solid var(--border-neutral-bold)",
                    borderBottom: "none", borderRadius: "8px 8px 0 0",
                  }}>
                    <Skeleton width={12} height={12} />
                    <Skeleton width={46} height={9} />
                  </div>
                  <div style={{
                    position: "relative", zIndex: 1, borderRadius: 8,
                    background: "var(--bg-neutral-primary)",
                    border: "1px solid var(--border-neutral-bold)",
                    boxShadow: "0 2px 8px rgba(31,31,42,0.06)",
                    padding: "16px 14px 14px",
                  }}>
                    <Skeleton width={150} height={14} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={10} style={{ marginBottom: 5 }} />
                    <Skeleton width="70%" height={10} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Icon
                name="hexagon"
                size="3xl"
                color="var(--text-neutral-disabled)"
                aria-hidden
              />
              <div style={{
                fontSize: 14, fontWeight: 600, marginTop: 8,
                color: "var(--text-neutral-secondary)",
              }}>
                Canvas empty
              </div>
              <div style={{
                fontSize: 12, marginTop: 4,
                color: "var(--text-neutral-tertiary)",
              }}>
                Click a node in the palette to add it
              </div>
            </div>
          </div>
        )}

        {/* ── Floating node config panel (overlay, not sidebar) ── */}
        <AnimatePresence>
          {selectedNode && (
            <NodeConfigPanel key={selectedNode.id} node={selectedNode} />
          )}
        </AnimatePresence>

        {/* Floating action toolbar — a single icon-only bar centred at the
            bottom of the canvas (the conventional spot for editor toolbars;
            frees the top chrome). Groups: workflow authoring (primary prompt,
            save) · agent actions (test call) · destructive (delete). Save shows
            a brand dot when there are unsaved changes and a spinner while
            saving.

            Radius honours the concentric inside/outside rule: the inner buttons
            use --radius-lg (8px), the wrapper pads them by 4px on every side, so
            the outer radius is 8 + 4 = 12px and the corners stay truly parallel
            (kept tight to match the editor's 8px corporate corner scale rather
            than reading as a soft pill). */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 4,
            background: "var(--bg-neutral-primary)",
            // No drop shadow — definition comes from the border so the bar reads
            // as lifted off the dotted canvas without casting a shadow. Sits
            // between subtle (#EBECF0) and bold (#C0C4D0): a 60% mix of bold so
            // the outline is present but not heavy now that nothing softens it.
            border: "1px solid color-mix(in srgb, var(--border-neutral-bold) 60%, transparent)",
            borderRadius: "calc(var(--radius-lg) + 4px)",
          }}
        >
          <Tooltip
            placement="top"
            content={
              primaryPrompt
                ? "Edit primary prompt — workflow-level persona / voice rules"
                : "Add primary prompt — defines the agent's persona for every step"
            }
          >
            <HemutButton
              variant="ghost"
              size="sm"
              leftIcon="sparkle"
              aria-label={primaryPrompt ? "Edit primary prompt" : "Add primary prompt"}
              onClick={() => setShowPrimaryPromptModal(true)}
            />
          </Tooltip>

          {/* Auto-arrange — re-flows the whole graph into a clean top-down tree. */}
          <Tooltip placement="top" content="Tidy layout — auto-arrange nodes">
            <HemutButton
              variant="ghost"
              size="sm"
              leftIcon="tree-structure"
              aria-label="Auto-arrange nodes"
              disabled={nodes.length === 0}
              onClick={autoArrange}
            />
          </Tooltip>

          {/* Save — same ghost priority as the rest of the bar; the brand dot
              (not a filled button) signals unsaved changes, and a spinner shows
              while saving. */}
          <span style={{ position: "relative", display: "inline-flex" }}>
            <Tooltip placement="top" content={isDirty ? "Save workflow" : "No unsaved changes"}>
              <HemutButton
                variant="ghost"
                size="sm"
                leftIcon={isSaving ? "circle-notch" : "floppy-disk"}
                loading={isSaving}
                disabled={!isDirty || isSaving}
                aria-label={isSaving ? "Saving workflow" : "Save workflow"}
                onClick={() => onSave(nodes, edges)}
              />
            </Tooltip>
            {isDirty && !isSaving && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                width: 7, height: 7, borderRadius: "50%",
                background: "var(--brand-400)",
                border: "1.5px solid var(--bg-neutral-primary)",
                pointerEvents: "none",
              }} />
            )}
          </span>

          <span style={{ width: 1, height: 20, background: "var(--border-neutral-subtle)", margin: "0 4px" }} />

          <Tooltip placement="top" content="Test call">
            <HemutButton
              variant="ghost"
              size="sm"
              leftIcon="phone"
              aria-label="Test call"
              onClick={onTestCall}
            />
          </Tooltip>

          <span style={{ width: 1, height: 20, background: "var(--border-neutral-subtle)", margin: "0 4px" }} />

          <Tooltip placement="top" content="Delete agent">
            <HemutButton
              variant="ghost"
              tone="destructive"
              size="sm"
              leftIcon="trash"
              aria-label="Delete agent"
              onClick={onDelete}
            />
          </Tooltip>
        </div>

        {/* ── Primary Prompt modal ─────────────────────────────────────────
            Workflow-level persona prompt. The runtime composes the final
            LLM system prompt as `primaryPrompt + "\n\n## Current step\n" +
            ai_conversation.prompt`, so authors don't repeat persona/voice
            rules on every node. `{{var}}` templating resolves against the
            comma-separated variable list below (which must be a subset of
            `variables[]` declared on the workflow envelope). */}
        <Modal
          open={showPrimaryPromptModal}
          onClose={() => setShowPrimaryPromptModal(false)}
          size="lg"
          title="Primary prompt"
          description="Defines the agent's persona, company context, and voice rules. Prepended to every conversation step."
        >
          <Modal.Body>
            <Stack gap="md">
              <Input
                kind="textarea"
                size="md"
                label="Prompt"
                placeholder={
                  "You are Paul, a senior freight broker at {{company_name}}. You handle inbound calls from carriers...\n\n## Voice Rules\n- Dollar amounts as words\n- Never narrate tool calls"
                }
                rows={14}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.currentTarget.value)}
                caption={`${draftPrompt.length} characters`}
              />
              <Input
                kind="text"
                size="md"
                label="Template variables (comma-separated)"
                placeholder="company_name, caller_phone"
                value={draftVars}
                onChange={(e) => setDraftVars(e.currentTarget.value)}
                caption={
                  variables.length > 0
                    ? `Declared on workflow: ${variables.map((v) => v.name).join(", ")}`
                    : "No workflow variables declared yet — add them in the workflow editor."
                }
              />
            </Stack>
          </Modal.Body>
          <Modal.Footer align="between">
            <HemutButton
              variant="ghost"
              size="md"
              onClick={() => setShowPrimaryPromptModal(false)}
            >
              Cancel
            </HemutButton>
            <HemutButton
              variant="primary"
              size="md"
              leftIcon="floppy-disk"
              onClick={() => {
                const vars = draftVars
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
                setPrimaryPrompt(draftPrompt, vars);
                setShowPrimaryPromptModal(false);
              }}
            >
              Apply
            </HemutButton>
          </Modal.Footer>
        </Modal>
      </div>

    </div>
  );
}

export default function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
