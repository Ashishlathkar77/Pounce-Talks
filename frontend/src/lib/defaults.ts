/**
 * Default workflow node graphs and starter prompts for each agent type.
 *
 * Workflows: Seeded into canvas when an agent has no saved workflow_json.
 *   Mirrors the backend seed_templates.py definitions but in TypeScript
 *   with the correct { data: { label, config } } structure ReactFlow expects.
 *
 * Prompts: Seeded into the Prompt tab when agent.prompt_override is null.
 *   These are concise operational starters — the full baked-in ElevenLabs
 *   prompts are in backend/voice_agent/prompts.py.  For self-serve customers
 *   the bridge already injects prompt_override via conv_override per call;
 *   for FDE customers with elevenlabs_agent_id the backend pushes it to EL.
 *
 * Two parallel registries:
 *   • {@link DEFAULT_WORKFLOW_BY_TYPE}    — legacy {nodes,edges} (canvas form).
 *   • {@link DEFAULT_WORKFLOW_V1_BY_TYPE} — v1.0 envelopes built by lifting the
 *     legacy graphs through {@link liftLegacyToV1} and attaching the per-type
 *     primary prompt + a default `company_name` variable. Used by the new
 *     primary-prompt editor and as the seed when a customer creates an agent
 *     under the v1.0 contract.
 */

import {
  AgentType,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSchemaV1,
  WORKFLOW_SCHEMA_VERSION,
  SchemaNode,
  SchemaEdge,
  IOField,
  WorkflowVariable,
  WorkflowMeta,
  TriggerConfig,
  AIConversationConfig,
  ClassifyConfig,
  ExtractConfig,
  ActionConfig,
  WebhookConfig,
} from "@/lib/types";
import { getToolSpec } from "@/lib/toolCatalog";

type Workflow = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

function n(
  id: string,
  type: WorkflowNode["type"],
  label: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
): WorkflowNode {
  return { id, type, position: { x, y }, data: { label, config } };
}

function e(id: string, source: string, target: string, label?: string): WorkflowEdge {
  return label ? { id, source, target, label } : { id, source, target };
}

// ── 1. Carrier Sales ──────────────────────────────────────────────────────────
//
// Mirrors HappyRobot's two-phase inbound carrier sales architecture:
//   Phase 1 "Find carrier":  verify MC → move_on (or transfer if failed)
//   Phase 2 "Find load and evaluate":  find load → evaluate offer →
//     run python negotiation → book/transfer → log option → extract → classify

const CARRIER_SALES: Workflow = {
  nodes: [
    // ── Trigger ────────────────────────────────────────────────────────────────
    n("n1",  "trigger",         "Inbound Call",              370, 0,   { direction: "inbound" }),

    // ── Phase 1 — Find carrier ─────────────────────────────────────────────────
    n("n2",  "ai_conversation", "Find carrier",              370, 110, {
      prompt: "Greet the carrier. Get their reference number, then MC number. Verify before proceeding.",
    }),
    n("n3",  "action",          "verify_carrier",            160, 240, { tool: "verify_carrier" }),
    n("n4",  "action",          "transfer_to_carrier_sales", 580, 240, { tool: "transfer_to_carrier_sales_rep" }),
    n("n5",  "action",          "move_on",                   370, 370, { tool: "move_on" }),

    // ── Phase 2 — Find load and evaluate ──────────────────────────────────────
    n("n6",  "ai_conversation", "Find load and evaluate",    370, 500, {
      prompt: "Find the load by reference number. Quote the rate. Collect carrier's offer. Negotiate to max buy.",
    }),
    n("n7",  "action",          "find_load_by_reference",    100, 630, { tool: "find_load_by_reference" }),
    n("n8",  "action",          "evaluate_offer",            370, 630, { tool: "evaluate_offer" }),
    n("n9",  "action",          "transfer_to_carrier_sales", 640, 630, { tool: "transfer_to_carrier_sales_rep" }),
    n("n10", "webhook",         "Find load before nego.",    100, 760, { url: "/webhooks/log/option", method: "POST" }),
    n("n11", "action",          "Run python (negotiate)",    370, 760, { tool: "negotiate_rate", description: "90/95/100% max_buy — rounds to $100" }),
    n("n12", "action",          "Direct transfer",           640, 760, { tool: "transfer_to_human" }),
    n("n13", "action",          "book_load",                 250, 890, { tool: "book_load" }),
    n("n14", "action",          "ask_for_more_loads",        250, 1000,{ tool: "ask_for_more_loads" }),
    n("n15", "webhook",         "Log option",                490, 890, { url: "/webhooks/log/option", method: "POST" }),

    // ── Outcome ────────────────────────────────────────────────────────────────
    n("n16", "extract",         "Extract",                   370, 1130,{ fields: ["outcome", "agreed_rate", "carrier_name", "load_ref"] }),
    n("n17", "classify",        "Classify",                  370, 1240,{
      branches: ["success", "rate_too_high", "carrier_not_qualified", "checking_with_driver",
                 "no_equipment", "call_back_later", "wrong_number", "hung_up"],
    }),
    n("n18", "webhook",         "Broker Carrier Sales log",  370, 1350,{ url: "/webhooks/log/option", method: "POST" }),
  ],
  edges: [
    // Trigger → Phase 1
    e("e1",  "n1",  "n2"),
    // Phase 1 prompt → tools
    e("e2",  "n2",  "n3",  "verify MC"),
    e("e3",  "n2",  "n4",  "no MC / 3× fail"),
    e("e4",  "n3",  "n5",  "verified"),
    e("e5",  "n4",  "n16"),
    // move_on → Phase 2
    e("e6",  "n5",  "n6"),
    // Phase 2 prompt → tools
    e("e7",  "n6",  "n7",  "find load"),
    e("e8",  "n6",  "n8",  "evaluate offer"),
    e("e9",  "n6",  "n9",  "load not found"),
    e("e10", "n7",  "n10"),
    e("e11", "n8",  "n11"),
    e("e12", "n9",  "n12"),
    // Negotiation outcomes
    e("e13", "n11", "n13", "accepted"),
    e("e14", "n11", "n8",  "counter"),
    e("e15", "n11", "n12", "declined (3×)"),
    // Book → more loads → log
    e("e16", "n13", "n14"),
    e("e17", "n14", "n15"),
    e("e18", "n15", "n16"),
    e("e19", "n12", "n16"),
    // Outcome → extract → classify → log
    e("e20", "n16", "n17"),
    e("e21", "n17", "n18"),
  ],
};

