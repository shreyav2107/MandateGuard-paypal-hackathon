"use client";

import { useState } from "react";
import PayPalSubscribe from "@/components/PayPalSubscribe";

type PlanKey = "honest" | "trap" | "borderline";

type CreateSubscriptionResponse = {
  subscriptionId?: string;
};

type SubscriptionResponse = {
  status?: string;
};

const plans: PlanKey[] = ["honest", "trap", "borderline"];

export default function PrecreateTestPage() {
  const [id, setId] = useState<string | null>(null);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSubscription(planKey: PlanKey) {
    setLoadingPlan(planKey);
    setId(null);
    setApprovedId(null);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/dev/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = (await response.json()) as CreateSubscriptionResponse;

      if (!response.ok || !data.subscriptionId) {
        throw new Error("Unable to create subscription");
      }

      setId(data.subscriptionId);
    } catch {
      setError("Unable to create the Sandbox subscription. Check the server configuration and try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function onApproved(approvedSubscriptionId: string) {
    setApprovedId(approvedSubscriptionId);
    setStatus("Checking PayPal status…");
    setError(null);

    try {
      const response = await fetch(
        `/api/dev/subscription/${encodeURIComponent(approvedSubscriptionId)}`,
      );
      const data = (await response.json()) as SubscriptionResponse;
      if (!response.ok || !data.status) {
        throw new Error("Unable to retrieve subscription status");
      }
      setStatus(data.status);
    } catch {
      setStatus(null);
      setError("The approval was received, but the subscription status could not be retrieved.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 bg-white px-4 py-10 text-neutral-950 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          MandateGuard · Sandbox
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pre-created subscription test</h1>
        <p className="max-w-2xl text-neutral-600">
          Create a subscription first, then use its stored ID to start PayPal checkout.
        </p>
      </header>

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="Choose a plan">
        {plans.map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => void createSubscription(plan)}
            disabled={loadingPlan !== null}
            className="w-full rounded-lg border border-neutral-300 px-5 py-3 font-medium capitalize transition hover:border-neutral-900 disabled:cursor-wait disabled:bg-neutral-200 sm:w-auto"
          >
            {loadingPlan === plan ? "Creating…" : plan}
          </button>
        ))}
      </section>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {id && (
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Subscription created</h2>
          <p className="text-sm text-neutral-700">
            Subscription ID: <code className="break-all">{id}</code>
          </p>
          <PayPalSubscribe
            getSubscriptionId={() => Promise.resolve({ subscriptionId: id })}
            onApproved={onApproved}
          />
          {approvedId && (
            <p className="text-sm text-neutral-700">
              Approved ID: <code className="break-all">{approvedId}</code>
            </p>
          )}
          {status && <p className="text-sm text-neutral-700">Subscription status: {status}</p>}
        </section>
      )}
    </main>
  );
}
