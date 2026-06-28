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

## Voice agent internals

Four techniques from recent research that meaningfully improve call quality:

- **Deterministic pre-tool fillers** — hard-coded `session.say()` fires before every Cal.com API call so there's zero dead air while the network round-trip happens
- **Backchannel allow-list** — 30-entry frozenset catches pure acknowledgments ("yeah", "right", "go ahead") and instructs the LLM to continue naturally instead of restarting its response
- **Dynamic endpointing** — Deepgram silence window extends from 400ms to 1200ms when the prospect is expected to spell an email address
- **Prompt with example transcripts** — 3 full realistic call examples embedded in the system prompt (clean booking, objection recovery, graceful no)

## Contributing

PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

Good places to start: new CRM integrations (HubSpot, Salesforce), additional TTS voices, language support, campaign analytics.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

[LiveKit](https://livekit.io/) · [Deepgram](https://deepgram.com/) · [Cartesia](https://cartesia.ai/) · [OpenAI](https://openai.com/) · [Cal.com](https://cal.com/)

Research: ConvFill (arXiv:2511.07397) · LTS-VoiceAgent (arXiv:2601.19952) · τ-Voice (arXiv:2603.13686)
