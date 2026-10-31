import { describe, expect, it } from "vitest";
import { compare } from "../lib/compare";
import { paypalToTerms } from "../lib/terms";
import type { Intent } from "../lib/types";
import { borderline, honest, trap } from "./fixtures";

const intent = (over: Partial<Intent> = {}): Intent => ({
  maxRecurringAmount: null, currency: null, expectedTrialDays: null, expectedTrialPrice: null,
  expectedInterval: null, maxCommitmentMonths: null, wantsOneTime: null, ...over,
});
// "₹1 trial, then max $10 a month" → the demo intent
const demo = intent({ maxRecurringAmount: 10, currency: "USD", expectedTrialPrice: 1, expectedInterval: "MONTH" });
const fields = (r: ReturnType<typeof compare>, sev = "HIGH") => r.findings.filter((f) => f.severity === sev).map((f) => f.field);

describe("compare: the 3 demo plans", () => {
  it("honest plan passes cleanly", () => {
    const r = compare(demo, paypalToTerms(honest));
    expect(r).toEqual({ findings: [], maxSeverity: "NONE", requiresAck: false });
  });

  it("trap plan: HIGH on amount and 24-month commitment", () => {
    const r = compare(demo, paypalToTerms(trap));
    expect(fields(r)).toEqual(["recurringAmount", "commitment"]);
    expect(r.maxSeverity).toBe("HIGH");
    expect(r.requiresAck).toBe(true);
    expect(r.findings[0]).toMatchObject({ id: "F1", expected: "≤ $10.00", actual: "$69.99 per month", source: "deterministic" });
    expect(r.findings[1].actual).toBe("24 months ($1680.76 total)");
  });

  it("borderline plan: HIGH on yearly interval when buyer expects monthly", () => {
    const r = compare(demo, paypalToTerms(borderline));
    expect(fields(r)).toContain("interval");
    expect(r.requiresAck).toBe(true);
  });
});

describe("compare: merchant claims vs reality", () => {
  it('flags "cancel anytime" on a 24-month plan', () => {
    const r = compare(intent(), paypalToTerms(trap), { cancelAnytime: true, claimedPrice: null, quotes: ["Cancel anytime."] });
    const f = r.findings.find((x) => x.field === "cancelClaim")!;
    expect(f).toMatchObject({ severity: "HIGH", source: "ai_claim+deterministic", expected: 'merchant says "Cancel anytime."' });
  });

  it('"cancel anytime" is fine when there is no fixed term', () => {
    const r = compare(intent(), paypalToTerms(honest), { cancelAnytime: true, claimedPrice: null, quotes: ["Cancel anytime."] });
    expect(r.findings).toEqual([]);
  });

  it("advertised price matching the trial price is not a mismatch, a different price is", () => {
    const t = paypalToTerms(trap);
    expect(compare(intent(), { ...t, commitmentMonths: null }, { cancelAnytime: null, claimedPrice: 1, quotes: [] }).findings).toEqual([]);
    expect(fields(compare(intent(), { ...t, commitmentMonths: null }, { cancelAnytime: null, claimedPrice: 49.99, quotes: [] }))).toEqual(["claimedPrice"]);
  });
});

describe("compare: edge cases", () => {
  const t = paypalToTerms(honest);

  it("no stated intent and no fixed term → nothing to flag", () => {
    expect(compare(intent(), t).maxSeverity).toBe("NONE");
  });

  it("price exactly at the limit is OK; one cent over is HIGH (no float errors)", () => {
    expect(compare(intent({ maxRecurringAmount: 9.99 }), t).findings).toEqual([]);
    expect(fields(compare(intent({ maxRecurringAmount: 9.98 }), t))).toEqual(["recurringAmount"]);
    expect(compare(intent({ maxRecurringAmount: 0.3 }), { ...t, recurringAmount: 0.1 + 0.2 }).findings).toEqual([]);
  });

  it("buyer who wants a one-time payment is warned about any subscription", () => {
    expect(fields(compare(intent({ wantsOneTime: true }), t))).toEqual(["recurring"]);
  });

  it("wrong currency is HIGH (case-insensitive)", () => {
    expect(fields(compare(intent({ currency: "inr" }), t))).toEqual(["currency"]);
    expect(compare(intent({ currency: "usd" }), t).findings).toEqual([]);
  });

  it("commitment the buyer accepted is OK; longer than accepted is HIGH", () => {
    const tt = paypalToTerms(trap);
    expect(fields(compare(intent({ maxCommitmentMonths: 24 }), tt))).toEqual([]);
    expect(fields(compare(intent({ maxCommitmentMonths: 12 }), tt))).toEqual(["commitment"]);
  });

  it("shorter trial: MEDIUM if more than half, HIGH if half or less / none", () => {
    expect(compare(intent({ expectedTrialDays: 10 }), t).findings[0].severity).toBe("MEDIUM"); // 7 of 10
    expect(compare(intent({ expectedTrialDays: 14 }), t).findings[0].severity).toBe("HIGH"); // 7 of 14
    expect(compare(intent({ expectedTrialDays: 7 }), { ...t, trialDays: null }).findings[0]).toMatchObject({ severity: "HIGH", actual: "no trial" });
  });

  it("trial costing more than expected is MEDIUM; a cheaper trial is not flagged", () => {
    expect(fields(compare(intent({ expectedTrialPrice: 0 }), t), "MEDIUM")).toEqual(["trialPrice"]);
    expect(compare(intent({ expectedTrialPrice: 5 }), t).findings).toEqual([]);
  });

  it("every-3-months billing doesn't pass as monthly", () => {
    const r = compare(intent({ expectedInterval: "MONTH" }), { ...t, intervalCount: 3 });
    expect(r.findings[0]).toMatchObject({ field: "interval", actual: "every 3 months" });
  });

  it("setup fee, tax and plan override are reported without blocking", () => {
    const r = compare(intent(), { ...t, setupFee: 2.5, taxPercent: 8, taxInclusive: false, planOverridden: true });
    expect(r.findings.map((f) => [f.field, f.severity])).toEqual([
      ["setupFee", "MEDIUM"], ["tax", "LOW"], ["planOverridden", "MEDIUM"],
    ]);
    expect(r).toMatchObject({ maxSeverity: "MEDIUM", requiresAck: false });
  });

  it("finding ids are sequential", () => {
    const r = compare(demo, paypalToTerms(trap), { cancelAnytime: true, claimedPrice: 1, quotes: ["Cancel anytime."] });
    expect(r.findings.map((f) => f.id)).toEqual(r.findings.map((_, i) => `F${i + 1}`));
  });
});