// ── 2. Driver ETA ─────────────────────────────────────────────────────────────

const DRIVER_ETA: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound Check Call",   250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Introduce & Ask Where", 250, 110, { prompt: "Introduce yourself and ask driver for their current location and ETA." }),
    n("n3", "extract",         "Extract Location",      250, 220, { field: "location_text" }),
    n("n4", "action",          "Capture Location",      250, 330, { tool: "capture_location" }),
    n("n5", "ai_conversation", "Ask for Issues",        250, 440, { prompt: "Ask if the driver has any delays, issues, or needs from dispatch." }),
    n("n6", "classify",        "Issues?",               250, 550, { branches: ["yes", "no"] }),
    n("n7", "action",          "Transfer to Dispatch",  430, 660, { tool: "transfer_to_human", reason: "Driver reporting delay or issue" }),
    n("n8", "action",          "Log Call",              250, 770),
    n("n9", "action",          "Hang Up",               250, 880),
  ],
  edges: [
    e("e1", "n1", "n2"),
    e("e2", "n2", "n3"),
    e("e3", "n3", "n4"),
    e("e4", "n4", "n5"),
    e("e5", "n5", "n6"),
    e("e6", "n6", "n7", "yes"),
    e("e7", "n6", "n8", "no"),
    e("e8", "n7", "n8"),
    e("e9", "n8", "n9"),
  ],
};

// ── 3. Customer ETA ───────────────────────────────────────────────────────────

const CUSTOMER_ETA: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound ETA Call",     250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Deliver ETA Update",    250, 110, { prompt: "Introduce yourself, reference the shipment, and give the ETA update." }),
    n("n3", "ai_conversation", "Answer Questions",      250, 220, { prompt: "Answer any questions the shipper has about the delivery." }),
    n("n4", "classify",        "Needs Escalation?",     250, 330, { branches: ["yes", "no"] }),
    n("n5", "action",          "Transfer to Human",     430, 440, { tool: "transfer_to_human", reason: "Customer escalation" }),
    n("n6", "action",          "Log Call",              250, 440),
    n("n7", "action",          "Hang Up",               250, 550),
  ],
  edges: [
    e("e1", "n1", "n2"),
    e("e2", "n2", "n3"),
    e("e3", "n3", "n4"),
    e("e4", "n4", "n5", "yes"),
    e("e5", "n4", "n6", "no"),
    e("e6", "n5", "n6"),
    e("e7", "n6", "n7"),
  ],
};

// ── 4. Receptionist ───────────────────────────────────────────────────────────

const RECEPTIONIST: Workflow = {
  nodes: [
    n("n1",  "trigger",         "Inbound Call",            250, 0,   { direction: "inbound" }),
    n("n2",  "ai_conversation", "Greet & Detect Intent",   250, 110, { prompt: "Greet caller warmly and identify why they're calling." }),
    n("n3",  "classify",        "Intent Routing",          250, 220, { branches: ["carrier", "driver", "shipper", "billing", "other"] }),
    n("n4",  "action",          "Transfer — Carrier Sales", 60, 350, { tool: "transfer_to_human", reason: "Carrier calling about a load" }),
    n("n5",  "action",          "Transfer — Dispatch",     200, 350, { tool: "transfer_to_human", reason: "Driver question" }),
    n("n6",  "action",          "Transfer — Customer Svc", 340, 350, { tool: "transfer_to_human", reason: "Shipper/receiver" }),
    n("n7",  "action",          "Transfer — Accounting",   480, 350, { tool: "transfer_to_human", reason: "Billing question" }),
    n("n8",  "ai_conversation", "Take Message",            620, 350, { prompt: "Offer to take a message and get their callback number." }),
    n("n9",  "action",          "Log Call",                250, 480),
    n("n10", "action",          "Hang Up",                 250, 590),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4",  "carrier"),
    e("e4",  "n3",  "n5",  "driver"),
    e("e5",  "n3",  "n6",  "shipper"),
    e("e6",  "n3",  "n7",  "billing"),
    e("e7",  "n3",  "n8",  "other"),
    e("e8",  "n4",  "n9"),
    e("e9",  "n5",  "n9"),
    e("e10", "n6",  "n9"),
    e("e11", "n7",  "n9"),
    e("e12", "n8",  "n9"),
    e("e13", "n9",  "n10"),
  ],
};

// ── 5. SDR Outbound ───────────────────────────────────────────────────────────

const SDR: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound Prospect Call", 250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Pitch & Gauge Interest", 250, 110, { prompt: "Introduce your brokerage and ask if carrier is looking for more loads." }),
    n("n3", "classify",        "Interested?",            250, 220, { branches: ["yes", "no"] }),
    n("n4", "ai_conversation", "Qualify Lanes & Equipment", 430, 330, { prompt: "Ask what lanes and equipment they run. Get their preferred regions." }),
    n("n5", "extract",         "Extract MC Number",      430, 440, { field: "mc_number" }),
    n("n6", "action",          "Verify Carrier",         430, 550, { tool: "verify_carrier" }),
    n("n7", "action",          "Log Call",               250, 660),
    n("n8", "action",          "Hang Up",                250, 770),
  ],
  edges: [
    e("e1", "n1", "n2"),
    e("e2", "n2", "n3"),
    e("e3", "n3", "n4", "yes"),
    e("e4", "n3", "n7", "no"),
    e("e5", "n4", "n5"),
    e("e6", "n5", "n6"),
    e("e7", "n6", "n7"),
    e("e8", "n7", "n8"),
  ],
};

// ── 6. POD Collection ─────────────────────────────────────────────────────────

const POD_COLLECTION: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound POD Call",       250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Request POD",             250, 110, { prompt: "Ask carrier if they have the signed POD and can submit it today." }),
    n("n3", "classify",        "POD Status",              250, 220, { branches: ["uploaded", "will_send", "missing", "dispute"] }),
    n("n4", "ai_conversation", "Confirm Receipt",          80, 350, { prompt: "Confirm POD received. Advise on payment timeline." }),
    n("n5", "ai_conversation", "Provide Instructions",    250, 350, { prompt: "Give submission instructions — email or portal link." }),
    n("n6", "ai_conversation", "Help Locate POD",         420, 350, { prompt: "Help carrier locate the signed copy from the consignee." }),
    n("n7", "action",          "Transfer — Dispute",      590, 350, { tool: "transfer_to_human", reason: "POD dispute" }),
    n("n8", "action",          "Log Call",                250, 480),
    n("n9", "action",          "Hang Up",                 250, 590),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4",  "uploaded"),
    e("e4",  "n3",  "n5",  "will_send"),
    e("e5",  "n3",  "n6",  "missing"),
    e("e6",  "n3",  "n7",  "dispute"),
    e("e7",  "n4",  "n8"),
    e("e8",  "n5",  "n8"),
    e("e9",  "n6",  "n8"),
    e("e10", "n7",  "n8"),
    e("e11", "n8",  "n9"),
  ],
};

