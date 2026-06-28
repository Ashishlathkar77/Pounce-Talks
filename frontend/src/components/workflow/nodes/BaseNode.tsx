"use client";

/**
 * BaseNode — shared chrome for every workflow node renderer.
 *
 * Before this primitive existed, every node renderer (Trigger, AI Conversation,
 * Classify, Extract, Action, Webhook) carried its own ~120-line dark-themed
 * <div> with hand-rolled accent colours per type, monospace typography, and
 * inline shadow / border / handle styles. Six near-identical files. Six places
 * to update if the canvas theme changes.
 *
 * BaseNode owns all of that. Each specific node now declares its `tone`, the
 * Phosphor `iconName`, the type label, and (optionally) custom sub-content.
 *
 * ── Card anatomy (matches the reference) ────────────────────────────────────
 *  • A *type tab* (icon + label, tone-coloured) that pokes up from BEHIND the
 *    card's top-left edge like a folder tab — the card's opaque body paints
 *    over the tab's lower portion, so only the rounded top shows. Replaces the
 *    old in-body icon-tile + pill row.
 *  • A clean white body: bold heading, multi-line (3-line-clamped) description,
 *    then optional children (chips / fields).
 *  • No left colour rail and no corner arrow — selection is shown by a darker
 *    (primary-text) outline alone. Corners stay on the editor's 8px scale.
 *
 * Tones map 1:1 to the palette tones defined in Canvas.tsx so the on-canvas
 * node card looks like a stamped-out version of its palette tile.
 */

import { ReactNode } from "react";
import { Handle, Position, useNodeId } from "@xyflow/react";
import { Icon } from "@hemut2025/design-system";
import { useWorkflowStore } from "@/lib/store";
import AddNextButton from "./AddNextButton";

// ── Tone ──────────────────────────────────────────────────────────────────────
//
// `tone` is still accepted on the props (each node renderer passes its semantic
// tone) but it no longer drives colour. The previous per-tone palette
// (`--brand-50`, `--green-700`, …) used *raw* palette tokens that have no
// dark-mode override, so the type tab stayed a light pastel on the dark canvas —
// the one bit of chrome that didn't follow the theme. The whole card now renders
// in neutral *semantic* tokens (which flip correctly), with the selected state
// the only accent — via the brand semantic token, which is also theme-aware.
export type NodeTone = "brand" | "info" | "warning" | "success" | "neutral";

// Every node card is this exact width — see the note on the root div for why a
// fixed width (not min/max) is required for straight connectors. Exported so the
// config panel can anchor itself off the node's on-screen size.
export const NODE_WIDTH = 264;

// ── Component ─────────────────────────────────────────────────────────────────

export interface BaseNodeProps {
  /** Tone — drives accent, type-tab, and selection-border colours. */
  tone: NodeTone;
  /** Phosphor slug (resolves via DS `<Icon name=… />`). */
  iconName: string;
  /** Short label shown in the floating type tab (e.g. "Trigger"). */
  typeLabel: string;
  /** Main heading shown under the type tab. */
  label: string;
  /** Optional small description shown below the heading. */
  description?: string;
  /** Optional custom content rendered below the description (chips, fields…). */
  children?: ReactNode;
  /** True when this node is selected on the React Flow canvas. */
  selected?: boolean;
  /** Whether to render a top input handle. Defaults to true. */
  hasTarget?: boolean;
  /** Whether to render a bottom output handle. Defaults to true. */
  hasSource?: boolean;
}

