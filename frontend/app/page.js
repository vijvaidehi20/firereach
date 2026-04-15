"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_PERSONA = { sender_name: "Parth", sender_company: "", sender_role: "" };

const PIPELINE_STEPS = [
  { key: "signals",  title: "Signal Harvester",  desc: "Fetching live buyer intent signals" },
  { key: "research", title: "Research Analyst",   desc: "Generating account intelligence brief" },
  { key: "compose",  title: "Outreach Sender",    desc: "Crafting & dispatching personalized email" },
];

const SIGNAL_CATEGORIES = {
  funding:     { label: "Funding",     color: "var(--accent-blue)",   badgeClass: "badge-blue" },
  hiring:      { label: "Hiring",      color: "var(--accent-green)",  badgeClass: "badge-green" },
  product:     { label: "Product",     color: "var(--accent-purple)", badgeClass: "badge-purple" },
  expansion:   { label: "Expansion",   color: "var(--accent-orange)", badgeClass: "badge-orange" },
  leadership:  { label: "Leadership",  color: "var(--accent-cyan)",   badgeClass: "badge-cyan" },
  partnership: { label: "Partnership", color: "var(--text-secondary)", badgeClass: "badge-muted" },
  general:     { label: "General",     color: "var(--text-muted)",    badgeClass: "badge-muted" },
};

const SOURCE_BADGE = {
  "Google News": "badge-blue",
  "Reddit":      "badge-orange",
  "GitHub":      "badge-green",
  "LinkedIn":    "badge-blue",
  "X (Twitter)": "badge-muted",
  "TechCrunch":  "badge-green",
  "Reuters":     "badge-blue",
  "Bloomberg":   "badge-orange",
  "Crunchbase":  "badge-blue",
  "Forbes":      "badge-purple",
  "Wikipedia":   "badge-muted",
};

function categorizeSignal(text) {
  const t = text.toLowerCase();
  if (/funding|raised|invest|series|capital|valuation|round/.test(t)) return "funding";
  if (/hiring|recruit|job|hire|talent|team|engineer|headcount/.test(t)) return "hiring";
  if (/launch|product|release|feature|platform|ship|announce/.test(t)) return "product";
  if (/expand|expansion|office|market|global|region|open/.test(t)) return "expansion";
  if (/leader|ceo|cto|appoint|executive|board|founder|chief/.test(t)) return "leadership";
  if (/partner|collaborat|integration|alliance|deal/.test(t)) return "partnership";
  return "general";
}

function getRelevanceScore(index, total) {
  if (total <= 1) return 92;
  return Math.round(95 - (index * (38 / (total - 1))));
}

function loadLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Icons ─────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6.5 1L3 7h3l-.5 4L9 5H6l.5-4z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 9.5a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12.2 9.2l.6 1-1.4 1.4-1-.6a5 5 0 01-1 .4l-.2 1.1H7.8l-.2-1.1a5 5 0 01-1-.4l-1 .6L4.2 11.2l.6-1a5 5 0 01-.4-1L3.3 9V7.1l1.1-.2a5 5 0 01.4-1l-.6-1 1.4-1.4 1 .6a5 5 0 011-.4L7.8 3.3H9.2l.2 1.1a5 5 0 011 .4l1-.6 1.4 1.4-.6 1a5 5 0 01.4 1l1.1.2V9l-1.1.2a5 5 0 01-.4 1z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 5l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.5 4.5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v4.5a1 1 0 001 1h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5v7M4 6.5l2.5 2.5L9 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M11.5 1.5L1.5 6l4 1.5 1.5 4 4.5-10z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M8.5 2L4 6.5 8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────

