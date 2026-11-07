import { explain, extractClaims, extractIntent, type AiSource } from "./ai";
import { compare } from "./compare";
import { hashTerms, paypalToTerms, type PayPalSubscription } from "./terms";
import type { CheckpointResponse, Intent } from "./types";

// One call for POST /api/checkpoints: PayPal subscription + shopper text + marketing copy
// -> everything the checkpoint screen needs. Never throws because of AI: with Gemini off,
// rate-limited or a wrong key, terms checks still run and the explanation is a template.

export type CheckpointInput = {
  subscription: PayPalSubscription; // GET /v1/billing/subscriptions/{id}?fields=plan
  intentText?: string; // what the shopper typed
  intentOverride?: Intent | null; // the manual form; wins over AI when present
  planCopy?: string; // the merchant's marketing text for this plan
};

export type CheckpointEvaluation = Omit<CheckpointResponse, "id"> & {
  termsHash: string; // store it; re-check before releasing the subscription id
  needsIntent: boolean; // true -> show the manual intent form
  ai: { intent: AiSource | "manual" | "none"; claims: AiSource | "none"; explanation: AiSource };
};

export async function evaluateCheckpoint(input: CheckpointInput): Promise<CheckpointEvaluation> {
  const terms = paypalToTerms(input.subscription);

  const [intentRes, claimsRes] = await Promise.all([
    input.intentOverride || !input.intentText?.trim() ? null : extractIntent(input.intentText),
    input.planCopy?.trim() ? extractClaims(input.planCopy) : null,
  ]);
  const intent = input.intentOverride ?? intentRes?.intent ?? null;

  // With no intent we still check the terms on their own (fixed term, fees, claims).
  const result = compare(intent ?? EMPTY_INTENT, terms, claimsRes?.claims);
  const { explanation, source } = await explain(terms, result.findings, intent);

  return {
    intent,
    terms,
    termsHash: hashTerms(terms),
    ...result,
    explanation,
    needsIntent: intent == null,
    ai: {
      intent: input.intentOverride ? "manual" : intentRes?.source ?? "none",
      claims: claimsRes?.source ?? "none",
      explanation: source,
    },
  };
}

const EMPTY_INTENT: Intent = {
  maxRecurringAmount: null, currency: null, expectedTrialDays: null, expectedTrialPrice: null,
  expectedInterval: null, maxCommitmentMonths: null, wantsOneTime: null,
};
