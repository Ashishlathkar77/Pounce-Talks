"use client";

/**
 * Agent Studio — directory listing of every voice agent in the workspace.
 *
 * Built from DS primitives end-to-end:
 *   • `PageHeader` — title + count pill + New-agent CTA.
 *   • `DataTable`  — the table itself (DS 1.21+). Columns are a typed config;
 *                    sorting, sticky header, row hover, loading + empty states
 *                    are all handled by the component. We only supply the
 *                    per-cell renderers (icon tile, direction/status pills).
 *   • `Tag`        — direction pill (neutral + directional arrow icon) and
 *                    status pill (success/neutral).
 *   • `EmptyState` — no-data placeholder with a single primary CTA.
 *
 * Sorting is *controlled*: DataTable cells render ReactNodes (pills), so the
 * component can't derive sortable scalars itself — we sort `list` here in
 * response to `onSortChange` and feed it the ordered rows.
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Button,
  DataTable,
  Dropdown,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Skeleton,
  Surface,
  Tag,
} from "@hemut2025/design-system";
import type { DataTableColumn, DataTableSort, DropdownValue } from "@hemut2025/design-system";
import { fetcher } from "@/lib/api";
import { AgentConfig } from "@/lib/types";
import { useAgentSelectorStore } from "@/lib/store";
import { agentCategory, AGENT_DEPTS, formatPhoneNumber } from "@/lib/utils";
import NewAgentModal from "@/components/agents/NewAgentModal";

// ── Catalogue ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  carrier_sales: "truck", driver_eta: "map-pin", customer_eta: "users",
  receptionist: "headphones", sdr: "trend-up", pod_collection: "file-text",
  detention_monitor: "warning", assign_driver: "user-check",
  equipment_change: "arrows-clockwise", reschedule: "clock",
  outbound_carrier_sales: "currency-dollar",
  outbound_load_bidder: "gavel",
  driver_onboarding: "user-plus",
};

type Direction = "Inbound" | "Outbound" | "Both";

const DIRECTION: Record<string, Direction> = {
  carrier_sales: "Inbound", outbound_carrier_sales: "Outbound", driver_eta: "Both",
  customer_eta: "Outbound", receptionist: "Inbound", sdr: "Outbound",
  pod_collection: "Outbound", detention_monitor: "Outbound",
  assign_driver: "Outbound", equipment_change: "Both", reschedule: "Both",
  outbound_load_bidder: "Outbound", driver_onboarding: "Both",
};

/** Direction is a *category*, not a status — so we drop semantic colours
 *  (Outbound used to be "warning"/amber, which read as a caution state) and
 *  use a single neutral pill differentiated by a directional arrow:
 *  Inbound ↓ (call comes in), Outbound ↑ (agent dials out), Both ↕. */
const DIRECTION_ICON: Record<Direction, string> = {
  Inbound:  "arrow-down",
  Outbound: "arrow-up",
  Both:     "arrows-down-up",
};

// Three distinct colours per direction. The palette only ships blue/green/amber
// as non-grey hues, so: Inbound = info (blue), Outbound = success (green),
// Both = warning (amber). Differentiated further by the directional arrow icon.
const DIRECTION_VARIANT: Record<Direction, "info" | "success" | "warning"> = {
  Inbound:  "info",
  Outbound: "success",
  Both:     "warning",
};

function directionOf(a: AgentConfig): Direction {
  return DIRECTION[a.agent_type] ?? "Both";
}

function statusLabel(status: AgentConfig["status"]): string {
  return status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft";
}

/** Node count from the stored workflow. Both shapes — the v1 envelope and the
 *  legacy `{ nodes, edges }` — expose a `nodes` array, so one accessor covers
 *  both. Returns null when no workflow_json is present (renders as "—"). */
function nodeCount(a: AgentConfig): number | null {
  const nodes = a.workflow_json?.nodes;
  return Array.isArray(nodes) ? nodes.length : null;
}

// ── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS: DataTableColumn<AgentConfig>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    cell: (a) => {
      const icon = TYPE_ICON[a.agent_type] ?? "robot";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "var(--bg-neutral-secondary)",
            border: "1px solid var(--border-neutral-subtle)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ph ph-${icon}`} style={{ fontSize: 16, color: "var(--text-neutral-secondary)" }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-neutral-primary)" }}>
            {a.name}
          </span>
        </div>
      );
    },
  },
  {
    id: "category",
    header: "Category",
    sortable: true,
    // The department grouping the agent's type belongs to — same taxonomy the
    // top-nav agent selector groups by (`AGENT_DEPTS`).
    cell: (a) => (
      <Tag className="ag-row-chip" size="xm" variant="neutral" leftIcon="folder-simple">
        {agentCategory(a.agent_type)}
      </Tag>
    ),
  },
  {
    id: "direction",
    header: "Direction",
    sortable: true,
    cell: (a) => {
      const dir = directionOf(a);
      return <Tag size="xm" variant={DIRECTION_VARIANT[dir]} leftIcon={DIRECTION_ICON[dir]}>{dir}</Tag>;
    },
  },
  {
    id: "nodes",
    header: "Nodes",
    sortable: true,
    // Workflow size — only shown when the agent carries a workflow_json; rows
    // without one render a dim "—" so the column stays aligned.
    cell: (a) => {
      const n = nodeCount(a);
      return n === null ? (
        <span style={{ fontSize: 13, color: "var(--text-neutral-disabled)" }}>—</span>
      ) : (
        <Tag size="xm" variant="neutral" leftIcon="tree-structure">{n}</Tag>
      );
    },
  },
  {
    id: "phone",
    header: "Phone",
    sortable: true,
    cell: (a) => (
      <span style={{
        fontSize: 13,
        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
        color: a.phone_number ? "var(--text-neutral-secondary)" : "var(--text-neutral-disabled)",
      }}>
        {formatPhoneNumber(a.phone_number) || "—"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    cell: (a) => (
      <Tag size="xm" variant={a.status === "active" ? "success" : "neutral"}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
          {statusLabel(a.status)}
        </span>
      </Tag>
    ),
  },
  {
    id: "open",
    header: "",
    align: "right",
    width: 56,
    cell: () => (
      <i className="ph ph-arrow-right" style={{ fontSize: 14, color: "var(--text-neutral-disabled)" }} />
    ),
  },
];

// ── Loading skeleton ─────────────────────────────────────────────────────────
// Mirror COLUMNS (ids/widths/alignment) so the skeleton reuses the table's
// colgroup — cells stay perfectly aligned with the header. Cells render
// Skeletons instead of data; rows are inert placeholders (no sort/click).

const SKELETON_ROW_COUNT = 8;

// Per-row width variation so the skeleton reads as content rather than a rigid
// grid of identical bars. Indexed by the placeholder row's number.
const SK_NAME_W  = [150, 124, 168, 138, 156, 116, 146, 132];
const SK_PHONE_W = [112,  96, 128, 104, 120, 100, 116, 108];
function skRow(id: string): number {
  const n = Number(id.slice(id.lastIndexOf("-") + 1));
  return Number.isFinite(n) ? n : 0;
}

// Plain rect Skeletons with explicit width/height — the app-wide convention
// (see runs / analytics / detail panels). Avatar box + a label bar for Name;
// pill-shaped bars stand in for the Direction/Status Tags.
const SKELETON_COLUMNS: DataTableColumn<AgentConfig>[] = [
  {
    id: "name",
    header: "Name",
    cell: (a: AgentConfig) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton width={32} height={32} radius="md" />
        <Skeleton width={SK_NAME_W[skRow(a.id) % SK_NAME_W.length]} height={14} radius="sm" />
      </div>
    ),
  },
  { id: "category",  header: "Category",  cell: () => <Skeleton width={104} height={22} radius="full" /> },
  { id: "direction", header: "Direction", cell: () => <Skeleton width={72} height={22} radius="full" /> },
  { id: "nodes",     header: "Nodes",     cell: () => <Skeleton width={44} height={22} radius="full" /> },
  { id: "phone",     header: "Phone",     cell: (a: AgentConfig) => <Skeleton width={SK_PHONE_W[skRow(a.id) % SK_PHONE_W.length]} height={12} radius="sm" /> },
  { id: "status",    header: "Status",    cell: () => <Skeleton width={72} height={22} radius="full" /> },
  {
    id: "open",
    header: "",
    align: "right",
    width: 56,
    cell: () => <Skeleton width={16} height={16} radius="sm" style={{ marginLeft: "auto" }} />,
  },
];