function SettingsModal({ persona, onSave, onClose }) {
  const [local, setLocal] = useState({ ...persona });
  function change(k) { return (e) => setLocal((p) => ({ ...p, [k]: e.target.value })); }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Sender Persona</span>
          <button className="icon-btn" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Your Name</label>
            <input type="text" placeholder="Parth" value={local.sender_name} onChange={change("sender_name")} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Company</label>
              <input type="text" placeholder="Acme Inc" value={local.sender_company} onChange={change("sender_company")} />
            </div>
            <div className="field">
              <label>Role</label>
              <input type="text" placeholder="Account Executive" value={local.sender_role} onChange={change("sender_role")} />
            </div>
          </div>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Used in the email sign-off. Saved to your browser.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" style={{ width: "auto" }} onClick={() => { onSave(local); onClose(); }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Pipeline ──────────────────────────────────────────────────────

function PipelineSidebar({ activeStep, company, loading }) {
  const stepIndex = { signals: 0, research: 1, compose: 2 };
  const current = stepIndex[activeStep] ?? (loading ? 0 : -1);

  return (
    <aside className="sidebar">
      {company && (
        <div className="company-info">
          <div className="company-name">{company}</div>
          <div className="company-meta">Target Company</div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-label">Pipeline</div>
        <div className="pipeline-vertical">
          {PIPELINE_STEPS.map((step, i) => {
            const done = current > i || (!loading && current === -1 && i <= 2);
            const active = current === i && loading;
            const isDone = done && !active;

            return (
              <div className="pipeline-step-v" key={step.key}>
                <div className={`step-circle${isDone ? " done" : active ? " active" : ""}`}>
                  {isDone ? <CheckIcon /> : i + 1}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`step-line${isDone ? " done" : ""}`} />
                )}
                <div className="step-info">
                  <div className={`step-title${isDone ? " done" : active ? " active" : ""}`}>
                    {step.title}
                  </div>
                  <div className="step-desc">{step.desc}</div>
                  {isDone && (
                    <div className="step-status complete">
                      <CheckIcon /> Complete
                    </div>
                  )}
                  {active && (
                    <div className="step-status running">
                      <span className="pulse-dot" /> Running
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ── Signal Card ───────────────────────────────────────────────────────────

function SignalCard({ signal, index, total }) {
  const category = categorizeSignal(signal);
  const catInfo = SIGNAL_CATEGORIES[category];
  const score = getRelevanceScore(index, total);

  return (
    <div className="signal-card" style={{ "--cat-color": catInfo.color }}>
      <div className="signal-card-top">
        <p className="signal-text">{signal}</p>
        <span className={`signal-badge ${catInfo.badgeClass}`}>
          {catInfo.label}
        </span>
      </div>
      <div className="signal-relevance">
        <div className="relevance-track">
          <div className="relevance-fill" style={{ width: `${score}%`, background: catInfo.color }} />
        </div>
        <span className="relevance-score">{score}%</span>
      </div>
    </div>
  );
}

// ── Category Summary ──────────────────────────────────────────────────────

function CategorySummary({ signals }) {
  const counts = {};
  signals.forEach((s) => {
    const cat = categorizeSignal(s);
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  if (entries.length === 0) return null;

  return (
    <div className="category-grid">
      {entries.map(([key, count]) => {
        const catInfo = SIGNAL_CATEGORIES[key];
        return (
          <div className="category-card" key={key}>
            <div className="category-count" style={{ color: catInfo.color }}>{count}</div>
            <div className="category-label">{catInfo.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Signals Tab ───────────────────────────────────────────────────────────

function SignalsTab({ result }) {
  return (
    <div className="fade-up">
      <div className="content-header">
        <div className="content-title">
          {result.company || "Company"} <span>— Intent Signals</span>
        </div>
        <div className="content-meta">
          <span>{result.signals?.length ?? 0} signals harvested</span>
          <span className="meta-dot" />
          <span>Live via Tavily</span>
        </div>
        {result.sources_used?.length > 0 && (
          <div className="sources-row">
            {result.sources_used.map((src) => (
              <span key={src} className={`badge ${SOURCE_BADGE[src] || "badge-muted"}`}>{src}</span>
            ))}
          </div>
        )}
      </div>

      {result.signals?.length > 0 && <CategorySummary signals={result.signals} />}

      {result.signals?.length > 0 ? (
        <div className="signal-list">
          {result.signals.map((s, i) => (
            <SignalCard key={i} signal={s} index={i} total={result.signals.length} />
          ))}
        </div>
      ) : (
        <div className="result-card">
          <div className="result-body">
            <p className="text-muted">No signals detected.</p>
          </div>
        </div>
      )}

      {result.wiki_facts && (
        <div className="wiki-card" style={{ marginTop: 16 }}>
          <div className="wiki-card-label">Background</div>
          {result.wiki_facts}
        </div>
      )}
    </div>
  );
}

// ── Research Tab ──────────────────────────────────────────────────────────

function ResearchTab({ result }) {
  return (
    <div className="fade-up">
      {result.adapted_icp && (
        <div className="result-card" style={{ marginBottom: 12 }}>
          <div className="result-header">
            <span className="result-title">Adapted ICP</span>
            <span className="badge badge-blue">AI tailored</span>
          </div>
          <div className="result-body">
            <p className="adapted-icp-text">{result.adapted_icp}</p>
          </div>
        </div>
      )}

      <div className="result-card">
        <div className="result-header">
          <span className="result-title">Account Brief</span>
        </div>
        <div className="result-body">
          <p className="brief-text">{result.account_brief}</p>
        </div>
      </div>

      {result.wiki_facts && (
        <div className="wiki-card" style={{ marginTop: 12 }}>
          <div className="wiki-card-label">Company Background</div>
          {result.wiki_facts}
        </div>
      )}
    </div>
  );
}

// ── Email Tab ─────────────────────────────────────────────────────────────

function EmailTab({ result, recipientEmail }) {
  const [emailDraft, setEmailDraft] = useState(result.email_content);
  const [emailStatus, setEmailStatus] = useState(result.email_status);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [copied, setCopied] = useState(false);

  const isDraft = emailStatus === "draft";
  const isSent = emailStatus === "sent";
  const isFailed = emailStatus === "failed_to_send";

  function copyEmail() {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportTxt() {
    const blob = new Blob([emailDraft], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firereach-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendEmail() {
    setSending(true);
    setSendError("");
    try {
      const subject = result.email_subject || "Outreach from FireReach";
      const lines = emailDraft.split("\n", 2);
      const body = lines[0].toLowerCase().startsWith("subject:") && lines[1]
        ? emailDraft.split("\n").slice(1).join("\n").trim()
        : emailDraft;

      const res = await fetch(`${API_URL}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipientEmail, subject, body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Send failed");
      }
      setEmailStatus("sent");
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  const statusBadge = isSent
    ? <span className="badge badge-green">Sent</span>
    : isDraft
    ? <span className="badge badge-orange">Draft — review & send</span>
    : <span className="badge badge-red">Failed</span>;

  return (
    <div className="fade-up">
      <div className="result-card">
        <div className="result-header">
          <span className="result-title">Outreach Email</span>
          <div className="result-header-right">{statusBadge}</div>
        </div>
        <div className="result-body">
          {(isFailed || isDraft) && sendError && (
            <div className="error-banner">
              <strong>Send failed</strong>{sendError}
            </div>
          )}
          {result.email_subject && (
            <div className="email-subject-row">
              Subject: <strong>{result.email_subject}</strong>
            </div>
          )}
          <textarea
            className="email-editable"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            spellCheck={false}
          />
          <div className="email-actions">
            {(isDraft || isFailed) && (
              <button className="btn btn-sm flex-row gap-6" style={{ width: "auto" }}
                onClick={sendEmail} disabled={sending}>
                <SendIcon />{sending ? "Sending…" : "Send Email"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm flex-row gap-6" onClick={copyEmail}>
              <CopyIcon />{copied ? "Copied!" : "Copy"}
            </button>
            <button className="btn btn-ghost btn-sm flex-row gap-6" onClick={exportTxt}>
              <DownloadIcon />Export .txt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Batch Result Card ──────────────────────────────────────────────────────

function BatchResultCard({ item }) {
  const [cardTab, setCardTab] = useState("signals");
  const result = { ...item.data, company: item.company };

  const statusBadge = item.data?.email_status === "draft"
    ? <span className="badge badge-orange">Draft</span>
    : <span className="badge badge-green">{item.data?.signals?.length ?? 0} signals</span>;

  return (
    <div className="batch-result-card">
      <div className="batch-result-header">
        <div>
          <span className="batch-result-company">{item.company}</span>
          {item.email && <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{item.email}</span>}
        </div>
        {item.error
          ? <span className="badge badge-red">Failed</span>
          : statusBadge}
      </div>
      {item.data && (
        <div className="batch-result-body">
          <div className="tab-bar">
            {["signals", "research", "email"].map((t) => (
              <button key={t} className={`tab-item${cardTab === t ? " active" : ""}`}
                onClick={() => setCardTab(t)}>
                {t === "signals" ? "Signals" : t === "research" ? "Research" : "Email"}
              </button>
            ))}
          </div>
          {cardTab === "signals" && <SignalsTab result={result} />}
          {cardTab === "research" && <ResearchTab result={result} />}
          {cardTab === "email" && <EmailTab result={result} recipientEmail={item.email} />}
        </div>
      )}
      {item.error && (
        <div className="batch-result-body">
          <div className="error-banner"><strong>Error</strong>{item.error}</div>
        </div>
      )}
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────

function HistoryPanel({ history, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <div className="history-section">
      <div className="history-header" onClick={() => setOpen((p) => !p)}>
        <div className="history-header-left">
          <span className="history-title">History</span>
          <span className="history-count">{history.length} run{history.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex-row gap-8">
          {open && (
            <button className="btn btn-danger btn-sm"
              onClick={(e) => { e.stopPropagation(); onClear(); }}>
              Clear
            </button>
          )}
          <span className={`history-chevron ${open ? "open" : ""}`}><ChevronIcon /></span>
        </div>
      </div>

      {open && (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-item" onClick={() => onSelect(item)}>
              <div className="history-item-left">
                <div className="history-company">{item.company}</div>
                <div className="history-meta">
                  {new Date(item.timestamp).toLocaleString()} · {item.signals?.length ?? 0} signals
                </div>
              </div>
              <div className="history-item-right">
                <span className={`badge ${item.email_status === "sent" ? "badge-green" : "badge-orange"}`}>
                  {item.email_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Home() {
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const [form, setForm] = useState({ icp: "", company: "", email: "" });
  const [batchMode, setBatchMode] = useState(false);
  const [batchCompanies, setBatchCompanies] = useState("");
  const [reviewFirst, setReviewFirst] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState("");
  const [result, setResult] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [tab, setTab] = useState("signals");

  useEffect(() => {
    setPersona(loadLS("fr_persona", DEFAULT_PERSONA));
    setHistory(loadLS("fr_history", []));
  }, []);

  function savePersona(p) {
    setPersona(p);
    saveLS("fr_persona", p);
  }

  function addToHistory(item) {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 15);
      saveLS("fr_history", next);
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    saveLS("fr_history", []);
  }

  const canSubmit = form.icp.trim() &&
    (batchMode ? batchCompanies.trim() : form.company.trim() && form.email.trim());

  async function runSingleStream(company, email) {
    const res = await fetch(`${API_URL}/run-agent-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icp: form.icp,
        company,
        email,
        sender_name: persona.sender_name || "Parth",
        sender_company: persona.sender_company || "",
        sender_role: persona.sender_role || "",
        review_first: reviewFirst,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const msg = JSON.parse(line.slice(6));
        if (msg.event === "step") setActiveStep(msg.step);
        if (msg.event === "done") return msg.result;
        if (msg.event === "error") throw new Error(msg.detail);
      }
    }
    throw new Error("Stream ended without a result.");
  }

  async function runSingle(company, email) {
    const res = await fetch(`${API_URL}/run-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icp: form.icp,
        company,
        email,
        sender_name: persona.sender_name || "Parth",
        sender_company: persona.sender_company || "",
        sender_role: persona.sender_role || "",
        review_first: reviewFirst,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setResult(null);
    setBatchResults([]);
    setError("");
    setTab("signals");

    if (batchMode) {
      const entries = batchCompanies.split("\n").map((line) => {
        const [company, ...rest] = line.split(",");
        return { company: company.trim(), email: rest.join(",").trim() };
      }).filter((e) => e.company);
      setBatchProgress({ current: 0, total: entries.length });
      const results = [];
      for (let i = 0; i < entries.length; i++) {
        const { company, email } = entries[i];
        if (!email) {
          results.push({ company, email: "", data: null, error: "Missing email — use format: Company, email@example.com" });
          setBatchResults([...results]);
          continue;
        }
        setBatchProgress({ current: i + 1, total: entries.length });
        setActiveStep("signals");
        try {
          const data = await runSingle(company, email);
          results.push({ company, email, data, error: null });
          addToHistory({ id: Date.now() + i, company, email, timestamp: new Date().toISOString(), ...data });
        } catch (err) {
          results.push({ company, email, data: null, error: err.message });
        }
        setBatchResults([...results]);
      }
      setActiveStep("");
    } else {
      try {
        const data = await runSingleStream(form.company, form.email);
        setActiveStep("");
        setResult({ ...data, company: form.company });
        addToHistory({ id: Date.now(), company: form.company, email: form.email, timestamp: new Date().toISOString(), ...data });
      } catch (err) {
        setError(err.message || "Something went wrong. Is the backend running?");
        setActiveStep("");
      }
    }

    setLoading(false);
  }

  function handleChange(field) {
    return (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  function handleReset() {
    setResult(null);
    setBatchResults([]);
    setError("");
    setActiveStep("");
    setBatchProgress({ current: 0, total: 0 });
    setTab("signals");
  }

  const showDashboard = result || batchResults.length > 0 || loading;

  return (
    <div className="page">
      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><BoltIcon /></div>
          FireReach
        </div>
        <div className="topbar-right">
          <div className="service-pills">
            <div className="service-pill">
              <span className="service-dot" style={{ background: "var(--accent-green)" }} />
              Groq
            </div>
            <div className="service-pill">
              <span className="service-dot" style={{ background: "var(--accent-blue)" }} />
              Tavily
            </div>
            <div className="service-pill">
              <span className="service-dot" style={{ background: "var(--accent-orange)" }} />
              SMTP
            </div>
          </div>
          <button className="icon-btn" title="Sender settings" onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </button>
          {showDashboard && (
            <button className="btn-new-campaign" onClick={handleReset}>
              <PlusIcon /> New Campaign
            </button>
          )}
        </div>
      </header>

      {showDashboard ? (
        /* ── Dashboard View ── */
        <div className="dashboard">
          <PipelineSidebar
            activeStep={activeStep}
            company={result?.company || form.company}
            loading={loading}
          />
          <div className="dash-main">
            {error && (
              <div className="error-banner">
                <strong>Agent execution failed</strong>{error}
              </div>
            )}

            {loading && !result && batchResults.length === 0 && (
              <div className="loader">
                <div className="spinner" />
                <p>
                  {batchMode && batchProgress.total > 0
                    ? `Processing ${batchProgress.current} of ${batchProgress.total}…`
                    : "Agent is working…"}
                </p>
              </div>
            )}

            {batchMode && loading && batchProgress.total > 0 && (
              <div className="batch-progress">
                <div className="batch-progress-label">
                  {batchProgress.current} / {batchProgress.total} companies processed
                </div>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Single result with tabs */}
            {result && (
              <>
                <div className="tab-bar">
                  {["signals", "research", "email"].map((t) => (
                    <button
                      key={t}
                      className={`tab-item${tab === t ? " active" : ""}`}
                      onClick={() => setTab(t)}
                    >
                      {t === "signals" ? "Signals" : t === "research" ? "Research" : "Email"}
                    </button>
                  ))}
                </div>

                {tab === "signals" && <SignalsTab result={result} />}
                {tab === "research" && <ResearchTab result={result} />}
                {tab === "email" && <EmailTab result={result} recipientEmail={form.email} />}
              </>
            )}

            {/* Batch results */}
            {batchResults.length > 0 && (
              <div className="batch-results fade-up">
                {batchResults.map((item, i) => (
                  <BatchResultCard key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Form View ── */
        <main className="main-centered">
          <div className="heading">
            <h1>Autonomous Outreach</h1>
            <p>Capture live signals, research the account, send a personalized email.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card">
              <div className="toggle-row" style={{ borderTop: "none", marginTop: 0, paddingTop: 0, marginBottom: 16 }}>
                <div className="toggle-label">
                  Batch Mode
                  <small>Run against multiple companies at once</small>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>

              {batchMode ? (
                <div className="field">
                  <label>Companies & Emails <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(one per line: Company, email)</span></label>
                  <textarea
                    placeholder={"Stripe, cto@stripe.com\nFigma, founder@figma.com\nNotion, sales@notion.so"}
                    value={batchCompanies}
                    onChange={(e) => setBatchCompanies(e.target.value)}
                    disabled={loading}
                    rows={5}
                    style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}
                  />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>Target Company</label>
                    <input
                      type="text" placeholder="e.g. Snyk"
                      value={form.company} onChange={handleChange("company")}
                      disabled={loading} autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label>Recipient Email</label>
                    <input
                      type="email" placeholder="founder@example.com"
                      value={form.email} onChange={handleChange("email")}
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="field">
                <label>Ideal Customer Profile</label>
                <textarea
                  placeholder="We sell high-end cybersecurity training to Series B startups"
                  value={form.icp} onChange={handleChange("icp")}
                  disabled={loading} rows={3}
                />
              </div>

              <div className="toggle-row">
                <div className="toggle-label">
                  Review before sending
                  <small>Generate draft first — you edit, then send</small>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={reviewFirst} onChange={(e) => setReviewFirst(e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
            </div>

            <div className="persona-row">
              <span className="persona-info">
                Sending as: <strong>
                  {persona.sender_name || "Parth"}
                  {persona.sender_role ? `, ${persona.sender_role}` : ""}
                  {persona.sender_company ? ` · ${persona.sender_company}` : ""}
                </strong>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
                Edit
              </button>
            </div>

            <button type="submit" className="btn" disabled={!canSubmit || loading}>
              {loading ? "Running…" : batchMode ? `Run Agent on ${batchCompanies.split("\n").filter(Boolean).length} companies` : "Run Agent"}
            </button>
          </form>

          <HistoryPanel
            history={history}
            onSelect={(item) => {
              setResult({ ...item, company: item.company });
              setActiveStep("");
              setForm((p) => ({ ...p, company: item.company, email: item.email || p.email }));
              setTab("signals");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onClear={clearHistory}
          />
        </main>
      )}

      {showSettings && (
        <SettingsModal
          persona={persona}
          onSave={savePersona}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
