from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlparse

from groq import AsyncGroq
from tavily import TavilyClient


logger = logging.getLogger("firereach.tools")

_llm_client: AsyncGroq | None = None
_tavily_client: TavilyClient | None = None
LLM_MODEL = "llama-3.3-70b-versatile"

_SOURCE_DOMAIN_MAP = {
    "reddit.com": "Reddit",
    "github.com": "GitHub",
    "linkedin.com": "LinkedIn",
    "x.com": "X (Twitter)",
    "twitter.com": "X (Twitter)",
    "news.google.com": "Google News",
    "reuters.com": "Reuters",
    "bloomberg.com": "Bloomberg",
    "techcrunch.com": "TechCrunch",
    "crunchbase.com": "Crunchbase",
    "forbes.com": "Forbes",
    "wikipedia.org": "Wikipedia",
}


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


def _get_tavily_client() -> TavilyClient:
    global _tavily_client
    if _tavily_client is None:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            raise RuntimeError(
                "TAVILY_API_KEY environment variable is not set. "
                "Get a free key at https://app.tavily.com/"
            )
        _tavily_client = TavilyClient(api_key=api_key)
    return _tavily_client


def _source_from_url(url: str) -> str:
    try:
        domain = urlparse(url).netloc.lower().removeprefix("www.")
        for pattern, label in _SOURCE_DOMAIN_MAP.items():
            if pattern in domain:
                return label
        return domain.split(".")[0].capitalize()
    except Exception:
        return "Web"


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
        line = re.sub(r"^\d+[\.\\)]\s*", "", line.strip()).lstrip("•-* ")
        if len(line) >= 10 and company_name.lower() in line.lower():
            cleaned.append(line)
    return cleaned[:5]


