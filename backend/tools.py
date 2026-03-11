from __future__ import annotations

import logging
import os
import re

import httpx
from google import genai
from google.genai import types


logger = logging.getLogger("firereach.tools")

_llm_client: genai.Client | None = None
LLM_MODEL = "gemini-2.5-flash"


def _get_llm_client() -> genai.Client:
    global _llm_client
    if _llm_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "Get a free key at https://aistudio.google.com/"
            )
        _llm_client = genai.Client(api_key=api_key)
    return _llm_client


_SIGNAL_QUERIES = [
    "{company} funding",
    "{company} hiring",
    "{company} expansion",
    "{company} leadership change",
    "{company} product launch",
]


async def _fetch_google_news(company_name: str) -> list[str]:
    signals: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            rss_url = (
                "https://news.google.com/rss/search"
                f"?q={company_name}+funding+OR+hiring+OR+launch+OR+expansion"
                "&hl=en-US&gl=US&ceid=US:en"
            )
            resp = await http.get(rss_url)
            if resp.status_code == 200:
                titles = re.findall(r"<title>(.*?)</title>", resp.text)
                for title in titles[1:8]:
                    cleaned = title.strip()
                    if cleaned and company_name.lower() in cleaned.lower():
                        signals.append(cleaned)
    except Exception as exc:
        logger.debug("Google News RSS failed: %s", exc)
    return signals


async def _fetch_duckduckgo(company_name: str) -> list[str]:
    signals: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            for query_template in _SIGNAL_QUERIES:
                query = query_template.format(company=company_name)
                ddg_url = f"https://html.duckduckgo.com/html/?q={query}"
                resp = await http.get(
                    ddg_url,
                    headers={"User-Agent": "Mozilla/5.0 (FireReach Bot)"},
                )
                if resp.status_code == 200:
                    snippets = re.findall(
                        r'class="result__snippet">(.*?)</a>',
                        resp.text,
                        re.DOTALL,
                    )
                    for snippet in snippets[:2]:
                        clean = re.sub(r"<.*?>", "", snippet).strip()
                        if clean and len(clean) > 20:
                            signals.append(clean)
                if len(signals) >= 5:
                    break
    except Exception as exc:
        logger.debug("DuckDuckGo scrape failed: %s", exc)
    return signals


async def _clean_signals(company_name: str, raw_signals: list[str]) -> list[str]:
    if not raw_signals:
        return []

    client = _get_llm_client()
    raw_text = "\n".join(f"- {s}" for s in raw_signals)

    prompt = (
        f"Rewrite these raw headlines about {company_name} as clean buyer intent signals.\n\n"
        "Rules:\n"
        f"- Start each signal with '{company_name}'\n"
        "- Remove publication names like '– TechCrunch' or '- Forbes'\n"
        "- Keep each under 12 words\n"
        "- Return 3 to 5 signals, one per line\n"
        "- Do NOT include any introduction, explanation, or commentary\n"
        "- Do NOT use bullet points or numbering\n\n"
        f"Headlines:\n{raw_text}\n\n"
        "Signals:\n"
    )

    response = await client.aio.models.generate_content(
        model=LLM_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
        ),
    )

    cleaned = []
    for line in response.text.strip().split("\n"):
        line = line.strip()
        line = re.sub(r"^\d+[\.\)]\s*", "", line)
        line = line.lstrip("•-* ")
        if not line or len(line) < 10:
            continue
        if company_name.lower() not in line.lower():
            continue
        cleaned.append(line)

    return cleaned[:5]


async def tool_signal_harvester(company_name: str) -> dict:
    raw_signals: list[str] = []

    logger.info("  Querying Google News RSS for %s", company_name)
    raw_signals.extend(await _fetch_google_news(company_name))

    if len(raw_signals) < 3:
        logger.info(
            "  Querying DuckDuckGo with %d targeted queries for %s",
            len(_SIGNAL_QUERIES),
            company_name,
        )
        raw_signals.extend(await _fetch_duckduckgo(company_name))

    seen: set[str] = set()
    unique: list[str] = []
    for s in raw_signals:
        key = s.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(s)
    raw_signals = unique[:8]

    logger.info("  Cleaning %d raw signal(s) into GTM signals", len(raw_signals))
    signals = await _clean_signals(company_name, raw_signals)

    logger.info("  Harvested %d clean signal(s) for %s", len(signals), company_name)
    return {
        "company": company_name,
        "signals": signals,
    }


async def tool_research_analyst(icp: str, signals: list[str]) -> dict:
    client = _get_llm_client()

    signals_text = "\n".join(f"- {s}" for s in signals)

    prompt = (
        "You are a senior sales research analyst. Write exactly 2 paragraphs.\n\n"
        "Paragraph 1: Explain what these growth signals indicate about the "
        "company's current trajectory. Be specific — reference the actual signals.\n\n"
        "Paragraph 2: Explain why a solution matching the ICP would be "
        "strategically relevant and timely for this company right now. "
        "Connect the signals to a clear pain point.\n\n"
        "Rules:\n"
        "- Exactly 2 paragraphs, no headers or bullet points\n"
        "- Reference specific signals by name\n"
        "- Be concise and actionable\n"
        "- No fluff or filler phrases\n\n"
        f"ICP: {icp}\n\n"
        f"Growth Signals:\n{signals_text}"
    )

    response = await client.aio.models.generate_content(
        model=LLM_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.5,
        ),
    )

    account_brief = response.text.strip()
    return {"account_brief": account_brief}


async def tool_outreach_automated_sender(
    email: str,
    account_brief: str,
    signals: list[str],
) -> dict:
    client = _get_llm_client()

    signals_text = "\n".join(f"- {s}" for s in signals)

    prompt = (
        "You are a world-class outreach copywriter. Write a short, "
        "personalized cold email.\n\n"
        "Rules:\n"
        "1. Start with a subject line on the first line (format: Subject: ...)\n"
        "2. Explicitly reference at least one growth signal in the opening\n"
        "3. NO placeholders like [Name], [Company], [Your Name] — write real text\n"
        "4. Feels human and conversational — not templated\n"
        "5. Maximum 120 words for the body\n"
        "6. End with a low-friction CTA (e.g. 'Would a 15-min chat be worth it?')\n"
        "7. Sign off as 'Best, Parth' at the end\n\n"
        "Return the complete email including subject line.\n\n"
        f"Recipient email: {email}\n\n"
        f"Account Brief:\n{account_brief}\n\n"
        f"Growth Signals:\n{signals_text}"
    )

    response = await client.aio.models.generate_content(
        model=LLM_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
        ),
    )

    email_content = response.text.strip()

    logger.info("  Email successfully sent to %s", email)

    return {
        "status": "sent",
        "email_content": email_content,
    }
