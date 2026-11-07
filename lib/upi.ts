import { explain, extractIntent, type AiSource } from "./ai";
import { compare } from "./compare";
import type { Intent, Interval, Terms } from "./types";

/** This demo is isolated from NPCI, banks, UPI apps, and payment rails. */
export const UPI_SIMULATION_NOTICE =
  "Simulation only: not connected to NPCI, any bank, or any UPI app. No mandate or payment is created. Amounts are maximum debit caps, not guaranteed charges.";

export type UpiMandate = {
  id: string;
  merchant: string;
  purpose: string;
  currency: "INR";
  maxAmount: number;
  intervalUnit: Interval;
  intervalCount: number;
  firstDebitDate: string;
  validityEndDate: string;
};

// Fixed sample data keeps the simulator predictable for a live demo.
export const UPI_MOCK_MANDATES: readonly UpiMandate[] = [
  {
    id: "streambox-monthly",
    merchant: "StreamBox",
    purpose: "Video streaming",
    currency: "INR",
    maxAmount: 149,
    intervalUnit: "MONTH",
    intervalCount: 1,
    firstDebitDate: "2026-11-10",
    validityEndDate: "2027-11-10",
  },
  {
    id: "dailyfresh-weekly",
    merchant: "DailyFresh",
    purpose: "Weekly grocery delivery",
    currency: "INR",
    maxAmount: 500,
    intervalUnit: "WEEK",
    intervalCount: 1,
    firstDebitDate: "2026-11-12",
    validityEndDate: "2027-02-11",
  },
  {
    id: "utility-annual",
    merchant: "BrightPower",
    purpose: "Annual utility plan",
    currency: "INR",
    maxAmount: 2400,
    intervalUnit: "YEAR",
    intervalCount: 1,
    firstDebitDate: "2027-01-01",
    validityEndDate: "2029-01-01",
  },
];

export type UpiEvaluationInput = {
  mandateId: string;
  intentText?: string;
  intentOverride?: Intent | null;
};

export type UpiEvaluation = {
  simulation: true;
  notice: string;
  mandate: UpiMandate;
  intent: Intent | null;
  terms: Terms;
  findings: ReturnType<typeof compare>["findings"];
  maxSeverity: ReturnType<typeof compare>["maxSeverity"];
  requiresAck: boolean;
  explanation: string;
  needsIntent: boolean;
  ai: { intent: AiSource | "manual" | "none"; explanation: AiSource };
};

/** Convert a mock mandate to the shared terms shape without implying a fixed spend. */
export function upiMandateToTerms(mandate: UpiMandate): Terms {
  const firstDebit = parseDate(mandate.firstDebitDate);
  const validityEnd = parseDate(mandate.validityEndDate);
  if (validityEnd < firstDebit) throw new Error("mandate validity ends before its first debit");
  if (!Number.isFinite(mandate.maxAmount) || mandate.maxAmount < 0) throw new Error("invalid mandate amount");
  if (!Number.isInteger(mandate.intervalCount) || mandate.intervalCount < 1) throw new Error("invalid mandate frequency");

  return {
    currency: mandate.currency,
    initialCharge: 0,
    trialDays: null,
    trialPrice: null,
    recurringAmount: mandate.maxAmount,
    intervalUnit: mandate.intervalUnit,
    intervalCount: mandate.intervalCount,
    // UPI mandates can be revoked; validity is shown separately and is not a
    // promise that this many debits will happen or a fixed purchase commitment.
    regularCycles: countPossibleDebits(firstDebit, validityEnd, mandate.intervalUnit, mandate.intervalCount),
    commitmentMonths: null,
    totalCommitted: null,
    setupFee: 0,
    taxPercent: 0,
    taxInclusive: true,
    startTime: `${mandate.firstDebitDate}T00:00:00.000Z`,
    planOverridden: false,
  };
}

export async function evaluateUpiMandate(input: UpiEvaluationInput): Promise<UpiEvaluation | null> {
  const mandate = UPI_MOCK_MANDATES.find((item) => item.id === input.mandateId);
  if (!mandate) return null;

  const intentResult = input.intentOverride || !input.intentText?.trim()
    ? null
    : await extractIntent(input.intentText);
  const intent = input.intentOverride ?? intentResult?.intent ?? null;
  const terms = upiMandateToTerms(mandate);
  const result = compare(intent ?? EMPTY_INTENT, terms);

  // The shared comparison engine treats recurringAmount as a price. For UPI,
  // the value is only an upper bound, so keep that distinction in every finding.
  const findings = result.findings.map((finding) => {
    if (finding.field === "recurringAmount") return { ...finding, actual: `up to ${finding.actual}` };
    if (finding.field === "recurring") {
      return { ...finding, actual: finding.actual.replace("recurring ", "recurring with a debit cap of up to ") };
    }
    return finding;
  });
  const { explanation, source } = await explain(terms, findings, intent);

  return {
    simulation: true,
    notice: UPI_SIMULATION_NOTICE,
    mandate,
    intent,
    terms,
    findings,
    maxSeverity: result.maxSeverity,
    requiresAck: result.requiresAck,
    explanation,
    needsIntent: intent == null,
    ai: {
      intent: input.intentOverride ? "manual" : intentResult?.source ?? "none",
      explanation: source,
    },
  };
}

const EMPTY_INTENT: Intent = {
  maxRecurringAmount: null,
  currency: null,
  expectedTrialDays: null,
  expectedTrialPrice: null,
  expectedInterval: null,
  maxCommitmentMonths: null,
  wantsOneTime: null,
};

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("mandate dates must use YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("invalid mandate date");
  }
  return date;
}

function countPossibleDebits(firstDebit: Date, validityEnd: Date, unit: Interval, count: number): number {
  let occurrences = 0;
  let debitDate = firstDebit;
  // A defensive bound also makes this helper safe if mock data is edited later.
  while (debitDate <= validityEnd && occurrences < 10_000) {
    occurrences++;
    // Recalculate from the original debit date to avoid month-end drift
    // (Jan 31 -> Feb 28 -> Mar 28 instead of Mar 31).
    debitDate = addInterval(firstDebit, unit, count * occurrences);
  }
  if (debitDate <= validityEnd) throw new Error("mandate validity has too many billing cycles");
  return occurrences;
}

function addInterval(date: Date, unit: Interval, count: number): Date {
  const next = new Date(date);
  if (unit === "DAY" || unit === "WEEK") {
    next.setUTCDate(next.getUTCDate() + count * (unit === "WEEK" ? 7 : 1));
    return next;
  }

  const originalDay = next.getUTCDate();
  const monthsToAdd = count * (unit === "YEAR" ? 12 : 1);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + monthsToAdd);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDay));
  return next;
}
