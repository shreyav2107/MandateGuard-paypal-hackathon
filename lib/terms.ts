import { createHash } from "node:crypto";
import type { Interval, Terms } from "./types";

// Minimal shape of GET /v1/billing/subscriptions/{id}?fields=plan that we rely on.
type Money = { value: string; currency_code: string };
type BillingCycle = {
  sequence: number;
  tenure_type: "TRIAL" | "REGULAR";
  total_cycles: number; // 0 = infinite (REGULAR only)
  frequency: { interval_unit: Interval; interval_count: number };
  pricing_scheme?: { fixed_price?: Money };
};
export type PayPalSubscription = {
  id?: string;
  status?: string;
  start_time?: string;
  plan_overridden?: boolean;
  plan: {
    billing_cycles: BillingCycle[];
    payment_preferences?: { setup_fee?: Money };
    taxes?: { percentage?: string; inclusive?: boolean };
  };
};

const DAYS: Record<Interval, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
const MONTHS: Record<Interval, number> = { DAY: 1 / 30, WEEK: 7 / 30, MONTH: 1, YEAR: 12 };

const round2 = (n: number) => Math.round(n * 100) / 100;
const price = (c?: BillingCycle) => Number(c?.pricing_scheme?.fixed_price?.value ?? 0);

// PayPal billing cycles -> plain fields that humans and compare() understand. No AI here.
export function paypalToTerms(sub: PayPalSubscription): Terms {
  const plan = sub.plan;
  if (!plan?.billing_cycles?.length) throw new Error("subscription has no plan.billing_cycles (fetch with ?fields=plan)");

  const cycles = [...plan.billing_cycles].sort((a, b) => a.sequence - b.sequence);
  const trials = cycles.filter((c) => c.tenure_type === "TRIAL"); // PayPal allows up to 2
  const reg = cycles.find((c) => c.tenure_type === "REGULAR");

  const unit = reg?.frequency.interval_unit ?? null;
  const count = reg?.frequency.interval_count ?? null;
  const total = reg?.total_cycles ?? null;
  const setupFee = Number(plan.payment_preferences?.setup_fee?.value ?? 0);

  const trialDays = trials.length
    ? trials.reduce((d, t) => d + DAYS[t.frequency.interval_unit] * t.frequency.interval_count * t.total_cycles, 0)
    : null;
  const trialCost = trials.reduce((s, t) => s + price(t) * t.total_cycles, 0);
  const bounded = unit != null && count != null && total != null && total > 0;

  return {
    currency: [reg, ...trials].find((c) => c?.pricing_scheme?.fixed_price)?.pricing_scheme?.fixed_price?.currency_code ?? "USD",
    initialCharge: round2(setupFee + (trials.length ? price(trials[0]) : price(reg))),
    trialDays,
    trialPrice: trials.length ? price(trials[0]) : null,
    recurringAmount: reg ? price(reg) : null,
    intervalUnit: unit,
    intervalCount: count,
    regularCycles: total,
    commitmentMonths: bounded ? round2(MONTHS[unit] * count * total) : null,
    totalCommitted: bounded ? round2(price(reg) * total + trialCost + setupFee) : null,
    setupFee,
    taxPercent: Number(plan.taxes?.percentage ?? 0),
    taxInclusive: plan.taxes?.inclusive ?? true,
    startTime: sub.start_time ?? null,
    planOverridden: !!sub.plan_overridden,
  };
}

// Fingerprint of the terms, to detect a change between "reviewed" and "approved".
// Keys are sorted so the hash doesn't depend on property order.
export function hashTerms(t: Terms): string {
  const stable = JSON.stringify(t, Object.keys(t).sort());
  return "sha256:" + createHash("sha256").update(stable).digest("hex");
}
