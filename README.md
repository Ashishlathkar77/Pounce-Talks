# Pounce — AI Outbound SDR

**Pounce** is an open-source AI voice agent that calls leads, qualifies them live on the phone, and books demos — no human SDR required.

Built for the [YC X25 Hackathon](https://www.ycombinator.com/) by the [Hemut](https://hemut.com) team.

---

## What it does

- Dials prospects via SIP outbound using LiveKit
- Runs a real two-way voice conversation (STT → LLM → TTS pipeline)
- Asks 3 discovery questions, scores qualification, and delivers a personalized pitch
- Books a demo on Cal.com and sends the calendar invite — all during the call
- Captures the full transcript and outcome to a dashboard in real time

## Demo

Live at **[pounce.hemut.com](https://pounce.hemut.com)**

## Architecture

```
┌─────────────┐     SIP outbound      ┌──────────────────┐
│  Campaign   │ ──── LiveKit room ───▶ │  Paul (LK Agent) │
│  dashboard  │                        │                  │
│  (Next.js)  │◀── webhook / SSE ───── │  STT  LLM  TTS  │
└─────────────┘                        │  DG   GPT  CAR  │
       │                               └────────┬─────────┘
       │ REST                                   │ Cal.com API
       ▼                                        ▼
┌─────────────┐                        ┌──────────────────┐
│  FastAPI    │                        │  Calendar invite │
│  + Postgres │                        │  + booking link  │
└─────────────┘                        └──────────────────┘
```

| Layer | Technology |
|---|---|
| Voice agent | [LiveKit Agents 1.6](https://docs.livekit.io/agents/) |
| STT | [Deepgram nova-3](https://deepgram.com/) with freight keyterm boosting |
| LLM | [OpenAI gpt-4.1](https://openai.com/) @ temperature 0.3 |
| TTS | [Cartesia Sonic-3](https://cartesia.ai/) — Blake voice, speed 0.96 |
| Frontend | [Next.js 15](https://nextjs.org/) App Router + Hemut Design System |
| Backend API | [FastAPI](https://fastapi.tiangolo.com/) + SQLAlchemy + Postgres |
| Scheduling | [Cal.com API v2](https://cal.com/docs/api-reference/v2) |
| Infra | AWS ECS Fargate ARM64, Vercel (frontend), GitHub Actions OIDC |

## Repository layout

```
pounce/
├── backend/
│   ├── agent_worker.py      # LiveKit agent — Paul SDR (voice pipeline)
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

- Python 3.11+
- Node.js 20+
- A [LiveKit](https://livekit.io/) project (Cloud or self-hosted)
- [Deepgram](https://deepgram.com/), [OpenAI](https://platform.openai.com/), [Cartesia](https://cartesia.ai/) API keys
- [Cal.com](https://cal.com/) account with API key + event type ID
- Postgres database

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # fill in your keys

# Start the FastAPI server
uvicorn main:app --reload --port 8000

# Start the LiveKit voice agent worker (separate terminal)
python agent_worker.py dev
```

**Required env vars** (see `.env.example`):

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...
CARTESIA_API_KEY=...
CALCOM_API_KEY=...
CALCOM_EVENT_TYPE_ID=...
DATABASE_URL=postgresql+asyncpg://...
WEBHOOK_BASE_URL=http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL

npm run dev   # http://localhost:3000
```

Default login: set `AUTH_EMAIL` / `AUTH_PASSWORD` in `.env.local` (fallback: `ashish@hemut.com` / `Qwerty@7890` — **change before deploying**).

## Voice agent highlights

The agent (`backend/agent_worker.py`) uses several techniques from recent voice AI research:

- **Deterministic pre-tool fillers** — hard-coded `session.say()` fires before slow Cal.com API calls so there's zero dead air
- **Backchannel allow-list** — 30-entry frozenset detects pure acknowledgments ("yeah", "right", "go ahead") and instructs the LLM to continue rather than start a new response
- **Dynamic endpointing** — Deepgram silence window extends to 1200ms when the prospect is expected to spell an email address
- **Structured prompt with example transcripts** — 3 full realistic call examples embedded in the system prompt (clean booking, objection recovery, graceful no)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

**Ways to contribute:**

- Improve the qualification flow or system prompt
- Add new integrations (CRMs, other calendar providers, different TTS voices)
- Frontend improvements (analytics, live call monitoring)
- Infrastructure (multi-tenant support, call queue management)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

Built with [LiveKit](https://livekit.io/), [Deepgram](https://deepgram.com/), [Cartesia](https://cartesia.ai/), [OpenAI](https://openai.com/), and [Cal.com](https://cal.com/).

Research references: ConvFill (arXiv:2511.07397), LTS-VoiceAgent (arXiv:2601.19952), τ-Voice (arXiv:2603.13686).

---

*Made by [Hemut](https://hemut.com) · YC X25*
