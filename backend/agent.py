from __future__ import annotations

import logging
import os

from tools import (
    tool_signal_harvester,
    tool_research_analyst,
    tool_outreach_automated_sender,
)
from schemas import AgentResponse


logger = logging.getLogger("firereach.agent")


def _check_groq_key():
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(
            "GROQ_API_KEY environment variable is not set. "
            "Get a free key at https://console.groq.com/"
        )


async def run_agent(icp: str, company: str, email: str) -> AgentResponse:
    _check_groq_key()

    logger.info("Step 1: Harvesting signals for %s", company)
    harvest_result = await tool_signal_harvester(company_name=company)
    signals = harvest_result.get("signals", [])
    logger.info("  → %d signal(s) captured", len(signals))

    logger.info("Step 2: Generating account research")
    analyst_result = await tool_research_analyst(icp=icp, signals=signals)
    account_brief = analyst_result.get("account_brief", "")
    logger.info("  → Account brief generated (%d chars)", len(account_brief))

    logger.info("Step 3: Creating personalized outreach")
    sender_result = await tool_outreach_automated_sender(
        email=email,
        account_brief=account_brief,
        signals=signals,
    )
    email_content = sender_result.get("email_content", "")
    email_status = sender_result.get("status", "sent")

    logger.info("Step 4: Sending outreach email to %s", email)
    if email_status == "sent":
        logger.info("  → Email sent successfully")
    else:
        logger.warning("  → Email failed to send, generated draft only")

    return AgentResponse(
        signals=signals,
        account_brief=account_brief,
        email_content=email_content,
        email_status=email_status,
    )
