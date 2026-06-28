"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { fetcher, request } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type CallReason = "monthly_reminder" | "due_date" | "late_fee_warning" | "cancellation_warning";
type CallStatus = "pending" | "dialing" | "answered" | "no_answer" | "voicemail_left" | "failed";
type CallOutcome =
  | "informed_will_pay" | "informed_paid" | "payment_promised"
  | "disputed" | "wrong_number" | "callback_requested" | "no_answer";

interface EntryRow {
  id: string;
  customer_name: string;
  phone_primary: string;
  phone_secondary: string | null;
  account_number: string | null;
  policy_number: string;
  finance_company: string;
  amount_due: number;
  due_date: string;
  late_fee_amount: number | null;
  late_fee_date: string | null;
  cancellation_date: string | null;
  call_reason: CallReason;
  call_status: CallStatus;
  call_outcome: CallOutcome | null;
  payment_promise_date: string | null;
  notes: string | null;
}

interface Campaign {
  id: string;
  name: string;
  campaign_date: string | null;
  status: "draft" | "firing" | "completed" | "paused";
  total_entries: number;
  total_dialed: number;
  total_answered: number;
  total_no_answer: number;
  entries?: EntryRow[];
}

interface CalendarDay {
  count: number;
  total_entries: number;
  status: "draft" | "firing" | "completed" | "paused";
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FINANCE_COS: { name: string; phone: string }[] = [
  { name: "Cypress",         phone: "(949)487-0602" },
  { name: "GBC",             phone: "(213)244-9535" },
  { name: "GAAC",            phone: "(949)470-9674" },
  { name: "IPFS",            phone: "(800)473-1171" },
  { name: "Capital",         phone: "(800)487-0602" },
  { name: "ETI",             phone: "(954)510-8008" },
  { name: "AFCO",            phone: "(877)226-5456" },
  { name: "Top Premium",     phone: "(800)458-2228" },
  { name: "National",        phone: "(720)930-4873" },
  { name: "First Insurance", phone: "(800)837-3707" },
  { name: "IFC",             phone: "(949)632-6733" },
  { name: "Classic",         phone: "(800)347-6481" },
  { name: "Progressive",     phone: "(888)515-3296" },
  { name: "IAT",             phone: "(800)252-0281" },
  { name: "Travelers",       phone: "(800)252-2268" },
  { name: "BHHC",            phone: "(877)680-2442" },
  { name: "Capital (MDX)",   phone: "(800)767-0705" },
  { name: "Geico",           phone: "(800)624-2513" },
  { name: "Other",           phone: "" },
];

const CATEGORY_META: Record<CallReason, { label: string; short: string; color: string; bg: string }> = {
  monthly_reminder:     { label: "Monthly Reminder",    short: "Monthly",      color: "#2563eb", bg: "#eff6ff" },
  due_date:             { label: "Monthly Reminder",    short: "Monthly",      color: "#2563eb", bg: "#eff6ff" },
  late_fee_warning:     { label: "Late Fee Warning",    short: "Late Fee",     color: "#d97706", bg: "#fffbeb" },
  cancellation_warning: { label: "Cancellation Warning",short: "Cancellation", color: "#dc2626", bg: "#fef2f2" },
};

const STATUS_COLOR: Record<CallStatus, string> = {
  pending: "#9ca3af", dialing: "#3b82f6", answered: "#16a34a",
  no_answer: "#d97706", voicemail_left: "#7c3aed", failed: "#dc2626",
};

const CAL_STATUS_COLOR: Record<Campaign["status"], string> = {
  draft: "#9ca3af", firing: "#3b82f6", completed: "#16a34a", paused: "#d97706",
};

const OUTCOME_LABELS: Partial<Record<string, string>> = {
  informed_will_pay: "Will Pay",
  informed_paid:     "Already Paid",
  payment_promised:  "Date Promised",
  disputed:          "Disputed",
  wrong_number:      "Wrong Number",
  callback_requested:"Callback",
  no_answer:         "No Answer",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HEADERS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Column definitions per category ───────────────────────────────────────────
// Standard anchor widths (consistent across all 3 categories):
//   # → 3%  |  Phone → 13%  |  Policy → 11%  |  Finance → 11%  |  Amount → 9%
//   Any date → 13%  |  Late Fee $ → 8%  |  Delete → 3%
// Customer Name fills the remainder, keeping it proportionally the widest.

const CATEGORY_COLS: Record<CallReason, { header: string; width: string }[]> = {
  monthly_reminder: [
    { header: "#",            width: "3%"  },
    { header: "Customer",     width: "16%" },
    { header: "Phone",        width: "12%" },
    { header: "Account #",    width: "9%"  },
    { header: "Policy #",     width: "10%" },
    { header: "Finance Co.",  width: "10%" },
    { header: "Amount",       width: "8%"  },
    { header: "Due Date",     width: "13%" },
    { header: "",             width: "3%"  },
  ],
  due_date: [
    { header: "#",            width: "3%"  },
    { header: "Customer",     width: "16%" },
    { header: "Phone",        width: "12%" },
    { header: "Account #",    width: "9%"  },
    { header: "Policy #",     width: "10%" },
    { header: "Finance Co.",  width: "10%" },
    { header: "Amount",       width: "8%"  },
    { header: "Due Date",     width: "13%" },
    { header: "",             width: "3%"  },
  ],
  late_fee_warning: [
    { header: "#",            width: "3%"  },
    { header: "Customer",     width: "13%" },
    { header: "Phone",        width: "11%" },
    { header: "Account #",    width: "8%"  },
    { header: "Policy #",     width: "9%"  },
    { header: "Finance Co.",  width: "9%"  },
    { header: "Amount",       width: "7%"  },
    { header: "Due Date",     width: "9%"  },
    { header: "Late Fee $",   width: "7%"  },
    { header: "Late Fee Date",width: "11%" },
    { header: "",             width: "3%"  },
  ],
  cancellation_warning: [
    { header: "#",            width: "3%"  },
    { header: "Customer",     width: "16%" },
    { header: "Phone",        width: "12%" },
    { header: "Account #",    width: "9%"  },
    { header: "Policy #",     width: "10%" },
    { header: "Finance Co.",  width: "10%" },
    { header: "Amount",       width: "8%"  },
    { header: "Cancel Date",  width: "13%" },
    { header: "",             width: "3%"  },
  ],
};

// ── Table style tokens ─────────────────────────────────────────────────────────

const GRID = "1px solid #e5e7eb";

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 10px",
  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "#9ca3af", whiteSpace: "nowrap",
  overflow: "hidden",
  background: "#f9fafb", borderRight: GRID, borderBottom: "2px solid #e5e7eb",
  position: "sticky", top: 0, zIndex: 2,
};

const td = (last = false): React.CSSProperties => ({
  padding: "8px 10px", verticalAlign: "middle",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  borderRight: last ? "none" : GRID, borderBottom: GRID,
  height: 38,
});

const INP: React.CSSProperties = {
  width: "100%", border: "none", outline: "none", background: "transparent",
  fontFamily: "inherit", fontSize: 12.5, color: "#111827", padding: 0,
  lineHeight: 1.4,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

type SheetRow = {
  _key: string;
  customer_name: string; phone_primary: string;
  account_number: string; policy_number: string; finance_company: string; amount_due: string;
  due_date: string; late_fee_amount: string; late_fee_date: string;
  cancellation_date: string;
};

const blankRow = (): SheetRow => ({
  _key: crypto.randomUUID(),
  customer_name: "", phone_primary: "",
  account_number: "", policy_number: "", finance_company: "Cypress", amount_due: "",
  due_date: "", late_fee_amount: "", late_fee_date: "",
  cancellation_date: "",
});

// ── Draft persistence (category + rows together) ───────────────────────────────

interface Draft { category: CallReason; rows: SheetRow[] }

const DRAFT_KEY = (date: string) => `call_sheet_draft_${date}`;

function loadDraft(date: string): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(date));
    if (raw) {
      const parsed: Draft = JSON.parse(raw);
      if (parsed?.rows?.length > 0) return parsed;
    }
  } catch {}
  return { category: "monthly_reminder", rows: [blankRow()] };
}

