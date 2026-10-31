import { describe, expect, it } from "vitest";
import { hashTerms, paypalToTerms } from "../lib/terms";
import { borderline, honest, trap } from "./fixtures";

describe("paypalToTerms", () => {
  it("honest plan: $1 for 7 days, then $9.99/month until cancelled", () => {
    const t = paypalToTerms(honest);
    expect(t).toMatchObject({
      currency: "USD", initialCharge: 1, trialDays: 7, trialPrice: 1, recurringAmount: 9.99,
      intervalUnit: "MONTH", intervalCount: 1, regularCycles: 0, commitmentMonths: null, totalCommitted: null,
      setupFee: 0, planOverridden: false,
    });
  });

  it("trap plan: 24 monthly payments of $69.99 (cycles out of order)", () => {
    const t = paypalToTerms(trap);
    expect(t.trialDays).toBe(7);
    expect(t.recurringAmount).toBe(69.99);
    expect(t.regularCycles).toBe(24);
    expect(t.commitmentMonths).toBe(24);
    expect(t.totalCommitted).toBe(1680.76); // 24 × 69.99 + 1.00 trial
  });

  it("borderline plan: free 3-day trial, then $119.88/year", () => {
    const t = paypalToTerms(borderline);
    expect(t).toMatchObject({ trialDays: 3, trialPrice: 0, initialCharge: 0, recurringAmount: 119.88, intervalUnit: "YEAR", commitmentMonths: null });
  });

  it("adds setup fee and handles two trial cycles and no trial", () => {
    const t = paypalToTerms({
      plan_overridden: true,
      plan: {
        billing_cycles: [
          { sequence: 1, tenure_type: "TRIAL", total_cycles: 1, frequency: { interval_unit: "WEEK", interval_count: 1 } },
          { sequence: 2, tenure_type: "TRIAL", total_cycles: 2, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: { value: "5.00", currency_code: "USD" } } },
          { sequence: 3, tenure_type: "REGULAR", total_cycles: 4, frequency: { interval_unit: "MONTH", interval_count: 3 }, pricing_scheme: { fixed_price: { value: "30.00", currency_code: "USD" } } },
        ],
        payment_preferences: { setup_fee: { value: "2.50", currency_code: "USD" } },
        taxes: { percentage: "8", inclusive: false },
      },
    });
    expect(t.trialDays).toBe(67); // 7 + 2 × 30
    expect(t.initialCharge).toBe(2.5); // setup fee + free first trial
    expect(t.commitmentMonths).toBe(12); // 4 payments every 3 months
    expect(t.totalCommitted).toBe(132.5); // 4 × 30 + 2 × 5 + 2.50
    expect(t).toMatchObject({ setupFee: 2.5, taxPercent: 8, taxInclusive: false, planOverridden: true });

    const noTrial = paypalToTerms({ plan: { billing_cycles: [{ sequence: 1, tenure_type: "REGULAR", total_cycles: 0, frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } } }] } });
    expect(noTrial).toMatchObject({ trialDays: null, trialPrice: null, initialCharge: 9.99 });
  });

  it("throws when the plan wasn't fetched", () => {
    expect(() => paypalToTerms({} as never)).toThrow(/fields=plan/);
  });
});

describe("hashTerms", () => {
  it("is stable for the same terms and changes when terms change", () => {
    const a = paypalToTerms(trap);
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as typeof a;
    expect(hashTerms(reordered)).toBe(hashTerms(a));
    expect(hashTerms({ ...a, recurringAmount: 79.99 })).not.toBe(hashTerms(a));
    expect(hashTerms(a)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
