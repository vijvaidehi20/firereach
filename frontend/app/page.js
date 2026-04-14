"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEPS = [
  { key: "signals",  label: "Signals"  },
  { key: "research", label: "Research" },
  { key: "email",    label: "Compose"  },
  { key: "sent",     label: "Sent"     },
];

const SOURCE_COLORS = {
  "Google News": "badge-blue",
  "DuckDuckGo":  "badge-purple",
  "Reddit":      "badge-warning",
  "GitHub":      "badge-success",
  "LinkedIn":    "badge-blue",
};

const DEFAULT_PERSONA = { sender_name: "Parth", sender_company: "", sender_role: "" };

function loadLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Icons ──────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
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

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 5l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Settings Modal ─────────────────────────────────────────────────────────

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
              <input type="text" placeholder="Rabbitt AI" value={local.sender_company} onChange={change("sender_company")} />
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

// ── Result Card ────────────────────────────────────────────────────────────

function ResultView({ result, recipientEmail }) {
  const [emailDraft, setEmailDraft] = useState(result.email_content);
  const [emailStatus, setEmailStatus] = useState(result.email_status);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [copied, setCopied] = useState(false);

  const isDraft = emailStatus === "draft";
  const isSent  = emailStatus === "sent";
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
    ? <span className="badge badge-success">Sent</span>
    : isDraft
    ? <span className="badge badge-warning">Draft — review &amp; send</span>
    : <span className="badge badge-error">Failed</span>;

  return (
    <div className="results">
      {/* Signals */}
      <div className="result-card">
        <div className="result-header">
          <span className="result-title">Growth Signals</span>
          <div className="result-header-right">
            {result.sources_used?.length > 0 && result.sources_used.map((src) => (
              <span key={src} className={`badge ${SOURCE_COLORS[src] || "badge-blue"}`}>{src}</span>
            ))}
            <span className="badge badge-success">{result.signals?.length ?? 0} detected</span>
          </div>
        </div>
        <div className="result-body">
          {result.signals?.length > 0 ? (
            <ul className="signal-list">
              {result.signals.map((s, i) => (
                <li key={i} className="signal-item">{s}</li>
              ))}
            </ul>
          ) : (
            <p className="brief-text" style={{ color: "var(--text-muted)" }}>No signals detected.</p>
          )}
          {result.wiki_facts && (
            <div className="wiki-facts">
              <div className="wiki-label">Wikipedia</div>
              {result.wiki_facts}
            </div>
          )}
        </div>
      </div>

      {/* Adapted ICP */}
      {result.adapted_icp && (
        <div className="result-card">
          <div className="result-header">
            <span className="result-title">Adapted ICP</span>
            <span className="badge badge-blue">AI tailored</span>
          </div>
          <div className="result-body">
            <p className="brief-text" style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>
              {result.adapted_icp}
            </p>
          </div>
        </div>
      )}

      {/* Account Brief */}
      <div className="result-card">
        <div className="result-header">
          <span className="result-title">Account Brief</span>
        </div>
        <div className="result-body">
          <p className="brief-text">{result.account_brief}</p>
        </div>
      </div>

      {/* Email */}
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
          <textarea
            className="email-editable"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            spellCheck={false}
          />
          <div className="email-actions">
            {(isDraft || isFailed) && (
              <button className="btn btn-sm flex-row" style={{ width: "auto", gap: 6 }}
                onClick={sendEmail} disabled={sending}>
                <SendIcon />{sending ? "Sending…" : "Send Email"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm flex-row" style={{ gap: 6 }} onClick={copyEmail}>
              <CopyIcon />{copied ? "Copied!" : "Copy"}
            </button>
            <button className="btn btn-ghost btn-sm flex-row" style={{ gap: 6 }} onClick={exportTxt}>
              <DownloadIcon />Export .txt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History Panel ──────────────────────────────────────────────────────────

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
        <div className="flex-row" style={{ gap: 8 }}>
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
                <span className={`badge ${item.email_status === "sent" ? "badge-success" : "badge-warning"}`}>
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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [persona, setPersona]       = useState(DEFAULT_PERSONA);
  const [history, setHistory]       = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const [form, setForm]     = useState({ icp: "", company: "", email: "" });
  const [batchMode, setBatchMode]   = useState(false);
  const [batchCompanies, setBatchCompanies] = useState("");
  const [reviewFirst, setReviewFirst]   = useState(false);

  const [loading, setLoading]     = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult]       = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError]         = useState("");

  // Load from localStorage on mount
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

  async function runSingle(company, email) {
    const res = await fetch(`${API_URL}/run-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icp: form.icp,
        company,
        email,
        sender_name:    persona.sender_name    || "Parth",
        sender_company: persona.sender_company || "",
        sender_role:    persona.sender_role    || "",
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
        setActiveStep(0);
        try {
          const data = await runSingle(company, email);
          results.push({ company, email, data, error: null });
          addToHistory({ id: Date.now() + i, company, email, timestamp: new Date().toISOString(), ...data });
        } catch (err) {
          results.push({ company, email, data: null, error: err.message });
        }
        setBatchResults([...results]);
      }
      setActiveStep(3);
    } else {
      const t1 = setTimeout(() => setActiveStep(1), 2500);
      const t2 = setTimeout(() => setActiveStep(2), 6000);
      setActiveStep(0);
      try {
        const data = await runSingle(form.company, form.email);
        setActiveStep(3);
        setResult(data);
        addToHistory({ id: Date.now(), company: form.company, email: form.email, timestamp: new Date().toISOString(), ...data });
      } catch (err) {
        setError(err.message || "Something went wrong. Is the backend running?");
        setActiveStep(-1);
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
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
    setActiveStep(-1);
    setBatchProgress({ current: 0, total: 0 });
  }

  const showResults = result || batchResults.length > 0;

  return (
    <div className="page">
      {/* Topbar */}
      <header className="topbar">
        <span className="brand">FireReach <span>/ Outreach Engine</span></span>
        <div className="topbar-actions">
          <button className="icon-btn" title="History" onClick={() => {
            document.querySelector(".history-section")?.scrollIntoView({ behavior: "smooth" });
          }}>
            <HistoryIcon />
          </button>
          <button className="icon-btn" title="Sender settings" onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      <main className="main">
        {/* Heading */}
        <div className="heading">
          <h1>Autonomous Outreach</h1>
          <p>Capture live signals, research the account, send a personalized email.</p>
        </div>

        {/* Pipeline progress */}
        {(loading || showResults) && (
          <div className="pipeline">
            {STEPS.map((step, i) => {
              const done   = activeStep > i;
              const active = activeStep === i;
              return (
                <div className="pipeline-step" key={step.key}>
                  <div className={`step-dot${done ? " done" : active ? " active" : ""}`}>
                    {done ? <CheckIcon /> : i + 1}
                  </div>
                  <span className={`step-label${done ? " done" : active ? " active" : ""}`}>
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={`step-connector${done ? " done" : ""}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Form */}
        {!showResults && !loading && (
          <form onSubmit={handleSubmit}>
            <div className="card">
              {/* Batch toggle */}
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
                  <label>Companies &amp; Emails <span className="text-muted" style={{ fontWeight: 400 }}>(one per line: Company, email)</span></label>
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

              {/* Options */}
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

            {/* Persona preview */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", marginBottom: 12 }}>
              <span className="text-muted">
                Sending as: <strong style={{ color: "var(--text-secondary)" }}>
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
        )}

        {/* Loader */}
        {loading && (
          <div className="loader">
            <div className="spinner" />
            <p>
              {batchMode && batchProgress.total > 0
                ? `Processing ${batchProgress.current} of ${batchProgress.total}…`
                : "Agent is working…"}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner">
            <strong>Agent execution failed</strong>{error}
          </div>
        )}

        {/* Batch progress bar */}
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

        {/* Single result */}
        {result && (
          <>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <button className="btn btn-ghost btn-sm flex-row" style={{ gap: 6, width: "auto" }} onClick={handleReset}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8.5 2L4 6.5 8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                New Outreach
              </button>
            </div>
            <ResultView result={result} recipientEmail={form.email} />
          </>
        )}

        {/* Batch results */}
        {batchResults.length > 0 && (
          <div className="batch-results">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <button className="btn btn-ghost btn-sm flex-row" style={{ gap: 6, width: "auto" }} onClick={handleReset}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8.5 2L4 6.5 8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                New Outreach
              </button>
            </div>
            {batchResults.map((item, i) => (
              <div key={i} className="batch-result-card">
                <div className="batch-result-header">
                  <div>
                    <span className="batch-result-company">{item.company}</span>
                    {item.email && <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{item.email}</span>}
                  </div>
                  {item.error
                    ? <span className="badge badge-error">Failed</span>
                    : <span className="badge badge-success">{item.data?.signals?.length ?? 0} signals</span>}
                </div>
                {item.data && (
                  <div className="batch-result-body">
                    <ResultView result={item.data} recipientEmail={form.email} />
                  </div>
                )}
                {item.error && (
                  <div className="batch-result-body">
                    <div className="error-banner"><strong>Error</strong>{item.error}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* History */}
        <HistoryPanel
          history={history}
          onSelect={(item) => {
            setResult(item);
            setActiveStep(3);
            setForm((p) => ({ ...p, company: item.company, email: item.email || p.email }));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onClear={clearHistory}
        />
      </main>

      {/* Settings Modal */}
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