// ── 7. Detention Monitor ──────────────────────────────────────────────────────

const DETENTION_MONITOR: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound Detention Check", 250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Confirm Arrival Status",   250, 110, { prompt: "Ask driver if they're at the facility and when they arrived." }),
    n("n3", "extract",         "Extract Arrival Time",     250, 220, { field: "arrival_time" }),
    n("n4", "action",          "Capture Location",         250, 330, { tool: "capture_location" }),
    n("n5", "ai_conversation", "Confirm Detention Logged", 250, 440, { prompt: "Let driver know detention is tracked. Ask if there are issues." }),
    n("n6", "classify",        "Issues?",                  250, 550, { branches: ["safety", "normal"] }),
    n("n7", "action",          "Transfer — Safety Issue",  430, 660, { tool: "transfer_to_human", reason: "Safety issue reported by driver" }),
    n("n8", "action",          "Log Call",                 250, 770),
    n("n9", "action",          "Hang Up",                  250, 880),
  ],
  edges: [
    e("e1", "n1", "n2"),
    e("e2", "n2", "n3"),
    e("e3", "n3", "n4"),
    e("e4", "n4", "n5"),
    e("e5", "n5", "n6"),
    e("e6", "n6", "n7", "safety"),
    e("e7", "n6", "n8", "normal"),
    e("e8", "n7", "n8"),
    e("e9", "n8", "n9"),
  ],
};

// ── 8. Driver Onboarding ──────────────────────────────────────────────────────

const DRIVER_ONBOARDING: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound Onboarding Call", 250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Welcome & Verify Identity",250, 110, { prompt: "Welcome the new driver and confirm their name and CDL number." }),
    n("n3", "extract",         "Extract Driver Info",      250, 220, { field: "driver_name, cdl_number" }),
    n("n4", "action",          "Verify Carrier",           250, 330, { tool: "verify_carrier" }),
    n("n5", "ai_conversation", "Walk Through Requirements",250, 440, { prompt: "Explain load assignment process, app download, and check-call expectations." }),
    n("n6", "ai_conversation", "Answer Questions",         250, 550, { prompt: "Answer any questions the driver has about getting started." }),
    n("n7", "classify",        "Needs Transfer?",          250, 660, { branches: ["yes", "no"] }),
    n("n8", "action",          "Transfer to Dispatch",     430, 770, { tool: "transfer_to_human", reason: "Driver onboarding question" }),
    n("n9", "action",          "Log Call",                 250, 880),
    n("n10","action",          "Hang Up",                  250, 990),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4"),
    e("e4",  "n4",  "n5"),
    e("e5",  "n5",  "n6"),
    e("e6",  "n6",  "n7"),
    e("e7",  "n7",  "n8",  "yes"),
    e("e8",  "n7",  "n9",  "no"),
    e("e9",  "n8",  "n9"),
    e("e10", "n9",  "n10"),
  ],
};

// ── 9. Assign Driver ──────────────────────────────────────────────────────────

const ASSIGN_DRIVER: Workflow = {
  nodes: [
    n("n1", "trigger",         "Outbound Assignment Call", 250, 0,   { direction: "outbound" }),
    n("n2", "ai_conversation", "Offer Load Assignment",    250, 110, { prompt: "Call the carrier and offer them a specific load. Give origin, destination, and rate." }),
    n("n3", "action",          "Find Load",                250, 220, { tool: "find_load" }),
    n("n4", "classify",        "Interested?",              250, 330, { branches: ["yes", "no", "negotiate"] }),
    n("n5", "action",          "Negotiate Rate",           430, 440, { tool: "negotiate_rate" }),
    n("n6", "action",          "Book Load",                430, 550, { tool: "book_load" }),
    n("n7", "action",          "Transfer to Human",         70, 440, { tool: "transfer_to_human", reason: "Carrier declined or needs special terms" }),
    n("n8", "action",          "Log Call",                 250, 660),
    n("n9", "action",          "Hang Up",                  250, 770),
  ],
  edges: [
    e("e1", "n1", "n2"),
    e("e2", "n2", "n3"),
    e("e3", "n3", "n4"),
    e("e4", "n4", "n5",  "negotiate"),
    e("e5", "n4", "n6",  "yes"),
    e("e6", "n4", "n7",  "no"),
    e("e7", "n5", "n6"),
    e("e8", "n6", "n8"),
    e("e9", "n7", "n8"),
    e("e10","n8", "n9"),
  ],
};

// ── 10. Equipment Change ──────────────────────────────────────────────────────

const EQUIPMENT_CHANGE: Workflow = {
  nodes: [
    n("n1", "trigger",         "Equipment Change Call",    250, 0,   { direction: "both" }),
    n("n2", "ai_conversation", "Confirm Load & Issue",     250, 110, { prompt: "Ask for the load reference and what equipment change is needed." }),
    n("n3", "extract",         "Extract Load Reference",   250, 220, { field: "reference_number" }),
    n("n4", "action",          "Find Load",                250, 330, { tool: "find_load" }),
    n("n5", "ai_conversation", "Capture New Equipment",    250, 440, { prompt: "Get the new truck number, trailer number, and reason for change." }),
    n("n6", "action",          "Update Load Notes",        250, 550, { tool: "update_load_notes" }),
    n("n7", "classify",        "Needs Approval?",          250, 660, { branches: ["yes", "no"] }),
    n("n8", "action",          "Transfer to Dispatch",     430, 770, { tool: "transfer_to_human", reason: "Equipment change requires approval" }),
    n("n9", "action",          "Log Call",                 250, 880),
    n("n10","action",          "Hang Up",                  250, 990),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4"),
    e("e4",  "n4",  "n5"),
    e("e5",  "n5",  "n6"),
    e("e6",  "n6",  "n7"),
    e("e7",  "n7",  "n8",  "yes"),
    e("e8",  "n7",  "n9",  "no"),
    e("e9",  "n8",  "n9"),
    e("e10", "n9",  "n10"),
  ],
};

