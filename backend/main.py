from __future__ import annotations

import asyncio
import json
import logging
import os
import smtplib
import time
from contextlib import asynccontextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from schemas import AgentRequest, AgentResponse, SendEmailRequest
from agent import run_agent

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("firereach")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("FireReach agent is online")
    yield
    logger.info("FireReach shutting down")


app = FastAPI(
    title="FireReach",
    description="Autonomous outreach engine — research a company, generate and send a personalized cold email.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "FireReach"}


@app.post("/run-agent", response_model=AgentResponse)
async def run_agent_endpoint(req: AgentRequest):
    logger.info(
        "/run-agent  company=%s  email=%s  review_first=%s",
        req.company, req.email, req.review_first,
    )
    start = time.perf_counter()

    try:
        result = await run_agent(
            icp=req.icp,
            company=req.company,
            email=req.email,
            sender_name=req.sender_name,
            sender_company=req.sender_company,
            sender_role=req.sender_role,
            review_first=req.review_first,
        )
        logger.info(
            "Done in %.1fs  signals=%d  status=%s",
            time.perf_counter() - start, len(result.signals), result.email_status,
        )
        return result

    except RuntimeError as exc:
        logger.error("Runtime error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Unhandled agent error")
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}")


@app.post("/run-agent-stream")
async def run_agent_stream(req: AgentRequest):
    queue: asyncio.Queue = asyncio.Queue()

    async def on_step(step: str):
        await queue.put({"event": "step", "step": step})

    async def run():
        try:
            result = await run_agent(
                icp=req.icp,
                company=req.company,
                email=req.email,
                sender_name=req.sender_name,
                sender_company=req.sender_company,
                sender_role=req.sender_role,
                review_first=req.review_first,
                on_step=on_step,
            )
            await queue.put({"event": "done", "result": result.model_dump()})
        except Exception as exc:
            logger.exception("Stream agent error")
            await queue.put({"event": "error", "detail": str(exc)})
        finally:
            await queue.put(None)

    asyncio.create_task(run())

    async def event_stream():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


from tools import _build_html_email

@app.post("/send-email")
async def send_email_endpoint(req: SendEmailRequest):
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise HTTPException(status_code=500, detail="SMTP credentials not configured.")

    try:
        body_lines = req.body.split("\n")
        subject_idx = -1
        for i, line in enumerate(body_lines[:5]):
            if line.strip().lower().startswith("subject:"):
                subject_idx = i
                break
                
        if subject_idx >= 0:
            final_body = "\n".join(body_lines[subject_idx + 1:]).strip()
        else:
            final_body = req.body.strip()

        html_body = _build_html_email(final_body, "", "", "")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = req.subject
        msg["From"] = smtp_email
        msg["To"] = req.recipient
        msg.attach(MIMEText(final_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, req.recipient, msg.as_string())

        logger.info("Email sent to %s", req.recipient)
        return {"status": "sent"}

    except Exception as exc:
        logger.error("SMTP send failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"SMTP send failed: {exc}")
