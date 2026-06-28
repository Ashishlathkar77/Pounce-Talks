"use client";

import { Surface, Stack } from "@hemut2025/design-system";

// ── Shared panel primitives ──────────────────────────────────────────────────
//
// Layout building blocks shared by the Settings page (config tabs) and the
// Guide page (onboarding / product docs). Kept in one module so both surfaces
// stay visually identical and contributors only learn one set of components.

/**
 * PanelHeader — title / description intro at the top of every panel.
 *
 * Leads straight with the title + a short description (no uppercase kicker —
 * the primary tab bar already names the section). The title is sized to clearly
 * out-rank the 14px section-card titles that follow.
 */
export function PanelHeader({
  title, description,
}: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
        color: "var(--text-neutral-primary)",
        lineHeight: 1.2,
      }}>
        {title}
      </div>
      {description && (
        <div style={{
          fontSize: 13, color: "var(--text-neutral-secondary)",
          marginTop: 6, lineHeight: 1.55, maxWidth: 720,
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

/**
 * Section — DS `Surface` card with a title row, optional description and
 * `headerActions`. Identical contract to the SettingsSection used in the
 * agent editor so contributors only learn one pattern.
 */
export function Section({
  title, description, headerActions, children,
}: {
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface variant="primary" padding="lg" radius="lg" border="primary" shadow="none">
      <Stack gap="md">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
              color: "var(--text-neutral-primary)",
            }}>
              {title}
            </div>
            {description && (
              <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", marginTop: 2 }}>
                {description}
              </div>
            )}
          </div>
          {headerActions}
        </div>
        {children}
      </Stack>
    </Surface>
  );
}

/**
 * StatusDot — small filled dot. Three states map to the standard DS semantic
 * palette so dark-mode reskins just work.
 */
export function StatusDot({ status }: { status: "ok" | "warn" | "error" }) {
  const color =
    status === "ok"    ? "var(--green-500)" :
    status === "warn"  ? "var(--brand-500)" :
                         "var(--red-500)";
  return (
    <span
      aria-hidden
      style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, flexShrink: 0,
      }}
    />
  );
}

/**
 * CodeBlock — monospace surface for shell snippets / curl examples. Uses DS
 * neutral-secondary background so it sits cleanly inside a Section card and
 * inherits theme changes for free.
 */
export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-neutral-secondary)",
      border: "1px solid var(--border-neutral-subtle)",
      borderRadius: 8,
      padding: "10px 12px",
      fontSize: 12,
      lineHeight: 1.7,
      fontFamily: "var(--font-mono), 'JetBrains Mono', 'Geist Mono', monospace",
      color: "var(--text-neutral-primary)",
      overflowX: "auto",
    }}>
      {children}
    </div>
  );
}

/**
 * KeyValueGrid — table-like list of `[label, value]` pairs (env vars,
 * configuration, etc.). Renders inside a CodeBlock so the values keep their
 * monospace feel without us re-implementing a table primitive.
 */
export function KeyValueGrid({
  rows,
  labelWidth = 180,
}: {
  rows: ReadonlyArray<readonly [string, string]>;
  labelWidth?: number;
}) {
  return (
    <CodeBlock>
      <Stack gap="none">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 12, lineHeight: 1.9 }}>
            <span style={{
              color: "var(--text-neutral-tertiary)",
              width: labelWidth, flexShrink: 0,
            }}>{k}</span>
            <span style={{
              color: "var(--brand-500)", overflowX: "auto",
              whiteSpace: "nowrap",
            }}>{v}</span>
          </div>
        ))}
      </Stack>
    </CodeBlock>
  );
}
