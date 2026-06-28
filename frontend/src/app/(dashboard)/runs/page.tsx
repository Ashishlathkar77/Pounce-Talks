"use client";

/**
 * Runs — call-log directory, redesigned onto the Hemut design system.
 *
 * Mirrors the Agent Studio layout: PageHeader + a filter toolbar open on the
 * secondary body, then a single bordered card (`.dt-card`) holding the DS
 * DataTable and a compact pagination footer (`.dt-pagination`). Loading swaps
 * in skeleton columns/rows (`.dt-loading`); the empty state renders centered
 * in the table body. Selecting a row opens the detail panel in a DS Drawer
 * (was a resizable split-pane).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Button,
  Checkbox,
  DataTable,
  DatePicker,
  Drawer,
  Dropdown,
  EmptyState,
  Icon,
  Menu,
  PageHeader,
  Pagination,
  Skeleton,
  Surface,
  Tag,
} from "@hemut2025/design-system";
import { Reorder, useDragControls } from "framer-motion";
import type { CalendarRange, DataTableColumn, DataTableSort, TagProps } from "@hemut2025/design-system";
import { fetcher } from "@/lib/api";
import { CallLog, PaginatedResponse, RunDetail } from "@/lib/types";
import { useAuthStore, useAgentSelectorStore } from "@/lib/store";
import { RunDetailPanel, RunStatusChips } from "@/components/runs/DetailPanel";

// ── Outcome options (drives the filter dropdown) ─────────────────────────────
const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: "meeting_booked",  label: "Meeting Booked"  },
  { value: "qualified",       label: "Qualified"       },
  { value: "not_qualified",   label: "Not Qualified"   },
  { value: "no_answer",       label: "No Answer"       },
  { value: "failed",          label: "Failed"          },
];

// ── Outcome → label + Tag variant ────────────────────────────────────────────
const OUTCOME_LABELS: Record<string, string> = {
  meeting_booked: "Meeting Booked",
  qualified:      "Qualified",
  not_qualified:  "Not Qualified",
  no_answer:      "No Answer",
  failed:         "Failed",
};
function outcomeLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return OUTCOME_LABELS[v] ?? v.replace(/_/g, " ");
}
function outcomeVariant(v: string | null | undefined): TagProps["variant"] {
  if (!v) return "neutral";
  if (v === "meeting_booked" || v === "qualified") return "success";
  if (v === "not_qualified" || v === "failed")     return "error";
  if (v === "no_answer")                           return "warning";
  return "neutral";
}

// ── Date helpers — convert between Date (DS DatePicker) and YYYY-MM-DD
// (the wire format the backend's `date_from` / `date_to` query params accept).
// We use the local-timezone Y/M/D parts (not toISOString, which would shift
// past midnight UTC for users east of GMT and yield off-by-one days).
function dateToWire(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wireToDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ── Outcome → label + Tag variant (defined above near OUTCOME_OPTIONS) ────────
// classVariant stub kept for any legacy DetailPanel reference
function classVariant(v: string | null | undefined): TagProps["variant"] {
  if (!v) return "neutral";
  const k = v.toLowerCase();
  if (["success", "booked", "accepted", "meeting_booked", "qualified"].includes(k))           return "success";
  if (["rate_too_high", "error_or_confused", "declined", "user_declined_load"].includes(k))   return "error";
  if (["checking_with_driver", "pending", "voicemail"].includes(k))                           return "warning";
  if (["ask_for_transfer", "transferred", "capacity_only"].includes(k))                       return "info";
  return "neutral";
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

// Scalar accessor per sortable column — feeds the controlled comparator.
function sortValue(r: CallLog, columnId: string): string {
  switch (columnId) {
    case "timestamp": return r.created_at ?? "";
    case "prospect":  return r.prospect_company ?? r.prospect_name ?? "";
    case "campaign":  return r.campaign_name ?? "";
    case "duration":  return String(r.duration_seconds ?? 0).padStart(6, "0");
    case "outcome":   return r.outcome ?? "";
    case "score":     return String(r.qualification_score ?? -1).padStart(3, "0");
    default:          return "";
  }
}

// ── Cell text styles (all DS-tokenized) ──────────────────────────────────────

const cellText:  React.CSSProperties = { fontSize: 13, color: "var(--text-neutral-primary)" };
const cellMuted: React.CSSProperties = { fontSize: 13, color: "var(--text-neutral-secondary)" };
const cellNum:   React.CSSProperties = { fontSize: 12.5, color: "var(--text-neutral-secondary)", fontVariantNumeric: "tabular-nums" };

// ── Column registry ───────────────────────────────────────────────────────────

const COL_REGISTRY: Record<string, DataTableColumn<CallLog>> = {
  timestamp: {
    id: "timestamp",
    sortable: true,
    header: "Called At",
    width: 190,
    cell: (r) => <span style={cellNum}>{fmtTs(r.created_at)}</span>,
  },
  prospect: {
    id: "prospect",
    sortable: true,
    header: "Prospect",
    cell: (r) => (
      <div>
        <div style={{ ...cellText, fontWeight: 500 }}>
          {r.prospect_company || r.prospect_name || "—"}
        </div>
        {r.prospect_name && r.prospect_name !== r.prospect_company && (
          <div style={{ fontSize: 11.5, color: "var(--text-neutral-secondary)", marginTop: 1 }}>
            {r.prospect_name}
          </div>
        )}
      </div>
    ),
  },
  campaign: {
    id: "campaign",
    sortable: true,
    header: "Campaign",
    cell: (r) => (
      <span style={cellMuted}>{r.campaign_name || "—"}</span>
    ),
  },
  duration: {
    id: "duration",
    sortable: true,
    header: "Duration",
    width: 90,
    cell: (r) => (
      <span style={cellNum}>{r.duration_fmt ?? (r.duration_seconds != null ? `${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, "0")}` : "—")}</span>
    ),
  },
  outcome: {
    id: "outcome",
    sortable: true,
    header: "Outcome",
    cell: (r) =>
      r.outcome
        ? <Tag size="xm" variant={outcomeVariant(r.outcome)}>{outcomeLabel(r.outcome)}</Tag>
        : <span style={cellMuted}>—</span>,
  },
  score: {
    id: "score",
    sortable: true,
    header: "Score",
    width: 80,
    align: "right",
    cell: (r) => {
      const s = r.qualification_score;
      if (s == null) return <span style={cellMuted}>—</span>;
      const color = s >= 7 ? "var(--text-success-primary)" : s >= 5 ? "#b45309" : "var(--text-error-primary)";
      return (
        <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
          {s}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-neutral-secondary)" }}>/10</span>
        </span>
      );
    },
  },
};

// Default Pounce SDR column order
const DEFAULT_RUNS_COLUMNS = ["timestamp", "prospect", "campaign", "duration", "outcome", "score"];

// ── Column reorder row ────────────────────────────────────────────────────────
// One draggable entry in the Columns menu. Dragging is gated to the grip handle
// (`dragListener={false}` + `dragControls`) so a plain click on the row toggles
// visibility instead of being swallowed by a drag gesture.
function ColumnReorderRow({
  colKey,
  visible,
  lockedVisible,
  onToggle,
}: {
  colKey: string;
  visible: boolean;
  /** The last remaining visible column — can't be hidden, so the row is inert. */
  lockedVisible: boolean;
  onToggle: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={colKey}
      dragListener={false}
      dragControls={controls}
      style={{ listStyle: "none" }}
    >
      <div
        role="button"
        aria-pressed={visible}
        onClick={() => { if (!lockedVisible) onToggle(); }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 8,
          cursor: lockedVisible ? "default" : "pointer",
          opacity: lockedVisible ? 0.55 : 1,
          userSelect: "none",
        }}
      >
        <span
          onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", cursor: "grab", touchAction: "none",
            color: "var(--text-neutral-disabled)",
          }}
          aria-label="Drag to reorder"
        >
          <Icon name="dots-six-vertical" size="sm" aria-hidden />
        </span>
        <Checkbox embedded checked={visible} />
        <span style={{ fontSize: 13, color: "var(--text-neutral-primary)" }}>
          {COL_REGISTRY[colKey].header}
        </span>
      </div>
    </Reorder.Item>
  );
}