// ── 11. Reschedule ────────────────────────────────────────────────────────────

const RESCHEDULE: Workflow = {
  nodes: [
    n("n1", "trigger",         "Reschedule Request",       250, 0,   { direction: "both" }),
    n("n2", "ai_conversation", "Get Load & Reason",        250, 110, { prompt: "Ask for the load reference number and reason they need to reschedule." }),
    n("n3", "extract",         "Extract Reference",        250, 220, { field: "reference_number" }),
    n("n4", "action",          "Find Load",                250, 330, { tool: "find_load" }),
    n("n5", "ai_conversation", "Propose New Time",         250, 440, { prompt: "Offer available pickup or delivery windows based on the load details." }),
    n("n6", "classify",        "Agreed?",                  250, 550, { branches: ["yes", "no", "escalate"] }),
    n("n7", "action",          "Update Load Notes",        430, 660, { tool: "update_load_notes" }),
    n("n8", "action",          "Schedule Callback",         80, 660, { tool: "schedule_callback" }),
    n("n9", "action",          "Transfer to Human",        600, 660, { tool: "transfer_to_human", reason: "Reschedule requires manual coordination" }),
    n("n10","action",          "Log Call",                 250, 770),
    n("n11","action",          "Hang Up",                  250, 880),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4"),
    e("e4",  "n4",  "n5"),
    e("e5",  "n5",  "n6"),
    e("e6",  "n6",  "n7",  "yes"),
    e("e7",  "n6",  "n8",  "no"),
    e("e8",  "n6",  "n9",  "escalate"),
    e("e9",  "n7",  "n10"),
    e("e10", "n8",  "n10"),
    e("e11", "n9",  "n10"),
    e("e12", "n10", "n11"),
  ],
};

// ── 12. Outbound Carrier Sales (formerly Load Negotiator) ─────────────────────

const OUTBOUND_CARRIER_SALES: Workflow = {
  nodes: [
    n("n1",  "trigger",         "Inbound Negotiation Call", 250, 0,   { direction: "inbound" }),
    n("n2",  "ai_conversation", "Greet & Get MC#",          250, 110, { prompt: "Greet the carrier and ask for their MC number." }),
    n("n3",  "extract",         "Extract MC Number",        250, 220, { field: "mc_number" }),
    n("n4",  "action",          "Verify Carrier",           250, 330, { tool: "verify_carrier" }),
    n("n5",  "ai_conversation", "Get Load & Rate Target",   250, 440, { prompt: "Ask for the load reference and what rate they need to make the run work." }),
    n("n6",  "extract",         "Extract Load Ref",         250, 550, { field: "reference_number" }),
    n("n7",  "action",          "Find Load",                250, 660, { tool: "find_load" }),
    n("n8",  "action",          "Get Market Rates",         430, 770, { tool: "get_market_rates" }),
    n("n9",  "action",          "Negotiate Rate",           250, 880, { tool: "negotiate_rate" }),
    n("n10", "classify",        "Outcome",                  250, 990, { branches: ["accepted", "countered", "declined"] }),
    n("n11", "action",          "Book Load",                430, 1100, { tool: "book_load" }),
    n("n12", "action",          "Transfer — Senior Broker",  70, 1100, { tool: "transfer_to_human", reason: "Rate negotiation escalation" }),
    n("n13", "action",          "Log Call",                 250, 1210),
    n("n14", "action",          "Hang Up",                  250, 1320),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),
    e("e3",  "n3",  "n4"),
    e("e4",  "n4",  "n5"),
    e("e5",  "n5",  "n6"),
    e("e6",  "n6",  "n7"),
    e("e7",  "n7",  "n8"),
    e("e8",  "n8",  "n9"),
    e("e9",  "n9",  "n10"),
    e("e10", "n10", "n11", "accepted"),
    e("e11", "n10", "n9",  "countered"),
    e("e12", "n10", "n12", "declined"),
    e("e13", "n11", "n13"),
    e("e14", "n12", "n13"),
    e("e15", "n13", "n14"),
  ],
};

// ── 13. Outbound Load Bidder (sell-side: Hevox-as-carrier bids on broker loads) ──

