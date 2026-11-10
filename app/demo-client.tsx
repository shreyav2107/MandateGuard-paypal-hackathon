"use client";

import { useEffect, useMemo, useState } from "react";
import type { Finding, Intent, MaxSeverity, Terms } from "@/lib/types";
import type { UpiMandate } from "@/lib/upi";

type PlanKey = "honest" | "trap" | "borderline";
type Mode = "paypal" | "upi";
type Evaluation = {
  intent: Intent | null;
  terms: Terms;
  findings: Finding[];
  maxSeverity: MaxSeverity;
  requiresAck: boolean;
  explanation: string;
  needsIntent: boolean;
  ai: { intent: string; claims?: string; explanation: string };
  termsHash?: string;
  simulation?: boolean;
  notice?: string;
  mandate?: UpiMandate;
};

const EMPTY_INTENT: Intent = {
  maxRecurringAmount: null,
  currency: null,
  expectedTrialDays: null,
  expectedTrialPrice: null,
  expectedInterval: null,
  maxCommitmentMonths: null,
  wantsOneTime: null,
};

const DEMO_PLANS: { key: PlanKey; name: string; price: string; detail: string; tag: string }[] = [
  { key: "honest", name: "Basic", price: "$9.99 / month", detail: "$1 for 7 days · cancel anytime", tag: "CLEAR TERMS" },
  { key: "trap", name: "Premium", price: "$69.99 / month", detail: "$1 for 7 days · 24 monthly payments", tag: "CHECK THIS" },
  { key: "borderline", name: "Annual", price: "$119.88 / year", detail: "3 days free · billed yearly", tag: "ANNUAL" },
];

