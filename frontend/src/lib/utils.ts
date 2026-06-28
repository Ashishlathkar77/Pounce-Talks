import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a phone number in US standard grouping for display, e.g.
 *  "+15551234567" → "+1 (555) 123-4567", "5551234567" → "(555) 123-4567".
 *  Non-US / unrecognized numbers are returned trimmed but unchanged so we never
 *  mangle international numbers. Empty input returns "" so call sites keep their
 *  own fallbacks ("—", "Unknown caller"). */
export function formatPhoneNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return trimmed; // unrecognized / international — leave as-is
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

// ── Transcript phoneme humanization ─────────────────────────────────────────
//
// The voice agent injects TTS pronunciation hints into its own speech using a
// `<<phoneme|tokens>>` syntax (see backend/voice_agent/prompts.py). Those
// markers are meant for the ElevenLabs/Cartesia engine, NOT for humans — but
// they get persisted verbatim into the transcript, so they leak into the call
// detail UI as e.g. "Thanks for calling <<m|aɪ|b|ɔ|ɹ|ɡ>>!".
//
// `humanizeTranscript` reverse-maps the known phoneme blocks back to their
// readable display names and, for any unrecognized block, strips the `<<>>`
// wrapper and `|` separators so it degrades to plain letters instead of
// showing raw brackets/pipes to the user.

// Inner phoneme content (the part between `<<` and `>>`) → display name.
// Mirrors the pronunciation tables in backend/voice_agent/prompts.py; keep in
// sync if new client names get phoneme overrides there.
const PHONEME_DISPLAY: Record<string, string> = {
  "m|aɪ|b|ɔ|ɹ|ɡ": "Meiborg",
  "m|aɪ|b|ɔɪ|g": "Meiborg", // LLM-improvised variant seen in transcripts
  "dʒ|æ|ɡ|d|iː|p": "Jagdeep",
  "s|ɪ|ŋ": "Singh",
};

export function humanizeTranscript(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text.replace(/<<([^>]*)>>/g, (_match, inner: string) => {
    const key = inner.trim();
    return PHONEME_DISPLAY[key] ?? key.replace(/\|/g, "");
  });
}

// Department / category grouping for agent types. Single source of truth shared
// by the global agent selector (top nav) and the Agent Studio table column, so
// the two can't drift apart.
export const AGENT_DEPTS: { label: string; types: string[] }[] = [
  { label: "Carrier Sales",     types: ["carrier_sales", "outbound_carrier_sales"] },
  { label: "Driver Operations", types: ["driver_eta", "assign_driver", "driver_onboarding"] },
  { label: "Customer",          types: ["customer_eta", "receptionist"] },
  { label: "Outbound",          types: ["sdr", "pod_collection", "detention_monitor"] },
  { label: "Scheduling",        types: ["equipment_change", "reschedule"] },
];

/** The department/category an agent type belongs to ("Other" if unmapped). */
export function agentCategory(type: string | null | undefined): string {
  if (!type) return "Other";
  return AGENT_DEPTS.find((d) => d.types.includes(type))?.label ?? "Other";
}

export function agentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    carrier_sales:    "Carrier Sales",
    driver_eta:       "Driver ETA",
    customer_eta:     "Customer ETA",
    receptionist:     "Receptionist",
    sdr:              "SDR",
    pod_collection:   "POD Collection",
    detention_monitor: "Detention Monitor",
    assign_driver:    "Assign Driver",
    equipment_change: "Equipment Change",
    reschedule:       "Reschedule",
    outbound_carrier_sales:  "Outbound Carrier Sales",
  };
  return labels[type] ?? type;
}
