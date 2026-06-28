# FINAL BUILD BRIEF — YC Orange Slice Hackathon
**Research basis: 323 agents, 74 sources, 24 verified facts across 3 deep research runs**

---

## THE ONE THING TO BUILD

# "InstantSDR" — AI Speed-to-Lead Service

**Not software. A service. Pay per qualified meeting booked.**

---

## The Insight (The One Thing No One Is Doing)

Every AI SDR company (11x, Artisan, AiSDR, Amplemarket, Regie) sells **seats of software**.
You configure it. You manage it. You pay monthly whether it works or not.

Nobody sells the **outcome**.

YC's own Summer 2026 RFS says it explicitly:
> *"AI-native companies that don't sell software — they sell the service. Instead of giving you a tool, they just do the work. The total spend on services is many times larger than the spend on software."*
> — Gustaf Alströmer, YC Partner, ycombinator.com/rfs (primary source, verified 3-0)

InstantSDR is that service. You connect a webhook. When a prospect shows intent, we call them in 60 seconds. You pay only when there's a meeting on your calendar.

---

## The Problem (Verified Numbers Only — No Marketing Claims)

| Fact | Number | Source | Verification |
|------|--------|--------|-------------|
| Average lead response time | **42 hours** | HBR 2011, Oldroyd et al., 2,241 US companies | ✅ 3-0 verified |
| Companies that never respond to web leads | **23%** | Same HBR study | ✅ 3-0 verified |
| Qualifying odds for sub-1-hour response vs. later | **7x more likely** | Same HBR study (2011) | ✅ verified |
| Fully-loaded human SDR annual cost | **$100K–$145K/yr** | LeadGenius, Glassdoor, RemoteGrowthPartners, Martal, Salary.com | ✅ 3-0 verified, 5 independent sources |

### What NOT to say:
- ❌ "100x contact odds" — vendor-commissioned B2C study, never peer-reviewed, don't touch it
- ❌ "21x qualification rate" — same study, same problem
- ❌ "78% of buyers buy from first responder" — killed 0-3, no source
- ❌ "$3-5 vs $177 per lead" — killed 0-3, pure vendor marketing math

---

## The Pitch (60 Seconds)

> "The average company takes **42 hours** to respond to a web lead [HBR, 2011, 2,241 companies]. 23% never respond at all. Companies that respond in under an hour are **7x more likely to qualify** that lead.
>
> We respond in **60 seconds**.
>
> Not with software. With an AI that picks up the phone, knows who you are, knows what you just did on the site, and qualifies you live on the call.
>
> No seats. No configuration. No monthly fee.
>
> You pay **$0** until there's a meeting on your calendar.
>
> YC says AI-native companies should sell the service, not the software. We are the SDR. You pay for the meeting."

---

## How It Works (Live Demo Flow)

**Setup for judges:**
- Screen 1: Live dashboard (laptop, visible to everyone)
- Screen 2: A test product's pricing page open in browser

**Demo:**
1. "I'm going to act as a prospect who just visited your pricing page twice"
2. Click pricing page twice → webhook fires
3. "In under 60 seconds, our AI will call me live"
4. Judge's phone (or a live phone on speaker) rings
5. AI: *"Hey [Name], I saw you were checking out [Product]'s pricing — I'm calling because a lot of people looking at the enterprise tier have questions about [specific pain]. Do you have 90 seconds?"*
6. Conducts 3-question qualification live
7. Dashboard updates in real time: name, company, qualification score, pain points, next step
8. Call ends. Meeting link sent via SMS automatically.
9. "That was 47 seconds. Your SDR would have called in 42 hours — if at all."

---

## Why This Wins the Hackathon

### 1. Track fit: Revenue on Autopilot (Cold Outbound & Pipeline Automation)
Exact match. No interpretation needed.

### 2. YC thesis alignment
The judges are YC-adjacent. You are building exactly what the YC RFS is asking for. Say that explicitly in your pitch.

### 3. The demo is visceral
Every judge in that room has felt the pain of leads going cold. Watching a phone ring 47 seconds after a pricing page visit is a gut-punch moment. No slide can do what that demo does.

### 4. No competitor does this as a service
Verified: 11x, Artisan, AiSDR, Amplemarket, Regie.ai, Outreach, Apollo, Salesloft — none confirmed to offer pay-per-meeting-booked with no seat pricing. The gap is real.

### 5. Your expertise is the moat
You have built production voice agents at claivon and hevox. The voice quality, latency handling, objection flow — this is the hardest part. Everyone at this hackathon can build a webhook. Not everyone can make an AI that sounds human enough to get a prospect through 3 qualification questions.

---

## Technical Architecture

```
Intent Signal (pricing page, form fill, trial signup)
        ↓ webhook
[FastAPI endpoint] → parse lead context (name, company, action)
        ↓
[Twilio outbound call] → connects to voice agent
        ↓
[gpt-4o-realtime-mini] ← low-latency conversation
        ↓ (on qualification question answered)
[gpt-4.1 supervisor] ← logs structured data via tool call
        ↓
[Convex mutation] → real-time dashboard update via WebSocket
        ↓
[Next.js dashboard] ← judges see this updating live
        ↓ (call end)
[Automated SMS] → sends calendar booking link
```

### Stack
| Component | Tool | Why |
|-----------|------|-----|
| Voice (turns) | OpenAI gpt-4o-realtime-mini | Low latency, sponsor credits |
| Voice (tool calls) | OpenAI gpt-4.1 supervisor | Context + CRM writes |
| Phone | Twilio Programmable Voice | Real calls, $0.013/min |
| Backend / state | Convex | Real-time WebSocket to dashboard, sponsor |
| Dashboard | Next.js + Convex React hooks | Fast to build, live updates |
| Webhook receiver | FastAPI (your existing pattern) | You know this already |
| Calendar booking | Cal.com API | Free, instant integration |

---

## 24-Hour Build Plan

| Hours | Task | Priority |
|-------|------|----------|
| 0–1 (5–6pm Sat) | Kickoff, get API credits, initialize repo, push to GitHub | Critical |
| 1–3 (6–8pm) | Webhook receiver + Twilio outbound call trigger working end-to-end | Critical |
| 3–6 (8–11pm) | Voice agent: gpt-4o-realtime-mini connected, basic qualification script (3 questions) | Critical |
| 6–9 (11pm–2am) | Tool calls: qualification data → Convex mutations | Critical |
| 9–12 (2–5am) | Next.js dashboard: live call status, transcript stream, CRM card | High |
| 12–16 (5–9am) | Polish: voice naturalness, error handling, SMS follow-up | Medium |
| 16–20 (9am–1pm) | Demo rehearsal, edge case handling, pitch timing | High |
| 20–24 (1–5pm) | Buffer, GitHub README, final pitch run-through | Critical |

---

## Hackathon Rules Compliance

| Rule | Status |
|------|--------|
| New codebase only | ✅ Fresh repo — you reuse architecture knowledge, not code |
| Open-source on GitHub during event | ✅ Initialize at kickoff |
| Solo participant | ✅ Completely soloable |
| No pre-built projects | ✅ Compliant — building new |
| Track fit | ✅ Revenue on Autopilot (exact match) |

---

## The One-Line Pitch for Judges

**"We are the SDR. You pay for the meeting, not the software."**
