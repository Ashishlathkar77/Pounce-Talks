# YC Orange Slice AI Growth Hackathon — Research Brief
**Date:** June 26, 2026 (hackathon starts tomorrow at 5pm)
**Sources:** 24 primary/blog sources, 107 agents, 9 verified facts (25 tested, 16 killed)

---

## 1. The Event

| Item | Detail |
|------|--------|
| Format | 24-hour solo or team (max 4) |
| Prizes | $15,000+ total |
| Grand prize | Potential YC Fall 2026 interview (overall winner only, conditional) |
| Location | YC office, 560 20th St, San Francisco |
| Kickoff | **Saturday June 27 at 5pm SHARP** (mandatory — miss it = no API credits) |
| Judging | Sunday June 28 at 5pm |
| Rules | New codebase only; open-source on GitHub for duration |

---

## 2. The Six Tracks

| Track | What They Want |
|-------|---------------|
| **Sales Cyborgs** | AI-enhanced sales workflows — AI that makes reps 10x more effective |
| **AI Ad Factories** | AI that generates/optimizes ads at scale |
| **Reading Minds** | Analytics, signal detection, churn prediction, lead scoring |
| **Revenue on Autopilot** | Cold outbound & pipeline automation — AI doing the SDR job |
| **Zero to One** | AI-enhanced PLG and onboarding |
| **Algorithm Hacking** | AI social media & virality engines |

**Your best tracks: Revenue on Autopilot and Sales Cyborgs.** Voice agents map directly to both.

---

## 3. Sponsor Stack (What They Expect You to Use)

### OpenAI — CONFIRMED $50 API credits for all participants
- The expected LLM provider. Build on OpenAI to align with judge expectations.
- Key APIs: **gpt-4o-realtime-mini** (low-latency voice turns) + **gpt-4.1** (tool calls / supervisor)
- Reference repo: `github.com/openai/openai-realtime-agents` — Chat-Supervisor pattern

### Convex — Named sponsor, credits unconfirmed
- Self-described as "the backend building blocks for your agents"
- Package: `@convex-dev/agent` (persistent threads, conversation history, WebSocket streaming)
- Key feature for demo: **real-time dashboard** — Convex WebSocket streams agent actions to browser live
- Architecture: LLM function call → Convex mutation → all clients update in real time
- ACID transactions, cron jobs, file storage, vector search — no separate DB needed

### Cursor — Confirmed credits (amount TBD)
- Use it as your IDE for 10x faster solo development
- Best practice: Describe high-level goals (not step-by-step), use Agent mode, scope sessions to modules
- PRD.md + AGENTS.md workflow = AI acts as PM, you as executor

---

## 4. The Winning Build (Verified Recommendation)

### "AI Outbound SDR — Inbound Carrier Sales for Any Industry"

**What it is:** A voice agent that makes outbound sales calls, qualifies leads in real time, logs CRM notes mid-call, and schedules follow-ups automatically — all visible on a live dashboard.

**Why this wins:**
- Directly targets "Revenue on Autopilot" track (Cold Outbound + Pipeline Automation)
- Leverages your existing voice agent expertise (same pattern as claivon/hevox inbound carrier sales)
- Live demo is visceral — judges hear a real call and watch the CRM update simultaneously
- Clear business ROI: AI SDR = $3-5/qualified lead vs $177/lead for human SDR (35-50x cheaper)

**Industry choice (pick one narrow vertical):**
- **Freight/trucking brokers** (you have domain knowledge from Hemut)
- **SaaS companies** (universal, judges understand it)
- **Real estate agents** (high outbound volume, painful cold calling)
- **Insurance agencies** (regulatory = lots of qualification questions = perfect for voice agent)

Recommended: **SaaS companies** — judges are all SaaS founders, they'll viscerally relate.

---

## 5. Architecture (Verified, Built in <24 Hours)

```
User/Lead (Phone/Browser)
        ↓
[gpt-4o-realtime-mini]  ← low-latency conversation turns (~300ms)
        ↓ (tool call when qualifying/logging)
[gpt-4.1 supervisor]    ← complex reasoning, CRM writes (~2s latency on tool calls)
        ↓
[Convex mutations]       ← ACID writes, persist everything
        ↓
[Next.js dashboard]      ← WebSocket live updates, judge-facing screen
```

**Reference repos:**
- `github.com/openai/openai-realtime-agents` — Chat-Supervisor pattern (prototype in <20 min)
- `github.com/get-convex/agent` — `@convex-dev/agent` package
- `github.com/get-convex/shop-talk` — Daily Bots + Convex voice-to-database reference

---

## 6. Demo Script (What Judges See)

**Screen 1 (laptop):** Live CRM dashboard — blank table with columns: Lead Name, Company, Qualification Score, Pain Points, Next Step, Follow-up Date

**Screen 2 (phone or second tab):** Voice call in progress (you or a teammate plays the "prospect")

**Moment of magic:** As the agent asks qualification questions, Convex writes the answers in real time — the dashboard updates LIVE during the call. By end of call: fully qualified lead, CRM note, follow-up scheduled.

**Pitch line:** "Every SaaS company burns $177 in SDR labor per qualified lead. This agent does it for $4 — and you just watched it work live."

---

## 7. Solo Build Timeline (24 Hours)

| Hour | Task |
|------|------|
| 0-2 (5-7pm Sat) | Kickoff + Setup: Next.js + Convex project, OpenAI Realtime API keys, repo public on GitHub |
| 2-6 (7pm-11pm) | Core voice agent: gpt-4o-realtime-mini connected, basic Q&A flow working |
| 6-10 (11pm-3am) | Tool calls: CRM write functions → Convex mutations, qualification logic |
| 10-14 (3am-7am) | Dashboard: live-updating table, WebSocket integration, mobile-friendly |
| 14-18 (7am-11am) | Polish: voice quality, error handling, demo flow rehearsal |
| 18-22 (11am-3pm) | Buffer + pitch prep: 2-min demo script, ROI slide, GitHub README |
| 22-24 (3pm-5pm) | Final rehearsal, submit |

---

## 8. Key Caveats (What Research Could Not Confirm)

1. **Judging rubric unknown** — no public scoring criteria. Track names are the only signal. Optimize for "Revenue on Autopilot" framing.
2. **Convex credits unconfirmed** — free tier may be enough for 24-hour demo. Verify at kickoff.
3. **OpenAI Realtime API** — May have updated from Beta to GA since May 12, 2026. Check `openai-realtime-agents` repo for current SDK compatibility before starting.
4. **Real phone calls** — unclear if outbound calls to real numbers are permitted. Use browser-based WebRTC demo to be safe.
5. **YC interview** is conditional "may be invited" for overall winner only — high variance outcome.

---

## 9. Differentiation as Solo Participant

Solo = weakness in speed, strength in focus. Play to it:
- Narrower use case = tighter demo = more impressive
- No coordination overhead = ship faster than teams
- Your voice agent expertise is a 6-12 month head start over most hackathon participants
- Build what you've already built in production (claivon/hevox inbound pattern) but flip it to outbound for a new industry

The narrative: "I've built this in production for freight. Tonight I showed it works for SaaS in 24 hours. It can run in any industry."