function saveDraft(date: string, draft: Draft) {
  try {
    const hasContent = draft.rows.some((r) => r.customer_name || r.phone_primary || r.policy_number);
    if (hasContent) {
      localStorage.setItem(DRAFT_KEY(date), JSON.stringify(draft));
    } else {
      localStorage.removeItem(DRAFT_KEY(date));
    }
  } catch {}
}

function clearDraft(date: string) {
  try { localStorage.removeItem(DRAFT_KEY(date)); } catch {}
}

// ── Floating Calendar ──────────────────────────────────────────────────────────

function FloatingCalendar({ selectedDate, calData, onSelect, onClose }: {
  selectedDate: string;
  calData: Record<string, CalendarDay>;
  onSelect: (d: string) => void;
  onClose: () => void;
}) {
  const [y, setY] = useState(() => Number(selectedDate.split("-")[0]));
  const [m, setM] = useState(() => Number(selectedDate.split("-")[1]) - 1);
  const today = toDateStr(new Date());

  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d });

  function nav(dir: -1 | 1) {
    setM((prev) => {
      const next = prev + dir;
      if (next < 0)  { setY((yy) => yy - 1); return 11; }
      if (next > 11) { setY((yy) => yy + 1); return 0;  }
      return next;
    });
  }

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1000,
      background: "#fff", border: GRID, borderRadius: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", width: 280, padding: "8px 0 12px",
      userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 14px 8px" }}>
        <button onClick={() => nav(-1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", padding: "0 4px", lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{MONTHS[m]} {y}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => nav(1)}  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", padding: "0 4px", lineHeight: 1 }}>›</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#9ca3af", padding: "0 2px", lineHeight: 1, marginLeft: 6 }}>✕</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 10px" }}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", padding: "2px 0", letterSpacing: "0.04em" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "2px 10px 0", gap: 1 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />;
          const { date, day } = cell;
          const info = calData[date];
          const isSel = date === selectedDate;
          const isToday = date === today;
          return (
            <button key={date} onClick={() => { onSelect(date); onClose(); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "5px 2px", borderRadius: 7, border: "none", cursor: "pointer", minHeight: 36,
                background: isSel ? "#2563eb" : isToday ? "#eff6ff" : "transparent",
              }}
              onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
              onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isToday ? "#eff6ff" : "transparent"; }}
            >
              <span style={{ fontSize: 12.5, fontWeight: isSel || isToday ? 700 : 400, color: isSel ? "#fff" : isToday ? "#2563eb" : "#111827", lineHeight: 1 }}>{day}</span>
              {info && <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSel ? "#bfdbfe" : CAL_STATUS_COLOR[info.status], display: "block", marginTop: 2 }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, padding: "10px 14px 0", borderTop: GRID, marginTop: 10 }}>
        {(Object.entries(CAL_STATUS_COLOR) as [Campaign["status"], string][]).map(([s, c]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#6b7280", textTransform: "capitalize" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sheet input row — renders only fields relevant to selected category ─────────

function SheetInputRow({ row, index, category, onChange, onRemove }: {
  row: SheetRow; index: number; category: CallReason;
  onChange: (key: string, f: string, v: string) => void;
  onRemove: (key: string) => void;
}) {
  const cellIn = (field: string, placeholder = "", type = "text") => (
    <input type={type} value={(row as Record<string, string>)[field]} placeholder={placeholder}
      onChange={(e) => onChange(row._key, field, e.target.value)}
      style={INP}
    />
  );

  const numCell = (field: string) => (
    <input type="number" value={(row as Record<string, string>)[field]} placeholder="0.00"
      onChange={(e) => onChange(row._key, field, e.target.value)}
      style={INP}
    />
  );

  const financeCell = (
    <select value={row.finance_company} onChange={(e) => onChange(row._key, "finance_company", e.target.value)}
      style={{ border: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "#111827", cursor: "pointer", outline: "none", width: "100%", padding: 0 }}>
      {FINANCE_COS.map((f) => (
        <option key={f.name} value={f.name}>{f.name}</option>
      ))}
    </select>
  );

  const deleteBtn = (
    <td style={{ ...td(true), padding: "0 6px", textAlign: "center", borderLeft: GRID }}>
      <button onClick={() => onRemove(row._key)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 4, lineHeight: 1, borderRadius: 4, display: "inline-flex", alignItems: "center" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#d1d5db"; (e.currentTarget as HTMLElement).style.background = "none"; }}
      >
        <i className="ph ph-trash" style={{ fontSize: 13 }} />
      </button>
    </td>
  );

  // Shared leading cells (same for all categories)
  const leading = (
    <>
      <td style={{ ...td(), fontSize: 11, color: "#d1d5db", textAlign: "center", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}>{index + 1}</td>
      <td style={td()}>{cellIn("customer_name", "Harpreet Gill")}</td>
      <td style={td()}>{cellIn("phone_primary", "+16045551234")}</td>
      <td style={td()}>{cellIn("account_number", "98765432")}</td>
      <td style={td()}>{cellIn("policy_number", "IPF-00293847")}</td>
      <td style={td()}>{financeCell}</td>
      <td style={td()}>{numCell("amount_due")}</td>
    </>
  );

  return (
    <tr style={{ background: "#fff" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
    >
      {leading}

      {(category === "monthly_reminder" || category === "due_date") && (
        <>
          <td style={td()}>{cellIn("due_date", "", "date")}</td>
          {deleteBtn}
        </>
      )}

      {category === "late_fee_warning" && (
        <>
          <td style={td()}>{cellIn("due_date", "", "date")}</td>
          <td style={td()}>{numCell("late_fee_amount")}</td>
          <td style={td()}>{cellIn("late_fee_date", "", "date")}</td>
          {deleteBtn}
        </>
      )}

      {category === "cancellation_warning" && (
        <>
          <td style={td()}>{cellIn("cancellation_date", "", "date")}</td>
          {deleteBtn}
        </>
      )}
    </tr>
  );
}

// ── Note cell with hover popover ──────────────────────────────────────────────
// Uses position:fixed so the tooltip escapes the table's overflow:auto container.

function NoteCell({ note }: { note: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const handleEnter = useCallback(() => {
    if (!ref.current || !note) return;
    const r = ref.current.getBoundingClientRect();
    setCoords({ top: r.top - 8, left: r.left });
  }, [note]);

  const handleLeave = useCallback(() => setCoords(null), []);

  if (!note) return <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>;

  return (
    <>
      <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={handleLeave}
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{note}</span>
      </div>

      {coords && (
        <div onMouseLeave={handleLeave} style={{
          position: "fixed",
          top: coords.top,
          left: Math.min(coords.left, window.innerWidth - 340),
          transform: "translateY(-100%)",
          zIndex: 9999,
          background: "#111827", color: "#f9fafb",
          fontSize: 12.5, lineHeight: 1.65,
          padding: "10px 14px", borderRadius: 8, maxWidth: 320,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
          pointerEvents: "none",
        }}>
          {note}
        </div>
      )}
    </>
  );
}

// ── Result entry row ───────────────────────────────────────────────────────────

function ResultEntryRow({ e }: { e: EntryRow }) {
  const meta = CATEGORY_META[e.call_reason];
  return (
    <tr style={{ background: "#fff" }}
      onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
      onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "#fff"; }}
    >
      <td style={{ ...td(), borderLeft: "3px solid transparent", paddingLeft: 11 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "#111827" }}>{e.customer_name}</span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151", fontFamily: "monospace" }}>{e.phone_primary}</span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151", fontFamily: "monospace" }}>{e.account_number ?? "—"}</span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151" }}>{e.policy_number}</span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151" }}>{e.finance_company}</span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>${e.amount_due.toFixed(2)}</span>
      </td>
      <td style={td()}>
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: 4,
          fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg,
        }}>{meta.short}</span>
      </td>
      <td style={td()}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[e.call_status], display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: STATUS_COLOR[e.call_status], textTransform: "capitalize" }}>
            {e.call_status.replace("_", " ")}
          </span>
        </span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151" }}>
          {e.call_outcome ? (OUTCOME_LABELS[e.call_outcome] ?? e.call_outcome) : "—"}
        </span>
      </td>
      <td style={td()}>
        <span style={{ fontSize: 12.5, color: "#374151" }}>{e.payment_promise_date ?? "—"}</span>
      </td>
      <td style={{ ...td(true), overflow: "visible", position: "relative" }}>
        <NoteCell note={e.notes} />
      </td>
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const RESULT_COLS = ["Customer", "Phone", "Account #", "Policy #", "Finance Co.", "Amount", "Category", "Status", "Outcome", "Promise Date", "Notes"];

