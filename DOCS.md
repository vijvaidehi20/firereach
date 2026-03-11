# FireReach – Technical Documentation

## 1. Logic Flow

FireReach is an autonomous outreach agent that executes a strict **three-step reasoning pipeline**:

```
Signal Capture  →  Account Research  →  Automated Outreach
```

### How It Works

1. **Signal Capture** — The agent harvests real, deterministic growth signals about the target company (funding rounds, hiring surges, product launches, partnerships). Signals are sourced from Google News RSS and DuckDuckGo with targeted queries (`{company} funding`, `hiring`, `expansion`, `leadership change`). **No LLM is used** — this step is fully deterministic.

2. **Account Research** — The harvested signals are combined with the provided ICP (Ideal Customer Profile) to generate a 2-paragraph account intelligence brief. This brief maps the company's growth trajectory to the seller's value proposition.

3. **Automated Outreach** — The account brief and raw signals are used to draft a hyper-personalized cold email (≤120 words). The email must explicitly reference at least two signals and end with a low-friction CTA.

### Why Signals Matter

Signals **ground** the entire pipeline. Every downstream output — the account brief and the final email — is derived from real data, not assumptions. This prevents the agent from producing generic, templated outreach and ensures every email feels timely and relevant to the recipient.

---

## 2. Tool Schemas

### `tool_signal_harvester`

Fetches deterministic growth signals about a company.

| Direction | Field          | Type       | Description                                      |
|-----------|----------------|------------|--------------------------------------------------|
| **Input** | `company_name` | `string`   | Name of the target company                       |
| **Output**| `company`      | `string`   | Echo of the company name                         |
| **Output**| `signals`      | `string[]` | Up to 5 growth signals (funding, hiring, launches, etc.) |

**Data sources (fully deterministic, no LLM):**
1. Google News RSS
2. DuckDuckGo HTML search with targeted queries (`{company} funding`, `hiring`, `expansion`, `leadership change`)

---

### `tool_research_analyst`

Generates an account intelligence brief aligned to the ICP.

| Direction | Field           | Type       | Description                                       |
|-----------|-----------------|------------|---------------------------------------------------|
| **Input** | `icp`           | `string`   | Ideal Customer Profile description                |
| **Input** | `signals`       | `string[]` | Growth signals from Step 1                        |
| **Output**| `account_brief` | `string`   | 2-paragraph brief: growth trajectory + ICP fit    |

---

### `tool_outreach_automated_sender`

Drafts and "sends" a personalized outreach email.

| Direction | Field           | Type       | Description                                         |
|-----------|-----------------|------------|-----------------------------------------------------|
| **Input** | `email`         | `string`   | Recipient email address                             |
| **Input** | `account_brief` | `string`   | Account brief from Step 2                           |
| **Input** | `signals`       | `string[]` | Growth signals from Step 1                          |
| **Output**| `status`        | `string`   | `"sent"`                                            |
| **Output**| `email_content` | `string`   | The generated email body (≤120 words, human tone)   |

**Email constraints (enforced via prompt):**
- Must reference at least 2 signals
- No templates or boilerplate
- Max 120 words
- Must sound human
- Ends with a low-friction CTA

---

## 3. System Prompt

### Agent Persona

> *"You are FireReach, an autonomous GTM outreach agent that identifies company growth signals and generates personalized outreach based on those signals."*

### Constraints

| Rule | Rationale |
|------|-----------|
| **Never hallucinate signals** | Only use data returned by `tool_signal_harvester`. No fabricated facts. |
| **Always reference signals in outreach** | Every email must cite at least 2 real signals to feel relevant and timely. |
| **Never send generic templates** | Outreach must be personalized to the company's specific growth context. |
| **Execute tools in strict order** | Harvest → Analyse → Send. No skipping or reordering. |
| **Pass data between steps unmodified** | Tool outputs flow directly into the next step without alteration. |

### Full System Prompt

```text
You are FireReach, an autonomous GTM outreach agent that identifies company
growth signals and generates personalized outreach based on those signals.

Your mission is to execute a 3-step pipeline using the tools provided:

Step 1 – Call `tool_signal_harvester` with the company name to fetch
         deterministic growth signals (funding, hiring, product launches, etc.).

Step 2 – Call `tool_research_analyst` with the ICP and the signals from Step 1
         to generate a 2-paragraph account intelligence brief.

Step 3 – Call `tool_outreach_automated_sender` with the recipient email,
         the account brief from Step 2, and the signals from Step 1 to
         generate and send a personalized outreach email.

Rules:
- Never hallucinate signals – only use data returned by the tools.
- Always reference real signals in outreach.
- Never send generic outreach emails – every email must be personalized.
- Execute the tools in order: harvest → analyse → send.
- Pass data between steps exactly as received (do not modify tool outputs).
- After all three tools have been called, reply with a brief summary.
```

