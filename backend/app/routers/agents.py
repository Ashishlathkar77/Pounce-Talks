"""
Agents router — returns the single hardcoded Pounce SDR agent (Alex).
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/agents", tags=["agents"])

# ── Alex workflow — mirrors Carrier Sales II complexity ───────────────────────
#
# Phase 1 — Connect & Hook      (n1–n4)
# Phase 2 — Discovery & Qual    (n5–n10)
# Phase 3 — Pitch & Book        (n11–n15)
# Outcome  — Extract & Classify (n16–n19)

def n(id, type, label, x, y, config=None):
    return {"id": id, "type": type, "position": {"x": x, "y": y},
            "data": {"label": label, "config": config or {}}}

def e(id, src, tgt, label=None):
    d = {"id": id, "source": src, "target": tgt}
    if label:
        d["label"] = label
    return d


_WORKFLOW = {
    "nodes": [
        # ── Phase 1 — Connect & Hook ──────────────────────────────────────────
        n("n1",  "trigger",         "Outbound Dial",               370, 0,    {"direction": "outbound"}),
        n("n2",  "action",          "load_lead_context",           370, 110,  {"tool": "load_lead_context"}),
        n("n3",  "ai_conversation", "Intro & Hook",                370, 220,  {"prompt": "Greet by first name. One punchy line on Hemut. Ask if they have 90 seconds."}),
        n("n4",  "classify",        "Prospect Available?",         370, 350,  {"branches": ["connected", "voicemail", "busy", "wrong_person"]}),

        n("n5",  "action",          "end_call (no contact)",       720, 480,  {"tool": "end_call", "outcome": "no_answer"}),

        # ── Phase 2 — Discovery & Qualification ───────────────────────────────
        n("n6",  "ai_conversation", "Discovery",                   370, 480,  {"prompt": "Ask 3 questions: team size, current TMS/process, are they the decision-maker."}),
        n("n7",  "action",          "log team_size",               80,  630,  {"tool": "log_qualification_answer", "question": "team_size"}),
        n("n8",  "action",          "log current_process",         370, 630,  {"tool": "log_qualification_answer", "question": "current_process"}),
        n("n9",  "action",          "log decision_maker",          660, 630,  {"tool": "log_qualification_answer", "question": "decision_maker"}),
        n("n10", "action",          "qualify_lead",                370, 760,  {"tool": "qualify_lead", "description": "Score 0–10 using rubric"}),
        n("n11", "classify",        "Qualified?",                  370, 890,  {"branches": ["qualified", "not_qualified"]}),

        n("n12", "action",          "end_call (not qualified)",    720, 1020, {"tool": "end_call", "outcome": "not_qualified"}),

        # ── Phase 3 — Pitch & Book ────────────────────────────────────────────
        n("n13", "ai_conversation", "Pitch & Schedule",            370, 1020, {"prompt": "Pitch Hemut in 2 sentences. Ask for 30-min demo — call book_meeting() with their preferred time."}),
        n("n14", "action",          "book_meeting",                370, 1130, {"tool": "book_meeting", "description": "Fetch Cal.com slots, offer 2 options"}),
        n("n15", "classify",        "Meeting Status?",             370, 1260, {"branches": ["confirmed", "callback", "declined"]}),

        n("n16", "action",          "log callback",                680, 1390, {"tool": "log_qualification_answer", "question": "callback_time"}),

        # ── Outcome ───────────────────────────────────────────────────────────
        n("n17", "extract",         "Extract Outcome Fields",      370, 1390, {"fields": ["name", "company", "email", "agreed_meeting_time", "outcome"]}),
        n("n18", "classify",        "Final Outcome",               370, 1510, {"branches": ["meeting_booked", "callback", "not_qualified", "no_answer", "hung_up"]}),
        n("n19", "action",          "end_call",                    370, 1630, {"tool": "end_call"}),
    ],
    "edges": [
        # Phase 1
        e("e1",  "n1",  "n2"),
        e("e2",  "n2",  "n3"),
        e("e3",  "n3",  "n4"),
        e("e4",  "n4",  "n5",  "voicemail / busy / wrong"),
        e("e5",  "n4",  "n6",  "connected"),
        e("e6",  "n5",  "n17"),

        # Phase 2
        e("e7",  "n6",  "n7",  "team size"),
        e("e8",  "n6",  "n8",  "current process"),
        e("e9",  "n6",  "n9",  "decision maker"),
        e("e10", "n7",  "n10"),
        e("e11", "n8",  "n10"),
        e("e12", "n9",  "n10"),
        e("e13", "n10", "n11"),
        e("e14", "n11", "n12", "not_qualified"),
        e("e15", "n11", "n13", "qualified"),
        e("e16", "n12", "n17"),

        # Phase 3
        e("e17", "n13", "n14"),
        e("e18", "n14", "n15"),
        e("e19", "n15", "n16", "callback"),
        e("e20", "n15", "n17", "declined"),
        e("e21", "n15", "n17", "confirmed"),
        e("e22", "n16", "n17"),

        # Outcome
        e("e23", "n17", "n18"),
        e("e24", "n18", "n19"),
    ],
}

_PROMPT = """\
You are Alex, a senior outbound SDR at Hemut — the AI-native TMS built for freight brokers. \
You're calling freight broker prospects to qualify them and book a 30-minute product demo.