const SKELETON_ROWS: AgentConfig[] = Array.from(
  { length: SKELETON_ROW_COUNT },
  (_, i) => ({ id: `skeleton-${i}` }) as AgentConfig,
);

// ── Filter options ───────────────────────────────────────────────────────────

// Option rows stay clean ("All", "Active") — no field-name prefix. The DS
// Dropdown renders the selected option's label in its trigger, OR the
// `placeholder` when nothing is selected. We keep the trigger self-describing
// ("Status: All") by treating the "all" value as the unselected state (see the
// value/onChange mapping below) so the placeholder carries the field name.
const STATUS_OPTIONS = [
  { value: "all",    label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft",  label: "Draft" },
];

const DIRECTION_OPTIONS = [
  { value: "all",      label: "All" },
  { value: "Inbound",  label: "Inbound" },
  { value: "Outbound", label: "Outbound" },
  { value: "Both",     label: "Both" },
];

// Category = the agent's department grouping (AGENT_DEPTS), plus a catch-all
// "Other" for types that map to no department (matches `agentCategory`).
const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  ...AGENT_DEPTS.map((d) => ({ value: d.label, label: d.label })),
  { value: "Other", label: "Other" },
];

/** Dropdown emits string | string[]; we only ever use single-select here. */
function asStr(v: DropdownValue): string {
  return typeof v === "string" ? v : v[0] ?? "all";
}

