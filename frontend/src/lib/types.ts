// ── Pounce-specific types (campaigns, leads) ─────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  icp_description: string;
  total_targets: number;
  total_dialed: number;
  total_qualified: number;
  total_booked: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  role: string;
  status: "new" | "queued" | "calling" | "qualified" | "not_qualified" | "meeting_booked" | "no_answer" | "failed";
  qualification_score: number | null;
  notes: string | null;
  campaign_id: string | null;
  intent_source: string;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  livekit_room_name: string;
  status: "initiated" | "ringing" | "connected" | "completed" | "failed" | "no_answer";
  duration_seconds: number | null;
  duration_fmt: string;
  outcome: "qualified" | "not_qualified" | "meeting_booked" | "no_answer" | "failed" | null;
  meeting_link: string | null;
  started_at: string;
  ended_at: string | null;
  // Enriched — joined from leads + campaigns
  prospect_name: string | null;
  prospect_company: string | null;
  campaign_name: string | null;
  qualification_score: number | null;
  // Legacy alias used by existing page code
  created_at: string;
}

// ── Hevox workflow/agent types ────────────────────────────────────────────────

export interface NodeData {
  label: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: "trigger" | "ai_conversation" | "classify" | "extract" | "action" | "webhook";
  data: NodeData;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ── Workflow Schema v1.0 ──────────────────────────────────────────────────────

export const WORKFLOW_SCHEMA_VERSION = "1.0" as const;

export type SchemaNodeType =
  | "trigger"
  | "ai_conversation"
  | "classify"
  | "extract"
  | "action"
  | "webhook";

export type VariableType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array";

export type VariableScope = "static" | "context" | "secret";

export interface WorkflowVariable {
  name: string;
  type: VariableType;
  scope?: VariableScope;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required?: boolean;
}

export interface IOField {
  name: string;
  type: VariableType;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  pattern?: string;
}

export interface NodeInput extends IOField {
  from?: string;
}

export interface SchemaPosition { x: number; y: number; }

// ── Per-type configs ─────────────────────────────────────────────────────────

export type TriggerDirection = "inbound" | "outbound" | "scheduled";
export type TriggerSource = "twilio" | "api" | "campaign" | "cron";

export interface TriggerConfig {
  direction: TriggerDirection;
  source?: TriggerSource;
  schedule?: string;
}

export type ExitConditionKind = "tool_called" | "intent" | "max_turns" | "node_complete";
export interface ExitCondition {
  kind: ExitConditionKind;
  tool?: string;
  intent?: string;
}

export interface AIConversationConfig {
  prompt: string;
  model?: string;
  max_turns?: number;
  tools_allowed?: string[];
  variables_in?: string[];
  exit_when?: ExitCondition;
}

export interface ClassifyBranch {
  name: string;
  description?: string;
}
export interface ClassifyConfig {
  decision_prompt: string;
  branches: ClassifyBranch[];
}

export interface ExtractConfig {
  extraction_prompt: string;
  fields: IOField[];
}

export interface ActionConfig {
  tool: string;
  arg_mapping?: Record<string, string>;
  result_alias?: Record<string, string>;
  result_mapping?: Record<string, string>;
}

export type WebhookAuthKind = "none" | "bearer" | "basic" | "api_key";
export interface WebhookAuth {
  kind: WebhookAuthKind;
  value_from?: string;
  header_name?: string;
}
export interface WebhookRetry { max?: number; backoff_ms?: number; }
export type WebhookMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface WebhookConfig {
  url: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  auth?: WebhookAuth;
  timeout_ms?: number;
  retry?: WebhookRetry;
  response_mapping?: Record<string, string>;
}

// ── Discriminated node union ─────────────────────────────────────────────────

interface SchemaNodeBase {
  id: string;
  function: string;
  label: string;
  description?: string;
  position?: SchemaPosition;
  inputs?: NodeInput[];
  outputs?: IOField[];
}

export interface TriggerSchemaNode extends SchemaNodeBase {
  type: "trigger";
  config: TriggerConfig;
}
export interface AIConversationSchemaNode extends SchemaNodeBase {
  type: "ai_conversation";
  config: AIConversationConfig;
}
export interface ClassifySchemaNode extends SchemaNodeBase {
  type: "classify";
  config: ClassifyConfig;
}
export interface ExtractSchemaNode extends SchemaNodeBase {
  type: "extract";
  config: ExtractConfig;
}
export interface ActionSchemaNode extends SchemaNodeBase {
  type: "action";
  config: ActionConfig;
}
export interface WebhookSchemaNode extends SchemaNodeBase {
  type: "webhook";
  config: WebhookConfig;
}

export type SchemaNode =
  | TriggerSchemaNode
  | AIConversationSchemaNode
  | ClassifySchemaNode
  | ExtractSchemaNode
  | ActionSchemaNode
  | WebhookSchemaNode;

// ── Edges with optional routing conditions ───────────────────────────────────

export type EdgeCondition =
  | { kind: "branch"; value: string }
  | { kind: "expression"; expression: string }
  | { kind: "intent"; prompt: string; model?: string }
  | { kind: "default" };

export interface SchemaEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  when?: EdgeCondition;
}

