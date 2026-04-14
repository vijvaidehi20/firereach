from __future__ import annotations

import logging
import os
import re

import httpx
from groq import AsyncGroq


logger = logging.getLogger("firereach.tools")

_llm_client: AsyncGroq | None = None
LLM_MODEL = "llama-3.3-70b-versatile"

_SIGNAL_QUERIES = [
    "{company} funding",
    "{company} hiring",
    "{company} expansion",
    "{company} leadership change",
    "{company} product launch",
]


def _get_llm_client() -> AsyncGroq:
    global _llm_client
    if _llm_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY environment variable is not set. "
                "Get a free key at https://console.groq.com/"
            )
        _llm_client = AsyncGroq(api_key=api_key)
    return _llm_client


async def _fetch_google_news(company_name: str) -> tuple[list[str], list[str]]:
    signals: list[str] = []
    sources: list[str] = []
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
                        sources.append("Google News")
    except Exception as exc:
        logger.debug("Google News RSS failed: %s", exc)
    return signals, sources


async def _fetch_duckduckgo(company_name: str) -> tuple[list[str], list[str]]:
    signals: list[str] = []
    sources: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            for query_template in _SIGNAL_QUERIES:
                query = query_template.format(company=company_name)
                resp = await http.get(
                    f"https://html.duckduckgo.com/html/?q={query}",
                    headers={"User-Agent": "Mozilla/5.0 (FireReach Bot)"},
                )
                if resp.status_code == 200:
                    snippets = re.findall(
                        r'class="result__snippet">(.*?)</a>', resp.text, re.DOTALL
                    )
                    for snippet in snippets[:2]:
                        clean = re.sub(r"<.*?>", "", snippet).strip()
                        if clean and len(clean) > 20:
                            signals.append(clean)
                            sources.append("DuckDuckGo")
                if len(signals) >= 5:
                    break
    except Exception as exc:
        logger.debug("DuckDuckGo scrape failed: %s", exc)
    return signals, sources


async def _fetch_reddit(company_name: str) -> tuple[list[str], list[str]]:
    signals: list[str] = []
    sources: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(
                "https://www.reddit.com/search.json",
                params={"q": company_name, "sort": "new", "limit": 5, "type": "link"},
                headers={"User-Agent": "FireReach/1.0 (signal harvester)"},
            )
            if resp.status_code == 200:
                data = resp.json()
                for post in data.get("data", {}).get("children", [])[:5]:
                    title = post["data"].get("title", "")
                    if company_name.lower() in title.lower() and len(title) > 20:
                        signals.append(title)
                        sources.append("Reddit")
    except Exception as exc:
        logger.debug("Reddit fetch failed: %s", exc)
    return signals, sources


async def _fetch_github(company_name: str) -> tuple[list[str], list[str]]:
    signals: list[str] = []
    sources: list[str] = []
    try:
        slug = re.sub(r"[^a-z0-9-]", "", company_name.lower().replace(" ", "-"))
        async with httpx.AsyncClient(
            timeout=10,
            headers={"User-Agent": "FireReach/1.0", "Accept": "application/vnd.github+json"},
        ) as http:
            resp = await http.get(f"https://api.github.com/orgs/{slug}")
            if resp.status_code == 200:
                data = resp.json()
                pub_repos = data.get("public_repos", 0)
                followers = data.get("followers", 0)
                if pub_repos > 0:
                    signals.append(f"{company_name} has {pub_repos} public repositories on GitHub")
                    sources.append("GitHub")
                if followers > 50:
                    signals.append(f"{company_name} GitHub org has {followers:,} followers")
                    sources.append("GitHub")
    except Exception as exc:
        logger.debug("GitHub fetch failed: %s", exc)
    return signals, sources