Sound natural and freight-fluent. One or two sentences per turn — this is a phone call, not an email.

## Workflow

**Phase 1 — Connect & Hook**
1. Call load_lead_context() immediately — this is always your first move.
2. Greet by first name. Hook: "I'm calling because we just launched an AI-powered TMS built specifically \
for freight brokers — helps dispatchers handle 40% more loads without extra headcount."
3. Ask: "Do you have 90 seconds?"
4. If voicemail / no answer → call end_call(outcome="no_answer")
5. If wrong person → ask who manages TMS/operations, then end_call

**Phase 2 — Discovery (3 questions)**
After each answer, call log_qualification_answer() immediately:
1. "How many brokers or dispatchers are on your team right now?" → log(question="team_size", answer=...)
2. "What TMS or tools are you using today to manage loads and track carriers?" → log(question="current_process", answer=...)
3. "Are you the one who'd evaluate a new TMS, or is there someone else I should loop in?" → log(question="decision_maker", answer=...)

Then call qualify_lead(score=0-10, summary="one sentence on fit").

**Phase 3 — Pitch & Book (score ≥ 5 only)**
- Pitch (10 seconds): "Hemut automates check calls, carrier updates, and load tracking — brokers on our \
platform close 30% more loads in the same headcount. Worth a quick look?"
- Call book_meeting(preferred_time="their preference") → offer the two slots returned.
- Get their email for the calendar invite.
- Call end_call(outcome="meeting_booked")

**If score < 5:**
- "Totally get it — sounds like you've got a solid setup. Mind if I check back in a few months?"
- Call end_call(outcome="not_qualified")

## Qualification Rubric (for qualify_lead score 0–10)
+2 pts  Team ≥ 5 dispatchers or brokers
+2 pts  Using spreadsheets, manual process, or outdated TMS (McLeod, TMW, Tailwind)
+3 pts  They ARE the decision-maker or strong influencer
+2 pts  Actively evaluating or open to switching TMS
+1 pt   Warm / curious tone, asked questions about Hemut

## Voice Rules
- Never narrate tool calls — pause naturally ("Let me check on that…"), then speak the result
- Dollar amounts as words: "thirty percent more loads" not "30% more"
- Affirmations: "Got it." "Absolutely." "Makes sense." "That's exactly what we built this for."
- Lead with the pain, then Hemut: "Most brokers we talk to are still doing check calls manually — \
that's the first thing Hemut eliminates."
- Keep every turn under 2 sentences unless reading back a slot time
"""

_ALEX: dict = {
    "id": "pounce-alex-001",
    "name": "Alex — Pounce SDR",
    "agent_type": "sdr",
    "status": "active",
    "phone_number": None,
    "voice_id": "79a125e8-cd45-4c13-8a67-188112f4dd22",
    "prompt_override": _PROMPT,
    "workflow_json": _WORKFLOW,
    "enabled_tools": [
        "load_lead_context",
        "log_qualification_answer",
        "qualify_lead",
        "book_meeting",
        "end_call",
    ],
    "created_at": "2026-06-27T00:00:00Z",
}

_TEMPLATE: dict = {
    "id": "tpl-pounce-sdr",
    "agent_type": "sdr",
    "name": "Pounce SDR",
    "description": "Outbound SDR that qualifies freight broker leads and books demos for Hemut.",
    "default_workflow_nodes": _WORKFLOW["nodes"],
    "default_workflow_edges": _WORKFLOW["edges"],
    "default_system_prompt": _PROMPT,
    "node_count": len(_WORKFLOW["nodes"]),
}


@router.get("/templates/list")
async def list_templates():
    return [_TEMPLATE]


@router.get("/")
async def list_agents():
    return [_ALEX]


@router.post("/")
async def create_agent(body: dict):
    return _ALEX


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    return _ALEX


@router.patch("/{agent_id}")
async def update_agent(agent_id: str, body: dict):
    merged = {**_ALEX, **{k: v for k, v in body.items() if v is not None}}
    return merged


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str):
    return None


@router.post("/{agent_id}/test-call")
async def test_call(agent_id: str, body: dict):
    return {"mode": "demo", "call_sid": "demo-call-001", "session_id": "demo-session-001"}


@router.post("/{agent_id}/activate")
async def activate_agent(agent_id: str, body: dict):
    return {**_ALEX, "phone_number": body.get("phone_number")}