async def tool_signal_harvester(company_name: str) -> dict:
    tavily = _get_tavily_client()
    all_raw: list[str] = []
    all_sources: list[str] = []
    news_resp: dict = {}
    general_resp: dict = {}

    # --- Tavily news search: recent buyer signals ---
    logger.info("  Tavily news search for %s", company_name)
    try:
        news_resp = tavily.search(
            query=f"{company_name} funding OR hiring OR expansion OR product launch OR partnership",
            topic="news",
            time_range="month",
            max_results=10,
            include_answer=True,
        )
        for result in news_resp.get("results", []):
            title = result.get("title", "").strip()
            content = result.get("content", "").strip()
            url = result.get("url", "")
            source = _source_from_url(url)

            if title and company_name.lower() in title.lower():
                all_raw.append(title)
                all_sources.append(source)
            elif content and len(content) > 20:
                snippet = content[:150].rsplit(" ", 1)[0]
                all_raw.append(snippet)
                all_sources.append(source)
    except Exception as exc:
        logger.warning("  Tavily news search failed: %s", exc)

    # --- Tavily general search: broader context ---
    logger.info("  Tavily general search for %s", company_name)
    try:
        general_resp = tavily.search(
            query=f"{company_name} growth strategy leadership recent developments",
            search_depth="advanced",
            max_results=5,
            include_answer=True,
        )
        for result in general_resp.get("results", []):
            title = result.get("title", "").strip()
            content = result.get("content", "").strip()
            url = result.get("url", "")
            source = _source_from_url(url)

            text = title if (title and company_name.lower() in title.lower()) else ""
            if not text and content and len(content) > 20:
                text = content[:150].rsplit(" ", 1)[0]

            if text and text.lower() not in {s.lower() for s in all_raw}:
                all_raw.append(text)
                all_sources.append(source)
    except Exception as exc:
        logger.warning("  Tavily general search failed: %s", exc)

    # --- Deduplicate ---
    seen: set[str] = set()
    unique_raw, unique_srcs = [], []
    for s, src in zip(all_raw, all_sources):
        key = s.lower().strip()
        if key not in seen:
            seen.add(key)
            unique_raw.append(s)
            unique_srcs.append(src)

    unique_raw = unique_raw[:10]
    logger.info("  %d unique raw signal(s) collected", len(unique_raw))

    # --- Clean signals via LLM ---
    logger.info("  Cleaning %d raw signal(s)", len(unique_raw))
    cleaned = await _clean_signals(company_name, unique_raw)
    cleaned = cleaned[:5]

    # --- Collect unique source labels ---
    sources_used: list[str] = []
    for src in unique_srcs:
        if src not in sources_used:
            sources_used.append(src)

    logger.info("  %d signal(s) from: %s", len(cleaned), ", ".join(sources_used) or "Tavily")

    # --- Wiki facts from Tavily answer or Wikipedia API fallback ---
    wiki_facts = ""
    for resp in [news_resp, general_resp]:
        answer = resp.get("answer", "")
        if answer and len(answer) > 50:
            wiki_facts = answer
            break

    if not wiki_facts:
        logger.info("  Falling back to Wikipedia API for %s", company_name)
        try:
            import httpx
            async with httpx.AsyncClient(timeout=8) as http:
                resp = await http.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{company_name}",
                    headers={"User-Agent": "FireReach/1.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    extract = data.get("extract", "")
                    sentences = [s.strip() for s in extract.split(". ") if s.strip()]
                    wiki_facts = ". ".join(sentences[:3]) + "." if sentences else ""
        except Exception as exc:
            logger.debug("  Wikipedia fallback failed: %s", exc)

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


def _build_html_email(body_text: str, sender_name: str, sender_role: str, sender_company: str) -> str:
    paragraphs = [p.strip() for p in body_text.split("\n") if p.strip()]

    body_html_parts = []
    sign_off_started = False

    for para in paragraphs:
        if para.lower().startswith(("best regards", "kind regards", "warm regards", "sincerely", "cheers")):
            sign_off_started = True

        if sign_off_started:
            body_html_parts.append(
                f'<p style="margin:0 0 2px 0;font-size:15px;line-height:1.5;color:#1d1d1f;">{para}</p>'
            )
        else:
            body_html_parts.append(
                f'<p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#1d1d1f;">{para}</p>'
            )

    body_html = "\n".join(body_html_parts)

    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:36px 36px 32px 36px;">
              {body_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
        "Structure (each section MUST be separated by a blank line):\n"
        "1. First line: Subject: <concise, professional subject>\n"
        "2. Blank line\n"
        "3. Greeting: Dear [relevant title or team],\n"
        "4. Blank line\n"
        "5. Opening paragraph (2-3 sentences): reference a specific growth signal naturally\n"
        "6. Blank line\n"
        "7. Value paragraph (2-3 sentences): connect the signal to a clear business problem "
        "and position your solution\n"
        "8. Blank line\n"
        "9. CTA paragraph (1-2 sentences): one crisp, low-friction call to action\n"
        "10. Blank line\n"
        f"11. Sign-off (exactly):\n{sign_off}\n\n"
        "Rules:\n"
        "- NO placeholders — write complete, real sentences\n"
        "- Formal but confident — no fluff, no filler\n"
        "- Body must not exceed 130 words (excluding subject and sign-off)\n"
        "- ALWAYS separate paragraphs with a blank line\n"
        "- Return only the complete email. No commentary.\n\n"
        f"{icp_line}"
        f"Account Brief:\n{account_brief}\n\n"
        f"Growth Signals:\n{signals_text}"
    )

    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=500,
    )

    email_content = (response.choices[0].message.content or "").strip()

    subject = "Outreach from FireReach"
    body_lines = email_content.split("\n")
    subject_idx = -1

    for i, line in enumerate(body_lines[:5]):
        if line.strip().lower().startswith("subject:"):
            subject = line.strip()[8:].strip()
            subject_idx = i
            break

    if subject_idx >= 0:
        body = "\n".join(body_lines[subject_idx + 1:]).strip()
    else:
        body = email_content

    if not send_immediately:
        return {"status": "draft", "email_subject": subject, "email_content": email_content}

    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if smtp_email and smtp_password:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        try:
            html_body = _build_html_email(body, sender_name, sender_role, sender_company)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_email
            msg["To"] = email
            msg.attach(MIMEText(body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

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
