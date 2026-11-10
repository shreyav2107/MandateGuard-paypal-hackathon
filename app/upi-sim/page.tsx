"use client";

import { useEffect, useState } from "react";
import FindingCard from "@/components/FindingCard";
import type { UpiEvaluation, UpiMandate } from "@/lib/upi";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type MandatesResponse = {
  simulation: true;
  notice: string;
  mandates: UpiMandate[];
};

function formatFrequency(mandate: UpiMandate) {
  const unit = mandate.intervalUnit.toLowerCase();
  const frequency = mandate.intervalCount === 1 ? unit : `${unit}s`;
  return `Every ${mandate.intervalCount === 1 ? "" : `${mandate.intervalCount} `}${frequency}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UpiSimulatorPage() {
  const [mandates, setMandates] = useState<UpiMandate[]>([]);
  const [notice, setNotice] = useState("Simulation: not connected to NPCI, any bank or any UPI app");
  const [intentText, setIntentText] = useState("");
  const [results, setResults] = useState<Record<string, UpiEvaluation>>({});
  const [loading, setLoading] = useState(true);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evaluationErrors, setEvaluationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadMandates() {
      try {
        const response = await fetch("/api/upi-sim/evaluate");
        if (!response.ok) throw new Error("Could not load the sample mandates.");
        const data = (await response.json()) as MandatesResponse;
        if (!active) return;
        setMandates(data.mandates);
        setNotice(data.notice);
      } catch {
        if (active) setLoadError("Could not load the sample mandates. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMandates();
    return () => {
      active = false;
    };
  }, []);

  async function evaluateMandate(mandateId: string) {
    setEvaluatingId(mandateId);
    setEvaluationErrors((current) => ({ ...current, [mandateId]: "" }));

    try {
      const response = await fetch("/api/upi-sim/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandateId,
          ...(intentText.trim() ? { intentText: intentText.trim() } : {}),
        }),
      });
      const data = (await response.json()) as UpiEvaluation | { error?: string };
      if (!response.ok) {
        const errorMessage = "error" in data ? data.error : undefined;
        const friendlyMessage = errorMessage === "Unknown mock mandate"
          ? "This sample mandate is no longer available. Please refresh and try again."
          : errorMessage === "Invalid request body" || errorMessage === "Invalid JSON body"
            ? "Please check your expectation and try again."
            : "Could not evaluate this mandate. Please try again.";
        setEvaluationErrors((current) => ({ ...current, [mandateId]: friendlyMessage }));
        return;
      }
      setResults((current) => ({ ...current, [mandateId]: data as UpiEvaluation }));
    } catch {
      setEvaluationErrors((current) => ({
        ...current,
        [mandateId]: "Could not evaluate this mandate. Please try again.",
      }));
    } finally {
      setEvaluatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <section
          role="note"
          aria-label="Simulation notice"
          className="rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 shadow-sm sm:px-6"
        >
          <p className="text-base font-bold text-amber-950 sm:text-lg">
            Simulation: not connected to NPCI, any bank or any UPI app
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {notice.replace(/^Simulation only:\s*/i, "").replace(/^Simulation:\s*/i, "")}
          </p>
        </section>

        <header className="my-8 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">UPI mandate simulator</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Review a simulated mandate</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Compare a sample debit cap and schedule with what you expect before you proceed.
          </p>
        </header>

        <section aria-labelledby="expectation-heading" className="mb-8 border-b border-slate-200 pb-7">
          <label htmlFor="intent-text" id="expectation-heading" className="block text-sm font-semibold text-slate-800">
            What did you expect?
            <span className="ml-2 font-normal text-slate-500">Optional</span>
          </label>
          <textarea
            id="intent-text"
            value={intentText}
            onChange={(event) => setIntentText(event.currentTarget.value)}
            maxLength={1200}
            rows={2}
            placeholder="For example: I expect to pay up to ₹149 monthly."
            className="mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </section>

        {loading ? (
          <div className="space-y-4" aria-label="Loading mandates" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse border-b border-slate-200 py-6">
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-64 rounded bg-slate-200" />
                <div className="mt-5 h-10 w-36 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            {loadError} Please refresh to try again.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {mandates.map((mandate) => {
              const result = results[mandate.id];
              const isEvaluating = evaluatingId === mandate.id;

              return (
                <article key={mandate.id} className="py-6 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-xl font-bold text-slate-900">{mandate.merchant}</h2>
                        <span className="text-sm text-slate-500">{mandate.purpose}</span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Debit cap</dt>
                          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{inr.format(mandate.maxAmount)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frequency</dt>
                          <dd className="mt-1 text-sm font-medium capitalize text-slate-800">{formatFrequency(mandate)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">First debit</dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">{formatDate(mandate.firstDebitDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valid through</dt>
                          <dd className="mt-1 text-sm font-medium text-slate-800">{formatDate(mandate.validityEndDate)}</dd>
                        </div>
                      </dl>
                    </div>
                    <button
                      type="button"
                      onClick={() => evaluateMandate(mandate.id)}
                      disabled={evaluatingId !== null}
                      className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-slate-700 sm:w-auto"
                    >
                      {isEvaluating ? "Evaluating…" : result ? "Evaluate again" : "Evaluate mandate"}
                    </button>
                  </div>

                  {evaluationErrors[mandate.id] ? (
                    <p role="alert" className="mt-4 text-sm text-rose-700">{evaluationErrors[mandate.id]}</p>
                  ) : null}

                  {result ? (
                    <section aria-label={`${mandate.merchant} evaluation results`} className="mt-6 border-t border-slate-200 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">Evaluation results</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {result.maxSeverity === "NONE" ? "No findings" : `${result.maxSeverity} severity`}
                        </span>
                      </div>
                      {result.needsIntent ? (
                        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                          Add what you expected above for a more meaningful comparison. These results currently show the mandate details without a stated expectation.
                        </p>
                      ) : null}
                      {result.explanation ? <p className="mt-3 text-sm leading-6 text-slate-600">{result.explanation}</p> : null}
                      {result.findings.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {result.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          No differences were found between your expectation and this simulated mandate.
                        </p>
                      )}
                    </section>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
