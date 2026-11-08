"use client";

import { useState } from "react";
import PayPalSubscribe from "./PayPalSubscribe";
import FindingCard from "./FindingCard";
import { mockTrap } from "../lib/mock";
import type { CheckpointResponse, Intent } from "../lib/types";

export default function CheckpointReview({ checkpoint }: { checkpoint?: Partial<CheckpointResponse> | null }) {
  const data = checkpoint ?? mockTrap;
  const checkpointId = data.id ?? null;
  const [intent, setIntent] = useState<Intent | null>(data.intent ?? mockTrap.intent);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<"declined" | "continued" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifiedStatus, setVerifiedStatus] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const findings = data.findings ?? mockTrap.findings;
  const explanation = data.explanation ?? mockTrap.explanation;
  const highFindings = findings.filter((finding) => finding.severity === "HIGH");
  const canContinue = highFindings.every((finding) => acknowledged[finding.id]);

  function updateIntent<K extends keyof Intent>(key: K, value: Intent[K]) {
    setIntent((current) => (current ? { ...current, [key]: value } : current));
  }

  async function submitDecision(nextDecision: "PROCEED" | "ABANDON") {
    if (!checkpointId) return;

    setSubmitting(true);
    setDecisionError(null);

    try {
      const payload = {
        decision: nextDecision,
        ackedIds: nextDecision === "PROCEED"
          ? findings.filter((finding) => finding.severity === "HIGH" && acknowledged[finding.id]).map((finding) => finding.id)
          : [],
      };

      const response = await fetch(`/api/checkpoints/${checkpointId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; missing?: string[]; subscriptionId?: string }
        | null;

      if (response.status === 400 && result?.error === "ack_required") {
        setDecisionError("Please acknowledge each high-severity issue before continuing.");
        return;
      }

      if (response.status === 409 && result?.error === "terms_changed") {
        setDecisionError("These terms changed, please review again");
        window.location.reload();
        return;
      }

      if (!response.ok) {
        const message = result?.error === "already_decided"
          ? "That decision has already been recorded."
          : "We couldn’t submit your decision right now.";
        setDecisionError(message);
        return;
      }

      if (nextDecision === "PROCEED") {
        const nextSubscriptionId = result?.subscriptionId ?? null;
        if (nextSubscriptionId) {
          setSubscriptionId(nextSubscriptionId);
        }
        setDecision("continued");
      } else {
        setDecision("declined");
      }
    } catch {
      setDecisionError("We couldn’t submit your decision right now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifySubscription() {
    if (!checkpointId || verifying) return;
    setVerifying(true);
    setVerifyError(null);

    try {
      const response = await fetch(`/api/checkpoints/${checkpointId}/verify`, { method: "POST" });
      const result = (await response.json().catch(() => null)) as { error?: string; status?: string } | null;

      if (!response.ok) {
        setVerifyError(result?.error === "not_proceeded"
          ? "This checkpoint has not been approved yet."
          : "We couldn’t verify this subscription. Please try again.");
        return;
      }

      setVerifiedStatus(result?.status ?? "UNKNOWN");
    } catch {
      setVerifyError("We couldn’t verify this subscription. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">MandateGuard demo</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Review this subscription</h1>
          <p className="max-w-2xl text-slate-600">
            Compare the offer with your expectations before deciding whether to continue.
          </p>
        </header>

        <section aria-labelledby="intent-title" className="space-y-3">
          <div>
            <h2 id="intent-title" className="text-lg font-semibold">Your expectations</h2>
            <p className="text-sm text-slate-600">Edit any value to make your preferences clear.</p>
          </div>
          {intent ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:justify-start sm:rounded-full">
                <span className="text-slate-600">Max monthly</span>
                <span className="text-slate-500">$</span>
                <input
                  aria-label="Maximum monthly price in USD"
                  className="w-14 min-w-0 bg-transparent font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  min="0"
                  step="0.01"
                  value={intent.maxRecurringAmount ?? ""}
                  onChange={(event) => updateIntent("maxRecurringAmount", event.target.value === "" ? null : Number(event.target.value))}
                />
                <span>/ month</span>
              </label>
              <label className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:justify-start sm:rounded-full">
                <span className="text-slate-600">Currency</span>
                <select
                  aria-label="Preferred currency"
                  className="bg-transparent font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={intent.currency ?? "USD"}
                  onChange={(event) => updateIntent("currency", event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:justify-start sm:rounded-full">
                <span className="text-slate-600">Billing</span>
                <select
                  aria-label="Expected billing interval"
                  className="bg-transparent font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={intent.expectedInterval ?? "MONTH"}
                  onChange={(event) => updateIntent("expectedInterval", event.target.value as Intent["expectedInterval"])}
                >
                  <option value="DAY">Daily</option>
                  <option value="WEEK">Weekly</option>
                  <option value="MONTH">Monthly</option>
                  <option value="YEAR">Yearly</option>
                </select>
              </label>
              <label className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:justify-start sm:rounded-full">
                <span className="text-slate-600">Max commitment</span>
                <input
                  aria-label="Maximum commitment in months"
                  className="w-12 min-w-0 bg-transparent text-right font-semibold outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={intent.maxCommitmentMonths ?? ""}
                  onChange={(event) => updateIntent("maxCommitmentMonths", event.target.value === "" ? null : Number(event.target.value))}
                />
                <span>months</span>
              </label>
              <label className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto sm:justify-start sm:rounded-full">
                <span className="text-slate-600">One-time purchase</span>
                <select
                  aria-label="One-time purchase preference"
                  className="bg-transparent font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  value={intent.wantsOneTime === null ? "either" : intent.wantsOneTime ? "yes" : "no"}
                  onChange={(event) => updateIntent("wantsOneTime", event.target.value === "either" ? null : event.target.value === "yes")}
                >
                  <option value="either">Either</option>
                  <option value="yes">Prefer</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="findings-title" className="space-y-3">
          <h2 id="findings-title" className="text-lg font-semibold">What we found</h2>
          {findings.length > 0 ? (
            <div className="space-y-3">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  acknowledgementLabel="I understand this finding and want to continue."
                  acknowledged={Boolean(acknowledged[finding.id])}
                  onAcknowledgedChange={(value) => setAcknowledged((current) => ({ ...current, [finding.id]: value }))}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" role="status">
              <h3 className="font-semibold">Matches what you expect</h3>
              <p className="mt-1 text-sm">We didn’t find any differences from the expectations you shared.</p>
            </div>
          )}
        </section>

        {explanation ? (
          <section aria-labelledby="explanation-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="explanation-title" className="font-semibold">A closer look</h2>
            <p className="mt-2 leading-relaxed text-slate-700">{explanation}</p>
          </section>
        ) : null}

        {decisionError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {decisionError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitDecision("ABANDON")}
            className="w-full rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed sm:w-auto"
          >
            Don’t subscribe
          </button>
          <button
            type="button"
            disabled={!canContinue || submitting}
            onClick={() => submitDecision("PROCEED")}
            className="w-full rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-700 sm:w-auto"
          >
            {submitting ? "Submitting…" : "I understand, continue"}
          </button>
        </div>

        {decision ? (
          <p role="status" className="text-center text-sm text-slate-700">
            {decision === "declined" ? "You chose not to subscribe." : "You acknowledged the high severity findings."}
          </p>
        ) : null}

        {subscriptionId && !verifiedStatus ? (
          <section aria-busy={verifying} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold">Approve the subscription</h2>
            <div className="mt-4">
              <PayPalSubscribe
                getSubscriptionId={() => Promise.resolve({ subscriptionId })}
                onApproved={() => {
                  void verifySubscription();
                }}
              />
            </div>
            {verifying ? <p role="status" className="mt-3 text-sm text-slate-600">Verifying your subscription with PayPal…</p> : null}
            <p className="mt-3 break-all text-xs uppercase tracking-wide text-slate-500">Subscription ID: {subscriptionId}</p>
          </section>
        ) : null}

        {verifyError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {verifyError}
          </div>
        ) : null}

        {verifiedStatus ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Approved</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-emerald-900">Subscription is active</h2>
            <p className="mt-3 text-lg text-emerald-800">Final status: {verifiedStatus}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
