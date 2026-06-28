"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import {
  AppShell,
  Sidebar,
  TopNav,
  AccountMenu,
  Menu,
  useAppShell,
} from "@hemut2025/design-system";
import type { SidebarItem } from "@hemut2025/design-system";
import { useAgentSelectorStore } from "@/lib/store";
import { fetcher } from "@/lib/api";
import { AgentConfig } from "@/lib/types";
import { AGENT_DEPTS } from "@/lib/utils";

// ── Department groupings ──────────────────────────────────────────────────────

const ALL_KNOWN_TYPES = AGENT_DEPTS.flatMap((d) => d.types);

// ── Global agent selector — matches HappyRobot top nav style ─────────────────

function AgentTopSelector() {
  const router   = useRouter();
  const pathname = usePathname();
  const { data: agents } = useSWR<AgentConfig[]>("/api/agents/", fetcher);
  const { selectedAgentId, selectedAgentName, setSelectedAgent } = useAgentSelectorStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggleDept(label: string) {
    setCollapsedDepts((p) => { const n = new Set(p); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }

  function handleSelect(id: string, type: string, name: string) {
    setSelectedAgent(id, type, name);
    setOpen(false);
    setSearch("");
    if (pathname.startsWith("/agents")) router.push(`/agents/${id}`);
  }

  const isAllSelected = !selectedAgentId;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "6px 10px", borderRadius: 8,
          background: open ? "var(--bg-neutral-secondary)" : "var(--bg-neutral-primary)",
          border: "1px solid var(--border-neutral-subtle)",
          boxShadow: "var(--shadow-xs, 0 1px 2px rgba(31,31,42,0.04))",
          cursor: "pointer", fontFamily: "inherit",
          maxWidth: 240, minWidth: 140,
          transition: "background 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-neutral-secondary)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-neutral-bold)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "var(--bg-neutral-primary)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-neutral-subtle)";
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="ph ph-phone" style={{ fontSize: 17, color: "var(--text-neutral-secondary)", flexShrink: 0 }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: "var(--text-neutral-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {selectedAgentName}
        </span>
        <i className="ph ph-caret-down" style={{ fontSize: 15, color: "var(--text-neutral-tertiary)", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 1000,
          width: 320,
          background: "var(--bg-neutral-primary)",
          border: "1px solid var(--border-neutral-subtle)",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(31,31,42,0.18)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-neutral-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-neutral-secondary)", borderRadius: 8, padding: "7px 10px" }}>
              <i className="ph ph-magnifying-glass" style={{ fontSize: 13, color: "var(--text-neutral-tertiary)", flexShrink: 0 }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workflows..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text-neutral-primary)", fontFamily: "inherit" }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 6px", scrollbarWidth: "thin", scrollbarColor: "var(--border-neutral-bold) transparent" }}>
            <button
              onClick={() => { setSelectedAgent(null, null, "All agents"); setOpen(false); setSearch(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "6px 10px", borderRadius: 8,
                background: isAllSelected ? "var(--bg-neutral-secondary)" : "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
              onMouseEnter={(e) => { if (!isAllSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-neutral-secondary)"; }}
              onMouseLeave={(e) => { if (!isAllSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <i className="ph ph-list" style={{ fontSize: 14, color: "var(--text-neutral-tertiary)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: isAllSelected ? 600 : 400, color: isAllSelected ? "var(--text-neutral-primary)" : "var(--text-neutral-secondary)" }}>
                All agents
              </span>
            </button>

            {[
              ...AGENT_DEPTS,
              {
                label: "Other",
                types: (agents ?? [])
                  .filter((a) => !ALL_KNOWN_TYPES.includes(a.agent_type))
                  .map((a) => a.agent_type),
              },
            ].map((dept) => {
              const deptAgents = (agents ?? []).filter((a) =>
                dept.types.includes(a.agent_type) &&
                (!search || a.name.toLowerCase().includes(search.toLowerCase()))
              );
              if (deptAgents.length === 0) return null;
              const isOpen = !collapsedDepts.has(dept.label);

              return (
                <div key={dept.label}>
                  <button
                    onClick={() => toggleDept(dept.label)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "5px 10px", borderRadius: 8,
                      background: "transparent", border: "none",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-neutral-secondary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <i className={`ph ph-caret-${isOpen ? "down" : "right"}`} style={{ fontSize: 10, color: "var(--text-neutral-tertiary)", flexShrink: 0 }} />
                    <i className={`ph ph-folder${isOpen ? "-open" : ""}`} style={{ fontSize: 14, color: "var(--text-neutral-secondary)", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-neutral-primary)" }}>{dept.label}</span>
                  </button>

                  {isOpen && deptAgents.map((agent) => {
                    const isActive = selectedAgentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleSelect(agent.id, agent.agent_type, agent.name)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          width: "100%", padding: "6px 10px 6px 32px", borderRadius: 8,
                          background: isActive ? "var(--bg-neutral-secondary)" : "transparent",
                          border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-neutral-secondary)"; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <i className="ph ph-stack" style={{ fontSize: 14, color: "var(--text-neutral-secondary)", flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: "var(--text-neutral-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {agent.name}
                        </span>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: agent.status === "active" ? "var(--green-500)" : "var(--border-neutral-bold)", boxShadow: agent.status === "active" ? "0 0 0 3px rgba(34,197,94,0.18)" : "0 0 0 3px rgba(120,120,130,0.15)", display: "inline-block", flexShrink: 0, marginRight: 3 }} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Header controls — fullscreen + dark-mode toggles ─────────────────────────

const THEME_KEY = "converse-theme";

function HeaderControls() {
  const [isDark, setIsDark] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    setIsFullscreen(!!document.fullscreenElement);

    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    setIsDark(next === "dark");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <>
      <TopNav.Action
        icon={isDark ? "sun" : "moon"}
        label={isDark ? "Light mode" : "Dark mode"}
        onClick={toggleTheme}
      />
      <TopNav.Action
        icon={isFullscreen ? "corners-in" : "corners-out"}
        label={isFullscreen ? "Exit full screen" : "Full screen"}
        onClick={toggleFullscreen}
      />
    </>
  );
}

// ── WorkspaceTile — simplified for Pounce (no Clerk, no org switching) ───────

function WorkspaceTile({
  userEmail,
  onProfile,
  onGuide,
  onLogout,
}: {
  userEmail: string;
  onProfile: () => void;
  onGuide: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const displayOrg = "Hemut YC X25";

  return (
    <>
      <Sidebar.UserTile
        ref={triggerRef}
        name={displayOrg}
        email={userEmail}
        switchLabel="Switch workspace"
        onSwitch={() => setOpen((v) => !v)}
      />

      <Menu
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        placement="top-start"
        offset={6}
        ariaLabel="Workspace menu"
      >
        <Menu.Section>
          <Menu.Item icon="user" onClick={onProfile}>Profile</Menu.Item>
          <Menu.Item icon="book-open" onClick={onGuide}>Guide</Menu.Item>
        </Menu.Section>
        <Menu.Divider />
        <Menu.Section>
          <Menu.Item icon="sign-out" destructive onClick={onLogout}>
            Logout
          </Menu.Item>
        </Menu.Section>
      </Menu>
    </>
  );
}

/* ── BridgedSidebar — keeps AppShell.collapsed + Sidebar.collapsed in sync ── */
function BridgedSidebar({
  activeKey,
  onSelect,
  userEmail,
  onLogout,
  items,
}: {
  activeKey: string;
  onSelect: (key: string) => void;
  userEmail: string;
  onLogout: () => void;
  items: SidebarItem[];
}) {
  const ctx = useAppShell();
  const collapsed = ctx?.collapsed ?? false;
  const setCollapsed = (next: boolean) => ctx?.setCollapsed?.(next);
  const router = useRouter();

  return (
    <Sidebar
      items={items}
      activeKey={activeKey}
      logo={<PeopleLogo collapsed={collapsed} />}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onSelect={(key, e) => {
        const ev = e as React.MouseEvent;
        if (ev.metaKey || ev.ctrlKey) return;
        ev.preventDefault?.();
        onSelect(key);
      }}
      footer={
        <WorkspaceTile
          userEmail={userEmail}
          onProfile={() => router.push("/profile")}
          onGuide={() => router.push("/guide")}
          onLogout={onLogout}
        />
      }
    />
  );
}

/* ── Orange Slice brand mark ── */
/* When the sidebar is collapsed, show only the cat mark (no wordmark). */
function PeopleLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: collapsed ? 0 : 7, flexShrink: 0 }}>
      <svg
        width="20" height="20"
        viewBox="0 0 22 22"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--text-neutral-primary)", flexShrink: 0 }}
      >
        {/* Head */}
        <circle cx="11" cy="13" r="8" strokeWidth="1.5" />
        {/* Left ear */}
        <path d="M4 10 L3 2 L9 7" strokeWidth="1.5" />
        {/* Right ear */}
        <path d="M13 7 L19 2 L18 10" strokeWidth="1.5" />
        {/* Eyes */}
        <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="14" cy="12" r="1.2" fill="currentColor" stroke="none" />
        {/* Nose */}
        <path d="M10 14.5 L11 15.5 L12 14.5" strokeWidth="1.2" />
        {/* Whiskers */}
        <line x1="1"  y1="13.5" x2="7.5"  y2="14"   strokeWidth="0.7" />
        <line x1="1"  y1="15.5" x2="7.5"  y2="15.5"  strokeWidth="0.7" />
        <line x1="21" y1="13.5" x2="14.5" y2="14"   strokeWidth="0.7" />
        <line x1="21" y1="15.5" x2="14.5" y2="15.5"  strokeWidth="0.7" />
      </svg>
      {!collapsed && (
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text-neutral-primary)",
          fontFamily: "Inter, -apple-system, sans-serif",
        }}>
          Pounce
        </span>
      )}
    </span>
  );
}

/* ── Nav structure ─────────────────────────────────────────────────────────────
 * BASE_NAV: same as hevox-prod PLUS Campaigns added at index 2.
 * Call Sheet is injected conditionally based on workspace_config.features.
 */
const BASE_NAV: SidebarItem[] = [
  { kind: "item", key: "/agents",     label: "Agent Studio", icon: "code"       },
  { kind: "item", key: "/runs",       label: "Runs",         icon: "phone"      },
  { kind: "item", key: "/campaigns",  label: "Campaigns",    icon: "megaphone"  },
  {
    kind: "section",
    label: "Monitor",
    children: [
      { kind: "item", key: "/analytics", label: "Analytics",    icon: "chart-line" },
      { kind: "item", key: "/live",      label: "Live Monitor", icon: "broadcast"  },
    ],
  },
  {
    kind: "section",
    label: "Configuration",
    children: [
      { kind: "item", key: "/settings", label: "Settings", icon: "gear" },
    ],
  },
];

function topLevelRoute(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}` : "/";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const activeKey = useMemo(() => topLevelRoute(pathname), [pathname]);

  // Agent editor (/agents/:id) forces collapsed sidebar (focus workspace)
  const isAgentEditor =
    /^\/agents\/[^/]+$/.test(pathname) && pathname !== "/agents/new";

  // Agent selector only on pages that react to the selected agent
  const showAgentSelector =
    pathname === "/runs" || pathname === "/analytics" || isAgentEditor;

  const [navCollapsed, setNavCollapsed] = useState(false);

  const nav = BASE_NAV;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  function handleNav(key: string) {
    router.push(key);
  }

  const userEmail = "demo@hemut.com";
  const userName  = "demo";

  return (
    <AppShell
      collapsed={isAgentEditor ? true : navCollapsed}
      onCollapsedChange={setNavCollapsed}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <AppShell.Sidebar>
        <BridgedSidebar
          activeKey={activeKey}
          onSelect={handleNav}
          userEmail={userEmail}
          onLogout={handleLogout}
          items={nav}
        />
      </AppShell.Sidebar>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <AppShell.TopBar>
        <TopNav
          left={showAgentSelector ? <AgentTopSelector /> : null}
          right={
            <>
              <TopNav.Action icon="bell" label="Notifications" />
              <HeaderControls />
              <AccountMenu
                user={{ name: userName, email: userEmail }}
                primaryItems={[
                  {
                    key: "profile", label: "Profile", icon: "user",
                    onClick: () => router.push("/profile"),
                  },
                  {
                    key: "settings", label: "Settings", icon: "gear",
                    onClick: () => router.push("/settings"),
                  },
                ]}
                onSignOut={handleLogout}
              />
            </>
          }
        />
      </AppShell.TopBar>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <AppShell.Content>
        {children}
      </AppShell.Content>
    </AppShell>
  );
}
