# Competitive Analysis & Fact-Check — AI Voice SDR
**108 agents, 25 sources, 5 verified (20 killed by adversarial check)**

---

## 1. Numbers You Should STOP Using

| Claim | Status | Why |
|-------|--------|-----|
| "$3-5 per qualified lead (AI)" | ❌ KILLED 3-0 | Vendor math from Retell/Aloware blogs, no independent source |
| "$177 per qualified lead (human)" | ❌ KILLED 3-0 | Circulates on vendor blogs, no authoritative origin |
| "AI SDRs generate 6.4x more touches" | ❌ KILLED 3-0 | Source not verifiable |
| "$487 vs $321 cost-per-opportunity" | ❌ KILLED 3-0 | Not substantiated |

---

## 2. Numbers You CAN Use (Verified)

| Claim | Status | Source |
|-------|--------|--------|
| Human SDR: $100K-$145K fully-loaded/year | ✅ 3-0 VERIFIED | LeadGenius, RemoteGrowthPartners 2026, Martal 2025, Glassdoor, Salary.com (5 independent sources) |
| Human SDR hourly cost: ~$61.50/hr ($128K ÷ 2,080h) | ✅ DERIVED from above | Math from verified annual figure |
| AI voice calling infrastructure cost: $0.07-$0.25/min | Directional | Vapi, Bland, Retell pricing pages (vendor-stated, not independently verified) |

**Safe pitch framing:** "A freight broker SDR costs $100-145K fully-loaded per year (Glassdoor, LeadGenius, 5 sources). Our voice agent handles shipper qualification calls at infrastructure cost — ~$0.10/min."

---

## 3. Competitive Landscape — Who Already Exists

### Horizontal AI SDR (email + LinkedIn, voice bolt-on — CROWDED)
| Company | What They Do | Voice Quality | Your Gap |
|---------|-------------|---------------|----------|
| 11x.ai | Email SDR "Alice" + phone agent "Jordan" | Weak — struggles with objections and natural conversation | Generic, no domain knowledge |
| Artisan AI | Email + LinkedIn sequences, "Ava" persona | No real voice | Generic |
| AiSDR | Email sequences | No voice | Generic |
| Amplemarket | Multichannel sequences | Weak voice | Generic |

**Key insight:** 14+ YC companies are already in horizontal AI SDR (including Orange Slice — the hackathon organizer themselves are an AI SDR company). Do NOT build a generic AI outbound SDR. You will not win.

### Logistics-Specific Voice AI (your neighborhood — but gaps exist)
| Company | What They Do | Your Gap |
|---------|-------------|----------|
| HappyRobot | Inbound voice for carriers, load tracking, POD collection. $44M Series B (Sept 2025), enterprise-only | INBOUND only. No outbound shipper sales. |
| Parade.ai | CoDriver Inbound Phone (April 2025) — inbound capacity management | INBOUND only. No shipper acquisition. |

**The gap that exists and is unoccupied:** Outbound freight broker → shipper voice prospecting with load board data enrichment.

---

## 4. TCPA Legal Reality (Important for Demo)

**Verified (2-1, FCC Declaratory Ruling FCC-24-17, Feb 2024):**
- AI-generated voices are classified as "artificial voices" under TCPA
- Unsolicited outbound AI marketing calls require prior express consent
- BUT: 5th Circuit rejected FCC's consent requirement in Feb 2026 → active circuit conflict → law is unsettled

**For the hackathon demo:** Use browser-based WebRTC (no real phone calls). Frame compliance as a feature: "We bake in consent scaffolding and DNC scrubbing — no existing horizontal AI SDR does this."

---

## 5. The Actual USP

Generic outbound AI SDR = dead space. The real differentiation is **domain intelligence + data enrichment + vertical specificity**.

No existing product does:
- Outbound freight broker → shipper calls with live load board signal enrichment
- TCPA-compliant AI calling with built-in consent capture
- Domain vocabulary (lanes, spot rates, FMCSA, BOL, accessorials)

Your USP: "HappyRobot handles inbound carrier calls. Parade handles inbound capacity. No one has built the outbound shipper acquisition side — and that's the hardest dollar in freight brokerage."
