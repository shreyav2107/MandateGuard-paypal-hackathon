"use client";

import { useState } from "react";
import PayPalSubscribe from "@/components/PayPalSubscribe";

type PlanKey = "honest" | "trap" | "borderline";

type CreateSubscriptionResponse = {
  subscriptionId?: string;
  error?: string;
};

const plans: { key: PlanKey; label: string }[] = [
  { key: "honest", label: "honest" },
  { key: "trap", label: "trap" },
  { key: "borderline", label: "borderline" },
];

export default function DevTestPage() {
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [approvedSubscriptionId, setApprovedSubscriptionId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSubscription(planKey: PlanKey) {
    setLoadingPlan(planKey);
    setSubscriptionId(null);
    setApprovedSubscriptionId(null);
    setError(null);

    try {
      const response = await fetch("/api/dev/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = (await response.json()) as CreateSubscriptionResponse;

      if (!response.ok || !data.subscriptionId) {
        throw new Error(data.error ?? "Unable to create subscription");
      }

      setSubscriptionId(data.subscriptionId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create subscription");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 bg-white px-4 py-10 text-neutral-950 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          MandateGuard · Sandbox
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Subscription test</h1>
        <p className="max-w-2xl text-neutral-600">
          Choose a plan to create a sandbox subscription, then approve it with PayPal.
        </p>
      </header>

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="Choose a plan">
        {plans.map((plan) => (
          <button
            key={plan.key}
            type="button"
            onClick={() => void createSubscription(plan.key)}
            disabled={loadingPlan !== null}
            className="w-full rounded-lg border border-neutral-300 px-5 py-3 font-medium capitalize transition hover:border-neutral-900 disabled:cursor-wait disabled:bg-neutral-200 sm:w-auto"
          >
            {loadingPlan === plan.key ? "Creating…" : plan.key}
          </button>
        ))}
      </section>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {subscriptionId && (
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Approve with PayPal</h2>
          <PayPalSubscribe
            getSubscriptionId={() => Promise.resolve({ subscriptionId })}
            onApproved={setApprovedSubscriptionId}
          />
          {approvedSubscriptionId && (
            <p className="text-sm text-neutral-700">
              Approved subscription ID: <code className="break-all">{approvedSubscriptionId}</code>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
