from typing import List

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    icp: str = Field(
        ...,
        description="Ideal Customer Profile – describes the target persona",
        examples=["Series-A B2B SaaS founders scaling from 1M to 5M ARR"],
    )
    company: str = Field(
        ...,
        description="Target company name to research",
        examples=["Acme Corp"],
    )
    email: str = Field(
        ...,
        description="Recipient email address for the outreach",
        examples=["founder@acme.com"],
    )


class AgentResponse(BaseModel):
    signals: List[str] = Field(default_factory=list)
    account_brief: str = ""
    email_content: str = ""
    email_status: str = "sent"
