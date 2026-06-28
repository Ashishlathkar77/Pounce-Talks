import {
  AgentConfig,
  AgentTemplate,
  CallLog,
  Campaign,
  DoraMetrics,
  PaginatedResponse,
  RunFilters,
  TranscriptTurn,
  TransferDestination,
  TransferDestinationInput,
  TransferDestinationPatch,
  ApiError,
} from "@/lib/types";

// Demo/proxy mode: BASE_URL is empty so all /api/* requests go through the
// Next.js rewrites proxy — no hardcoded API host, no Authorization header.
const BASE_URL = "";

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  // No Authorization header in demo mode — the proxy handles auth

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Auth (no-op in demo mode)
export function logout(): void {
  // No-op — demo mode has no real session
}

// Agents
export async function getAgents(): Promise<AgentConfig[]> {
  return request<AgentConfig[]>("/api/agents/");
}

export async function getAgent(id: string): Promise<AgentConfig> {
  return request<AgentConfig>(`/api/agents/${id}`);
}

export async function createAgent(data: {
  name: string;
  agent_type: string;
  prompt_override?: string | null;
  workflow_json?: { nodes: import("@/lib/types").WorkflowNode[]; edges: import("@/lib/types").WorkflowEdge[] } | null;
  voice_id?: string;
  tms_type?: string;
  tms_credentials?: Record<string, unknown>;
}): Promise<AgentConfig> {
  return request<AgentConfig>("/api/agents/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAgent(
  id: string,
  data: {
    name?: string;
    workflow_nodes?: import("@/lib/types").WorkflowNode[];
    workflow_edges?: import("@/lib/types").WorkflowEdge[];
    system_prompt?: string;
    voice_id?: string;
    phone_number?: string;
    active?: boolean;
    prompt_override?: string;
    /** Either the v1.0 envelope (preferred) or the legacy {nodes,edges}
     *  shape. The backend at app/routers/agents.py validates v1.0 strictly
     *  and lets the legacy shape through unchanged. */
    workflow_json?: import("@/lib/types").AgentWorkflowJSON;
    enabled_tools?: string[];
  }
): Promise<import("@/lib/types").AgentConfig> {
  // Map frontend field names → backend field names
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined)           payload.name          = data.name;
  if (data.voice_id !== undefined)       payload.voice_id      = data.voice_id;
  if (data.phone_number !== undefined)   payload.phone_number  = data.phone_number;
  // prompt: frontend calls it system_prompt or prompt_override
  if (data.system_prompt !== undefined)  payload.prompt_override = data.system_prompt;
  if (data.prompt_override !== undefined) payload.prompt_override = data.prompt_override;
  // workflow: frontend sends nodes+edges separately, backend wants { nodes, edges }
  if (data.workflow_json !== undefined) {
    payload.workflow_json = data.workflow_json;
  } else if (data.workflow_nodes !== undefined || data.workflow_edges !== undefined) {
    payload.workflow_json = {
      nodes: data.workflow_nodes ?? [],
      edges: data.workflow_edges ?? [],
    };
  }
  if (data.enabled_tools !== undefined) payload.enabled_tools = data.enabled_tools;

  return request<import("@/lib/types").AgentConfig>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  return request<void>(`/api/agents/${id}`, { method: "DELETE" });
}

// Templates
export async function getTemplates(): Promise<AgentTemplate[]> {
  return request<AgentTemplate[]>("/api/agents/templates/list");
}

// Runs
export async function getRuns(filters: RunFilters = {}): Promise<PaginatedResponse<CallLog>> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.agent_type) params.set("agent_type", filters.agent_type);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);

  const qs = params.toString();
  return request<PaginatedResponse<CallLog>>(`/api/runs/${qs ? `?${qs}` : ""}`);
}

export async function getRun(sessionId: string): Promise<{
  call: CallLog;
  transcript: TranscriptTurn[];
}> {
  return request<{ call: CallLog; transcript: TranscriptTurn[] }>(`/api/runs/${sessionId}`);
}

