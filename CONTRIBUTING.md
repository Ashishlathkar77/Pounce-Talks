# Contributing to Pounce

Thanks for your interest! Here's how to get involved.

## Workflow

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make changes, keep commits focused and descriptive.
3. Open a pull request against `main` — describe what changed and why.

**All changes go through PRs — direct pushes to `main` are not accepted.**

## What to work on

Check the [Issues](https://github.com/Ashishlathkar77/Pounce-Talks/issues) tab. Good first issues are labelled `good first issue`.

High-impact areas:
- **Voice quality** — turn detection tuning, new TTS voices, language support
- **Integrations** — HubSpot / Salesforce / Pipedrive CRM sync; Calendly support
- **Prompt / qualification** — better objection handling, non-freight verticals
- **Frontend** — analytics charts, live call waveform, campaign A/B testing
- **Infrastructure** — multi-tenant isolation, call queue, rate limiting

## Code style

- **Python**: [Ruff](https://docs.astral.sh/ruff/) (`ruff check . && ruff format .`)
- **TypeScript**: Prettier + ESLint (`npm run lint` in `frontend/`)
- No unnecessary comments — name things clearly instead

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add Spanish language support
fix(ui): close button missing on mobile drawer
chore(deps): bump livekit-agents to 1.7.0
```

## Secrets

Never commit API keys or `.env` files. Use `.env.example` as the template.

## Questions?

Open a GitHub Discussion or email [ashish@hemut.com](mailto:ashish@hemut.com).