export default function CallSheetPage() {
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [calOpen, setCalOpen] = useState(false);
  const calBtnRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"sheet" | "results">("sheet");
  const [submitting, setSubmitting] = useState(false);
  const [firing, setFiring] = useState(false);

  // Draft: category + rows stored together per date
  const [category, setCategory] = useState<CallReason>("monthly_reminder");
  const [rows, setRows] = useState<SheetRow[]>([blankRow()]);

  // Load draft on mount and on date change
  useEffect(() => {
    const draft = loadDraft(selectedDate);
    setCategory(draft.category);
    setRows(draft.rows);
  }, [selectedDate]);

  // Persist whenever category or rows change
  useEffect(() => {
    saveDraft(selectedDate, { category, rows });
  }, [category, rows, selectedDate]);

  // Outside click closes calendar
  useEffect(() => {
    if (!calOpen) return;
    function handler(e: MouseEvent) {
      if (calBtnRef.current && !calBtnRef.current.contains(e.target as Node)) setCalOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calOpen]);

  const selYear = Number(selectedDate.split("-")[0]);
  const selMonth = Number(selectedDate.split("-")[1]);

  const { data: calData = {} } = useSWR<Record<string, CalendarDay>>(
    `/api/insurance/campaigns/calendar?year=${selYear}&month=${selMonth}`,
    fetcher,
    { refreshInterval: firing ? 3000 : 30000 }
  );

  const { data: dateCampaigns, isLoading: dateLoading } = useSWR<Campaign[]>(
    `/api/insurance/campaigns?date=${selectedDate}`,
    fetcher,
    { refreshInterval: firing ? 2000 : 0 }
  );

  const latestCampaign = dateCampaigns?.[0] ?? null;
  const { data: campaignDetail } = useSWR<Campaign>(
    latestCampaign ? `/api/insurance/campaigns/${latestCampaign.id}` : null,
    fetcher,
    { refreshInterval: firing ? 2000 : 0 }
  );

  const isFiring = latestCampaign?.status === "firing";

  useEffect(() => {
    if (dateCampaigns && dateCampaigns.length > 0) setActiveTab("results");
  }, [dateCampaigns]);

  function selectDate(date: string) {
    setSelectedDate(date);
    if (calData[date]) setActiveTab("results");
  }

  function addRow() { setRows((r) => [...r, blankRow()]); }
  function removeRow(key: string) { setRows((r) => r.filter((x) => x._key !== key)); }
  function updateRow(key: string, field: string, value: string) {
    setRows((r) => r.map((x) => x._key === key ? { ...x, [field]: value } : x));
  }

  // Validation rules per category
  function validate(): string | null {
    for (const r of rows) {
      if (!r.customer_name || !r.phone_primary || !r.policy_number || !r.amount_due) {
        return "Fill Customer Name, Phone, Policy #, and Amount on every row.";
      }
      if ((category === "monthly_reminder" || category === "due_date") && !r.due_date)
        return "Fill Due Date on every row.";
      if (category === "late_fee_warning" && (!r.late_fee_amount || !r.late_fee_date))
        return "Fill Late Fee Amount and Late Fee Date on every row.";
      if (category === "cancellation_warning" && !r.cancellation_date)
        return "Fill Cancel Date on every row.";
    }
    return null;
  }

  async function handleFire() {
    const err = validate();
    if (err) { alert(err); return; }
    setSubmitting(true);
    try {
      const meta = CATEGORY_META[category];
      const campaign: Campaign = await request("/api/insurance/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: `${fmtDate(selectedDate)} — ${meta.label}`,
          campaign_date: selectedDate,
          entries: rows.map((r) => ({
            customer_name:    r.customer_name,
            phone_primary:    r.phone_primary,
            phone_secondary:  null,
            account_number:   r.account_number || null,
            policy_number:    r.policy_number,
            finance_company:  r.finance_company,
            amount_due:       parseFloat(r.amount_due) || 0,
            due_date:         r.due_date         || null,
            late_fee_amount:  r.late_fee_amount  ? parseFloat(r.late_fee_amount) : null,
            late_fee_date:    r.late_fee_date    || null,
            cancellation_date:r.cancellation_date|| null,
            call_reason:      category,
          })),
        }),
      });
      await request(`/api/insurance/campaigns/${campaign.id}/fire`, { method: "POST" });
      clearDraft(selectedDate);
      setFiring(true);
      setActiveTab("results");
      mutate(`/api/insurance/campaigns?date=${selectedDate}`);
      mutate(`/api/insurance/campaigns/calendar?year=${selYear}&month=${selMonth}`);
      setRows([blankRow()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(typeof msg === "string" ? msg : "Failed to fire calls");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePause() {
    if (!latestCampaign) return;
    await request(`/api/insurance/campaigns/${latestCampaign.id}/pause`, { method: "POST" });
    setFiring(false);
    mutate(`/api/insurance/campaigns?date=${selectedDate}`);
  }

  const progress = campaignDetail
    ? Math.round((campaignDetail.total_dialed / Math.max(campaignDetail.total_entries, 1)) * 100)
    : 0;

  const activeMeta = CATEGORY_META[category];
  const activeCols = CATEGORY_COLS[category];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-neutral-primary)", overflow: "hidden" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 20px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--border-neutral-bold)",
        background: "var(--bg-neutral-primary)",
      }}>
        <span style={{ fontSize: 13, color: "var(--text-neutral-tertiary)", fontWeight: 500 }}>Workflows</span>
        <span style={{ color: "var(--text-neutral-disabled)", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "var(--text-neutral-secondary)", fontWeight: 600 }}>Call Sheet</span>

        <div style={{ width: 1, height: 18, background: "var(--border-neutral-subtle)", margin: "0 4px" }} />

        {/* Floating date picker */}
        <div ref={calBtnRef} style={{ position: "relative" }}>
          <button onClick={() => setCalOpen((v) => !v)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8,
            border: `1px solid ${calOpen ? "#3b82f6" : "#d1d5db"}`,
            background: calOpen ? "#eff6ff" : "#fff", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 600, color: calOpen ? "#2563eb" : "#111827", transition: "all 0.12s",
          }}>
            <i className="ph ph-calendar" style={{ fontSize: 14, color: calOpen ? "#2563eb" : "#6b7280" }} />
            {fmtDate(selectedDate)}
            <i className={`ph ph-caret-${calOpen ? "up" : "down"}`} style={{ fontSize: 11, color: "#9ca3af" }} />
          </button>
          {calOpen && (
            <FloatingCalendar selectedDate={selectedDate} calData={calData}
              onSelect={selectDate} onClose={() => setCalOpen(false)} />
          )}
        </div>

        {/* Fill / Results tabs */}
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 2, gap: 1 }}>
          {(["sheet", "results"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "4px 14px", borderRadius: 6, border: "none",
              background: activeTab === tab ? "#fff" : "transparent",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              fontFamily: "inherit", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              color: activeTab === tab ? "#111827" : "#6b7280", transition: "all 0.12s",
            }}>
              {tab === "sheet" ? "Fill Sheet" : "Results"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Firing indicator */}
        {isFiring && campaignDetail && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
              {campaignDetail.total_dialed}/{campaignDetail.total_entries} fired
            </span>
            <button onClick={handlePause} style={{ fontSize: 11.5, padding: "3px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", color: "#374151", fontWeight: 500 }}>
              Pause
            </button>
          </div>
        )}

        {/* Sheet actions */}
        {activeTab === "sheet" && (
          <>
            <button onClick={addRow} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
              border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12.5, color: "#374151", fontWeight: 500,
            }}>
              <i className="ph ph-plus" style={{ fontSize: 13 }} /> Add Row
            </button>
            <button onClick={handleFire} disabled={submitting || rows.length === 0} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px",
              borderRadius: 8, border: "none",
              background: submitting ? "#e5e7eb" : activeMeta.color,
              color: submitting ? "#9ca3af" : "#fff",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: submitting ? "wait" : "pointer", opacity: rows.length === 0 ? 0.5 : 1,
            }}>
              <i className="ph ph-phone-outgoing" style={{ fontSize: 14 }} />
              {submitting ? "Firing…" : `Fire ${rows.length} Call${rows.length !== 1 ? "s" : ""}`}
            </button>
          </>
        )}
      </div>

      {/* ── Category selector (sheet tab only) ───────────────────────────────── */}
      {activeTab === "sheet" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderBottom: GRID, background: "#fff", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Call Category
          </span>
          {(Object.entries(CATEGORY_META) as [CallReason, typeof CATEGORY_META[CallReason]][]).filter(([key]) => key !== "due_date").map(([key, meta]) => {
            const active = category === key || (key === "monthly_reminder" && category === "due_date");
            return (
              <button key={key} onClick={() => setCategory(key)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 16px", borderRadius: 20,
                border: `1.5px solid ${active ? meta.color : "#e5e7eb"}`,
                background: active ? meta.bg : "#fff",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                color: active ? meta.color : "#6b7280",
                transition: "all 0.12s",
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: active ? meta.color : "#d1d5db", flexShrink: 0,
                }} />
                {meta.label}
              </button>
            );
          })}
          {/* Hint about what fields this batch needs */}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#b0b7c3", letterSpacing: "0.02em" }}>
            {(category === "monthly_reminder" || category === "due_date") && "Fill: Customer · Phone · Policy # · Amount · Due Date"}
            {category === "late_fee_warning"     && "Fill: Customer · Phone · Policy # · Amount · Late Fee $ · Late Fee Date"}
            {category === "cancellation_warning" && "Fill: Customer · Phone · Policy # · Amount · Cancel Date"}
          </span>
        </div>
      )}

      {/* ── Fill Sheet tab ────────────────────────────────────────────────────── */}
      {activeTab === "sheet" && (
        <div style={{ flex: 1, overflow: "auto", background: "var(--bg-neutral-primary)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              {activeCols.map((col, i) => <col key={i} style={{ width: col.width }} />)}
            </colgroup>
            <thead>
              <tr>
                {activeCols.map((col, i) => (
                  <th key={i} style={{ ...th, borderRight: i === activeCols.length - 1 ? "none" : GRID }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <SheetInputRow key={row._key} row={row} index={i} category={category}
                  onChange={updateRow} onRemove={removeRow} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={activeCols.length} style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13, borderBottom: GRID }}>
                    Click <strong>Add Row</strong> to start adding entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ padding: "6px 14px", fontSize: 10.5, color: "#b0b7c3" }}>
            Up to 500 entries per batch
          </div>
        </div>
      )}

      {/* ── Results tab ───────────────────────────────────────────────────────── */}
      {activeTab === "results" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {campaignDetail && (
            <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "10px 20px", borderBottom: GRID, background: "#f9fafb", flexShrink: 0 }}>
              {/* Campaign category badge */}
              {campaignDetail.entries?.[0] && (
                <span style={{
                  padding: "3px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                  color: CATEGORY_META[campaignDetail.entries[0].call_reason].color,
                  background: CATEGORY_META[campaignDetail.entries[0].call_reason].bg,
                }}>
                  {CATEGORY_META[campaignDetail.entries[0].call_reason].label}
                </span>
              )}
              <div style={{ width: 1, height: 20, background: "#e5e7eb" }} />
              {[
                { label: "Total",     value: campaignDetail.total_entries },
                { label: "Dialed",    value: campaignDetail.total_dialed },
                { label: "Answered",  value: campaignDetail.total_answered },
                { label: "No Answer", value: campaignDetail.total_no_answer },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>{value}</span>
                </div>
              ))}
              <div style={{ flex: 1 }} />
              {campaignDetail.total_entries > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 120, height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "#2563eb", borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{progress}%</span>
                </div>
              )}
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto" }}>
            {dateLoading && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Loading…</div>}
            {!dateLoading && !latestCampaign && (
              <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                No calls fired on {fmtDate(selectedDate)}.<br />
                <span style={{ color: "#6b7280" }}>Switch to <strong>Fill Sheet</strong> to create one.</span>
              </div>
            )}
            {campaignDetail && (
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  {/* Customer | Phone | Policy | Finance | Amount | Category | Status | Outcome | Promise | Notes */}
                  <col style={{ width: "15%" }} /><col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} /><col style={{ width: "10%" }} />
                  <col style={{ width: "8%"  }} /><col style={{ width: "10%" }} />
                  <col style={{ width: "9%"  }} /><col style={{ width: "9%"  }} />
                  <col style={{ width: "9%"  }} /><col style={{ width: "9%"  }} />
                </colgroup>
                <thead>
                  <tr>
                    {RESULT_COLS.map((col, i) => (
                      <th key={col} style={{ ...th, borderRight: i === RESULT_COLS.length - 1 ? "none" : GRID }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignDetail.entries?.map((e) => <ResultEntryRow key={e.id} e={e} />)}
                  {(!campaignDetail.entries || campaignDetail.entries.length === 0) && (
                    <tr>
                      <td colSpan={RESULT_COLS.length} style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13, borderBottom: GRID }}>
                        No entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