async def _fetch_linkedin(company_name: str) -> tuple[list[str], list[str]]:
    signals: list[str] = []
    sources: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(
                f"https://html.duckduckgo.com/html/?q={company_name}+site:linkedin.com/jobs",
                headers={"User-Agent": "Mozilla/5.0 (FireReach Bot)"},
            )
            if resp.status_code == 200:
                snippets = re.findall(
                    r'class="result__snippet">(.*?)</a>', resp.text, re.DOTALL
                )
                for snippet in snippets[:3]:
                    clean = re.sub(r"<.*?>", "", snippet).strip()
                    if clean and len(clean) > 20:
                        signals.append(clean)
                        sources.append("LinkedIn")
    except Exception as exc:
        logger.debug("LinkedIn fetch failed: %s", exc)
    return signals, sources


async def _fetch_wikipedia(company_name: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            resp = await http.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{company_name}",
                headers={"User-Agent": "FireReach/1.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                extract = data.get("extract", "")
                sentences = [s.strip() for s in extract.split(". ") if s.strip()]
                return ". ".join(sentences[:3]) + "." if sentences else ""
    except Exception as exc:
        logger.debug("Wikipedia fetch failed: %s", exc)
    return ""


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
        f"Headlines:\n{raw_text}\n\nSignals:\n"
    )

    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=300,
    )

    cleaned = []
    text = response.choices[0].message.content or ""
    for line in text.strip().split("\n"):
        line = re.sub(r"^\d+[\.\)]\s*", "", line.strip()).lstrip("•-* ")
        if len(line) >= 10 and company_name.lower() in line.lower():
            cleaned.append(line)
    return cleaned[:5]


async def tool_signal_harvester(company_name: str) -> dict:
    all_raw: list[str] = []
    all_raw_sources: list[str] = []

    logger.info("  Querying Google News for %s", company_name)
    sigs, srcs = await _fetch_google_news(company_name)
    all_raw.extend(sigs)
    all_raw_sources.extend(srcs)

    if len(all_raw) < 3:
        logger.info("  Querying DuckDuckGo for %s", company_name)
        sigs, srcs = await _fetch_duckduckgo(company_name)
        all_raw.extend(sigs)
        all_raw_sources.extend(srcs)

    logger.info("  Querying Reddit for %s", company_name)
    sigs, srcs = await _fetch_reddit(company_name)
    all_raw.extend(sigs)
    all_raw_sources.extend(srcs)

    logger.info("  Querying GitHub for %s", company_name)
    gh_sigs, gh_srcs = await _fetch_github(company_name)

    logger.info("  Querying LinkedIn for %s", company_name)
    li_sigs, li_srcs = await _fetch_linkedin(company_name)

    seen: set[str] = set()
    unique_raw, unique_srcs = [], []
    for s, src in zip(all_raw, all_raw_sources):
        key = s.lower().strip()
        if key not in seen:
            seen.add(key)
            unique_raw.append(s)
            unique_srcs.append(src)

    unique_raw = unique_raw[:8]

    logger.info("  Cleaning %d raw signal(s)", len(unique_raw))
    cleaned = await _clean_signals(company_name, unique_raw)

    for s, src in zip(gh_sigs + li_sigs, gh_srcs + li_srcs):
        if s.lower() not in seen and len(cleaned) < 5:
            seen.add(s.lower())
            cleaned.append(s)
            unique_srcs.append(src)

    cleaned = cleaned[:5]

    sources_used: list[str] = []
    for src in unique_srcs + gh_srcs + li_srcs:
        if src not in sources_used:
            sources_used.append(src)

    logger.info("  %d signal(s) from: %s", len(cleaned), ", ".join(sources_used) or "web")

    logger.info("  Fetching Wikipedia facts for %s", company_name)
    wiki_facts = await _fetch_wikipedia(company_name)

    return {
        "company": company_name,
        "signals": cleaned,
        "sources_used": sources_used,
        "wiki_facts": wiki_facts,
    }


