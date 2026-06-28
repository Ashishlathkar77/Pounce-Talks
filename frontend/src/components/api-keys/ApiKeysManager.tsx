"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Surface,
  Stack,
  Tag,
  Button,
  Modal,
  Input,
  Dropdown,
  Icon,
  Skeleton,
} from "@hemut2025/design-system";
import type { TagProps } from "@hemut2025/design-system";
import { fetcher, request } from "@/lib/api";
import {
  VoiceAgentAccount,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  AgentConfig,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(prefix: string) {
  return `${prefix}${"•".repeat(20)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function accountTypeTag(type: VoiceAgentAccount["account_type"]): {
  label: string;
  variant: NonNullable<TagProps["variant"]>;
} {
  if (type === "hemut_internal") return { label: "Hemut", variant: "brand" };
  return { label: "External", variant: "info" };
}

// ── Copy button ───────────────────────────────────────────────────────────────

/**
 * CopyButton — exported as a named export because the dedicated /api-keys page's
 * `QuickUsageCard` reuses it for the cURL snippets. Keeping a single definition
 * here avoids drift between the two surfaces.
 */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was denied.", variant: "destructive" });
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      leftIcon={copied ? "check" : "copy"}
      tone={copied ? "neutral" : "neutral"}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

// ── Code block (modal reveal) ─────────────────────────────────────────────────

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

// ── Account-type selector tile (used inside New Key modal) ────────────────────

function AccountTypeTile({
  active, label, hint, onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        padding: "12px 14px",
        borderRadius: 10,
        background: active ? "var(--brand-50)" : "var(--bg-neutral-primary)",
        border: `1px solid ${active ? "var(--brand-300)" : "var(--border-neutral-subtle)"}`,
        boxShadow: active ? "0 1px 2px rgba(31,31,42,0.04)" : "none",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
        color: active ? "var(--brand-700)" : "var(--text-neutral-primary)",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, color: "var(--text-neutral-tertiary)",
        marginTop: 4, fontFamily: "var(--font-mono), monospace",
      }}>
        {hint}
      </div>
    </button>
  );
}

// ── New key modal ─────────────────────────────────────────────────────────────

function NewKeyModal({
  open, agents, onClose, onCreated,
}: {
  open: boolean;
  agents: AgentConfig[];
  onClose: () => void;
  onCreated: (result: CreateApiKeyResponse) => void;
}) {
  const [form, setForm] = useState<CreateApiKeyRequest>({
    name: "",
    account_type: "external_api",
  });
  const [webhookSecret, setWebhookSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ name: "", account_type: "external_api" });
    setWebhookSecret("");
    setError("");
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload: CreateApiKeyRequest = {
        ...form,
        webhook_secret: webhookSecret || undefined,
      };
      const result = await request<CreateApiKeyResponse>("/v1/api-keys", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      reset();
      onCreated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create API key"
      description="Generates a token your systems can use to authenticate with the Converse API."
      leadingIcon={<i className="ph ph-key" style={{ fontSize: 20, color: "var(--brand-700)" }} />}
      accent="brand"
      size="md"
      mode="form"
      loading={loading}
      loadingLabel="Creating key…"
    >
      <Modal.Body>
        <Stack gap="md">
          <Input
            kind="text"
            size="md"
            label="Key name"
            placeholder="e.g. Production McLeod Integration"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            required
            autoFocus
          />

          <div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-neutral-secondary)",
              marginBottom: 6,
            }}>
              Account type
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <AccountTypeTile
                active={form.account_type === "external_api"}
                label="External API"
                hint="hx_live_…"
                onClick={() => setForm({ ...form, account_type: "external_api" })}
              />
              <AccountTypeTile
                active={form.account_type === "hemut_internal"}
                label="Hemut Internal"
                hint="hx_hemut_…"
                onClick={() => setForm({ ...form, account_type: "hemut_internal" })}
              />
            </div>
          </div>

          <Dropdown
            label="Default agent (optional)"
            size="md"
            value={form.agent_config_id ?? ""}
            onChange={(v) => {
              const next = typeof v === "string" ? v : (v[0] ?? "");
              setForm({ ...form, agent_config_id: next || undefined });
            }}
            options={[
              { value: "", label: "— None —" },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
            searchable
            searchPlaceholder="Search agents…"
          />

          {form.account_type === "hemut_internal" && (
            <Input
              kind="text"
              size="md"
              label="Hemut Org ID"
              placeholder="org_abc123"
              value={form.hemut_org_id ?? ""}
              onChange={(e) => setForm({ ...form, hemut_org_id: e.currentTarget.value || undefined })}
            />
          )}

          <Input
            kind="text"
            size="md"
            label="Webhook URL (optional)"
            placeholder="https://your-tms.com/webhooks/converse"
            value={form.webhook_url ?? ""}
            onChange={(e) => setForm({ ...form, webhook_url: e.currentTarget.value || undefined })}
          />

          {form.webhook_url && (
            <Input
              kind="text"
              size="md"
              label="Webhook secret (optional)"
              caption="HMAC-SHA256. At least 16 random characters."
              placeholder="••••••••••••••••••"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.currentTarget.value)}
            />
          )}

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: 8,
              background: "var(--bg-error-subtle)",
              border: "1px solid var(--border-error-primary)",
              fontSize: 12.5, color: "var(--text-error-primary)",
            }}>
              <Icon name="warning-circle" size="sm" />
              <span>{error}</span>
            </div>
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer align="between">
        <Button variant="ghost" size="md" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={loading}
          loading={loading}
          leftIcon="key"
        >
          {loading ? "Creating…" : "Create API key"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Reveal modal — show full key once ─────────────────────────────────────────

function RevealModal({ result, onClose }: { result: CreateApiKeyResponse | null; onClose: () => void }) {
  const open = result !== null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="API key created"
      description={result?.name}
      leadingIcon={<i className="ph ph-key" style={{ fontSize: 20, color: "var(--brand-700)" }} />}
      accent="brand"
      size="md"
      role="alertdialog"
      closeOnBackdropClick={false}
    >
      <Modal.Body>
        <Stack gap="md">
          <div style={{
            display: "flex", gap: 10,
            padding: "10px 12px", borderRadius: 8,
            background: "var(--brand-50)", border: "1px solid var(--brand-200)",
            fontSize: 12.5, color: "var(--brand-700)", lineHeight: 1.55,
          }}>
            <Icon name="warning" size="sm" />
            <span>
              Copy this key now. It will{" "}
              <strong style={{ fontWeight: 700 }}>never be shown again</strong>{" "}
              — we only store a hash.
            </span>
          </div>

          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "var(--text-neutral-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                Your API key
              </span>
              {result && <CopyButton value={result.api_key} label="Copy key" />}
            </div>
            {result && <CodeBlock multiline>{result.api_key}</CodeBlock>}
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" size="md" onClick={onClose} leftIcon="check">
          I&apos;ve saved the key
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Revoke confirmation ───────────────────────────────────────────────────────

function RevokeConfirmModal({
  account, onClose, onConfirm,
}: {
  account: VoiceAgentAccount | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const open = account !== null;

  async function handleConfirm() {
    if (!account) return;
    setBusy(true);
    try {
      await request(`/v1/api-keys/${account.id}`, { method: "DELETE" });
      mutate("/v1/api-keys");
      toast({ title: "API key revoked" });
      onConfirm();
    } catch (err) {
      toast({
        title: "Revoke failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      role="alertdialog"
      size="sm"
      title="Revoke API key?"
      leadingIcon={<i className="ph ph-warning" style={{ fontSize: 20, color: "var(--text-error-primary)" }} />}
      closeOnBackdropClick={false}
      loading={busy}
      loadingLabel="Revoking key…"
    >
      <Modal.Body>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-neutral-secondary)" }}>
          You're about to revoke{" "}
          <strong style={{ color: "var(--text-neutral-primary)", fontWeight: 600 }}>
            {account?.name}
          </strong>. Any system using this key will start receiving 401 Unauthorized
          responses immediately.
        </div>
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--bg-error-subtle)",
          border: "1px solid var(--border-error-primary)",
          borderRadius: 8,
          fontSize: 12, color: "var(--text-error-primary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Icon name="warning-circle" size="sm" />
          <span>This action cannot be undone.</span>
        </div>
      </Modal.Body>
      <Modal.Footer align="between">
        <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          tone="destructive"
          size="md"
          onClick={handleConfirm}
          disabled={busy}
          loading={busy}
          leftIcon="trash"
        >
          {busy ? "Revoking…" : "Revoke key"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ── Key row ───────────────────────────────────────────────────────────────────

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-neutral-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13,
        color: "var(--text-neutral-secondary)",
        fontFamily: mono ? "var(--font-mono), monospace" : undefined,
        wordBreak: "break-all",
        lineHeight: 1.5,
      }}>
        {value}
      </div>
    </div>
  );
}

function KeyRow({
  account, onRequestRevoke,
}: {
  account: VoiceAgentAccount;
  onRequestRevoke: (account: VoiceAgentAccount) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tag = accountTypeTag(account.account_type);

  const hasDetails =
    account.hemut_org_id ||
    account.webhook_url ||
    account.field_mappings ||
    account.tms_connector_config;

  return (
    <Surface variant="primary" padding="none" radius="lg" border="primary" shadow="none">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          all: "unset",
          width: "100%", boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px",
          cursor: "pointer",
        }}
      >
        {/* Status dot */}
        <span
          aria-hidden
          style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: account.is_active ? "var(--green-500)" : "var(--text-neutral-disabled)",
            boxShadow: account.is_active
              ? "0 0 0 3px color-mix(in srgb, var(--green-500) 18%, transparent)"
              : "none",
          }}
        />

        {/* Name + masked prefix */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
            color: "var(--text-neutral-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {account.name}
          </div>
          <div style={{
            fontSize: 12, color: "var(--text-neutral-tertiary)",
            marginTop: 2,
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          }}>
            {maskKey(account.api_key_prefix)}
          </div>
        </div>

        <Tag size="sm" variant={tag.variant}>{tag.label}</Tag>

        <span style={{
          fontSize: 12, color: "var(--text-neutral-tertiary)",
          flexShrink: 0, minWidth: 92, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatDate(account.created_at)}
        </span>

        <span style={{
          color: "var(--text-neutral-tertiary)", flexShrink: 0,
          display: "flex", alignItems: "center",
        }}>
          <Icon name={expanded ? "caret-up" : "caret-down"} size="sm" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "16px",
              borderTop: "1px solid var(--border-neutral-subtle)",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "start",
            }}>
              <div style={{ minWidth: 0 }}>
                {hasDetails ? (
                  <Stack gap="md">
                    {account.hemut_org_id && (
                      <Detail label="Hemut Org ID" value={account.hemut_org_id} mono />
                    )}
                    {account.webhook_url && (
                      <Detail label="Webhook URL" value={account.webhook_url} mono />
                    )}
                    {account.field_mappings && (
                      <Detail
                        label="Field Mappings"
                        value={`${Object.keys(account.field_mappings).length} mapped fields`}
                      />
                    )}
                    {account.tms_connector_config && (
                      <Detail
                        label="TMS Connector"
                        value={
                          (account.tms_connector_config as Record<string, string>).tms_type ??
                          "Configured"
                        }
                      />
                    )}
                  </Stack>
                ) : (
                  <div style={{
                    fontSize: 12.5, color: "var(--text-neutral-tertiary)",
                    lineHeight: 1.55,
                  }}>
                    No additional configuration. This key authenticates against the default
                    agent and inherits standard webhook routing.
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                tone="destructive"
                size="sm"
                leftIcon="trash"
                onClick={() => onRequestRevoke(account)}
              >
                Revoke key
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function ApiKeysEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Surface variant="primary" padding="lg" radius="lg" border="primary" shadow="sm">
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "32px 16px",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "var(--brand-50)",
          border: "1px solid var(--brand-200)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--brand-700)",
          marginBottom: 16,
        }}>
          <Icon name="key" size="lg" />
        </div>
        <div style={{
          fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em",
          color: "var(--text-neutral-primary)",
        }}>
          No API keys yet
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-neutral-secondary)",
          marginTop: 6, maxWidth: 420, lineHeight: 1.55,
        }}>
          Create your first key to start triggering outbound voice calls and listening
          for webhook events from external systems.
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" size="md" onClick={onCreate} leftIcon="plus">
            Create first key
          </Button>
        </div>
      </div>
    </Surface>
  );
}

// ── Manager ────────────────────────────────────────────────────────────────────

export interface ApiKeysManagerProps {
  /**
   * `page` — rendered on the dedicated /api-keys route (page header sits above).
   * `embedded` — rendered inside the Settings → API Keys tab, where the
   * surrounding `Section` already supplies a card + title.
   */
  variant?: "page" | "embedded";
}

/**
 * ApiKeysManager — the live Converse API-key management surface: create, list,
 * copy-once reveal, and revoke. Self-contained (owns its SWR fetches + modal
 * state) so it can be dropped into both the dedicated page and the Settings tab
 * from a single source of truth. Both surfaces share the SWR key
 * `"/v1/api-keys"`, so a mutate on one revalidates the other.
 */
export default function ApiKeysManager({ variant = "embedded" }: ApiKeysManagerProps) {
  const { data: accounts, isLoading } = useSWR<VoiceAgentAccount[]>("/v1/api-keys", fetcher);
  const { data: agents } = useSWR<AgentConfig[]>("/api/agents/", fetcher);

  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VoiceAgentAccount | null>(null);

  function handleCreated(result: CreateApiKeyResponse) {
    setShowNewKeyModal(false);
    setCreatedKey(result);
    mutate("/v1/api-keys");
    toast({ title: "API key created", description: result.name });
  }

  const hasKeys = !!accounts && accounts.length > 0;

  return (
    <>
      <Stack gap="md">
        {/* Header row — the New key action lives inside the manager so every
            surface that renders it gets key generation for free. Hidden in the
            empty state, which carries its own "Create first key" CTA. */}
        {(isLoading || hasKeys) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size={variant === "embedded" ? "sm" : "md"}
              leftIcon="plus"
              onClick={() => setShowNewKeyModal(true)}
            >
              New key
            </Button>
          </div>
        )}

        {isLoading ? (
          <Stack gap="sm">
            {[1, 2, 3].map((i) => (
              <Surface key={i} variant="primary" padding="md" radius="lg" border="primary" shadow="none">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Skeleton width={8} height={8} radius="full" />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
                    <Skeleton width="60%" height={12} />
                  </div>
                  <Skeleton width={60} height={20} />
                  <Skeleton width={80} height={12} />
                </div>
              </Surface>
            ))}
          </Stack>
        ) : !hasKeys ? (
          <ApiKeysEmptyState onCreate={() => setShowNewKeyModal(true)} />
        ) : (
          <Stack gap="sm">
            {accounts!.map((account, i) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <KeyRow
                  account={account}
                  onRequestRevoke={(a) => setRevokeTarget(a)}
                />
              </motion.div>
            ))}
          </Stack>
        )}
      </Stack>

      <NewKeyModal
        open={showNewKeyModal}
        agents={agents ?? []}
        onClose={() => setShowNewKeyModal(false)}
        onCreated={handleCreated}
      />

      <RevealModal
        result={createdKey}
        onClose={() => setCreatedKey(null)}
      />

      <RevokeConfirmModal
        account={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => setRevokeTarget(null)}
      />
    </>
  );
}
