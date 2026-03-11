# FireReach 🔥

**Autonomous signal-driven outreach engine** — captures live buyer signals for a company, reasons through them against your ICP, and automatically sends a hyper-personalized cold email.

Built with **FastAPI · Gemini · Next.js · Function-Calling Architecture**

---

## Architecture

```
User Input → FastAPI → Agent Loop → 3 Sequential Tools → Response
                          ↑               |
                          └── Gemini ─────┘
```

| Step | Tool                           | Type           | Purpose                              |
|------|--------------------------------|----------------|--------------------------------------|
| 1    | `tool_signal_harvester`        | Deterministic  | Fetch live growth signals (no LLM)   |
| 2    | `tool_research_analyst`        | LLM reasoning  | Generate 2-paragraph account brief   |
| 3    | `tool_outreach_automated_sender` | LLM + dispatch | Write & "send" personalized email  |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Gemini API key](https://aistudio.google.com/) (free)

### 1. Clone & setup backend

```bash
cd fireReach

# Create virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate          # Windows

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY, SMTP_EMAIL, and SMTP_PASSWORD
```

### 3. Start backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** → fill in Company, Email, ICP → hit **Run FireReach Agent**.

### 5. Test via curl (optional)

```bash
curl -X POST http://localhost:8000/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "icp": "We sell high-end cybersecurity training to Series B startups",
    "company": "Snyk",
    "email": "candidate@example.com"
  }'
```

---

## Project Structure

```
fireReach/
├── backend/
│   ├── main.py          # FastAPI app & /run-agent endpoint
│   ├── agent.py          # Sequential agent loop (3 tool calls)
│   ├── tools.py          # Tool definitions + implementations
│   ├── prompts.py        # System & user prompt templates
│   └── schemas.py        # Pydantic request/response models
├── frontend/
│   └── app/
│       ├── layout.js     # Root layout + metadata
│       ├── page.js       # Main UI (form → results)
│       └── globals.css   # Dark theme design system
├── .env.example
├── requirements.txt
├── DOCS.md               # Full agent documentation
└── README.md
```

---

## Environment Variables

| Variable         | Required | Description                                           |
|------------------|----------|-------------------------------------------------------|
| `GROQ_API_KEY`   | Yes      | Groq API key for LLM generation ([get free](https://console.groq.com/)) |
| `SMTP_EMAIL`     | Yes      | Gmail address used for sending automated outreach emails |
| `SMTP_PASSWORD`  | Yes      | Gmail App Password (not normal password) for SMTP dispatch |

For the frontend, set `NEXT_PUBLIC_API_URL` if your backend is not at `http://localhost:8000`.

---

## Deployment

### Backend (Render)

1. Create a new **Web Service** on [render.com](https://render.com).
2. Point to this repo, set root directory to `fireReach`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env vars: `GROQ_API_KEY`, `SMTP_EMAIL`, `SMTP_PASSWORD`

### Frontend (Vercel)

1. Import repo on [vercel.com](https://vercel.com).
2. Set root directory to `fireReach/frontend`.
3. Add env var: `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com`

---

## Tech Stack

| Layer    | Technology                |
|----------|---------------------------|
| API      | FastAPI + Uvicorn         |
| LLM      | Groq (llama-3.3-70b)      |
| Email    | Python smtplib (Gmail)    |
| Frontend | Next.js 16 (App Router)   |
| Schemas  | Pydantic v2               |
| Signals  | Google News + DuckDuckGo  |

---

## Documentation

See [DOCS.md](./DOCS.md) for full agent documentation:
- Logic flow & signal grounding
- Tool schemas with input/output specs
- System prompt & constraints
- Example run with Snyk
- Architecture diagram

---

## License

MIT