// Analytics
export async function getDoraMetrics(): Promise<DoraMetrics> {
  return request<DoraMetrics>("/api/analytics/dora");
}

// TMS
export async function pingTMS(): Promise<{ status: string; latency_ms: number }> {
  return request<{ status: string; latency_ms: number }>("/api/tms/ping");
}

// Campaigns

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  agent_config_id: string;
  targets: { phone: string; name?: string; reference?: string }[];
  retry_limit?: number;
  concurrent_calls?: number;
}

export async function getCampaigns(): Promise<{ items: Campaign[]; page: number; page_size: number }> {
  return request<{ items: Campaign[]; page: number; page_size: number }>("/api/campaigns/");
}

export async function createCampaign(data: CreateCampaignPayload): Promise<Campaign> {
  return request<Campaign>("/api/campaigns/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function startCampaign(id: string): Promise<Campaign> {
  return request<Campaign>(`/api/campaigns/${id}/start`, { method: "POST" });
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  return request<Campaign>(`/api/campaigns/${id}/pause`, { method: "POST" });
}

export async function cancelCampaign(id: string): Promise<Campaign> {
  return request<Campaign>(`/api/campaigns/${id}/cancel`, { method: "POST" });
}

// Test call
export interface TestCallParams {
  caller_name?: string;
  reference_number?: string;
  load_origin?: string;
  load_destination?: string;
  load_equipment?: string;
  load_pickup_date?: string;
  load_delivery_date?: string;
  carrier_name?: string;
  posted_rate?: string;
}

export async function testCall(
  agentId: string,
  toPhone: string,
  params?: TestCallParams,
): Promise<{ mode: string; call_sid: string; session_id: string }> {
  return request<{ mode: string; call_sid: string; session_id: string }>(
    `/api/agents/${agentId}/test-call`,
    {
      method: "POST",
      body: JSON.stringify({ to_phone: toPhone, ...params }),
    },
  );
}

// Activate agent (bind phone number)
export async function activateAgent(
  agentId: string,
  phoneNumber: string,
): Promise<import("@/lib/types").AgentConfig> {
  return request<import("@/lib/types").AgentConfig>(
    `/api/agents/${agentId}/activate`,
    {
      method: "POST",
      body: JSON.stringify({ phone_number: phoneNumber }),
    },
  );
}

// Transfer Destinations (warm-transfer routing)

export async function listTransferDestinations(opts: {
  agent_config_id?: string;
  agent_type?: string;
} = {}): Promise<TransferDestination[]> {
  const params = new URLSearchParams();
  if (opts.agent_config_id) params.set("agent_config_id", opts.agent_config_id);
  if (opts.agent_type)      params.set("agent_type", opts.agent_type);
  const qs = params.toString();
  return request<TransferDestination[]>(`/api/transfer-destinations/${qs ? `?${qs}` : ""}`);
}

export async function createTransferDestination(
  body: TransferDestinationInput,
): Promise<TransferDestination> {
  return request<TransferDestination>("/api/transfer-destinations/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTransferDestination(
  id: string,
  body: TransferDestinationPatch,
): Promise<TransferDestination> {
  return request<TransferDestination>(`/api/transfer-destinations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTransferDestination(id: string): Promise<void> {
  return request<void>(`/api/transfer-destinations/${id}`, { method: "DELETE" });
}

/** Set or clear the per-customer outbound SIP trunk. Pass `null` to clear. */
export async function setOutboundTrunk(
  outbound_trunk_id: string | null,
): Promise<{ outbound_trunk_id: string | null }> {
  return request<{ outbound_trunk_id: string | null }>(
    "/api/transfer-destinations/customer/outbound-trunk",
    { method: "PATCH", body: JSON.stringify({ outbound_trunk_id }) },
  );
}

// SWR fetcher
export const fetcher = <T>(url: string): Promise<T> => {
  return request<T>(url);
};

// Alias used by the Pounce campaigns page
export const apiFetch = request;
