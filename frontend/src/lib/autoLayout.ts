/**
 * autoLayout — a lightweight top-down tree/DAG layout for the workflow canvas.
 *
 * Workflows flow downward (Trigger at the top, edges pointing at the next step),
 * so we lay them out in layers: depth (longest path from a root) drives the row,
 * and a leaf-order centering pass spreads siblings horizontally and centres each
 * parent over its children. No external layout engine — the graphs here are
 * small and mostly tree-shaped, so a Reingold–Tilford-style pass is plenty.
 *
 * Pure function: returns NEW node objects with updated `position`, leaving the
 * inputs untouched. Positions are snapped to the canvas grid so the result lands
 * on the same lattice the drag snap uses.
 */

import { WorkflowNode, WorkflowEdge } from "./types";

export interface LayoutOptions {
  /** Horizontal distance between sibling columns. */
  xGap?: number;
  /** Vertical distance between layers. */
  yGap?: number;
  /** Grid to snap final positions to (match Canvas SNAP_GRID). */
  grid?: number;
  originX?: number;
  originY?: number;
}

export function layoutNodes(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  opts: LayoutOptions = {},
): WorkflowNode[] {
  const xGap = opts.xGap ?? 336;
  const yGap = opts.yGap ?? 192;
  const grid = opts.grid ?? 48;
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;

  if (nodes.length === 0) return nodes;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  nodes.forEach((n) => { children.set(n.id, []); indeg.set(n.id, 0); });
  edges.forEach((e) => {
    // Ignore dangling edges that reference nodes no longer present.
    if (byId.has(e.source) && byId.has(e.target)) {
      children.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  });

  // ── Topological order (Kahn) ────────────────────────────────────────────────
  // Seed with in-degree-0 nodes (roots — typically the Trigger), ordered by
  // their current position so the result is stable / deterministic.
  const indegCopy = new Map(indeg);
  const seeds = nodes
    .filter((n) => (indegCopy.get(n.id) ?? 0) === 0)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((n) => n.id);

  const queue = [...seeds];
  const topo: string[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    topo.push(id);
    for (const c of children.get(id) ?? []) {
      indegCopy.set(c, (indegCopy.get(c) ?? 0) - 1);
      if ((indegCopy.get(c) ?? 0) <= 0) queue.push(c);
    }
  }
  // Any nodes left unseen sit in a cycle — append them so they still get placed.
  nodes.forEach((n) => { if (!seen.has(n.id)) topo.push(n.id); });

  // ── Depth = longest path from a root ────────────────────────────────────────
  const depth = new Map<string, number>();
  topo.forEach((id) => { if (!depth.has(id)) depth.set(id, 0); });
  topo.forEach((id) => {
    const d = depth.get(id) ?? 0;
    for (const c of children.get(id) ?? []) {
      depth.set(c, Math.max(depth.get(c) ?? 0, d + 1));
    }
  });

  // ── Column assignment (leaf order, parent centred over children) ────────────
  const col = new Map<string, number>();
  const placed = new Set<string>();
  let nextCol = 0;
  function assign(id: string) {
    if (placed.has(id)) return;
    placed.add(id);
    const kids = children.get(id) ?? [];
    const fresh = kids.filter((k) => !placed.has(k));
    if (kids.length === 0) {
      col.set(id, nextCol++);
      return;
    }
    fresh.forEach(assign);
    const kidCols = kids.map((k) => col.get(k)).filter((v): v is number => v != null);
    col.set(id, kidCols.length
      ? kidCols.reduce((a, b) => a + b, 0) / kidCols.length
      : nextCol++);
  }
  // Roots first (in their seeded order), then anything orphaned.
  (seeds.length ? seeds : nodes.map((n) => n.id)).forEach(assign);
  nodes.forEach((n) => { if (!placed.has(n.id)) { assign(n.id); } });

  // ── De-overlap pass — guarantee a min column gap within each row ─────────────
  // The centroid centering above keeps internal nodes inside their own subtree's
  // leaf span, which is collision-free for a clean tree. But once the graph stops
  // being a tree — shared children, re-converging branches (e.g. several actions
  // feeding one `book_load`, or an "evaluate offer" edge looping back) — two nodes
  // at the SAME depth can resolve to the same (or near-same) fractional column and
  // stack right on top of each other. That's the "tidy leaves 2–3 nodes overlapping"
  // bug. Fix it per row: sort by column, then sweep left→right and push any node
  // closer than one full column-unit to its left neighbour out to a clean gap.
  // Left-to-right order is preserved; only colliding nodes move.
  const rows = new Map<number, string[]>();
  topo.forEach((id) => {
    const d = depth.get(id) ?? 0;
    if (!rows.has(d)) rows.set(d, []);
    rows.get(d)!.push(id);
  });
  rows.forEach((ids) => {
    ids.sort((a, b) =>
      (col.get(a) ?? 0) - (col.get(b) ?? 0) ||
      (byId.get(a)!.position.x - byId.get(b)!.position.x),
    );
    let last = -Infinity;
    ids.forEach((id) => {
      let c = col.get(id) ?? 0;
      if (c < last + 1) c = last + 1;
      col.set(id, c);
      last = c;
    });
  });

  const snap = (v: number) => Math.round(v / grid) * grid;
  return nodes.map((n) => ({
    ...n,
    position: {
      x: snap(originX + (col.get(n.id) ?? 0) * xGap),
      y: snap(originY + (depth.get(n.id) ?? 0) * yGap),
    },
  }));
}
