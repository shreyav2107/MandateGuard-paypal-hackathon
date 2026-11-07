"use client";

import { useState } from "react";
import FindingCard from "../components/FindingCard";
import { mockTrap } from "../lib/mock";
import type { Intent } from "../lib/types";

export default function CheckpointDemoPage() {
  const [intent, setIntent] = useState<Intent | null>(mockTrap.intent);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<"declined" | "continued" | null>(null);

  const highFindings = mockTrap.findings.filter((finding) => finding.severity === "HIGH");
  const canContinue = highFindings.every((finding) => acknowledged[finding.id]);

  function updateIntent<K extends keyof Intent>(key: K, value: Intent[K]) {
    setIntent((current) => (current ? { ...current, [key]: value } : current));
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
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm">
                <span className="text-slate-600">Max monthly</span>
                <span className="text-slate-500">$</span>
                <input
                  aria-label="Maximum monthly price in USD"
                  className="w-14 bg-transparent font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  min="0"
                  step="0.01"
                  value={intent.maxRecurringAmount ?? ""}
                  onChange={(event) => updateIntent("maxRecurringAmount", event.target.value === "" ? null : Number(event.target.value))}
                />
                <span>/ month</span>
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm">
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
              <label className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm">
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
              <label className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm">
                <span className="text-slate-600">Max commitment</span>
                <input
                  aria-label="Maximum commitment in months"
                  className="w-12 bg-transparent text-right font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={intent.maxCommitmentMonths ?? ""}
                  onChange={(event) => updateIntent("maxCommitmentMonths", event.target.value === "" ? null : Number(event.target.value))}
                />
                <span>months</span>
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm shadow-sm">
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
          {mockTrap.findings.length > 0 ? (
            <div className="space-y-3">
              {mockTrap.findings.map((finding) => (
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

        {mockTrap.explanation ? (
          <section aria-labelledby="explanation-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="explanation-title" className="font-semibold">A closer look</h2>
            <p className="mt-2 leading-relaxed text-slate-700">{mockTrap.explanation}</p>
          </section>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDecision("declined")}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            Don’t subscribe
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setDecision("continued")}
            className="rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            I understand, continue
          </button>
        </div>

        {decision ? (
          <p role="status" className="text-center text-sm text-slate-700">
            {decision === "declined" ? "You chose not to subscribe." : "You acknowledged the high severity findings."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