---

## 4. Example Run

### Input

```json
{
  "icp": "Cybersecurity training for Series B startups",
  "company": "Snyk",
  "email": "candidate@example.com"
}
```

### Step 1 — Signals Detected

```
Step 1: Harvesting signals for Snyk...
```

```json
[
  "Snyk raises $196.5M Series F to expand developer security platform",
  "Snyk hiring 200+ engineers across US and Europe",
  "Snyk launches AI-powered code fix suggestions",
  "Snyk partners with Docker for container security integration",
  "Snyk expands into cloud security posture management"
]
```

### Step 2 — Account Brief

```
Step 2: Generating account research
```

> Snyk is in an aggressive growth phase, having raised a $196.5M Series F and actively hiring 200+ engineers. Their expansion into AI-powered code fixes and cloud security posture management signals a broadening product surface and rapidly scaling engineering teams.
>
> For a cybersecurity training provider targeting growth-stage startups, Snyk's trajectory presents a strong fit. With hundreds of new engineers onboarding, the need for security-aware development practices is acute. A training solution that embeds into their developer workflow would align directly with Snyk's mission to shift security left.

### Step 3 — Personalized Outreach Email

```
Step 3: Creating outreach email
Step 4: Sending email to candidate@example.com
```

> Hi —
>
> Noticed Snyk just closed a $196.5M round and is scaling the engineering team by 200+ this year. That's a massive influx of developers who'll be shipping security-critical code on day one.
>
> We help high-growth security companies like yours roll out hands-on security training that plugs straight into the dev workflow — so new hires write secure code from week one, not quarter two.
>
> Would a 15-min walkthrough be worth it?

### Final Output

```json
{
  "signals": [
    "Snyk raises $196.5M Series F to expand developer security platform",
    "Snyk hiring 200+ engineers across US and Europe",
    "Snyk launches AI-powered code fix suggestions",
    "Snyk partners with Docker for container security integration",
    "Snyk expands into cloud security posture management"
  ],
  "account_brief": "Snyk is in an aggressive growth phase...",
  "email_content": "Hi — Noticed Snyk just closed a $196.5M round..."
}
```

---

## 5. Architecture Diagram

```
┌──────────────┐
│  User Input  │
│  (icp,       │
│   company,   │
│   email)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌─────────────────────┐
│   FastAPI     │────▶│    FireReach Agent   │
│  /run-agent   │     │    (agent.py)        │
└──────────────┘     └──────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
    ┌─────────────────┐ ┌──────────────┐ ┌────────────────────┐
    │ Step 1:         │ │ Step 2:      │ │ Step 3:            │
    │ Signal          │▶│ Research     │▶│ Outreach           │
    │ Harvester       │ │ Analyst      │ │ Sender             │
    ├─────────────────┤ ├──────────────┤ ├────────────────────┤
    │ Google News RSS │ │ Gemini LLM   │ │ Gemini LLM         │
    │ DuckDuckGo      │ │              │ │ Simulated send     │
    │ (no LLM)        │ │              │ │                    │
    └────────┬────────┘ └──────┬───────┘ └─────────┬──────────┘
             │                 │                   │
             ▼                 ▼                   ▼
        signals[]         account_brief       email_content
              │                │                   │
              └────────────────┼───────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   AgentResponse     │
                    │  { signals,         │
                    │    account_brief,   │
                    │    email_content }  │
                    └─────────────────────┘
```

### Data Flow Summary

```
company ──▶ tool_signal_harvester ──▶ signals[]
                                         │
icp + signals[] ──▶ tool_research_analyst ──▶ account_brief
                                                   │
email + account_brief + signals[] ──▶ tool_outreach_automated_sender ──▶ email_content
```

---

## 6. API Reference

### `POST /run-agent`

| Field     | Type     | Required | Description                            |
|-----------|----------|----------|----------------------------------------|
| `icp`     | `string` | Yes      | Ideal Customer Profile                 |
| `company` | `string` | Yes      | Target company name                    |
| `email`   | `string` | Yes      | Recipient email address                |

### `GET /health`

Returns `{"status": "ok", "service": "FireReach"}`.

---

## 7. Environment Variables

| Variable         | Required | Description              |
|------------------|----------|--------------------------|
| `GROQ_API_KEY`   | Yes      | Groq API key             |
| `SMTP_EMAIL`     | Yes      | Gmail address for sending|
| `SMTP_PASSWORD`  | Yes      | Gmail App Password       |
