import { paypal } from "../lib/paypal";
import type { Interval } from "../lib/types";

type PayPalProductResponse = { id: string };
type PayPalPlanResponse = { id: string };
type BillingCycleSeed = {
  sequence: number;
  tenure_type: "TRIAL" | "REGULAR";
  total_cycles: number;
  frequency: { interval_unit: Interval; interval_count: number };
  pricing_scheme?: { fixed_price: { value: string; currency_code: string } };
};

const usd = (v: string) => ({ value: v, currency_code: "USD" });
const cycle = (seq: number, tenure: "TRIAL" | "REGULAR", unit: Interval, count: number, total: number, price?: string): BillingCycleSeed => ({
  sequence: seq, tenure_type: tenure, total_cycles: total,
  frequency: { interval_unit: unit, interval_count: count },
  ...(price ? { pricing_scheme: { fixed_price: usd(price) } } : {}),
});

async function main() {
  const product = await paypal<PayPalProductResponse>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({ name: "StreamNest Premium", type: "SERVICE", category: "SOFTWARE" }),
  });
  const mk = (name: string, billing_cycles: BillingCycleSeed[]) =>
    paypal<PayPalPlanResponse>("/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify({
        product_id: product.id, name, billing_cycles,
        payment_preferences: { auto_bill_outstanding: true, setup_fee: usd("0"), setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 3 },
      }),
    });

  const honest = await mk("Honest: $1 for 7 days, then $9.99/mo, cancel anytime",
    [cycle(1, "TRIAL", "DAY", 7, 1, "1.00"), cycle(2, "REGULAR", "MONTH", 1, 0, "9.99")]);
  const trap = await mk("Trap: $1 for 7 days, then $69.99/mo for 24 months",
    [cycle(1, "TRIAL", "DAY", 7, 1, "1.00"), cycle(2, "REGULAR", "MONTH", 1, 24, "69.99")]);
  const border = await mk("Borderline: 3 days free, then $119.88/year",
    [cycle(1, "TRIAL", "DAY", 3, 1), cycle(2, "REGULAR", "YEAR", 1, 0, "119.88")]);

  console.log({ PLAN_HONEST: honest.id, PLAN_TRAP: trap.id, PLAN_BORDERLINE: border.id });
}
main().catch(() => {
  console.error("PayPal seeding failed");
  process.exitCode = 1;
});
