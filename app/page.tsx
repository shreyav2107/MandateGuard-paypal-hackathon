"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "../lib/plans";

export default function StorePage() {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string>(PLANS[0].key);
  const [intentText, setIntentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = PLANS.find((candidate) => candidate.key === selectedKey) ?? PLANS[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = intentText.trim();
    if (!value) {
      setError("Tell us what you expect to pay before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: plan.key,
          intentText: value,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

      if (!response.ok || !payload?.id) {
        const message = payload?.error === "plan_not_configured"
          ? "This plan isn’t available right now. Please try another option."
          : "We couldn’t review that subscription. Please try again.";
        throw new Error(message);
      }

      router.push("/checkpoint/" + payload.id);
    } catch {
      setError("We couldn’t review that subscription. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">StreamNest</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pick the plan that fits your budget</h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            MandateGuard checks a subscription against what you expect, before you approve it.
          </p>
          <a
            href="/demo"
            className="inline-flex w-fit items-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            Try the live terms and UPI demo →
          </a>
        </header>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((planOption) => {
            const isSelected = planOption.key === selectedKey;

            return (
              <article
                key={planOption.key}
                className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
                  isSelected ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200"
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{planOption.title}</span>
                  {isSelected ? <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">Selected</span> : null}
                </div>

                <h2 className="text-2xl font-bold tracking-tight">{planOption.headline}</h2>
                <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{planOption.copy}</p>

                {!isSelected ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKey(planOption.key);
                      setError(null);
                    }}
                    className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                  >
                    Choose
                  </button>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      What do you expect to pay?
                      <input
                        value={intentText}
                        onChange={(event) => setIntentText(event.target.value)}
                        placeholder="max $10 a month, 7-day trial"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-600 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {submitting ? "Checking…" : "Continue"}
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
