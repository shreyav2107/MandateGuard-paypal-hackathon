import type { PayPalSubscription } from "../lib/terms";

// Same shapes as GET /v1/billing/subscriptions/{id}?fields=plan for the 3 demo plans
// created by scripts/seed-paypal.ts. Swap in real saved sandbox JSON once A has it.

const usd = (v: string) => ({ value: v, currency_code: "USD" });
const prefs = { setup_fee: usd("0") };
const taxes = { percentage: "0", inclusive: true };

export const honest: PayPalSubscription = {
  id: "I-HONEST", status: "APPROVAL_PENDING", start_time: "2026-11-01T00:00:00Z",
  plan: {
    billing_cycles: [
      { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 7 }, pricing_scheme: { fixed_price: usd("1.00") } },
      { sequence: 2, tenure_type: "REGULAR", total_cycles: 0, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: usd("9.99") } },
    ],
    payment_preferences: prefs, taxes,
  },
};

export const trap: PayPalSubscription = {
  id: "I-TRAP", status: "APPROVAL_PENDING", start_time: "2026-11-01T00:00:00Z",
  plan: {
    billing_cycles: [
      // Deliberately out of order: paypalToTerms must sort by sequence.
      { sequence: 2, tenure_type: "REGULAR", total_cycles: 24, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: usd("69.99") } },
      { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 7 }, pricing_scheme: { fixed_price: usd("1.00") } },
    ],
    payment_preferences: prefs, taxes,
  },
};

export const borderline: PayPalSubscription = {
  id: "I-BORDER", status: "APPROVAL_PENDING", start_time: "2026-11-01T00:00:00Z",
  plan: {
    billing_cycles: [
      { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 3 } }, // free: no pricing_scheme
      { sequence: 2, tenure_type: "REGULAR", total_cycles: 0, frequency: { interval_unit: "YEAR", interval_count: 1 }, pricing_scheme: { fixed_price: usd("119.88") } },
    ],
    payment_preferences: prefs, taxes,
  },
};