export default function BaseNode({
  // `tone` is intentionally not read — see the note on NodeTone above. Kept on
  // the props so node renderers can keep declaring their semantic tone.
  iconName,
  typeLabel,
  label,
  description,
  children,
  selected,
  hasTarget = true,
  hasSource = true,
}: BaseNodeProps) {
  // Selection is shown by a darker outline alone (no corner arrow). The
  // primary-text token is theme-aware — a near-black grey-900 outline in light
  // mode, a near-white one in dark mode — so the selected card reads clearly
  // darker/bolder than the resting grey-300 border in both themes.
  const selectedAccent = "var(--text-neutral-primary)";

  // A node is a "leaf" when it has a source handle but nothing is wired to it
  // yet — those get the dangling "add next step" affordance below the card.
  const nodeId = useNodeId();
  const edges = useWorkflowStore((s) => s.edges);
  const isLeaf = hasSource && !!nodeId && !edges.some((e) => e.source === nodeId);

  return (
    // Root is `overflow: visible` so the type tab can notch above the card edge.
    // Height is driven by the card alone (the tab is absolutely positioned), so
    // the top/bottom handles still anchor to the card's true top/bottom edges.
    //
    // FIXED width (not min/max): React Flow centres the top/bottom handles on the
    // card's horizontal mid-line, so every node in a column must share the same
    // width for the connectors to run perfectly straight after auto-arrange. A
    // variable width shifted each handle's centre and bent the "straight" links.
    <div style={{ position: "relative", width: NODE_WIDTH }}>

      {/* Type tab — pokes up from BEHIND the card (zIndex below the body), so the
          card's opaque top edge tucks over its lower portion and only the
          rounded top shows. Neutral semantic fill + border so it reads against
          the card in both themes; top-rounded only (the square bottom tucks
          behind the card). */}
      <div
        style={{
          position: "absolute",
          // Raised so the *visible* strip (tab top → card edge) gives the content
          // equal breathing room above and below. The extra bottom padding is the
          // part that tucks behind the card, keeping the icon/label visually
          // centred in the showing portion rather than jammed at the card edge.
          top: -24,
          left: 0,
          zIndex: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 9px 9px 9px",
          background: "var(--bg-neutral-secondary)",
          border: "1px solid var(--border-neutral-bold)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          color: "var(--text-neutral-secondary)",
          pointerEvents: "none",
        }}
      >
        <Icon name={iconName} size="xs" color="var(--icon-neutral-secondary)" />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-neutral-secondary)",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}>
          {typeLabel}
        </span>
      </div>

      {hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: "var(--border-neutral-bold)",
            border: "2px solid var(--bg-neutral-primary)",
            width: 10,
            height: 10,
          }}
        />
      )}

      {/* Card body — zIndex above the tab + opaque fill, so it paints over the
          tab's lower portion (the "folder tab tucks behind the card" look). */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: 8,
          background: "var(--bg-neutral-primary)",
          border: selected
            ? `1px solid ${selectedAccent}`
            // Match the floating toolbar's border so node cards read as the same
            // lifted-off-the-canvas family (bolder border, definition without a
            // heavy shadow).
            : "1px solid var(--border-neutral-bold)",
          // Selection reads from the accent border alone — no shadow lift. The
          // resting card keeps a soft shadow for definition off the dot grid.
          boxShadow: selected
            ? "none"
            : "0 2px 8px rgba(31,31,42,0.06)",
          transition: "box-shadow 0.15s ease, border-color 0.15s ease",
          padding: "16px 14px 14px",
        }}
      >
        {/* Heading */}
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text-neutral-primary)",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}>
          {label}
        </div>

        {/* Optional description — up to 3 lines, then ellipsis. */}
        {description && (
          <div style={{
            fontSize: 12,
            color: "var(--text-neutral-tertiary)",
            marginTop: 4,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {description}
          </div>
        )}

        {/* Sub-content (chips, fields, method+url, etc.) */}
        {children && (
          <div style={{ marginTop: 10 }}>
            {children}
          </div>
        )}
      </div>

      {hasSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: "var(--border-neutral-bold)",
            border: "2px solid var(--bg-neutral-primary)",
            width: 10,
            height: 10,
          }}
        />
      )}

      {/* Dangling "add next step" affordance for leaf nodes. */}
      {isLeaf && nodeId && <AddNextButton sourceId={nodeId} />}
    </div>
  );
}
