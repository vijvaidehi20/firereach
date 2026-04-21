# FireReach

Autonomous signal-driven outreach engine. Captures live buyer signals for a target company, reasons through them against your ICP, and sends a hyper-personalized cold email — all in one agent loop.

Built with **FastAPI · Groq (Llama 3.3) · Tavily Search API · Next.js · Groq Function Calling**

---

## How it works

```
User Input → FastAPI → Agent Loop (Groq function calling) → 3 Tools → Email Sent
```

The agent uses Groq's function calling API. The LLM decides which tool to call and passes arguments; the backend executes each tool and feeds results back into the conversation until the full pipeline completes.

| Step | Tool | What it does |
|------|------|--------------|
| 1 | `tool_signal_harvester` | Fetches live growth signals via Tavily Search API (news + general web), then cleans them into buyer-intent signals via LLM |
| 2 | `tool_research_analyst` | Adapts your base ICP to this specific company's signals and writes a 2-paragraph account brief |
| 3 | `tool_outreach_automated_sender` | Writes a personalized cold email using the adapted ICP and sends it via SMTP |

---

## Features

- **Live signal harvesting** — Tavily Search API (news + general search), with source-level tagging inferred from result URLs (e.g. Reuters, TechCrunch, LinkedIn, Reddit, GitHub, etc.)
- **Smart ICP adaptation** — AI rewrites your base ICP into a company-specific value proposition based on live signals
- **Batch mode** — run the full pipeline against multiple companies at once, each with their own recipient email
- **Review before sending** — generate a draft first, edit it, then send
- **Editable email** — modify the generated email directly in the browser before dispatch
- **Copy / Export** — copy to clipboard or download as `.txt`
- **Run history** — last 15 runs saved to localStorage, click any to restore
- **Sender persona** — configure your name, company, and role; persisted in the browser
- **Source badges** — each signal is tagged with the source it came from

---

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Groq API key](https://console.groq.com/) (free tier is sufficient)
- [Tavily API key](https://app.tavily.com/) (free tier: 1,000 credits/month)
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords) enabled

### 1. Clone and set up the backend

```bash
python -m venv venv
source venv/bin/activate       # macOS / Linux
# venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
# Fill in your keys in backend/.env
```

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com/) |
| `TAVILY_API_KEY` | From [app.tavily.com](https://app.tavily.com/) |
| `SMTP_EMAIL` | Your Gmail address |
| `SMTP_PASSWORD` | Gmail App Password (not your account password) |

### 3. Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**, fill in the form, and hit **Run Agent**.

---

## Project structure

```
fireReach/
├── backend/
│   ├── main.py       # FastAPI app — /run-agent and /send-email endpoints
│   ├── agent.py      # Agentic loop with Groq function calling
│   ├── tools.py      # Tool implementations: harvester, analyst, sender
│   ├── prompts.py    # System prompt and user prompt builder
│   └── schemas.py    # Pydantic request / response models
├── frontend/
│   └── app/
│       ├── layout.js    # Root layout and metadata
│       ├── page.js      # Full UI — form, results, history, batch mode
│       └── globals.css  # Design system (Apple dark theme)
├── .env.example
├── requirements.txt
└── README.md
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| API | FastAPI + Uvicorn |
| LLM | Groq — llama-3.3-70b-versatile |
| Email dispatch | smtplib — Gmail SMTP with STARTTLS |
| Frontend | Next.js 15 (App Router) |
| Schemas | Pydantic v2 |
| Signal sources | Tavily Search API (news + general) · Wikipedia fallback |

---

## License

MIT
