from __future__ import annotations

import json
import logging
import os
from collections.abc import Awaitable, Callable

from groq import AsyncGroq

from tools import tool_signal_harvester, tool_research_analyst, tool_outreach_automated_sender
from prompts import SYSTEM_PROMPT, build_user_prompt
from schemas import AgentResponse


logger = logging.getLogger("firereach.agent")

LLM_MODEL = "llama-3.3-70b-versatile"

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "tool_signal_harvester",
            "description": (
                "Fetches deterministic live buyer signals for a target company from "
                "Google News, DuckDuckGo, Reddit, and GitHub. Returns growth signals, "
                "sources used, and Wikipedia background facts. Must be called first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "company_name": {
                        "type": "string",
                        "description": "The name of the target company to research",
                    }
                },
                "required": ["company_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tool_research_analyst",
            "description": (
                "Analyzes harvested growth signals against the user's ICP to generate "
                "a 2-paragraph Account Brief. Pass wiki_facts from tool_signal_harvester "
                "output to enrich the brief. Must be called after tool_signal_harvester."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "icp": {
                        "type": "string",
                        "description": "The user's Ideal Customer Profile description",
                    },
                    "signals": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of growth signals from tool_signal_harvester",
                    },
                    "wiki_facts": {
                        "type": "string",
                        "description": "Company background from tool_signal_harvester output (optional)",
                    },
                },
                "required": ["icp", "signals"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tool_outreach_automated_sender",
            "description": (
                "Generates a hyper-personalized cold email and dispatches it. "
                "Must be called last after tool_research_analyst."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Recipient email address",
                    },
                    "account_brief": {
                        "type": "string",
                        "description": "The 2-paragraph account brief from tool_research_analyst",
                    },
                    "signals": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of growth signals from tool_signal_harvester",
                    },
                },
                "required": ["email", "account_brief", "signals"],
            },
        },
    },
]

_TOOL_DISPATCH = {
    "tool_signal_harvester": tool_signal_harvester,
    "tool_research_analyst": tool_research_analyst,
    "tool_outreach_automated_sender": tool_outreach_automated_sender,
}


async def run_agent(
    icp: str,
    company: str,
    email: str,
    sender_name: str = "Parth",
    sender_company: str = "",
    sender_role: str = "",
    review_first: bool = False,
    on_step: Callable[[str], Awaitable[None]] | None = None,
) -> AgentResponse:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY environment variable is not set. "
            "Get a free key at https://console.groq.com/"
        )

    client = AsyncGroq(api_key=api_key)

    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": build_user_prompt(
                icp=icp,
                company=company,
                email=email,
                sender_name=sender_name,
                sender_company=sender_company,
                sender_role=sender_role,
            ),
        },
    ]

    signals: list[str] = []
    sources_used: list[str] = []
    wiki_facts: str = ""
    adapted_icp: str = ""
    account_brief: str = ""
    email_subject: str = ""
    email_content: str = ""
    email_status: str = "sent"

    for iteration in range(6):
        logger.info("Agent loop iteration %d", iteration + 1)

        response = await client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=2048,
        )

        assistant_message = response.choices[0].message

        msg_dict: dict = {"role": "assistant", "content": assistant_message.content or ""}
        if assistant_message.tool_calls:
            msg_dict["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in assistant_message.tool_calls
            ]
        messages.append(msg_dict)

        if not assistant_message.tool_calls:
            logger.info("Agent pipeline complete")
            break

        for tool_call in assistant_message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            logger.info("Agent calling: %s  args=%s", fn_name, list(fn_args.keys()))

            if on_step:
                step_map = {
                    "tool_signal_harvester": "signals",
                    "tool_research_analyst": "research",
                    "tool_outreach_automated_sender": "compose",
                }
                if fn_name in step_map:
                    await on_step(step_map[fn_name])

            if fn_name == "tool_research_analyst" and wiki_facts:
                fn_args.setdefault("wiki_facts", wiki_facts)

            if fn_name == "tool_outreach_automated_sender":
                fn_args["sender_name"] = sender_name
                fn_args["sender_company"] = sender_company
                fn_args["sender_role"] = sender_role
                fn_args["send_immediately"] = not review_first
                if adapted_icp:
                    fn_args.setdefault("adapted_icp", adapted_icp)

            if fn_name not in _TOOL_DISPATCH:
                tool_result = {"error": f"Unknown tool: {fn_name}"}
            else:
                tool_result = await _TOOL_DISPATCH[fn_name](**fn_args)

            if fn_name == "tool_signal_harvester":
                signals = tool_result.get("signals", [])
                sources_used = tool_result.get("sources_used", [])
                wiki_facts = tool_result.get("wiki_facts", "")
                logger.info("  %d signal(s), sources: %s", len(signals), sources_used)

            elif fn_name == "tool_research_analyst":
                adapted_icp = tool_result.get("adapted_icp", icp)
                account_brief = tool_result.get("account_brief", "")
                logger.info("  Adapted ICP: %s", adapted_icp[:60])
                logger.info("  Account brief: %d chars", len(account_brief))

            elif fn_name == "tool_outreach_automated_sender":
                email_subject = tool_result.get("email_subject", "")
                email_content = tool_result.get("email_content", "")
                email_status = tool_result.get("status", "sent")
                logger.info("  Email status: %s", email_status)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result),
                }
            )

    return AgentResponse(
        signals=signals,
        sources_used=sources_used,
        wiki_facts=wiki_facts,
        adapted_icp=adapted_icp,
        account_brief=account_brief,
        email_subject=email_subject,
        email_content=email_content,
        email_status=email_status,
    )
