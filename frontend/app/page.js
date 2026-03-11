"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEP_LABELS = ["Signals", "Research", "Email", "Sent"];

export default function Home() {
  const [form, setForm] = useState({
    icp: "",
    company: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const canSubmit = form.icp.trim() && form.company.trim() && form.email.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setResult(null);
    setError("");

    setActiveStep(0);
    const stepTimer1 = setTimeout(() => setActiveStep(1), 2500);
    const stepTimer2 = setTimeout(() => setActiveStep(2), 6000);

    try {
      const res = await fetch(`${API_URL}/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icp: form.icp,
          company: form.company,
          email: form.email,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setActiveStep(3);
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Is the backend running?");
      setActiveStep(-1);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
    }
  }

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleReset() {
    setResult(null);
    setError("");
    setActiveStep(-1);
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🔥</span>
          <h1>FireReach</h1>
        </div>
        <p className="subtitle">
          Signal-driven outreach, fully autonomous.
        </p>
      </header>

      {!result && (
        <form onSubmit={handleSubmit}>
          <div className="form-card">
            <div className="field">
              <label htmlFor="company">Company</label>
              <input
                id="company"
                type="text"
                placeholder="Snyk"
                value={form.company}
                onChange={handleChange("company")}
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="email">Recipient Email</label>
              <input
                id="email"
                type="email"
                placeholder="founder@snyk.io"
                value={form.email}
                onChange={handleChange("email")}
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="icp">Ideal Customer Profile</label>
              <textarea
                id="icp"
                placeholder="We sell cybersecurity training to Series B startups"
                value={form.icp}
                onChange={handleChange("icp")}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>

          <button
            type="submit"
            className="run-btn"
            disabled={!canSubmit || loading}
          >
            {loading ? "Running agent…" : "Run FireReach Agent"}
          </button>
        </form>
      )}

      {(loading || result) && (
        <div className="steps">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`step ${activeStep === i ? "active" : activeStep > i ? "done" : ""
                }`}
            >
              <span className="step-num">
                {activeStep > i ? "✓" : i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="loader">
          <div className="spinner" />
          <p>Agent is working…</p>
        </div>
      )}

      {error && <div className="error-card">{error}</div>}

      {result && (
        <div className="results">
          <div className="result-card">
            <div className="result-header">
              <span className="icon">📡</span> Signals Detected
            </div>
            <div className="result-body">
              {result.signals?.length > 0 ? (
                <ul className="signal-list">
                  {result.signals.map((s, i) => (
                    <li key={i} className="signal-item">
                      <span className="signal-dot" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="brief-text" style={{ color: "var(--text-muted)" }}>
                  No signals detected.
                </p>
              )}
            </div>
          </div>

          <div className="result-card">
            <div className="result-header">
              <span className="icon">🧠</span> Account Brief
            </div>
            <div className="result-body">
              <p className="brief-text">{result.account_brief}</p>
            </div>
          </div>

          <div className="result-card">
            <div className="result-header">
              <span className="icon">📧</span> Outreach Email
              {result.email_status === "failed_to_send" && (
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#e53e3e", background: "#fed7d7", padding: "2px 8px", borderRadius: "12px" }}>
                  Draft Only
                </span>
              )}
            </div>
            <div className="result-body">
              {result.email_status === "failed_to_send" && (
                <div style={{ background: "#fff5f5", color: "#c53030", padding: "12px", borderRadius: "6px", marginBottom: "16px", fontSize: "14px", border: "1px solid #feb2b2" }}>
                  <strong>Could not send automatically.</strong> The server firewall blocked the SMTP port. Please copy the draft below to send manually.
                </div>
              )}
              <p className="email-text">{result.email_content}</p>
            </div>
          </div>

          <button className="run-btn secondary" onClick={handleReset}>
            ← Run Again
          </button>
        </div>
      )}
    </div>
  );
}
