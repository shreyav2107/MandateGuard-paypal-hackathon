// lib/types.ts: the shared contract between backend (A), engine (B) and frontend (C).
// Change only with the whole team's agreement.

export type Interval = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type MaxSeverity = "NONE" | Severity;

// The real terms of a PayPal subscription, flattened into plain fields.
export type Terms = {
  currency: string;
  initialCharge: number; // charged at signup: setup fee + first trial/regular price
  trialDays: number | null;
  trialPrice: number | null; // 0 = free trial
  recurringAmount: number | null; // price per regular billing interval
  intervalUnit: Interval | null;
  intervalCount: number | null;
  regularCycles: number | null; // 0 = until cancelled
  commitmentMonths: number | null; // null = no fixed term
  totalCommitted: number | null; // null = no fixed term
  setupFee: number;
  taxPercent: number;
  taxInclusive: boolean;
  startTime: string | null;
  planOverridden: boolean;
};

// What the buyer expects to pay (from the form, or extracted by AI).
export type Intent = {
  maxRecurringAmount: number | null;
  currency: string | null;
  expectedTrialDays: number | null;
  expectedTrialPrice: number | null;
  expectedInterval: Interval | null;
  maxCommitmentMonths: number | null;
  wantsOneTime: boolean | null;
};

// What the merchant's marketing copy promises (extracted by AI, quotes required).
export type Claims = { cancelAnytime: boolean | null; claimedPrice: number | null; quotes: string[] };

export type Finding = {
  id: string;
  field: string;
  severity: Severity;
  expected: string;
  actual: string;
  source: "deterministic" | "ai_claim+deterministic";
};

export type CompareResult = { findings: Finding[]; maxSeverity: MaxSeverity; requiresAck: boolean };

// What POST /api/checkpoints returns to the frontend.
export type CheckpointResponse = {
  id: string;
  intent: Intent | null;
  terms: Terms;
  findings: Finding[];
  maxSeverity: MaxSeverity;
  requiresAck: boolean;
  explanation: string | null;
};
