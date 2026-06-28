# Pounce

**Your leads get a real phone call. You get a booked demo.**

Most "AI outreach" tools send another email into an already-ignored inbox. Pounce picks up the phone — it calls your prospects, has a live two-way voice conversation, qualifies them on the spot, and books the meeting before the call ends. No human needed at any step.

Built by [Ashish Lathkar](https://github.com/Ashishlathkar77) · YC X25

---

## The difference

| Everyone else | Pounce |
|---|---|
| Email sequences, LinkedIn DMs | Real outbound phone call |
| Prospect reads (or ignores) a message | Prospect has a live conversation |
| You follow up manually | Demo is already on the calendar |
| Async, days-long back-and-forth | Qualified + booked in under 5 minutes |

The entire funnel — **dial → qualify → pitch → book** — happens in a single call. No SDR. No BDR. No follow-up sequence.

## Demo

Live at **[pounce.hemut.com](https://pounce.hemut.com)**

## How it works

```
┌─────────────┐     SIP outbound      ┌──────────────────────┐
│  Campaign   │ ──── LiveKit room ───▶ │  Paul (voice agent)  │
│  dashboard  │                        │                      │
│  (Next.js)  │◀── webhook / SSE ───── │  Deepgram  GPT-4.1  │
└─────────────┘                        │  Cartesia  Cal.com  │
       │                               └──────────┬───────────┘
       │ REST                                     │
       ▼                                          ▼
┌─────────────┐                        ┌──────────────────────┐
│  FastAPI    │                        │  Calendar invite     │
│  + Postgres │                        │  sent automatically  │
└─────────────┘                        └──────────────────────┘
```

1. You upload a list of leads and start a campaign
2. Pounce dials each one via SIP outbound
3. Paul (the voice agent) runs a live discovery conversation — team size, current tooling, decision-maker
4. Qualifies the lead in real time using a scored rubric
5. Delivers a personalized pitch based on what they just said
6. Books a demo slot on Cal.com and sends the calendar invite
7. Full transcript + outcome lands in your Runs dashboard instantly

## Tech stack

| Layer | Technology |
|---|---|
| Voice agent | [LiveKit Agents 1.6](https://docs.livekit.io/agents/) |
| STT | [Deepgram nova-3](https://deepgram.com/) — keyterm boosting, dynamic endpointing |
| LLM | [OpenAI gpt-4.1](https://openai.com/) @ temperature 0.3 |
| TTS | [Cartesia Sonic-3](https://cartesia.ai/) — Blake voice, speed 0.96 |
| Frontend | [Next.js 15](https://nextjs.org/) App Router |
| Backend API | [FastAPI](https://fastapi.tiangolo.com/) + SQLAlchemy + Postgres |
| Scheduling | [Cal.com API v2](https://cal.com/docs/api-reference/v2) |
| Infra | AWS ECS Fargate ARM64, Vercel (frontend), GitHub Actions OIDC |

## Repository layout

```
pounce/
├── backend/
│   ├── agent_worker.py      # LiveKit agent — Paul (voice pipeline)
│   ├── main.py              # FastAPI app (campaigns, leads, webhooks)
│   ├── app/
│   │   ├── agent/
│   │   │   ├── prompt.py    # System prompt + 3 example call transcripts
│   │   │   └── state.py     # Per-call state (qualification gates, transcript)
│   │   ├── routers/         # API routes
│   │   ├── models/          # SQLAlchemy models
│   │   └── services/        # Outbound call dispatch, Cal.com, etc.
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/ # Agents, Runs, Campaigns, Analytics pages
│       │   └── login/       # Auth (HMAC-SHA256 cookie, no external deps)
│       └── lib/             # API client, types, auth helpers
├── deploy/                  # ECS task definitions, Dockerfile targets
├── research/                # Voice agent research papers + analysis
└── .github/workflows/       # CI/CD: build → push ECR → deploy ECS
```

## Getting started

### Prerequisites

- Python 3.11+, Node.js 20+
- [LiveKit](https://livekit.io/) project (Cloud or self-hosted)
- API keys: [Deepgram](https://deepgram.com/), [OpenAI](https://platform.openai.com/), [Cartesia](https://cartesia.ai/)
- [Cal.com](https://cal.com/) account + event type ID
- Postgres database

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in your keys

uvicorn main:app --reload --port 8000      # FastAPI
python agent_worker.py dev                  # LiveKit voice agent
```

Key env vars:

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
CARTESIA_API_KEY=
CALCOM_API_KEY=
CALCOM_EVENT_TYPE_ID=
DATABASE_URL=postgresql+asyncpg://...
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

Set `AUTH_EMAIL` / `AUTH_PASSWORD` in `frontend/.env.local` before deploying.

## The research behind it

Most voice agents fail on the phone because they're built the same way as text chatbots — no understanding of how real-time spoken conversation actually works. Before writing a line of agent code, we went through recent academic literature on voice AI and extracted what actually moves the needle.

Five papers shaped the design:

### [ConvFill — Conversational Fillers for Real-Time Voice Agents](https://arxiv.org/abs/2511.07397)
**What it says:** When a voice agent needs to call an external tool (calendar, CRM, API), there's an unavoidable latency gap. Without intervention, the prospect hears dead silence and assumes the call dropped. ConvFill shows that injecting a hard-coded natural filler _before_ the tool call — not generated by the LLM, just a fixed phrase — eliminates the perceived pause with near-zero latency overhead.

**What we built:** `_say_filler()` in `agent_worker.py` — a method that bypasses the LLM entirely and fires text straight to Cartesia TTS before every Cal.com slot fetch and booking API call. "One sec, let me check what's open around then…" starts playing within milliseconds. The API call runs in parallel.

---

### [LTS-VoiceAgent — Latency-Tolerant Streaming Voice Agents](https://arxiv.org/abs/2601.19952)
**What it says:** End-of-turn detection (endpointing) is a fixed silence threshold in most systems. That threshold is a major source of both false positives (cutting the prospect off mid-sentence) and false negatives (long pauses after complex input like spelling an email address). LTS-VoiceAgent proposes state-aware endpointing — the silence window should adapt based on what kind of input the agent is waiting for.

**What we built:** A `_dictation_mode` flag on the agent. When Paul has just offered meeting slots and is waiting for the prospect to spell their email, a `stt_node` override extends Deepgram's endpointing from 400ms to 1200ms. The window snaps back to normal after the booking is confirmed.

---

### [τ-Voice — Turn-Taking and Backchannel Modeling for Voice Agents](https://arxiv.org/abs/2603.13686)
**What it says:** Human speech is full of backchannels — brief acknowledgments like "yeah", "right", "go ahead", "mhm" that signal continued attention without yielding the floor. Most voice systems treat these as real interruptions, which causes the agent to stop speaking and generate a confused response to a one-word non-question. τ-Voice categorises these and shows that suppressing barge-in for known backchannels dramatically reduces unhelpful interruptions.

**What we built:** A 30-entry `_BACKCHANNELS` frozenset in `agent_worker.py`. When `conversation_item_added` fires with a user message that matches the list, Paul's response is overridden with a "continue naturally" instruction via `session.generate_reply()` — the LLM never sees the backchannel as a new topic.

---

### [Speculative Interaction Agents](https://arxiv.org/abs/2605.13360)
**What it says:** The standard pipeline — wait for user to finish → STT → LLM → TTS → speak — has irreducible latency because each stage blocks the next. Speculative interaction proposes running the LLM speculatively during the user's utterance, not after. For tool-heavy agents the gains are most visible when the LLM can predict which tool it will call before the full utterance lands.

**What we built:** `preemptive_generation: {"enabled": False}` in the current build (deliberately off). The paper's approach requires careful rollback logic when speculation is wrong, which introduces its own failure modes. We documented it for future implementation once the qualification flow is stable enough to predict tool calls reliably.

---

### [VeriGuard — Hallucination Detection for Tool-Calling Voice Agents](https://arxiv.org/abs/2510.05156)
**What it says:** When a voice LLM calls a tool (e.g., a booking API), it sometimes generates plausible-sounding but fabricated parameters — an invented meeting time, a mangled email address — because the LLM is optimising for fluent speech, not data fidelity. VeriGuard proposes a lightweight verification pass on tool arguments before execution.

**What we built:** Gate-protected tool calls in `agent_worker.py`. `book_meeting` and `confirm_meeting` both validate pre-conditions via `state.can_book_meeting()` before touching the Cal.com API. Meeting times are never invented — the agent may only offer slots that the Cal.com API actually returned, stored in `state._available_slots`. Email addresses are validated for `@` presence before a booking is created.

---

The full research survey (15 papers reviewed, 5 implemented, notes on what was skipped and why) is in [`research/`](research/).

## Contributing

PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

Good places to start: new CRM integrations (HubSpot, Salesforce), additional TTS voices, language support, campaign analytics.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

[LiveKit](https://livekit.io/) · [Deepgram](https://deepgram.com/) · [Cartesia](https://cartesia.ai/) · [OpenAI](https://openai.com/) · [Cal.com](https://cal.com/) · [Orange Slice.AI](https://orangeslice.ai)

Research: ConvFill ([arXiv:2511.07397](https://arxiv.org/abs/2511.07397)) · LTS-VoiceAgent ([arXiv:2601.19952](https://arxiv.org/abs/2601.19952)) · τ-Voice ([arXiv:2603.13686](https://arxiv.org/abs/2603.13686)) · Speculative Interaction Agents ([arXiv:2605.13360](https://arxiv.org/abs/2605.13360)) · VeriGuard ([arXiv:2510.05156](https://arxiv.org/abs/2510.05156))