const OUTBOUND_LOAD_BIDDER: Workflow = {
  nodes: [
    n("n1",  "trigger",         "Outbound Bid Call",          380, 0,    { direction: "outbound", source: "api" }),
    n("n2",  "ai_conversation", "Open + state our ask",       380, 110,  {
      prompt: "Greet contact='{{contact}}', identify yourself as Casey from {{company_name}}, reference the {{posting_src}} posting (ref {{ref}}, {{origin}} to {{destination}}, {{equipment}}). Then say: 'I see you've got it at {{current_rate}} — we're at {{max_rate}}. Can you do that number?' Wait for the broker's response.",
      model: "gpt-4.1",
      max_turns: 4,
      variables_in: ["company_name", "ref", "origin", "destination", "equipment", "current_rate", "max_rate", "posting_src", "contact"],
      exit_when: { kind: "intent", intent: "Broker has reacted to our opening ask" },
    }),
    n("n3",  "classify",        "Broker initial response",    380, 220,  {
      decision_prompt: "Classify the broker's initial reaction to our pitch.",
      branches: [
        { name: "accepts_immediately", description: "Broker accepts max_rate without counter" },
        { name: "counters_lower",      description: "Broker pushes back with a lower number" },
        { name: "callback_request",    description: "'Let me check and call you back'" },
        { name: "already_covered",     description: "Broker says load is already covered" },
        { name: "wrong_load",          description: "Broker doesn't recognize the ref" },
        { name: "hostile",             description: "Broker is hostile / abusive" },
      ],
    }),

    // ── Counter path: loop until accept / decline ────────────────────────────
    n("n4",  "extract",         "Extract broker offer",        80, 360,  {
      extraction_prompt: "Capture the broker's spoken counter-offer in their exact words (e.g. 'fourteen hundred', '$1,450 all in').",
      fields: [{ name: "broker_offer_text", type: "string", required: true }],
    }),
    n("n5",  "action",          "Run bid negotiation",         80, 480,  {
      tool: "negotiate_bid_rate",
      arg_mapping: { broker_offer_text: "n4.outputs.broker_offer_text" },
    }),
    n("n6",  "classify",        "Nego outcome",                 80, 600,  {
      decision_prompt: "What did negotiate_bid_rate return? Read result.action.",
      branches: [
        { name: "accept",  description: "Action == accept — book at agreed_rate" },
        { name: "counter", description: "Action == counter — speak our_offer, wait" },
        { name: "decline", description: "Action == decline — 3 counters exhausted" },
      ],
    }),
    n("n7",  "ai_conversation", "Speak counter, listen",       240, 720, {
      prompt: "Speak the message you got back from negotiate_bid_rate verbatim ('Yeah I hear ya — best we can do is [our_offer]. Can you make that work?'). Wait for the broker's response, then we'll re-extract their new offer.",
      model: "gpt-4.1",
      max_turns: 3,
      exit_when: { kind: "intent", intent: "Broker responded with a new offer or pass" },
    }),

    // ── Booking path (joined from accepts_immediately + nego.accept) ─────────
    n("n8",  "ai_conversation", "Get rate-con email",          380, 720, {
      prompt: "Confirm the booking. Say: 'Done deal. We'll take it. Send the rate con over — what's the best email?' Capture the email they give you.",
      model: "gpt-4.1",
      max_turns: 3,
      exit_when: { kind: "intent", intent: "Broker provided a rate-con email or declined to" },
    }),
    n("n9",  "action",          "Confirm bid accepted",        380, 840, {
      tool: "confirm_action",
      arg_mapping: { confirmation: "literal:bid accepted — rate con requested" },
    }),

    // ── Short closes per branch ──────────────────────────────────────────────
    n("n10", "ai_conversation", "Polite decline close",         80, 840, {
      prompt: "Speak the decline message: 'Yeah, we can't make it work at that number — appreciate the time.' Keep it short.",
      model: "gpt-4.1-mini", max_turns: 1,
      exit_when: { kind: "intent", intent: "Decline acknowledged" },
    }),
    n("n11", "ai_conversation", "Callback close",              580, 360, {
      prompt: "Acknowledge the callback request: 'Sounds good — we're at {{max_rate}}, give us a shout when you know. Appreciate it.'",
      model: "gpt-4.1-mini", max_turns: 1,
      variables_in: ["max_rate"],
      exit_when: { kind: "intent", intent: "Callback acknowledged" },
    }),
    n("n12", "ai_conversation", "Already covered close",       730, 360, {
      prompt: "Acknowledge: 'All good, no worries — keep us in mind for the next one out of {{origin}}.'",
      model: "gpt-4.1-mini", max_turns: 1,
      variables_in: ["origin"],
      exit_when: { kind: "intent", intent: "Closure acknowledged" },
    }),
    n("n13", "ai_conversation", "Wrong load close",            880, 360, {
      prompt: "Apologize for the stale posting: 'My bad — must have a stale posting on my end. Appreciate the time, take care.'",
      model: "gpt-4.1-mini", max_turns: 1,
      exit_when: { kind: "intent", intent: "Apology acknowledged" },
    }),
    n("n14", "ai_conversation", "Hostile close",              1030, 360, {
      prompt: "End the call calmly: 'Alright, I'll let you go. Thanks for the time.'",
      model: "gpt-4.1-mini", max_turns: 1,
      exit_when: { kind: "intent", intent: "Hostile call ended" },
    }),

    // ── Final tail (every path lands here) ───────────────────────────────────
    n("n15", "action",          "Log call outcome",            380, 1000, { tool: "log_call" }),
    n("n16", "action",          "Hang up",                     380, 1120, { tool: "hang_up"  }),
  ],
  edges: [
    e("e1",  "n1",  "n2"),
    e("e2",  "n2",  "n3"),

    e("e3",  "n3",  "n8",  "accepts_immediately"),
    e("e4",  "n3",  "n4",  "counters_lower"),
    e("e5",  "n3",  "n11", "callback_request"),
    e("e6",  "n3",  "n12", "already_covered"),
    e("e7",  "n3",  "n13", "wrong_load"),
    e("e8",  "n3",  "n14", "hostile"),

    e("e9",  "n4",  "n5"),
    e("e10", "n5",  "n6"),

    e("e11", "n6",  "n8",  "accept"),
    e("e12", "n6",  "n7",  "counter"),
    e("e13", "n6",  "n10", "decline"),

    e("e14", "n7",  "n4"),
    e("e15", "n8",  "n9"),
    e("e16", "n9",  "n15"),
    e("e17", "n10", "n15"),
    e("e18", "n11", "n15"),
    e("e19", "n12", "n15"),
    e("e20", "n13", "n15"),
    e("e21", "n14", "n15"),
    e("e22", "n15", "n16"),
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const DEFAULT_WORKFLOW_BY_TYPE: Partial<Record<AgentType, Workflow>> = {
  carrier_sales:     CARRIER_SALES,
  driver_eta:        DRIVER_ETA,
  customer_eta:      CUSTOMER_ETA,
  receptionist:      RECEPTIONIST,
  sdr:               SDR,
  pod_collection:    POD_COLLECTION,
  detention_monitor: DETENTION_MONITOR,
  driver_onboarding: DRIVER_ONBOARDING,
  assign_driver:     ASSIGN_DRIVER,
  equipment_change:  EQUIPMENT_CHANGE,
  reschedule:        RESCHEDULE,
  outbound_carrier_sales: OUTBOUND_CARRIER_SALES,
  outbound_load_bidder:   OUTBOUND_LOAD_BIDDER,
};

export const DEFAULT_PROMPT_BY_TYPE: Partial<Record<AgentType, string>> = {
  carrier_sales: `You are Paul, a senior freight broker at {{company_name}}. You handle inbound calls from trucking carriers who want to book loads.

Sound natural and freight-fluent. One or two sentences per turn — this is a phone call, not an email.

## Workflow
1. Greet the caller and ask for their MC number
2. Call verify_carrier() — if not in system after 3 tries, transfer to human
3. Ask for their load reference number
4. Call find_load() to pull up the load details
5. Tell them the origin → destination and posted rate, ask what rate they need
6. Call negotiate_rate() with their offer — the system handles countering
7. If accepted → call book_load() and confirm the rate confirmation
8. Ask if they have more trucks available (ask_for_more_loads)
9. If declined → transfer to a senior broker

## Voice Rules
- Dollar amounts as words: "fifteen hundred" not "$1,500"
- Never narrate tool calls — pause naturally, then speak the result
- Use: "Got it." "All right." "Yep." "Copy that." — not robotic affirmations`,

  driver_eta: `You are a check-call dispatcher at {{company_name}}. You are calling a driver on load {{load_ref}} to get their current location and ETA.

Keep it short — drivers are driving. Two sentences max per turn.

## Workflow
1. Introduce yourself and the company
2. Confirm you have the right driver and the right load
3. Ask where they are right now and when they expect to arrive
4. Call capture_location() with their location and ETA in minutes
5. Ask if they have any delays, issues, or need anything from dispatch
6. If issues → call transfer_to_human() to get a live dispatcher
7. Otherwise, confirm the update and let them get back on the road

## Voice Rules
- Short, direct sentences
- "Where are you right now?" not "Could you please provide your current location?"
- Confirm the ETA number back: "Copy that — we'll show you arriving around 3pm"`,

  customer_eta: `You are an automated shipping update agent at {{company_name}}. You are calling {{caller_name}} about shipment {{load_ref}}.

You are proactively updating the shipper or consignee on their delivery status.

## Workflow
1. Introduce yourself and reference the shipment number
2. Give the current ETA — be specific with time and day
3. Mention any notable updates (early, late, on time)
4. Ask if they have any questions or concerns
5. If they need to speak to someone → transfer to customer service
6. Otherwise, confirm everything and wrap up professionally

## Voice Rules
- Confident and reassuring — the shipper wants certainty
- Give specific times: "we're showing arrival by 2pm tomorrow" not "sometime tomorrow"
- If delayed: acknowledge it directly, give the new ETA, explain why briefly`,

  receptionist: `You are the front-desk voice agent at {{company_name}}. You answer all inbound calls and route them to the right team.

Sound warm and professional. This is the first impression callers get of the company.

## Routing Logic
- Carrier calling about a load or rate → Transfer to carrier sales
- Driver calling about a delivery, pickup, or breakdown → Transfer to dispatch
- Shipper or consignee with questions → Transfer to customer service
- Billing, invoice, or payment question → Transfer to accounting
- Anything else → Offer to take a message and get a callback number

## Voice Rules
- Always greet with: "Thank you for calling {{company_name}}, this is the front desk."
- Ask: "Who am I speaking with, and how can I direct your call?"
- When transferring: briefly explain who you're connecting them with`,

  sdr: `You are an outbound carrier development agent at {{company_name}}. You're calling carriers to see if they'd like to haul loads for our brokerage.

Be friendly and direct. Carriers get a lot of calls — get to the point quickly.

## Workflow
1. Introduce yourself and the company (5 seconds max)
2. Ask if they're currently looking for loads and what lanes they run
3. If interested → ask about their equipment type and preferred regions
4. Get their MC number and call verify_carrier() to confirm
5. If verified → explain our load board, rate structure, and check-call process
6. Schedule a follow-up or transfer to a load planner if ready to work now
7. If not interested → thank them and end professionally

## Voice Rules
- Lead with a question, not a pitch: "Are you looking for more loads right now?"
- Listen more than you talk — qualify their lanes before selling
- Never read from a script — sound like a real person`,

  pod_collection: `You are an accounts payable agent at {{company_name}}. You're calling carrier {{caller_name}} about proof of delivery for load {{load_ref}}.

POD submission is required before payment can be processed.

## Workflow
1. Introduce yourself, reference the load number and delivery date
2. Confirm they completed the delivery and ask if they have the signed POD
3. Based on their response:
   - Have it → give submission instructions (email: accounting@{{company_name}}.com or online portal)
   - Will send → confirm the deadline and how they'll submit
   - Can't find it → help them get a copy from the consignee or weigh station
   - Dispute → transfer to billing immediately
4. Confirm the payment timeline once POD is received
5. Log the call outcome

## Voice Rules
- Be friendly — this is about getting them paid, not chasing them
- "Once we get the POD, we can get your payment processed right away"`,

  detention_monitor: `You are a detention tracking agent at {{company_name}}. You're calling driver {{caller_name}} on load {{load_ref}} to log detention time.

Detention starts after 2 free hours at a facility. Every minute matters for the claim.

## Workflow
1. Introduce yourself and reference the load
2. Confirm the driver arrived at the facility and get the exact arrival time
3. Call capture_location() to log arrival time and location
4. Tell them detention is now being tracked and they should call again if held longer than 4 hours
5. Ask if there are any safety issues or other concerns
6. If safety issue → immediately transfer to dispatch
7. Otherwise, thank them and let them know we're watching the clock

## Voice Rules
- Be efficient — drivers are waiting at a dock
- Confirm the arrival time back to them: "I've got you checked in at 10:45am"
- For safety issues, escalate without hesitation`,

  driver_onboarding: `You are a driver onboarding agent at {{company_name}}. You're calling a new driver to walk them through their first load assignment.

Make them feel welcome and set clear expectations.

## Workflow
1. Welcome them and confirm their name and driver ID
2. Confirm the load details: reference number, pickup location, delivery location
3. Walk through check-call expectations: call every 2-4 hours with location updates
4. Explain the detention policy: call dispatch if held more than 2 hours
5. Confirm they have our dispatch number saved
6. Ask if they have any questions about the load or process
7. If they need to speak to dispatch → transfer immediately

## Voice Rules
- Be encouraging — this is their first interaction with the company
- Keep explanations short and clear
- "Do you have any questions before you head to the pickup?" — always give them the chance to ask`,

  assign_driver: `You are a load assignment agent at {{company_name}}. You're calling a carrier to offer them a specific load.

Get to the point — offer the load, handle the rate, get a yes or no.

## Workflow
1. Introduce yourself and say you have a load that matches their lanes
2. Give the key details: origin, destination, equipment, pickup date, posted rate
3. Ask if they can take it
4. If interested but wants a different rate → call negotiate_rate()
5. If agreed → call book_load() and send the rate confirmation
6. If declined → thank them and ask if they'd be interested in future loads on similar lanes
7. Log the outcome

## Voice Rules
- Lead with the load details, not small talk
- "I've got a [equipment] from [origin] to [destination], picking up [date] at [rate]. Can you run it?"
- If they counter on rate, negotiate directly — don't put them on hold`,

  equipment_change: `You are an operations agent at {{company_name}}. You're handling an equipment change request for an in-progress load.

Equipment changes affect insurance, load planning, and compliance — document everything.

## Workflow
1. Get the load reference number and confirm the current assignment
2. Find the load with find_load()
3. Ask for the new truck number, trailer number, and reason for the change
4. Note if the trailer type is changing (dry van → reefer, etc.) — flag for re-quoting
5. Log all changes with update_load_notes()
6. If the change requires dispatch approval → transfer to human
7. If approved → confirm with the driver and update your notes

## Voice Rules
- Be thorough — get all equipment numbers accurately
- Repeat numbers back: "So that's truck 4782, trailer 9156 — correct?"
- If trailer type changes, flag it immediately: "A trailer type change may affect the rate — let me get dispatch on the line"`,

  reschedule: `You are a scheduling agent at {{company_name}}. You're handling a pickup or delivery reschedule request.

Rescheduling requires coordinating between the driver, shipper, and consignee — be organized.

## Workflow
1. Get the load reference number and current appointment details
2. Find the load with find_load()
3. Understand why they need to reschedule (driver delay, facility closure, etc.)
4. Propose a new pickup or delivery window based on available appointments
5. If they agree → log the change with update_load_notes()
6. If they need a callback to confirm with their facility → schedule_callback()
7. If this requires manual carrier/shipper coordination → transfer to dispatch

## Voice Rules
- Be solution-focused: "Here's what we can do" not "That's not possible"
- Always confirm the new appointment details before ending the call
- For tight delivery windows, flag the urgency: "We don't have a lot of flexibility on the delivery — let's get this locked in today"`,

  outbound_carrier_sales: `You are a senior load negotiator at {{company_name}}. You handle inbound calls from carriers who want to negotiate rates on loads they've found on our board.

You're experienced, direct, and know your margins. One or two sentences per turn.

## Workflow
1. Get their MC number and call verify_carrier()
2. Get the load reference and pull it up with find_load()
3. Check market rates with get_market_rates() to know if their ask is reasonable
4. Ask what rate they need to run it
5. Call negotiate_rate() with their offer — the engine handles the counter schedule
6. If accepted → book_load() and confirm rate confirmation
7. If declined after 3 rounds → transfer to senior broker or let them walk

## Voice Rules
- Sound like someone who's negotiated thousands of loads
- Use market rate context naturally: "On that lane, the market is running around X"
- Don't over-explain counters: "Best I can do is fifteen hundred. You wanna work with that?"
- Never reveal your max — stay firm, stay warm`,

  outbound_load_bidder: `You are Casey, a freight dispatcher at {{company_name}}. You're calling a broker who has posted a load on a public load board (Uber Freight, DAT, 123Loadboard, etc.) and we have a truck that fits the lane. You ARE the carrier on this call.

Sound confident, direct, no fluff. One or two sentences per turn. Dollar amounts as words ("fourteen hundred" not "$1,400"). Never narrate tool calls.

## Workflow
1. Open: greet by name, identify yourself, name the load (ref, lane, equipment), state the broker's posted rate vs our opening max_rate, ask if they can do that number.
2. If they accept your max_rate: get the rate-con email, call confirm_action(confirmation="bid accepted at <rate>"), then log_call() and hang_up(outcome="booked").
3. If they counter lower: extract their offer in their exact words and call negotiate_bid_rate(broker_offer_text). Speak the message it returns verbatim. Loop until accept or decline.
4. If they ask for a callback: acknowledge briefly, log_call() and hang_up(outcome="callback_requested"). Do NOT keep negotiating.
5. If they say covered / wrong load / hostile: short polite close, then log_call() and hang_up().

## Rates — Strict
- Public anchors only: their posted rate, our opening max_rate, target_rate, and counters from negotiate_bid_rate.
- We have an internal floor that you do NOT know. Never speculate ("I can probably do less") and never ask "what's your bottom line".
- If asked "what's the lowest you'll go?" — answer with the LAST number negotiate_bid_rate gave you, never improvise.

## Voice Rules
- Lead with the load details, not small talk.
- "I see you've got it at {{current_rate}} — we're at {{max_rate}}. Can you do that number?"
- Don't apologize for our rate. We're a real carrier with a real truck.
- Don't chase below the last counter the engine returned.`,
};


// ── v1.0 lifter ──────────────────────────────────────────────────────────────

interface LegacyNodeConfigShape {
  [k: string]: unknown;
}

function liftClassifyConfig(cfg: LegacyNodeConfigShape): ClassifyConfig {
  const branchesRaw = cfg.branches;
  const branches = Array.isArray(branchesRaw) && branchesRaw.length > 0
    ? branchesRaw.map((b) =>
        typeof b === "string" ? { name: b } : (b as { name: string; description?: string }),
      )
    : [{ name: "yes" }, { name: "no" }];
  return {
    decision_prompt:
      typeof cfg.decision_prompt === "string"
        ? (cfg.decision_prompt as string)
        : "Decide which path the conversation should follow next.",
    branches,
  };
}

function liftExtractConfig(cfg: LegacyNodeConfigShape): ExtractConfig {
  const raw = cfg.fields ?? cfg.field;
  let fields: IOField[] = [];
  if (Array.isArray(raw)) {
    fields = raw
      .map((x): IOField | null => {
        if (typeof x === "string") return { name: x, type: "string" };
        if (x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string") {
          const f = x as Partial<IOField> & { name: string };
          return { ...f, name: f.name, type: f.type ?? "string" };
        }
        return null;
      })
      .filter((f): f is IOField => f !== null);
  } else if (typeof raw === "string") {
    fields = raw.split(",").map((s) => s.trim()).filter(Boolean).map((n) => ({ name: n, type: "string" as const }));
  }
  if (fields.length === 0) fields = [{ name: "value", type: "string" }];
  return {
    extraction_prompt:
      typeof cfg.extraction_prompt === "string"
        ? (cfg.extraction_prompt as string)
        : `Extract ${fields.map((f) => f.name).join(", ")} from the conversation.`,
    fields,
  };
}

function liftActionConfig(cfg: LegacyNodeConfigShape): ActionConfig {
  const tool = typeof cfg.tool === "string" ? (cfg.tool as string) : "log_call";
  const arg_mapping: Record<string, string> = {};
  if (typeof cfg.reason === "string") {
    arg_mapping.reason = `literal:${cfg.reason}`;
  }
  if (cfg.arg_mapping && typeof cfg.arg_mapping === "object") {
    Object.assign(arg_mapping, cfg.arg_mapping as Record<string, string>);
  }
  const result_alias = (cfg.result_alias && typeof cfg.result_alias === "object")
    ? (cfg.result_alias as Record<string, string>)
    : undefined;
  return result_alias ? { tool, arg_mapping, result_alias } : { tool, arg_mapping };
}

function liftWebhookConfig(cfg: LegacyNodeConfigShape): WebhookConfig {
  const url = typeof cfg.url === "string" ? (cfg.url as string) : "https://example.com";
  const method = (typeof cfg.method === "string" ? cfg.method : "POST") as WebhookConfig["method"];
  return { url, method };
}

function liftAIConversationConfig(cfg: LegacyNodeConfigShape): AIConversationConfig {
  const out: AIConversationConfig = {
    prompt: typeof cfg.prompt === "string" ? (cfg.prompt as string) : "Continue the conversation.",
    model: typeof cfg.model === "string" ? (cfg.model as string) : "gpt-4.1",
    max_turns: typeof cfg.max_turns === "number" ? (cfg.max_turns as number) : 20,
  };
  if (Array.isArray(cfg.tools_allowed)) {
    out.tools_allowed = (cfg.tools_allowed as unknown[]).filter((t): t is string => typeof t === "string");
  }
  if (Array.isArray(cfg.variables_in)) {
    out.variables_in = (cfg.variables_in as unknown[]).filter((v): v is string => typeof v === "string");
  }
  if (cfg.exit_when && typeof cfg.exit_when === "object") {
    out.exit_when = cfg.exit_when as AIConversationConfig["exit_when"];
  }
  return out;
}

function liftTriggerConfig(cfg: LegacyNodeConfigShape): TriggerConfig {
  const dir = cfg.direction;
  const src = cfg.source;
  const source = (src === "api" || src === "campaign" || src === "cron")
    ? (src as TriggerConfig["source"])
    : "twilio";
  return {
    direction: dir === "outbound" || dir === "scheduled" ? dir : "inbound",
    source,
  };
}

function liftLegacyNode(n: WorkflowNode): SchemaNode {
  const cfg = (n.data?.config ?? {}) as LegacyNodeConfigShape;
  const base = {
    id: n.id,
    label: n.data.label,
    description: n.data.description,
    position: n.position,
    inputs: [] as never[],
  };
  switch (n.type) {
    case "trigger":
      return {
        ...base,
        type: "trigger",
        function: "inbound_call",
        config: liftTriggerConfig(cfg),
        outputs: [
          { name: "caller_phone", type: "string" as const },
          { name: "started_at",   type: "string" as const },
        ],
      };
    case "ai_conversation":
      return {
        ...base,
        type: "ai_conversation",
        function: slug(n.data.label),
        config: liftAIConversationConfig(cfg),
        outputs: [],
      };
    case "classify": {
      const lifted = liftClassifyConfig(cfg);
      return {
        ...base,
        type: "classify",
        function: slug(n.data.label),
        config: lifted,
        outputs: [{ name: "branch", type: "string" as const, enum: lifted.branches.map((b) => b.name) }],
      };
    }
    case "extract": {
      const lifted = liftExtractConfig(cfg);
      return {
        ...base,
        type: "extract",
        function: slug(n.data.label),
        config: lifted,
        outputs: lifted.fields,
      };
    }
    case "action": {
      const lifted = liftActionConfig(cfg);
      const spec = getToolSpec(lifted.tool);
      return {
        ...base,
        type: "action",
        function: lifted.tool,
        config: lifted,
        inputs: spec ? spec.inputs.map((i) => ({ ...i })) : [],
        outputs: spec ? spec.outputs.map((o) => ({ ...o })) : [{ name: "result", type: "object" as const }],
      };
    }
    case "webhook":
      return {
        ...base,
        type: "webhook",
        function: slug(n.data.label),
        config: liftWebhookConfig(cfg),
        outputs: [
          { name: "status", type: "integer" as const },
          { name: "body",   type: "object" as const },
        ],
      };
  }
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64) || "step";
}

function liftLegacyEdge(
  e: WorkflowEdge,
  classifyIds: Set<string>,
): SchemaEdge {
  const out: SchemaEdge = { id: e.id, source: e.source, target: e.target };
  if (e.label) out.label = e.label;
  if (e.label && classifyIds.has(e.source)) {
    out.when = { kind: "branch", value: e.label };
  }
  return out;
}

/**
 * Lift a legacy `{nodes, edges}` workflow into the typed v1.0 envelope.
 */
export function liftLegacyToV1(
  agentType: AgentType,
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  options: {
    name?: string;
    primaryPrompt?: string;
    extraVariables?: WorkflowVariable[];
  } = {},
): WorkflowSchemaV1 {
  const triggerNode = graph.nodes.find((n) => n.type === "trigger");
  const entrypoint = triggerNode?.id ?? graph.nodes[0]?.id ?? "n1";
  const classifyIds = new Set(graph.nodes.filter((n) => n.type === "classify").map((n) => n.id));

  const meta: WorkflowMeta = {
    agent_type: agentType,
    name: options.name ?? agentType.replace(/_/g, " "),
    entrypoint,
    primary_prompt: options.primaryPrompt ?? DEFAULT_PROMPT_BY_TYPE[agentType] ?? undefined,
    primary_prompt_vars: options.primaryPrompt || DEFAULT_PROMPT_BY_TYPE[agentType] ? ["company_name"] : [],
  };

  const variables: WorkflowVariable[] = [
    { name: "company_name", type: "string", scope: "static", default: "Hemut Freight" },
    ...(options.extraVariables ?? []),
  ];

  return {
    schema_version: WORKFLOW_SCHEMA_VERSION,
    meta,
    variables,
    nodes: graph.nodes.map(liftLegacyNode),
    edges: graph.edges.map((e) => liftLegacyEdge(e, classifyIds)),
  };
}

/** Per-type v1.0 envelopes built once at module load. */
export const DEFAULT_WORKFLOW_V1_BY_TYPE: Partial<Record<AgentType, WorkflowSchemaV1>> = (() => {
  const out: Partial<Record<AgentType, WorkflowSchemaV1>> = {};
  for (const [type, graph] of Object.entries(DEFAULT_WORKFLOW_BY_TYPE) as [
    AgentType,
    { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | undefined,
  ][]) {
    if (!graph) continue;
    out[type] = liftLegacyToV1(type, graph);
  }
  return out;
})();