export interface WorkflowMeta {
  agent_type: string;
  name: string;
  entrypoint: string;
  primary_prompt?: string;
  primary_prompt_vars?: string[];
  description?: string;
  tags?: string[];
}

export interface WorkflowSchemaV1 {
  schema_version: typeof WORKFLOW_SCHEMA_VERSION;
  meta: WorkflowMeta;
  variables?: WorkflowVariable[];
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}

/** Type guard — returns true when ``payload`` is a v1.0 workflow envelope. */
export function isWorkflowSchemaV1(payload: unknown): payload is WorkflowSchemaV1 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { schema_version?: string }).schema_version === WORKFLOW_SCHEMA_VERSION
  );
}

export type AgentType =
  | "carrier_sales"
  | "driver_eta"
  | "customer_eta"
  | "receptionist"
  | "sdr"
  | "pod_collection"
  | "detention_monitor"
  | "driver_onboarding"
  | "assign_driver"
  | "equipment_change"
  | "reschedule"
  | "outbound_carrier_sales"
  | "outbound_load_bidder";

export type AgentWorkflowJSON =
  | WorkflowSchemaV1
  | { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export interface AgentConfig {
  id: string;
  name: string;
  agent_type: AgentType;
  status: "draft" | "active" | "paused";
  workflow_json: AgentWorkflowJSON | null;
  prompt_override: string | null;
  created_at: string;
  phone_number?: string | null;
  tms_type?: string;
  voice_id?: string;
  enabled_tools?: string[] | null;
  custom_instructions?: string | null;
  elevenlabs_agent_id?: string | null;
}

export interface AgentTemplate {
  id: string;
  agent_type: AgentType;
  name: string;
  description: string;
  default_workflow_nodes: WorkflowNode[];
  default_workflow_edges: WorkflowEdge[];
  default_system_prompt: string;
  node_count?: number;
}

// Re-export AgentCallLog under a different name to avoid conflict with Pounce CallLog
export interface AgentCallLog {
  id: string;
  session_id: string;
  caller_name: string | null;
  caller_phone: string;
  carrier_name: string | null;
  verified_mc_hash: string | null;
  mc_number_hash: string | null;
  direction: "inbound" | "outbound";
  agreed_rate: number | null;
  posted_rate: number | null;
  outcome: string | null;
  negotiation_outcome: string | null;
  duration_sec: number | null;
  duration_seconds: number | null;
  negotiation_rounds: number | null;
  offer_attempts: number | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  reference_number: string | null;
  load_ref?: string;
  agent_id?: string;
  agent_type?: AgentType;
  agent_config_id?: string;
  agent_name?: string | null;
  classification?: string | null;
  ins_customer_name?: string;
  ins_policy_number?: string;
  ins_finance_company?: string;
  ins_call_reason?: string;
  ins_call_status?: string;
  ins_call_outcome?: string;
  ins_promise_date?: string;
}

export interface TranscriptTurn {
  id?: string;
  turn?: number;
  role: "agent" | "caller" | "assistant" | "user" | "operator";
  text: string;
  ts: number | string;
  interrupted?: boolean;
  grouped?: boolean;
}

export interface DoraMetrics {
  booking_rate: number;
  avg_negotiation_attempts: number;
  transfer_rate?: number;
  avg_call_duration_sec: number;
  total_duration_sec?: number;
  total_calls: number;
  total_booked?: number;
  total_successful?: number;
  total_transferred?: number;
  period_start?: string;
  period_end?: string;
  check_calls_per_load?: number;
  detention_capture_rate?: number | null;
  calls_last_7_days?: number;
  calls_last_30_days?: number;
  calls_per_day?: Array<{ date: string; count: number }>;
  outcome_distribution?: Array<{ outcome: string; count: number }>;
  funnel?: Array<FunnelStage>;
  negotiation_depth?: Array<NegotiationDepthBucket>;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pct_of_total: number;
  pct_of_previous: number | null;
}

export interface NegotiationDepthBucket {
  rounds_label: string;
  rounds_min: number;
  count: number;
}

export interface CallAuditResult {
  session_id?: string;
  audited_at?: string;
  interruption_count?: number;
  sentiment_score?: number;
  sentiment_trend?: "improving" | "declining" | "stable";
  escalation_requested?: boolean;
  goal_achieved?: boolean;
  tool_selection_accuracy?: number;
  autonomous_resolution?: boolean;
  conversation_quality_score?: number;
  efficiency_score?: number;
  overall_score?: number;
  quality_flags?: string[];
  summary?: string;
  recommendations?: string[];
}

export interface RunDetail extends AgentCallLog {
  transcript?: TranscriptTurn[];
  tool_calls?: Array<{ tool: string; args: Record<string, unknown>; result: Record<string, unknown>; ts?: string }>;
  audit_result?: CallAuditResult;
  notes?: string[];
}

export interface AuditMetrics {
  total_audited: number;
  avg_overall_score: number | null;
  avg_conversation_quality: number | null;
  avg_efficiency_score: number | null;
  avg_tool_accuracy: number | null;
  autonomous_resolution_rate: number | null;
  escalation_rate: number | null;
  goal_achieved_rate: number | null;
  avg_interruptions: number | null;
  avg_sentiment: number | null;
  top_quality_flags: Array<{ flag: string; count: number }>;
  period_days: number;
  quality_per_day?: Array<QualityPerDay>;
  sentiment_distribution?: Array<{ label: "Negative" | "Neutral" | "Positive"; count: number }>;
}

export interface QualityPerDay {
  date: string;
  audited_count: number;
  avg_overall_score: number | null;
  avg_sentiment_score: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface RunFilters {
  page?: number;
  page_size?: number;
  outcome?: string;
  agent_type?: string;
  agent_id?: string;
  date_from?: string;
  date_to?: string;
}

// ── Campaign types (Hevox campaign management — different from Pounce Campaign above) ──

export interface HevoxCampaign {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  agent_config_id: string;
  total_targets: number;
  total_dialed: number;
  total_booked: number;
  total_no_answer: number;
  retry_limit: number;
  concurrent_calls: number;
  schedule_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CampaignTarget {
  phone: string;
  name?: string;
  reference?: string;
}

export type CampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";

export interface CampaignCallRecord {
  id: string;
  phone: string;
  contact_name?: string;
  reference?: string;
  status: "pending" | "dialing" | "completed" | "no_answer" | "failed";
  attempts: number;
  last_attempted_at?: string;
}

// ── Live monitoring types ───────────────────────────────────────────────────

export interface LiveTranscriptTurn {
  role: "agent" | "caller";
  text: string;
  ts: string;
}

export interface ActiveCall {
  session_id: string;
  customer_id: string;
  agent_type: string;
  direction: "inbound" | "outbound";
  caller_phone: string;
  started_at: string;
  transcript: LiveTranscriptTurn[];
}

export type LiveEvent =
  | { type: "snapshot"; calls: ActiveCall[] }
  | { type: "call_started"; session_id: string; agent_type: string; direction: string; caller_phone: string; ts: string }
  | { type: "transcript_turn"; session_id: string; role: string; text: string; ts: string }
  | { type: "call_ended"; session_id: string; outcome: string; duration_sec: number | null; ts: string };

// ── Voice Agent API Keys ────────────────────────────────────────────────────

export type AccountType = "hemut_internal" | "external_api";

export interface VoiceAgentAccount {
  id: string;
  name: string;
  account_type: AccountType;
  api_key_prefix: string;
  agent_config_id: string | null;
  is_active: boolean;
  hemut_org_id: string | null;
  field_mappings: Record<string, string> | null;
  tms_connector_config: Record<string, unknown> | null;
  webhook_url: string | null;
  created_at: string;
}

export interface CreateApiKeyRequest {
  name: string;
  account_type: AccountType;
  agent_config_id?: string;
  hemut_org_id?: string;
  field_mappings?: Record<string, string>;
  tms_connector_config?: Record<string, unknown>;
  webhook_url?: string;
  webhook_secret?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  api_key: string;
  api_key_prefix: string;
  account_type: AccountType;
}

// ── Transfer Destinations (warm-transfer routing) ───────────────────────────

export interface TransferDestination {
  id: string;
  customer_id: string;
  agent_config_id: string | null;
  agent_type: AgentType | null;
  label: string;
  phone_e164: string;
  extension: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransferDestinationInput {
  agent_config_id?: string | null;
  agent_type?: AgentType | null;
  label: string;
  phone_e164: string;
  extension?: string | null;
  priority?: number;
  active?: boolean;
}

export interface TransferDestinationPatch {
  agent_config_id?: string | null;
  agent_type?: AgentType | null;
  label?: string;
  phone_e164?: string;
  extension?: string | null;
  priority?: number;
  active?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
