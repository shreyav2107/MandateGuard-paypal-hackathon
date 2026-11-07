import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateUpiMandate, UPI_MOCK_MANDATES, upiMandateToTerms } from "../lib/upi";
import type { Intent } from "../lib/types";

const monthlyIntent: Intent = {
  maxRecurringAmount: 100,
  currency: "INR",
  expectedTrialDays: null,
  expectedTrialPrice: null,
  expectedInterval: "MONTH",
  maxCommitmentMonths: null,
  wantsOneTime: null,
};

describe("UPI mandate normalization", () => {
  it("provides three fixed INR examples with validity and first debit dates", () => {
    expect(UPI_MOCK_MANDATES).toHaveLength(3);
    expect(UPI_MOCK_MANDATES.every((mandate) => mandate.currency === "INR")).toBe(true);
    expect(UPI_MOCK_MANDATES.every((mandate) => mandate.firstDebitDate && mandate.validityEndDate)).toBe(true);
  });

  it("maps the monthly cap and calculates possible debit dates without promising total spend", () => {
    const terms = upiMandateToTerms(UPI_MOCK_MANDATES[0]);
    expect(terms).toMatchObject({
      currency: "INR",
      recurringAmount: 149,
      intervalUnit: "MONTH",
      intervalCount: 1,
      regularCycles: 13,
      commitmentMonths: null,
      totalCommitted: null,
      startTime: "2026-11-10T00:00:00.000Z",
    });
  });

  it("keeps monthly dates anchored at month end", () => {
    const terms = upiMandateToTerms({
      ...UPI_MOCK_MANDATES[0],
      firstDebitDate: "2027-01-31",
      validityEndDate: "2027-03-31",
    });
    expect(terms.regularCycles).toBe(3);
  });

  it("rejects invalid date ranges and frequencies", () => {
    expect(() => upiMandateToTerms({
      ...UPI_MOCK_MANDATES[0],
      firstDebitDate: "2027-02-29",
    })).toThrow(/invalid mandate date/);
    expect(() => upiMandateToTerms({
      ...UPI_MOCK_MANDATES[0],
      intervalCount: 0,
    })).toThrow(/invalid mandate frequency/);
  });
});

describe("UPI mandate evaluation", () => {
  beforeEach(() => vi.stubEnv("AI_MODE", "mock"));
  afterEach(() => vi.unstubAllEnvs());

  it("compares the debit cap and frequency while labeling the cap clearly", async () => {
    const result = await evaluateUpiMandate({ mandateId: "streambox-monthly", intentOverride: monthlyIntent });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ simulation: true, needsIntent: false, maxSeverity: "HIGH", requiresAck: true });
    expect(result!.findings).toHaveLength(1);
    expect(result!.findings[0]).toMatchObject({
      field: "recurringAmount",
      severity: "HIGH",
      actual: "up to INR 149.00 per month",
    });
    expect(result!.terms.totalCommitted).toBeNull();
    expect(result!.notice).toMatch(/not connected to NPCI/);
  });

  it("returns null for an unknown mock mandate", async () => {
    expect(await evaluateUpiMandate({ mandateId: "unknown" })).toBeNull();
  });
});
