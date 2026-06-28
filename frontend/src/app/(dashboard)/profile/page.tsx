"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Surface,
  Stack,
  Avatar,
  Button,
  Icon,
  Input,
  Toggle,
  Dropdown,
  Tabs,
  PageHeader as DSPageHeader,
} from "@hemut2025/design-system";
import type { TabItem } from "@hemut2025/design-system";
import { Section } from "@/components/panels/panel-ui";
import { useAuthStore } from "@/lib/store";
import { fetcher } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface UserMe {
  id: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
  name?: string;
}

type TabId = "profile" | "preferences" | "security";

const TAB_ITEMS: TabItem[] = [
  { id: "profile",     label: "Profile",     icon: "user"         },
  { id: "preferences", label: "Preferences", icon: "sliders"      },
  { id: "security",    label: "Security",    icon: "shield-check" },
];

/**
 * VISUAL MOCK — none of the controls on this page are wired to a backend yet.
 * Inputs/toggles/dropdowns hold local state so the page feels live, but every
 * Save / Change / Delete / Logout action just surfaces this toast. Replace with
 * real handlers (Clerk + metadata, or new endpoints) when we productionize.
 */
function notWiredUp() {
  toast({ title: "Coming soon", description: "This isn't available yet." });
}

// ── Shared bits ───────────────────────────────────────────────────────────────

/** Panel title row with a trailing Save button — mirrors the reference. */
function PanelTopBar({
  title, description, showSave = true,
}: { title: string; description?: string; showSave?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 16, marginBottom: 20,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--text-neutral-primary)", lineHeight: 1.2,
        }}>
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: "var(--text-neutral-secondary)", marginTop: 6 }}>
            {description}
          </div>
        )}
      </div>
      {showSave && (
        <Button size="sm" variant="primary" leftIcon="check" onClick={notWiredUp}>
          Save
        </Button>
      )}
    </div>
  );
}

/** Label + description on the left, a control on the right. */
function ControlRow({
  label, description, children, first = false,
}: { label: string; description?: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 24, padding: "16px 0",
      borderTop: first ? "none" : "1px solid var(--border-neutral-subtle)",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-neutral-primary)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ── Tab: Profile (Persona Information) ────────────────────────────────────────

function ProfilePanel({ initialFirst, initialLast, initialEmail }: {
  initialFirst: string; initialLast: string; initialEmail: string;
}) {
  const [first, setFirst]   = useState(initialFirst);
  const [last, setLast]     = useState(initialLast);
  const [email, setEmail]   = useState(initialEmail);
  const [mobile, setMobile] = useState("");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelTopBar title="Persona Information" description="Manage your personal details and how you appear in Converse." />

      <Stack gap="lg">
        <Section title="Profile" description="Your name and avatar.">
          {/* Avatar + change image */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar size="xl" name={`${first} ${last}`.trim() || "User"} />
            <div>
              <Button size="sm" variant="secondary" leftIcon="image" onClick={notWiredUp}>
                Change image
              </Button>
              <div style={{ fontSize: 11.5, color: "var(--text-neutral-tertiary)", marginTop: 6 }}>
                PNG or JPEG · 500×500px recommended
              </div>
            </div>
          </div>

          {/* Name fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input
              kind="text" size="sm" label="First name" placeholder="First name"
              value={first} onChange={(e) => setFirst(e.currentTarget.value)}
            />
            <Input
              kind="text" size="sm" label="Last name" placeholder="Last name"
              value={last} onChange={(e) => setLast(e.currentTarget.value)}
            />
          </div>
        </Section>

        <Section title="Contact" description="Used for sign-in and account notifications.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input
              kind="text" size="sm" type="email" label="Email" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <Input
              kind="phone" size="sm" label="Mobile" placeholder="555 000 0000"
              value={mobile} onChange={(e) => setMobile(e.currentTarget.value)}
            />
          </div>
        </Section>

        {/* Delete account — destructive, gated behind policy we haven't built. */}
        <Surface
          variant="primary" padding="lg" radius="lg" border="none" shadow="none"
          style={{ border: "1px solid var(--border-error-primary)" }}
        >
          <Stack gap="md">
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-error-primary)" }}>
                Delete account
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-neutral-secondary)", marginTop: 4, lineHeight: 1.6, maxWidth: 560 }}>
                Once you delete your account you lose access to all agents, call logs, and analytics.
                This action cannot be undone.
              </div>
            </div>
            <div>
              <Button size="sm" variant="outline" tone="destructive" leftIcon="trash" onClick={notWiredUp}>
                Delete account
              </Button>
            </div>
          </Stack>
        </Surface>
      </Stack>
    </motion.div>
  );
}

// ── Tab: Preferences (User Preferences) ───────────────────────────────────────

const TIMEZONES = [
  { value: "ist",  label: "Indian Standard Time (IST)" },
  { value: "pst",  label: "Pacific Time (PT)" },
  { value: "est",  label: "Eastern Time (ET)" },
  { value: "utc",  label: "Coordinated Universal Time (UTC)" },
];
const DATE_FORMATS = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "iso", label: "YYYY-MM-DD" },
];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

