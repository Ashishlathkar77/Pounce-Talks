"use client";

import {
  Surface,
  Stack,
  Tag,
} from "@hemut2025/design-system";
import ApiKeysManager, { CopyButton } from "@/components/api-keys/ApiKeysManager";

// ── Reusable layout primitives ───────────────────────────────────────────────

/**
 * PageHeader — kicker / title / description block. Mirrors the rhythm used
 * across the dashboard (settings, agent editor) so configuration surfaces
 * feel like one product.
 */
function PageHeader({
  kicker, title, description, action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 16, marginBottom: 20,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--text-neutral-tertiary)",
          marginBottom: 4,
        }}>
          {kicker}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em",
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
      {action}
    </div>
  );
}

/**
 * Section — DS `Surface` card with an optional title + description + actions
 * row. Identical contract to the SettingsSection used elsewhere.
 */
function Section({
  title, description, headerActions, children,
}: {
  title?: string;
  description?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface variant="primary" padding="lg" radius="lg" border="primary" shadow="sm">
      <Stack gap="md">
        {(title || headerActions) && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              {title && (
                <div style={{
                  fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
                  color: "var(--text-neutral-primary)",
                }}>
                  {title}
                </div>
              )}
              {description && (
                <div style={{ fontSize: 12, color: "var(--text-neutral-tertiary)", marginTop: 2 }}>
                  {description}
                </div>
              )}
            </div>
            {headerActions}
          </div>
        )}
        {children}
      </Stack>
    </Surface>
  );
}

/**
 * CodeBlock — monospace surface for shell snippets. Uses DS neutral-secondary
 * background so the block sits cleanly on a Surface card and inherits theme
 * changes for free.
 */
function CodeBlock({ children, multiline = false }: { children: React.ReactNode; multiline?: boolean }) {
  return (
    <pre style={{
      margin: 0,
      background: "var(--bg-neutral-secondary)",
      border: "1px solid var(--border-neutral-subtle)",
      borderRadius: 8,
      padding: "10px 12px",
      fontSize: 12,
      lineHeight: 1.7,
      fontFamily: "var(--font-mono), 'JetBrains Mono', 'Geist Mono', monospace",
      color: "var(--text-neutral-primary)",
      overflowX: "auto",
      whiteSpace: multiline ? "pre-wrap" : "pre",
      wordBreak: multiline ? "break-all" : "normal",
    }}>
      {children}
    </pre>
  );
}

// ── Quick usage snippets ──────────────────────────────────────────────────────

const USAGE_SNIPPETS: ReadonlyArray<{ id: string; label: string; code: string }> = [
  {
    id: "trigger-outbound",
    label: "Trigger an outbound call",
    code: `curl -X POST https://api.converse.ai/v1/calls/assign-driver \\
  -H "Authorization: Bearer hx_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"to":{"phone":"+15005550006","name":"James"},"ref":"ORD-1234"}'`,
  },
  {
    id: "load-negotiator",
    label: "Load negotiator call",
    code: `curl -X POST https://api.converse.ai/v1/calls/outbound-carrier-sales \\
  -H "Authorization: Bearer hx_live_…" \\
  -d '{"to":{"phone":"+15005550006","name":"ABC Carriers"},
       "agent_data":{"ref":"LD-9001","origin":"Chicago, IL",
       "destination":"Dallas, TX","posted_rate":1500,"our_max_rate":1800}}'`,
  },
];

function QuickUsageCard() {
  return (
    <Section
      title="Quick usage"
      description="Send these requests with any API key created below."
      headerActions={<Tag size="sm" variant="brand">cURL</Tag>}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 12,
      }}>
        {USAGE_SNIPPETS.map((s) => (
          <div key={s.id}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "var(--text-neutral-tertiary)",
              marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span>{s.label}</span>
              <CopyButton value={s.code} />
            </div>
            <CodeBlock multiline>{s.code}</CodeBlock>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <PageHeader
        kicker="Settings"
        title="API Keys"
        description="Programmatic access tokens for triggering outbound voice calls and receiving webhook events. Each key can be scoped to a specific agent."
      />

      <Stack gap="md">
        <QuickUsageCard />
        <ApiKeysManager variant="page" />
      </Stack>
    </div>
  );
}
