# Contributing to Pounce

Thanks for your interest! Here's how to get involved.

## Workflow

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes, keeping commits focused and descriptive.
3. Open a pull request against `main` — describe what changed and why.
4. A maintainer will review and merge.

**All changes go through PRs — direct pushes to `main` are disabled for external contributors.**

## What to work on

Check the [Issues](https://github.com/Ashishlathkar77/Pounce-Talks/issues) tab. Good first issues are labelled `good first issue`.

High-impact areas:
- **Prompt / qualification flow** — better objection handling, new vertical prompts
- **Integrations** — HubSpot, Salesforce, Pipedrive CRM sync; Calendly support
- **Voice quality** — turn detection tuning, new TTS voices, language support
- **Frontend** — analytics charts, live call waveform, campaign A/B testing
- **Infrastructure** — multi-tenant isolation, call queue, rate limiting

## Code style

- **Python**: [Ruff](https://docs.astral.sh/ruff/) for linting/formatting (`ruff check . && ruff format .`)
- **TypeScript**: Prettier + ESLint (run `npm run lint` in `frontend/`)
- No unnecessary comments — name things clearly instead
- Keep functions small and focused

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add Spanish language support
fix(ui): close button missing on mobile drawer
chore(deps): bump livekit-agents to 1.7.0
```

## Secrets & environment

Never commit API keys, `.env` files, or credentials. Use `.env.example` as the template — add new vars there when you add a new integration.

## Questions?

Open a GitHub Discussion or reach out at [team@hemut.com](mailto:team@hemut.com).