const currencySymbol = (currency: string) => ({ USD: "$", INR: "₹", EUR: "€", GBP: "£" })[currency] ?? `${currency} `;
const displayMoney = (amount: number | null, currency: string) => amount == null ? "Not listed" : `${currencySymbol(currency)}${amount.toFixed(2)}`;
const severityLabel: Record<MaxSeverity, string> = { NONE: "Looks aligned", LOW: "Small detail to note", MEDIUM: "Review these terms", HIGH: "Mismatch found" };

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default function DemoClient() {
  const [mode, setMode] = useState<Mode>("paypal");
  const [planKey, setPlanKey] = useState<PlanKey>("trap");
  const [mandates, setMandates] = useState<UpiMandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [upiNotice, setUpiNotice] = useState("");
  const [expectation, setExpectation] = useState("I’m okay with $1 for a trial, then no more than $10 a month.");
  const [manualMode, setManualMode] = useState(false);
  const [manualIntent, setManualIntent] = useState<Intent>(EMPTY_INTENT);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentPlan = DEMO_PLANS.find((plan) => plan.key === planKey)!;
  const selectedMandate = mandates.find((mandate) => mandate.id === mandateId);
  const expectedForm = useMemo(() => (
    <ManualExpectations value={manualIntent} onChange={setManualIntent} />
  ), [manualIntent]);

  useEffect(() => {
    if (mode !== "upi" || mandates.length) return;
    let cancelled = false;
    void fetch("/api/upi-sim/evaluate")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load the UPI examples.");
        if (!cancelled) {
          setMandates(body.mandates as UpiMandate[]);
          setMandateId((body.mandates as UpiMandate[])[0]?.id ?? "");
          setUpiNotice(body.notice as string);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the UPI examples.");
      });
    return () => { cancelled = true; };
  }, [mode, mandates.length]);

  function changeMode(next: Mode) {
    setMode(next);
    setEvaluation(null);
    setAcknowledged(false);
    setError("");
    setExpectation(next === "upi"
      ? "Keep debits to ₹100 per month or less."
      : "I’m okay with $1 for a trial, then no more than $10 a month.");
  }

  async function evaluate() {
    setBusy(true);
    setError("");
    setEvaluation(null);
    setAcknowledged(false);
    try {
      const endpoint = mode === "paypal" ? "/api/demo-checkpoints" : "/api/upi-sim/evaluate";
      const payload = mode === "paypal"
        ? { planKey, intentText: expectation, ...(manualMode ? { intentOverride: manualIntent } : {}) }
        : { mandateId, intentText: expectation, ...(manualMode ? { intentOverride: manualIntent } : {}) };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The check could not be completed.");
      setEvaluation(body as Evaluation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The check could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MandateGuard home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>mandate<span className="brand-light">guard</span></span>
        </a>
        <span className="topbar-note"><span className="live-dot" /> CONSUMER CHECKPOINT DEMO</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A clearer yes starts here</p>
          <h1>Know what you’re<br className="desktop-break" /> saying yes to.</h1>
          <p className="hero-subtitle">Check the real billing terms against what you expected before a subscription begins.</p>
        </div>
        <div className="hero-stamp" aria-label="Rules checked, AI assisted">
          <span className="stamp-icon">✓</span>
          <span><strong>Rules checked</strong><small>AI assisted · human readable</small></span>
        </div>
      </section>

      <div className="mode-switch" role="tablist" aria-label="Payment type">
        <button className={mode === "paypal" ? "mode-tab active" : "mode-tab"} onClick={() => changeMode("paypal")} role="tab" aria-selected={mode === "paypal"}>
          <span className="mode-icon paypal-icon">P</span> PayPal subscriptions
        </button>
        <button className={mode === "upi" ? "mode-tab active" : "mode-tab"} onClick={() => changeMode("upi")} role="tab" aria-selected={mode === "upi"}>
          <span className="mode-icon upi-icon">U</span> UPI mandate simulator
          <span className="sim-tag">SIMULATED</span>
        </button>
      </div>

      <div className="workspace-grid">
        <section className="panel input-panel" aria-labelledby="setup-heading">
          <div className="panel-heading">
            <div><span className="step-label">STEP 01</span><h2 id="setup-heading">Set up your check</h2></div>
            <span className="heading-icon">⌁</span>
          </div>

          {mode === "paypal" ? (
            <>
              <fieldset className="plan-fieldset">
                <legend>Choose a sample plan</legend>
                <div className="plan-options">
                  {DEMO_PLANS.map((plan) => (
                    <button key={plan.key} type="button" className={planKey === plan.key ? "plan-option selected" : "plan-option"} onClick={() => { setPlanKey(plan.key); setEvaluation(null); }}>
                      <span className="plan-option-top"><span className="plan-name">{plan.name}</span><span className={`plan-tag ${plan.key}`}>{plan.tag}</span></span>
                      <strong>{plan.price}</strong><small>{plan.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="merchant-copy">
                <span className="merchant-label">MERCHANT MESSAGE</span>
                <p>“{currentPlan.key === "honest" ? "Try StreamNest for 7 days for $1, then $9.99/month. Cancel anytime." : currentPlan.key === "trap" ? "Start StreamNest Premium for just $1! Cancel anytime." : "Get 3 days free. Best value plan!"}”</p>
                <span className="merchant-brand"><span className="merchant-avatar">S</span> StreamNest</span>
              </div>
            </>
          ) : (
            <div className="upi-selector">
              <label htmlFor="mandate-select">Choose a sample mandate</label>
              <select id="mandate-select" value={mandateId} onChange={(event) => { setMandateId(event.target.value); setEvaluation(null); }}>
                {mandates.map((mandate) => <option value={mandate.id} key={mandate.id}>{mandate.merchant} · {currencySymbol(mandate.currency)}{mandate.maxAmount} / {mandate.intervalUnit.toLowerCase()}</option>)}
              </select>
              {selectedMandate && <div className="mandate-summary"><strong>{selectedMandate.merchant}</strong><span>{selectedMandate.purpose}</span><span>Max debit cap: {currencySymbol(selectedMandate.currency)}{selectedMandate.maxAmount} every {selectedMandate.intervalUnit.toLowerCase()}</span><span>Valid through {selectedMandate.validityEndDate}</span></div>}
              <div className="simulation-note"><span>ⓘ</span><p>{upiNotice || "Simulation only. No bank, NPCI, UPI app, mandate, or payment is involved."}</p></div>
            </div>
          )}

          <div className="expectation-field">
            <label htmlFor="expectation">What did you expect?</label>
            <textarea id="expectation" value={expectation} maxLength={1200} onChange={(event) => setExpectation(event.target.value)} placeholder="For example: I’m okay with a $1 trial, then up to $10 per month." rows={3} />
            <div className="field-foot"><span>Say it naturally. English and Hinglish supported.</span><span>{expectation.length}/1200</span></div>
          </div>

          <label className="manual-toggle">
            <input type="checkbox" checked={manualMode} onChange={(event) => setManualMode(event.target.checked)} />
            <span className="custom-check" aria-hidden="true" />
            <span><strong>Enter expectations manually</strong><small>Use this if AI is unavailable or you prefer exact fields.</small></span>
          </label>
          {manualMode && expectedForm}

          <button className="evaluate-button" type="button" onClick={evaluate} disabled={busy || (mode === "upi" && !mandateId)}>
            {busy ? <><span className="spinner" /> Checking the terms…</> : <>Check these terms <span aria-hidden="true">→</span></>}
          </button>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <p className="privacy-note"><span aria-hidden="true">◇</span> This demo evaluates sample data. It never starts a subscription or payment.</p>
        </section>

        <section className={`panel result-panel ${evaluation ? "has-result" : ""}`} aria-labelledby="result-heading" aria-live="polite">
          <div className="panel-heading">
            <div><span className="step-label">STEP 02</span><h2 id="result-heading">Your terms check</h2></div>
            {evaluation && <span className={`severity-pill ${evaluation.maxSeverity.toLowerCase()}`}><span />{severityLabel[evaluation.maxSeverity]}</span>}
          </div>

          {!evaluation ? (
            <div className="empty-result">
              <div className="empty-illustration"><span className="paper-line one" /><span className="paper-line two" /><span className="paper-line three" /><span className="paper-check">✓</span></div>
              <h3>Your check will appear here</h3>
              <p>Choose a plan and tell us what you expected. We’ll compare it with the billing details.</p>
              <div className="empty-points"><span><b>01</b> Terms translated</span><span><b>02</b> Expectations compared</span><span><b>03</b> Surprises explained</span></div>
            </div>
          ) : (
            <EvaluationResult evaluation={evaluation} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
          )}
        </section>
      </div>

      <footer className="footer">
        <span>MandateGuard <span className="footer-dot">·</span> Subscription clarity, before you commit</span>
        <span>AI extracts the details. Code checks the rules.</span>
      </footer>
    </main>
  );
}

function ManualExpectations({ value, onChange }: { value: Intent; onChange: (intent: Intent) => void }) {
  const update = (key: keyof Intent, next: string | boolean) => {
    if (key === "wantsOneTime") onChange({ ...value, wantsOneTime: next ? true : null });
    else if (key === "currency") onChange({ ...value, currency: next ? String(next) : null });
    else if (key === "expectedInterval") onChange({ ...value, expectedInterval: next ? String(next) as Intent["expectedInterval"] : null });
    else onChange({ ...value, [key]: numberOrNull(String(next)) });
  };

  return (
    <div className="manual-fields">
      <div className="manual-grid">
        <label>Maximum recurring amount<input inputMode="decimal" value={value.maxRecurringAmount ?? ""} onChange={(event) => update("maxRecurringAmount", event.target.value)} placeholder="e.g. 10" /></label>
        <label>Currency<select value={value.currency ?? ""} onChange={(event) => update("currency", event.target.value)}><option value="">Not specified</option><option value="USD">USD — US dollar</option><option value="INR">INR — Indian rupee</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound</option></select></label>
        <label>Expected billing interval<select value={value.expectedInterval ?? ""} onChange={(event) => update("expectedInterval", event.target.value)}><option value="">Not specified</option><option value="WEEK">Weekly</option><option value="MONTH">Monthly</option><option value="YEAR">Yearly</option></select></label>
        <label>Expected trial days<input inputMode="numeric" value={value.expectedTrialDays ?? ""} onChange={(event) => update("expectedTrialDays", event.target.value)} placeholder="e.g. 7" /></label>
        <label>Maximum trial price<input inputMode="decimal" value={value.expectedTrialPrice ?? ""} onChange={(event) => update("expectedTrialPrice", event.target.value)} placeholder="Use 0 for free" /></label>
        <label>Maximum commitment (months)<input inputMode="numeric" value={value.maxCommitmentMonths ?? ""} onChange={(event) => update("maxCommitmentMonths", event.target.value)} placeholder="Leave blank for none" /></label>
      </div>
      <label className="one-time-option"><input type="checkbox" checked={value.wantsOneTime === true} onChange={(event) => update("wantsOneTime", event.target.checked)} /> I only want a one-time payment</label>
    </div>
  );
}

function EvaluationResult({ evaluation, acknowledged, onAcknowledge }: { evaluation: Evaluation; acknowledged: boolean; onAcknowledge: (value: boolean) => void }) {
  const { terms } = evaluation;
  const interval = terms.intervalUnit ? `${terms.intervalCount && terms.intervalCount > 1 ? `every ${terms.intervalCount} ` : ""}${terms.intervalUnit.toLowerCase()}${(terms.intervalCount ?? 1) > 1 ? "s" : ""}` : "billing interval not listed";
  const trial = terms.trialDays == null ? "No trial listed" : `${terms.trialDays} day${terms.trialDays === 1 ? "" : "s"} for ${displayMoney(terms.trialPrice, terms.currency)}`;

  return (
    <div className="evaluation-content">
      <div className={`result-banner ${evaluation.maxSeverity.toLowerCase()}`}>
        <span className="result-symbol">{evaluation.maxSeverity === "NONE" ? "✓" : evaluation.maxSeverity === "HIGH" ? "!" : "i"}</span>
        <div><strong>{severityLabel[evaluation.maxSeverity]}</strong><p>{evaluation.explanation}</p></div>
      </div>

      <div className="terms-summary">
        <div className="terms-heading"><h3>What the billing details say</h3><span>PAYMENT TERMS</span></div>
        <div className="term-grid">
          <Term label={evaluation.simulation ? "Maximum debit cap" : "Regular charge"} value={`${evaluation.simulation ? "up to " : ""}${displayMoney(terms.recurringAmount, terms.currency)} / ${interval}`} />
          <Term label="At signup" value={displayMoney(terms.initialCharge, terms.currency)} />
          <Term label="Trial" value={trial} />
          <Term label="Fixed commitment" value={terms.commitmentMonths == null ? "None listed" : `${terms.commitmentMonths} months · ${displayMoney(terms.totalCommitted, terms.currency)} total`} />
        </div>
      </div>

      {evaluation.findings.length > 0 ? (
        <div className="finding-list">
          <div className="findings-heading"><h3>Details to review</h3><span>{evaluation.findings.length} finding{evaluation.findings.length === 1 ? "" : "s"}</span></div>
          {evaluation.findings.map((finding) => (
            <article className="finding-card" key={finding.id}>
              <span className={`finding-severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
              <div><strong>{formatField(finding.field)}</strong><p><span>Expected</span> {finding.expected}</p><p><span>Actual</span> {finding.actual}</p></div>
            </article>
          ))}
        </div>
      ) : <div className="match-note"><span>✓</span> No mismatch was found in the details we checked.</div>}

      {evaluation.requiresAck && <div className={`acknowledgement ${acknowledged ? "checked" : ""}`}>
        <label><input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledge(event.target.checked)} /><span className="custom-check" aria-hidden="true" /><span><strong>{acknowledged ? "Mismatch acknowledged" : "I’ve reviewed these differences"}</strong><small>This demo does not continue to a payment step.</small></span></label>
        <span className="ack-status">{acknowledged ? "ACKNOWLEDGED" : "REVIEW NEEDED"}</span>
      </div>}

      {evaluation.needsIntent && <p className="manual-hint">We couldn’t safely extract your expectations. The terms were still checked; use the manual fields to compare them with your expectations.</p>}
      <div className="source-row"><span>Intent: {sourceLabel(evaluation.ai.intent)}</span>{evaluation.ai.claims && <span>Merchant copy: {sourceLabel(evaluation.ai.claims)}</span>}<span>Explanation: {sourceLabel(evaluation.ai.explanation)}</span></div>
      {evaluation.termsHash && <p className="hash-note">Terms fingerprint created for a later change check: <code>{evaluation.termsHash.slice(0, 20)}…</code></p>}
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return <div className="term-cell"><span>{label}</span><strong>{value}</strong></div>;
}

function formatField(field: string) {
  const labels: Record<string, string> = { recurringAmount: "Recurring price", trialDays: "Trial length", trialPrice: "Trial price", commitment: "Fixed commitment", cancelClaim: "Cancellation promise", claimedPrice: "Advertised price", setupFee: "Setup fee", planOverridden: "Plan changed", wantsOneTime: "Payment type" };
  return labels[field] ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function sourceLabel(source: string) {
  if (source === "gemini") return "Gemini";
  if (source === "gemini-fallback") return "Gemini fallback";
  if (source === "manual") return "Manual";
  if (source === "template") return "Safe template";
  if (source === "cache") return "Cached";
  if (source === "off") return "AI unavailable";
  return "Not used";
}