function PreferencesPanel() {
  const [tz, setTz]             = useState("ist");
  const [dateFmt, setDateFmt]   = useState("mdy");
  const [lang, setLang]         = useState("en");
  const [emailNotif, setEmailNotif]     = useState(true);
  const [desktopNotif, setDesktopNotif] = useState(true);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelTopBar title="User Preferences" description="Personalize how Converse looks and behaves for you." />

      <Stack gap="lg">
        <Section title="Regional">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Dropdown
              size="sm" label="Timezone" options={TIMEZONES}
              value={tz} onChange={(v) => setTz(v as string)}
            />
            <Dropdown
              size="sm" label="Date format" options={DATE_FORMATS}
              value={dateFmt} onChange={(v) => setDateFmt(v as string)}
            />
          </div>
        </Section>

        <Section title="Notifications">
          <div>
            <ControlRow
              label="Email notifications"
              description="Receive an email when a call needs your review."
              first
            >
              <Toggle size="sm" checked={emailNotif} onChange={(e) => setEmailNotif(e.currentTarget.checked)} />
            </ControlRow>
            <ControlRow
              label="Desktop notifications"
              description="Get a desktop alert when an agent escalates a live call."
            >
              <Toggle size="sm" checked={desktopNotif} onChange={(e) => setDesktopNotif(e.currentTarget.checked)} />
            </ControlRow>
          </div>
        </Section>

        <Section title="General">
          <ControlRow label="Language" description="Default language for the dashboard." first>
            <Dropdown
              size="sm" options={LANGUAGES}
              value={lang} onChange={(v) => setLang(v as string)}
            />
          </ControlRow>
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Tab: Security ─────────────────────────────────────────────────────────────

interface Session {
  id: string;
  browser: string;
  location: string;
  status: "current" | "active" | "inactive";
}

const SESSIONS: ReadonlyArray<Session> = [
  { id: "1", browser: "Chrome on macOS",    location: "San Francisco, US", status: "current"  },
  { id: "2", browser: "Safari on iPhone",   location: "San Francisco, US", status: "active"   },
  { id: "3", browser: "Firefox on Windows", location: "New York, US",      status: "inactive" },
];

function SessionStatus({ status }: { status: Session["status"] }) {
  if (status === "inactive") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-neutral-tertiary)" }}>
        <Icon name="circle" size="sm" /> Inactive
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--green-500)" }}>
      <Icon name="check-circle" size="sm" /> {status === "current" ? "Current" : "Active"}
    </span>
  );
}

function SecurityPanel() {
  const [twoFA, setTwoFA] = useState(true);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <PanelTopBar title="Security" description="Protect your account and review where you're signed in." showSave={false} />

      <Stack gap="lg">
        <Section title="Two-factor authentication">
          <ControlRow
            label="Two-factor authentication"
            description="Keep your account secure with a one-time passcode via SMS or an authenticator app."
            first
          >
            <Toggle size="sm" checked={twoFA} onChange={(e) => setTwoFA(e.currentTarget.checked)} />
          </ControlRow>
        </Section>

        <Section title="Active sessions" description="Devices currently signed in to your account.">
          <div>
            {SESSIONS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-neutral-subtle)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: "var(--bg-neutral-secondary)",
                  border: "1px solid var(--border-neutral-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-neutral-secondary)",
                }}>
                  <Icon name="globe" size="sm" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)" }}>
                    {s.browser}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)" }}>{s.location}</div>
                </div>
                <SessionStatus status={s.status} />
                <Button size="sm" variant="ghost" tone="destructive" onClick={notWiredUp}>
                  Log out
                </Button>
              </div>
            ))}
          </div>
        </Section>
      </Stack>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [active, setActive] = useState<TabId>("profile");

  const { data: profile } = useSWR<UserMe>("/api/auth/me", fetcher);

  const email       = user?.email ?? profile?.email ?? "";
  const rawName     = profile?.name ?? email.split("@")[0] ?? "User";
  const displayName = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());
  const [firstName, ...restName] = displayName.split(" ");
  const lastName = restName.join(" ");

  return (
    <div
      className="converse-fullbleed-page"
      style={{
        display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
        background: "var(--bg-neutral-secondary)",
      }}
    >
      {/* ── Page header ── */}
      <DSPageHeader
        style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}
        title="Profile"
        info="Your account details, preferences, and sign-in security."
      />

      {/* ── Primary tabs ── */}
      <div style={{ flexShrink: 0, background: "var(--bg-neutral-secondary)" }}>
        <Tabs
          variant="primary"
          ariaLabel="Profile sections"
          items={TAB_ITEMS}
          value={active}
          onChange={(id) => setActive(id as TabId)}
        />
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "24px 20px 48px",
        background: "var(--bg-neutral-secondary)",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            {active === "profile" ? (
              <ProfilePanel
                key="profile"
                initialFirst={firstName ?? ""}
                initialLast={lastName}
                initialEmail={email}
              />
            ) : active === "preferences" ? (
              <PreferencesPanel key="preferences" />
            ) : (
              <SecurityPanel key="security" />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
