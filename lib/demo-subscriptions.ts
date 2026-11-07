import type { PayPalSubscription } from "./terms";

const usd = (value: string) => ({ value, currency_code: "USD" });
const preferences = { setup_fee: usd("0") };
const taxes = { percentage: "0", inclusive: true };

/** Synthetic PayPal-shaped subscriptions for the in-app demo. */
export const DEMO_SUBSCRIPTIONS: Record<"honest" | "trap" | "borderline", PayPalSubscription> = {
  honest: {
    id: "I-HONEST",
    status: "APPROVAL_PENDING",
    start_time: "2026-11-01T00:00:00Z",
    plan: {
      billing_cycles: [
        { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 7 }, pricing_scheme: { fixed_price: usd("1.00") } },
        { sequence: 2, tenure_type: "REGULAR", total_cycles: 0, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: usd("9.99") } },
      ],
      payment_preferences: preferences,
      taxes,
    },
  },
  trap: {
    id: "I-TRAP",
    status: "APPROVAL_PENDING",
    start_time: "2026-11-01T00:00:00Z",
    plan: {
      billing_cycles: [
        { sequence: 2, tenure_type: "REGULAR", total_cycles: 24, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: usd("69.99") } },
        { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 7 }, pricing_scheme: { fixed_price: usd("1.00") } },
      ],
      payment_preferences: preferences,
      taxes,
    },
  },
  borderline: {
    id: "I-BORDER",
    status: "APPROVAL_PENDING",
    start_time: "2026-11-01T00:00:00Z",
    plan: {
      billing_cycles: [
        { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "DAY", interval_count: 3 } },
        { sequence: 2, tenure_type: "REGULAR", total_cycles: 0, frequency: { interval_unit: "YEAR", interval_count: 1 }, pricing_scheme: { fixed_price: usd("119.88") } },
      ],
      payment_preferences: preferences,
      taxes,
    },
  },
};
