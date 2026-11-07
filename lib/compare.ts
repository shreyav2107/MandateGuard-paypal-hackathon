import type { Claims, CompareResult, Finding, Intent, MaxSeverity, Terms } from "./types";

// The heart of MandateGuard: every money, date and frequency check is plain code,
// so results are predictable and explainable. AI only supplies Intent and Claims.

const cents = (n: number) => Math.round(n * 100);
const money = (n: number | null, c = "USD") =>
  n == null ? "—" : `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;
const per = (t: Terms) =>
  !t.intervalUnit ? "" : t.intervalCount && t.intervalCount > 1
    ? ` every ${t.intervalCount} ${t.intervalUnit.toLowerCase()}s`
    : ` per ${t.intervalUnit.toLowerCase()}`;

const ORDER: Record<MaxSeverity, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

export function compare(intent: Intent, t: Terms, claims?: Claims | null): CompareResult {
  const findings: Finding[] = [];
  const add = (field: string, severity: Finding["severity"], expected: string, actual: string,
    source: Finding["source"] = "deterministic") =>
    findings.push({ id: `F${findings.length + 1}`, field, severity, expected, actual, source });
  const m = (n: number | null) => money(n, t.currency);

  if (intent.currency && intent.currency.toUpperCase() !== t.currency)
    add("currency", "HIGH", intent.currency.toUpperCase(), t.currency);

  if (intent.wantsOneTime && t.recurringAmount)
    add("recurring", "HIGH", "one-time payment", `recurring ${m(t.recurringAmount)}${per(t)}`);

  if (intent.maxRecurringAmount != null && t.recurringAmount != null && cents(t.recurringAmount) > cents(intent.maxRecurringAmount))
    add("recurringAmount", "HIGH", `≤ ${m(intent.maxRecurringAmount)}`, `${m(t.recurringAmount)}${per(t)}`);

  if (intent.expectedInterval && t.intervalUnit &&
      (intent.expectedInterval !== t.intervalUnit || (t.intervalCount ?? 1) !== 1))
    add("interval", "HIGH", intent.expectedInterval.toLowerCase(), per(t).trim());

  // A fixed term is a surprise unless the buyer said they accept at least that long.
  if (t.commitmentMonths != null && (intent.maxCommitmentMonths == null || intent.maxCommitmentMonths < t.commitmentMonths))
    add("commitment", "HIGH",
      intent.maxCommitmentMonths != null ? `≤ ${intent.maxCommitmentMonths} months` : "no fixed term",
      `${t.commitmentMonths} months (${m(t.totalCommitted)} total)`);

  if (intent.expectedTrialDays != null && (t.trialDays ?? 0) < intent.expectedTrialDays) {
    const actual = t.trialDays ?? 0;
    add("trialDays", actual <= intent.expectedTrialDays / 2 ? "HIGH" : "MEDIUM",
      `${intent.expectedTrialDays} days`, actual ? `${actual} days` : "no trial");
  }

  if (intent.expectedTrialPrice != null && t.trialPrice != null && cents(t.trialPrice) > cents(intent.expectedTrialPrice))
    add("trialPrice", "MEDIUM", m(intent.expectedTrialPrice), m(t.trialPrice));

  if (t.setupFee > 0) add("setupFee", "MEDIUM", "no setup fee", m(t.setupFee));
  if (!t.taxInclusive && t.taxPercent > 0) add("tax", "LOW", "price includes tax", `+${t.taxPercent}% tax`);
  if (t.planOverridden) add("planOverridden", "MEDIUM", "standard plan terms", "terms customised for this subscription");

  // Merchant claims (from AI, with quotes) checked against the real terms.
  if (claims?.cancelAnytime && t.commitmentMonths != null)
    add("cancelClaim", "HIGH", `merchant says "${claims.quotes[0] ?? "cancel anytime"}"`,
      `billing set for ${t.regularCycles} payments (${t.commitmentMonths} months)`, "ai_claim+deterministic");

  if (claims?.claimedPrice != null && t.recurringAmount != null &&
      cents(claims.claimedPrice) !== cents(t.recurringAmount) &&
      (t.trialPrice == null || cents(claims.claimedPrice) !== cents(t.trialPrice)))
    add("claimedPrice", "HIGH", `advertised ${m(claims.claimedPrice)}`, `charged ${m(t.recurringAmount)}${per(t)}`,
      "ai_claim+deterministic");

  const maxSeverity = findings.reduce<MaxSeverity>((max, f) => (ORDER[f.severity] > ORDER[max] ? f.severity : max), "NONE");
  return { findings, maxSeverity, requiresAck: maxSeverity === "HIGH" };
}
