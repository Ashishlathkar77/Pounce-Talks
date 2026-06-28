"use client";

/**
 * AddNextButton — the dangling "add next step" affordance shown beneath a leaf
 * node (a node whose bottom/source handle has no outgoing edge yet).
 *
 * Anatomy (matches the reference):
 *  • a short vertical dashed stub continuing down from the node's source handle,
 *  • a faint rounded-square button at its end. At rest the button is quiet; on
 *    hover it lifts (bolder border + fill, clearer "+") and shows an "Add step"
 *    tooltip.
 *  • clicking opens a small popover of node types — picking one creates that
 *    node on the grid directly below, wires an edge from this node to it, and
 *    selects the new node so its config panel opens.
 *
 * Rendered absolutely below the card (top:100%) so it never grows the node's
 * measured box — the source handle stays anchored to the card's bottom edge.
 * The wrapper is click-through (`pointer-events:none`); only the button and the
 * popover opt back in, so the dashed stub never intercepts canvas pans/clicks.
 */

import { useEffect, useRef, useState } from "react";
import { Icon, Tooltip } from "@hemut2025/design-system";
import { useWorkflowStore } from "@/lib/store";
import { WorkflowNode, WorkflowEdge, NodeData } from "@/lib/types";

// Keep in step with Canvas.tsx's SNAP_GRID so the spawned node lands on the same
// lattice the drag snap uses.
const SNAP_GRID = 48;

// What the picker offers. Trigger is intentionally excluded — every workflow has
// exactly one and it's never a *next* step. Icons mirror Canvas.tsx's palette.
const ADD_TYPES: Array<{ type: WorkflowNode["type"]; label: string; iconName: string }> = [
  { type: "ai_conversation", label: "AI Conversation", iconName: "chat-circle-text" },
  { type: "classify",        label: "Classify",        iconName: "git-branch"       },
  { type: "extract",         label: "Extract",         iconName: "scissors"         },
  { type: "action",          label: "Action / API",    iconName: "lightning"        },
  { type: "webhook",         label: "Webhook",         iconName: "globe"            },
];

export default function AddNextButton({ sourceId }: { sourceId: string }) {
  const { nodes, edges, setNodes, setEdges, setSelectedNode } = useWorkflowStore();
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the picker on any outside click. Listen in the *capture* phase —
  // React Flow's pane calls stopPropagation on mousedown, so a bubble-phase
  // document listener would never fire. Capture runs before that. (A
  // `position:fixed` backdrop is also no good: React Flow's viewport transform
  // makes `fixed` resolve against the transformed pane, not the screen.)
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [open]);

  function addNext(type: WorkflowNode["type"], label: string) {
    const source = nodes.find((n) => n.id === sourceId);
    if (!source) return;

    const id = `${type}_${Date.now()}`;
    // Directly below the source, snapped to the grid.
    const position = {
      x: Math.round(source.position.x / SNAP_GRID) * SNAP_GRID,
      y: Math.round((source.position.y + 180) / SNAP_GRID) * SNAP_GRID,
    };
    const newNode: WorkflowNode = {
      id,
      type,
      position,
      // Mark selected so the card highlights and matches the opened config panel
      // (React Flow reads this `selected` flag, not the store's selectedNode).
      selected: true,
      data: { label, config: {} } as NodeData,
    } as WorkflowNode;
    const newEdge: WorkflowEdge = {
      id: `e_${sourceId}_${id}`,
      source: sourceId,
      target: id,
    };

    // Deselect any previously-selected node so only the new one is active.
    const deselected = nodes.map((n) =>
      (n as WorkflowNode & { selected?: boolean }).selected ? { ...n, selected: false } : n
    );
    setNodes([...deselected, newNode]);
    setEdges([...edges, newEdge]);
    setSelectedNode(newNode);
    setOpen(false);
    setHovered(false);
  }

  const active = hovered || open;

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Click-through container — only the button/popover opt back in.
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {/* Dashed stub continuing down from the source handle. */}
      <div style={{
        width: 0,
        height: 16,
        borderLeft: "1.5px dashed var(--border-neutral-bold)",
      }} />

      {/* Endpoint. At rest it's just a small round brand dot (like a handle); on
          hover it grows into a light "+" button. Quiet by default — definition
          comes from the dot, not a heavy bordered box. */}
      <Tooltip placement="top" content="Add step">
        <button
          aria-label="Add next step"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          // Stop the click/drag from bubbling to the node (which would select or
          // drag it instead of opening the picker).
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Fixed footprint so the dot→button swap never shifts layout.
            width: 22,
            height: 22,
            padding: 0,
            borderRadius: "50%",
            cursor: "pointer",
            background: active ? "var(--bg-neutral-primary)" : "transparent",
            border: active ? "1px solid var(--border-neutral-bold)" : "1px solid transparent",
            color: "var(--text-neutral-secondary)",
            transition: "background 0.12s, border-color 0.12s",
          }}
        >
          {active ? (
            <Icon name="plus" size="xs" />
          ) : (
            // Resting dot — matches the brand-yellow source handles.
            <span style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--brand-300)",
            }} />
          )}
        </button>
      </Tooltip>

      {/* Type picker popover */}
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 6,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            pointerEvents: "auto",
            width: 188,
            padding: 4,
            background: "var(--bg-neutral-primary)",
            border: "1px solid var(--border-neutral-bold)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(31,31,42,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {ADD_TYPES.map((item) => (
            <button
              key={item.type}
              onClick={(e) => { e.stopPropagation(); addNext(item.type, item.label); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 8px",
                background: "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--text-neutral-secondary)",
                fontSize: 13,
                fontWeight: 500,
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-neutral-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={item.iconName} size="xs" color="var(--icon-neutral-secondary)" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
