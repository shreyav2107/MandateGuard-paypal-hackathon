// lib/types.ts  - the shared contract. Change only with the whole team's agreement.
export type Interval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type Terms = {
  currency: string; initialCharge: number; trialDays: number | null; trialPrice: number | null;
  recurringAmount: number | null; intervalUnit: Interval | null; intervalCount: number | null;
  regularCycles: number | null; commitmentMonths: number | null; totalCommitted: number | null;
  setupFee: number; taxPercent: number; taxInclusive: boolean; startTime: string | null; planOverridden: boolean;
};

export type Intent = {
  maxRecurringAmount: number | null; currency: string | null; expectedTrialDays: number | null;
  expectedTrialPrice: number | null; expectedInterval: Interval | null; maxCommitmentMonths: number | null;
  wantsOneTime: boolean | null;
};

export type Claims = { cancelAnytime: boolean | null; claimedPrice: number | null; quotes: string[] };

export type Finding = {
  id: string; field: string; severity: "LOW" | "MEDIUM" | "HIGH";
  expected: string; actual: string; source: "deterministic" | "ai_claim+deterministic";
};

// What POST /api/checkpoints returns to the frontend
export type CheckpointResponse = {
  id: string; intent: Intent | null; terms: Terms;
  findings: Finding[]; maxSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  requiresAck: boolean; explanation: string | null;
};