// Trailing "open" affordance — appended after the data columns (matches Agent
// Studio) so every row reads as clickable → opens the detail drawer.
const OPEN_COL: DataTableColumn<CallLog> = {
  id: "__open",
  header: "",
  align: "right",
  width: 56,
  cell: () => (
    <i className="ph ph-arrow-right" style={{ fontSize: 14, color: "var(--text-neutral-disabled)" }} />
  ),
};

// ── Loading skeleton ─────────────────────────────────────────────────────────
const SKELETON_ROWS: CallLog[] = Array.from(
  { length: 12 },
  (_, i) => ({ id: `sk-${i}` }) as CallLog,
);
// Type-aware skeletons (matches Agent Studio): columns that render a DS Tag get
// a pill-shaped placeholder; text columns get a bar; the trailing open column a
// small chip. Per-row width variation so it reads as content, not a rigid grid.
const SK_BAR_W  = ["62%", "45%", "70%", "52%", "64%", "48%"];
const SK_PILL_W = [78, 96, 70, 88, 82, 74];
const SK_PILL_COLS = new Set(["outcome"]);

// Multiselect + an "All" reset row. Internally an empty array means "all"; the
// "all" sentinel is only ever shown as the selected chip when nothing specific
// is picked. Selecting "All" (or clearing every pick) resets to []; selecting a
// specific value drops the sentinel.
const ALL = "all";
function multiWithAll(current: string[], next: string[]): string[] {
  const allWasShown = current.length === 0;
  if (next.includes(ALL) && !allWasShown) return [];   // user clicked "All"
  return next.filter((v) => v !== ALL);                 // specific picks (or none → all)
}
function valueWithAll(current: string[]): string[] {
  return current.length ? current : [ALL];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [dateFrom, setFrom]     = useState("");
  const [dateTo, setTo]         = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<DataTableSort | null>(null);

  // Column-visibility toggle (left of the filters). We track *hidden* keys so
  // the selection survives `runsColumns` loading/changing — anything not hidden
  // stays visible. Local-only (not persisted to workspace_config).
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  // User-controlled column order (drag-to-reorder in the Columns menu). Seeded
  // from the freight defaults, then reconciled against the active column set
  // (see effect below) so it tracks workspace_config without losing a manual
  // arrangement. Local-only, like `hiddenCols`.
  const [colOrder, setColOrder] = useState<string[]>(
    () => DEFAULT_RUNS_COLUMNS.filter((k) => COL_REGISTRY[k]),
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colBtnRef = useRef<HTMLButtonElement>(null);

  const { user } = useAuthStore();

  // Agent filter — driven by the global header agent selector (shared store),
  // not a local dropdown. `selectedAgentId === null` means "All agents".
  const { selectedAgentId } = useAgentSelectorStore();

  // Selecting a different agent in the header can shrink the result set, so
  // snap back to the first page whenever it changes.
  useEffect(() => { setPage(1); }, [selectedAgentId]);

  // Build the query manually so the multiselect outcome filter can emit
  // repeated params (`?outcome=a&outcome=b`) — the shape FastAPI parses into a
  // list. The header agent selection contributes a single `agent_id`.
  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    if (selectedAgentId) p.set("agent_id", selectedAgentId);
    outcomes.forEach((o) => p.append("outcome", o));
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    return p.toString();
  }, [page, pageSize, selectedAgentId, outcomes, dateFrom, dateTo]);

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResponse<CallLog>>(
    `/api/runs/?${queryStr}`,
    fetcher,
    { refreshInterval: 15000 },
  );

  // Local refresh-busy flag — `mutate()` returns a Promise we await so the
  // refresh button can show a spinning state for the duration of the request.
  const [refreshing, setRefreshing] = useState(false);
  const refreshBusy = refreshing || isValidating;
  async function handleRefresh() {
    setRefreshing(true);
    try { await mutate(); } finally { setRefreshing(false); }
  }

  const runs       = data?.items ?? [];
  // Client-side sort over the current page only (server returns newest-first).
  // When no sort is active we preserve the server order untouched.
  const sortedRuns = useMemo(() => {
    if (!sort) return runs;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...runs].sort(
      (a, b) => sortValue(a, sort.columnId).localeCompare(sortValue(b, sort.columnId)) * dir
    );
  }, [runs, sort]);
  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const hasFilter  = !!(outcomes.length || dateFrom || dateTo);
  const panelOpen  = !!selectedId;
  // The selected row (from the already-loaded page) supplies the Drawer's
  // auto-header title — the full transcript still streams in inside the panel.
  const selectedRun = runs.find((r) => r.id === selectedId);
  // Share the panel's SWR cache key so the header's status chips (which need
  // the step count from the full transcript + tool calls) render without a
  // second network request — SWR dedupes the identical key.
  const { data: selectedDetail } = useSWR<RunDetail>(
    selectedId ? `/api/runs/${selectedId}` : null,
    fetcher,
  );

  // Resolve active column set from workspace_config, falling back to freight
  // defaults. Drop any keys with no registry entry so the toggle menu and the
  // table agree on the same column universe.
  const runsColumns: string[] = useMemo(
    () => (user?.workspace_config?.runs_columns ?? DEFAULT_RUNS_COLUMNS).filter((k) => COL_REGISTRY[k]),
    [user?.workspace_config?.runs_columns],
  );
  // Keep the manual order in sync with the active column universe: preserve the
  // user's arrangement for keys that still exist, append any newly-added keys in
  // their config order, and drop any that went away. No-ops when nothing moved
  // so we don't churn state on every render.
  useEffect(() => {
    setColOrder((prev) => {
      const kept = prev.filter((k) => runsColumns.includes(k));
      const added = runsColumns.filter((k) => !kept.includes(k));
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next;
    });
  }, [runsColumns]);
  const visibleColKeys = useMemo(
    () => colOrder.filter((k) => !hiddenCols.includes(k)),
    [colOrder, hiddenCols],
  );
  const activeCols = useMemo(
    () => [
      ...(visibleColKeys.map((k) => COL_REGISTRY[k]) as DataTableColumn<CallLog>[]),
      OPEN_COL,
    ],
    [visibleColKeys],
  );

  // Toggle a column's visibility — never let the user hide the last column.
  function toggleCol(key: string) {
    setHiddenCols((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : visibleColKeys.length <= 1
          ? prev
          : [...prev, key],
    );
  }

  // Skeleton columns reuse the active colgroup (ids/widths) so the loading rows
  // stay perfectly aligned with the header. Type-aware like Agent Studio: pill
  // placeholders for Tag columns, bars for text, a small chip for the open col.
  const skeletonColumns = useMemo<DataTableColumn<CallLog>[]>(
    () => activeCols.map((c, ci) => ({
      id: c.id,
      header: c.header,
      width: c.width,
      align: c.align,
      cell: c.id === "__open"
        ? () => <Skeleton width={14} height={14} radius="sm" style={{ marginLeft: "auto" }} />
        : SK_PILL_COLS.has(c.id)
          ? (_r: CallLog, i: number) => (
              <Skeleton width={SK_PILL_W[(i + ci) % SK_PILL_W.length]} height={22} radius="full" />
            )
          : (_r: CallLog, i: number) => (
              <Skeleton width={SK_BAR_W[(i + ci) % SK_BAR_W.length]} height={12} radius="sm" />
            ),
    })),
    [activeCols],
  );

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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Runs
            {!isLoading && (
              <Tag size="sm" variant="neutral" style={{ background: "var(--bg-neutral-primary)" }}>
                {total.toLocaleString()} runs
              </Tag>
            )}
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            leftIcon="arrows-clockwise"
            onClick={handleRefresh}
            loading={refreshBusy}
            disabled={refreshBusy}
            aria-label={refreshBusy ? "Refreshing runs" : "Refresh runs"}
            title={refreshBusy ? "Refreshing…" : "Refresh"}
          />
        }
      />

      {/* Content region — 12px gutter on the secondary body. Toolbar sits open
          on the body; the table + pagination live in the white card. */}
      <div style={{ flex: 1, minHeight: 0, padding: "12px 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Toolbar — outcome + date range filters; the agent filter lives in the
            global header selector. Column toggle is pushed to the far right. */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 210 }}>
            <Dropdown
              size="sm"
              multiple
              optionVariant="checkbox"
              value={valueWithAll(outcomes)}
              onChange={(v) => { setOutcomes(multiWithAll(outcomes, Array.isArray(v) ? v : [v])); setPage(1); }}
              options={[{ value: ALL, label: "All outcomes" }, ...OUTCOME_OPTIONS]}
              searchable
              searchPlaceholder="Search outcomes…"
              placeholder="All outcomes"
            />
          </div>
          <div style={{ width: 220 }}>
            <DatePicker
              type="range"
              size="sm"
              placeholder="Pick a date range"
              rangeValue={{ start: wireToDate(dateFrom), end: wireToDate(dateTo) }}
              onRangeChange={(next: CalendarRange) => {
                setFrom(dateToWire(next.start));
                setTo(dateToWire(next.end));
                setPage(1);
              }}
              placement="bottom-start"
            />
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon="x"
              onClick={() => { setOutcomes([]); setFrom(""); setTo(""); setPage(1); }}
            >
              Clear
            </Button>
          )}

          {/* Columns — fixed-label trigger opening a checkbox menu. Pushed to the
              far right; toggles which registry columns the table renders. */}
          <Button
            ref={colBtnRef}
            variant="outline"
            size="sm"
            leftIcon="columns"
            rightIcon="caret-down"
            onClick={() => setColMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={colMenuOpen}
            style={{ marginLeft: "auto" }}
          >
            Columns
          </Button>
          <Menu
            open={colMenuOpen}
            onOpenChange={setColMenuOpen}
            anchorRef={colBtnRef}
            placement="bottom-end"
            offset={6}
            ariaLabel="Toggle and reorder columns"
            width={240}
          >
            <Menu.Section>
              {/* Drag the grip to reorder; click a row to toggle visibility.
                  Reorder writes through to `colOrder`, which drives both this
                  list and the table's column order. */}
              <Reorder.Group
                as="div"
                axis="y"
                values={colOrder}
                onReorder={setColOrder}
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {colOrder.map((key) => (
                  <ColumnReorderRow
                    key={key}
                    colKey={key}
                    visible={!hiddenCols.includes(key)}
                    lockedVisible={!hiddenCols.includes(key) && visibleColKeys.length <= 1}
                    onToggle={() => toggleCol(key)}
                  />
                ))}
              </Reorder.Group>
            </Menu.Section>
          </Menu>
        </div>

        {/* White table card — table + pagination share ONE bordered wrapper
            (`.dt-card` flattens the DataTable's own border in globals). */}
        <Surface
          className="dt-card"
          variant="primary"
          radius="lg"
          border="primary"
          shadow="none"
          padding="none"
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* DS DataTable — sticky-header, row click → open detail Drawer. While
              loading we swap in skeleton columns/rows (same colgroup → aligned);
              `.dt-loading` disables row :hover/cursor. The empty slot keeps the
              header visible and centers via globals (`.hm-table-empty-*`). */}
          <div
            style={{ flex: 1, minHeight: 0 }}
            className={isLoading ? "dt-loading" : undefined}
          >
            <DataTable<CallLog>
              style={{ height: "100%" }}
              columns={isLoading ? skeletonColumns : activeCols}
              rows={isLoading ? SKELETON_ROWS : sortedRuns}
              getRowId={(r: CallLog) => r.id}
              stickyHeader
              showColumnControls={false}
              density="dense"
              sort={isLoading ? null : sort}
              onSortChange={isLoading ? undefined : setSort}
              onRowClick={isLoading ? undefined : (r: CallLog) => setSelectedId(r.id)}
              emptyState={
                <EmptyState
                  size="md"
                  icon="phone"
                  title={hasFilter ? "No matching calls" : "No calls yet"}
                  description={
                    hasFilter
                      ? "Try adjusting your filters or date range."
                      : "Calls appear here once your agents go live."
                  }
                />
              }
            />
          </div>

          {/* Pagination — card footer. Only the top divider here; the inner
              padding is aligned to the table cell rhythm (12/16) in globals
              (`.dt-pagination`). `menuPlacement="up"` so the rows-per-page menu
              isn't clipped at the viewport bottom. */}
          {!isLoading && total > 0 && (
            <div className="dt-pagination" style={{
              flexShrink: 0,
              borderTop: "1px solid var(--border-neutral-subtle)",
            }}>
              <Pagination
                page={page}
                totalItems={total}
                totalPages={totalPages}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[15, 30, 60, 100]}
                onPageChange={setPage}
                onRowsPerPageChange={(n) => { setPageSize(n); setPage(1); }}
                menuPlacement="up"
                ariaLabel="Runs pagination"
                rangeLabel={(first, last, totalItems) =>
                  `${first.toLocaleString()}–${last.toLocaleString()} of ${totalItems.toLocaleString()} runs`
                }
              />
            </div>
          )}
        </Surface>
      </div>

      {/* ── Detail Drawer ──
          Native DS Drawer: the floating inset card governs width (size `lg`)
          and full height, and its auto-header owns the call-date title + close
          button (`dismissible`). The embedded `RunDetailPanel` drops its own
          title/chrome row and fills the body below the header. Backdrop click /
          Esc still close. */}
      <Drawer
        open={panelOpen}
        onClose={() => setSelectedId(null)}
        placement="right"
        size="lg"
        title={selectedRun ? fmtTs(selectedRun.created_at) : "Run details"}
        subtitle={selectedDetail ? <RunStatusChips data={selectedDetail} /> : undefined}
        ariaLabel="Run details"
        className="runs-detail-drawer"
      >
        <Drawer.Body>
          {/* minHeight:0 is required so this flex child can shrink to the body's
              height instead of growing to content height — otherwise the panel's
              inner scroll area never engages and the transcript can't scroll. */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {selectedId && (
              <RunDetailPanel
                sessionId={selectedId}
                embedded
              />
            )}
          </div>
        </Drawer.Body>
      </Drawer>
    </div>
  );
}