async def tool_research_analyst(
    icp: str,
    signals: list[str],
    wiki_facts: str = "",
) -> dict:
    client = _get_llm_client()

    signals_text = "\n".join(f"- {s}" for s in signals)
    wiki_section = f"\nCompany Background: {wiki_facts}\n" if wiki_facts else ""

    prompt = (
        "You are a senior sales research analyst. Do two things:\n\n"
        "PART 1 — Adapted ICP:\n"
        "Rewrite the base ICP into a single sharp sentence tailored specifically to this "
        "company's current signals. Make it feel timely, not generic.\n\n"
        "PART 2 — Account Brief:\n"
        "Write exactly 2 paragraphs:\n"
        "Paragraph 1: What these growth signals reveal about the company's trajectory. "
        "Reference the actual signals by name.\n"
        "Paragraph 2: Why the adapted ICP solution is strategically relevant right now. "
        "Connect signals to a clear pain point.\n\n"
        "Output format — use these exact labels:\n"
        "ADAPTED ICP: <one sentence>\n\n"
        "ACCOUNT BRIEF:\n<paragraph 1>\n\n<paragraph 2>\n\n"
        "Rules:\n"
        "- No headers, bullets, or filler phrases\n"
        "- Be concise and actionable\n\n"
        f"Base ICP: {icp}\n"
        f"{wiki_section}"
        f"Growth Signals:\n{signals_text}"
    )

    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=600,
    )

    text = (response.choices[0].message.content or "").strip()

    adapted_icp = icp
    account_brief = text

    adapted_match = re.search(r"ADAPTED ICP:\s*(.+?)(?:\n|$)", text)
    brief_match = re.search(r"ACCOUNT BRIEF:\s*\n([\s\S]+)", text)

    if adapted_match:
        adapted_icp = adapted_match.group(1).strip()
    if brief_match:
        account_brief = brief_match.group(1).strip()

    logger.info("  Adapted ICP: %s", adapted_icp[:80])
    return {"adapted_icp": adapted_icp, "account_brief": account_brief}


async def tool_outreach_automated_sender(
    email: str,
    account_brief: str,
    signals: list[str],
    adapted_icp: str = "",
    sender_name: str = "Parth",
    sender_company: str = "",
    sender_role: str = "",
    send_immediately: bool = True,
) -> dict:
    client = _get_llm_client()

    signals_text = "\n".join(f"- {s}" for s in signals)

    sign_off = f"Best regards,\n{sender_name}"
    if sender_role and sender_company:
        sign_off += f"\n{sender_role}\n{sender_company}"
    elif sender_role:
        sign_off += f"\n{sender_role}"
    elif sender_company:
        sign_off += f"\n{sender_company}"

    icp_line = f"Value Proposition: {adapted_icp}\n\n" if adapted_icp else ""

    prompt = (
        "You are a senior B2B sales executive writing a formal, high-quality outreach email.\n\n"
        "Rules:\n"
        "1. First line must be the subject line in this exact format: Subject: <subject text>\n"
        "2. Open with 'Dear [relevant title or team],'\n"
        "3. First sentence: reference a specific growth signal naturally and professionally\n"
        "4. Second paragraph: use the value proposition to connect that signal to a clear business problem\n"
        "5. Third paragraph: one crisp, low-friction CTA\n"
        "6. NO placeholders — write complete, real sentences\n"
        "7. Formal but confident — no fluff, no filler\n"
        "8. Body must not exceed 130 words\n"
        f"9. Close with exactly:\n{sign_off}\n\n"
        "Return only the complete email. No commentary.\n\n"
        f"{icp_line}"
        f"Account Brief:\n{account_brief}\n\n"
        f"Growth Signals:\n{signals_text}"
    )

    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=450,
    )

    email_content = (response.choices[0].message.content or "").strip()

    subject = "Outreach from FireReach"
    body = email_content
    lines = email_content.split("\n", 1)
    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0][8:].strip()
        body = lines[1].strip() if len(lines) > 1 else body

    if not send_immediately:
        return {"status": "draft", "email_subject": subject, "email_content": email_content}

    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if smtp_email and smtp_password:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_email
            msg["To"] = email
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_email, smtp_password)
                server.sendmail(smtp_email, email, msg.as_string())

            logger.info("  Email sent via SMTP to %s", email)
        except Exception as exc:
            logger.error("  SMTP send failed: %s", exc)
            return {
                "status": "failed_to_send",
                "email_subject": subject,
                "email_content": email_content,
                "error": str(exc),
            }
    else:
        logger.warning("  SMTP credentials not set. Skipping dispatch.")

    return {"status": "sent", "email_subject": subject, "email_content": email_content}
