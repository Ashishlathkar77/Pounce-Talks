"""
Pounce — pre-call intelligence briefing

Generates a structured brief for a prospect before the agent dials.
Uses GPT-4.1-mini (fast + cheap) for the narrative and Clearbit for logo.
"""

from __future__ import annotations

import httpx
import structlog
from openai import AsyncOpenAI

log = structlog.get_logger(__name__)


async def generate_brief(
    name: str,
    company: str,
    email: str = "",
    role: str = "",
) -> dict:
    """
    Return a pre-call intelligence card for the prospect.

    Keys:
        company_summary  – 2-sentence overview of what the company does
        likely_pain      – Most probable pain point for an outbound TMS pitch
        opener_angle     – Specific first-line hook tailored to this prospect
        talking_points   – list[str] of 3 concise conversation anchors
        logo_url         – Clearbit logo (best-effort, None if unavailable)
    """
    logo_url = await _fetch_logo(company, email)

    client = AsyncOpenAI()

    prompt = f"""You are a senior outbound SDR preparing a quick brief before a cold call.

Prospect: {name}
Title/Role: {role or "unknown"}
Company: {company}
Email domain: {email.split("@")[-1] if "@" in email else "unknown"}

Return ONLY valid JSON with these exact keys:
{{
  "company_summary": "<2 sentences: what the company does and rough size/market>",
  "likely_pain": "<1 sentence: most probable operational pain for a freight/trucking/logistics company of this type>",
  "opener_angle": "<1 sentence: the single most compelling opening line for this call — specific to them, not generic>",
  "talking_points": ["<point 1>", "<point 2>", "<point 3>"]
}}

Be specific. Do not be generic. If the company domain gives you hints, use them.
Think about freight brokers vs carriers vs 3PLs vs shippers."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            response_format={"type": "json_object"},
        )
        import json
        brief = json.loads(response.choices[0].message.content)
    except Exception as exc:
        log.warning("enrichment_llm_failed", error=str(exc))
        brief = {
            "company_summary": f"{company} — details unavailable.",
            "likely_pain": "Manual dispatch coordination and freight visibility gaps.",
            "opener_angle": f"Hi {name}, I'm calling because companies like {company} often struggle with real-time load tracking—",
            "talking_points": [
                "How are you currently tracking loads in transit?",
                "How many dispatchers are on your team?",
                "Are you using a TMS today, or mostly spreadsheets?",
            ],
        }

    return {**brief, "logo_url": logo_url}


async def _fetch_logo(company: str, email: str) -> str | None:
    """
    Try Clearbit Logo API (no auth required for basic use).
    Falls back to None if unavailable.
    """
    domain = email.split("@")[-1] if "@" in email else None
    if not domain or domain in {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com"}:
        # Try to guess from company name as slug
        slug = company.lower().replace(" ", "").replace(",", "").replace(".", "")
        domain = f"{slug}.com"

    url = f"https://logo.clearbit.com/{domain}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.head(url)
            if r.status_code == 200:
                return url
    except Exception:
        pass
    return None
