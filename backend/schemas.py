from __future__ import annotations

from typing import List
from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    icp: str = Field(..., description="Ideal Customer Profile")
    company: str = Field(..., description="Target company name")
    email: str = Field(..., description="Recipient email address")
    sender_name: str = Field(default="Parth", description="Sender's full name")
    sender_company: str = Field(default="", description="Sender's company name")
    sender_role: str = Field(default="", description="Sender's job title/role")
    review_first: bool = Field(default=False, description="If True, skip SMTP and return draft only")


class SendEmailRequest(BaseModel):
    recipient: str
    subject: str
    body: str


class AgentResponse(BaseModel):
    signals: List[str] = Field(default_factory=list)
    sources_used: List[str] = Field(default_factory=list)
    wiki_facts: str = ""
    adapted_icp: str = ""
    account_brief: str = ""
    email_subject: str = ""
    email_content: str = ""
    email_status: str = "sent"  # "sent" | "draft" | "failed_to_send"