// Scalar accessor per sortable column — feeds the controlled comparator.
function sortValue(a: AgentConfig, columnId: string): string {
  switch (columnId) {
    case "category":  return agentCategory(a.agent_type);
    case "direction": return directionOf(a);
    // -1 keeps workflow-less agents sorted below any real count.
    case "nodes":     return String(nodeCount(a) ?? -1);
    case "phone":     return a.phone_number ?? "";
    case "status":    return statusLabel(a.status);
    default:          return a.name ?? "";
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter();
  const { setSelectedAgent } = useAgentSelectorStore();
  const { data: agents, isLoading } = useSWR<AgentConfig[]>("/api/agents/", fetcher);
  const list = useMemo(() => agents ?? [], [agents]);
  const active = list.filter((a) => a.status === "active").length;

  // Toolbar / table state
  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter]   = useState("all");
  const [sort, setSort]                       = useState<DataTableSort | null>(null);
  const [page, setPage]                       = useState(1);
  const [rowsPerPage, setRowsPerPage]         = useState(20);
  const [newAgentOpen, setNewAgentOpen]       = useState(false);

  // Pipeline: filter → sort → paginate. Any filter/search change resets to
  // page 1 (handlers below) so the user never lands on an out-of-range page.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (directionFilter !== "all" && directionOf(a) !== directionFilter) return false;
      if (categoryFilter !== "all" && agentCategory(a.agent_type) !== categoryFilter) return false;
      if (q && !`${a.name} ${a.phone_number ?? ""} ${agentCategory(a.agent_type)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, search, statusFilter, directionFilter, categoryFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort(
      // `numeric` so the Nodes column (and any number-bearing field) sorts
      // 2 < 10 instead of lexically.
      (a, b) => sortValue(a, sort.columnId).localeCompare(sortValue(b, sort.columnId), undefined, { numeric: true }) * dir
    );
  }, [filtered, sort]);

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage   = Math.min(page, totalPages);
  const rows = useMemo(
    () => sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage),
    [sorted, safePage, rowsPerPage]
  );

  function handleOpen(agent: AgentConfig) {
    setSelectedAgent(agent.id, agent.agent_type, agent.name);
    router.push(`/agents/${agent.id}`);
  }

  return (
    <div className="converse-fullbleed-page" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--bg-neutral-secondary)",
    }}>

      {/* Header — shares the secondary-tone body background. */}
      <PageHeader
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            Agent Studio
            {!isLoading && list.length > 0 && (
              <Tag
                size="sm"
                variant="neutral"
                style={{ background: "var(--bg-neutral-primary)" }}
              >
                {active} active · {list.length} total
              </Tag>
            )}
          </span>
        }
        actions={
          <Button variant="primary" size="sm" leftIcon="plus" onClick={() => setNewAgentOpen(true)}>
            New agent
          </Button>
        }
      />

      {/* Content region — 12px gutter on the secondary body. The toolbar sits
          open on the body; the table + pagination live in the white card. */}
      <div style={{ flex: 1, minHeight: 0, padding: "12px 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Toolbar — filters + search, open on the body (no container). */}
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Dropdown
              size="sm"
              placeholder="Status: All"
              value={statusFilter === "all" ? "" : statusFilter}
              onChange={(v) => { setStatusFilter(asStr(v)); setPage(1); }}
              options={STATUS_OPTIONS}
            />
            <Dropdown
              size="sm"
              placeholder="Direction: All"
              value={directionFilter === "all" ? "" : directionFilter}
              onChange={(v) => { setDirectionFilter(asStr(v)); setPage(1); }}
              options={DIRECTION_OPTIONS}
            />
            <Dropdown
              size="sm"
              placeholder="Category: All"
              value={categoryFilter === "all" ? "" : categoryFilter}
              onChange={(v) => { setCategoryFilter(asStr(v)); setPage(1); }}
              options={CATEGORY_OPTIONS}
            />
          </div>
          <div style={{ width: 280, maxWidth: "50%" }}>
            <Input
              kind="text"
              size="sm"
              leadingIcon="magnifying-glass"
              clearable
              placeholder="Search agents…"
              value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
            />
          </div>
        </div>

        {/* White table card — table + pagination share ONE bordered wrapper.
            The Surface owns the border/radius; the DataTable's own border is
            flattened in globals (`.dt-card .hm-data-table`) so the table sits
            flush and the pagination footer lives inside the card. */}
        <Surface
          className="dt-card"
          variant="primary"
          radius="lg"
          border="primary"
          shadow="none"
          padding="none"
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* DS DataTable — sortable, sticky-header, row click → open agent.
              The empty slot keeps the column header visible. CSS in globals
              (`.hm-table-empty-*`) centers it in the body and drops the row
              :hover the DS otherwise applies. Non-primary CTA via
              `secondaryAction`. While loading we swap in skeleton columns/rows
              (same colgroup → aligned) instead of the DS label-only loading
              row; `.dt-loading` disables the row :hover/cursor. */}
          <div
            style={{ flex: 1, minHeight: 0 }}
            className={isLoading ? "dt-loading" : undefined}
          >
            <DataTable<AgentConfig>
              style={{ height: "100%" }}
              columns={isLoading ? SKELETON_COLUMNS : COLUMNS}
              rows={isLoading ? SKELETON_ROWS : rows}
              getRowId={(a: AgentConfig) => a.id}
              stickyHeader
              showColumnControls={false}
              density="dense"
              sort={isLoading ? null : sort}
              onSortChange={isLoading ? undefined : setSort}
              onRowClick={isLoading ? undefined : handleOpen}
              emptyState={
                list.length === 0 ? (
                  <EmptyState
                    size="md"
                    icon="robot"
                    title="No agents yet"
                    description="Deploy your first voice agent from a template."
                    secondaryAction={{ label: "Pick a template", icon: "plus", onClick: () => setNewAgentOpen(true) }}
                  />
                ) : (
                  <EmptyState
                    size="md"
                    icon="magnifying-glass"
                    title="No matching agents"
                    description="No agents match your search or filters."
                  />
                )
              }
            />
          </div>

          {/* Pagination — card footer. Only the top divider here; the inner
              padding is aligned to the table cell rhythm (12/16) in globals
              (`.dt-pagination`) so the range label + rows-per-page sit on the
              same left/right rails as the columns — seamless. */}
          {!isLoading && totalItems > 0 && (
            <div className="dt-pagination" style={{
              flexShrink: 0,
              borderTop: "1px solid var(--border-neutral-subtle)",
            }}>
              <Pagination
                page={safePage}
                totalItems={totalItems}
                totalPages={totalPages}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(1); }}
                rowsPerPageOptions={[10, 20, 50]}
                rangeLabel={(first, last, total) => `Showing ${first}–${last} of ${total}`}
              />
            </div>
          )}
        </Surface>
      </div>

      {/* Modal-based creation flow — replaces the old /agents/new wizard page. */}
      <NewAgentModal open={newAgentOpen} onClose={() => setNewAgentOpen(false)} />
    </div>
  );
}
