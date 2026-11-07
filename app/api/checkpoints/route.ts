import { randomUUID } from "node:crypto";
import { z } from "zod";
import { compare } from "@/lib/compare";
import { extractClaims, extractIntent, explain, templateExplanation } from "@/lib/ai";
import { logEvent, q } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { paypal, paypalErrorResponse } from "@/lib/paypal";
import { hashTerms, paypalToTerms, type PayPalSubscription } from "@/lib/terms";
import type { CheckpointResponse, Claims, Intent, Terms } from "@/lib/types";

const intentSchema = z.object({
  maxRecurringAmount: z.number().nonnegative().nullable(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/).nullable(),
  expectedTrialDays: z.number().int().nonnegative().nullable(),
  expectedTrialPrice: z.number().nonnegative().nullable(),
  expectedInterval: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
  maxCommitmentMonths: z.number().nonnegative().nullable(),
  wantsOneTime: z.boolean().nullable(),
}).strict();

const requestSchema = z.object({
  planKey: z.string().trim().min(1),
  intentText: z.string().trim().max(5000),
  intentOverride: intentSchema.nullable().optional(),
}).strict();

const emptyIntent: Intent = {
  maxRecurringAmount: null,
  currency: null,
  expectedTrialDays: null,
  expectedTrialPrice: null,
  expectedInterval: null,
  maxCommitmentMonths: null,
  wantsOneTime: null,
};

async function safeLogEvent(checkpointId: string | null, type: string, payload: unknown) {
  await logEvent(checkpointId, type, "app", payload).catch(() => undefined);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await safeLogEvent(null, "CHECKPOINT_REQUEST_REJECTED", { reason: "invalid_json" });
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    await safeLogEvent(null, "CHECKPOINT_REQUEST_REJECTED", { reason: "invalid_body" });
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { planKey, intentText, intentOverride } = parsed.data;
  const plan = PLANS.find((candidate) => candidate.key === planKey);
  if (!plan) {
    await safeLogEvent(null, "CHECKPOINT_REQUEST_REJECTED", { reason: "unknown_plan" });
    return Response.json({ error: "unknown_plan" }, { status: 400 });
  }

  const planId = process.env[plan.envId];
  if (!planId) {
    await safeLogEvent(null, "CHECKPOINT_CREATION_FAILED", { reason: "plan_not_configured" });
    return Response.json({ error: "plan_not_configured" }, { status: 500 });
  }

  const id = `chk_${randomUUID()}`;
  let terms: Terms;
  try {
    const planTerms = await paypal<PayPalSubscription["plan"]>(
      `/v1/billing/plans/${encodeURIComponent(planId)}`,
    );
    terms = paypalToTerms({ plan: planTerms });
  } catch {
    await safeLogEvent(null, "CHECKPOINT_CREATION_FAILED", { checkpointId: id, stage: "fetch_plan" });
    return paypalErrorResponse();
  }

  let intent: Intent | null;
  if (intentOverride !== undefined) {
    intent = intentOverride;
  } else {
    try {
      intent = (await extractIntent(intentText)).intent;
    } catch {
      intent = null;
    }
  }

  let claims: Claims | null = null;
  try {
    claims = (await extractClaims(plan.copy)).claims;
  } catch {
    claims = null;
  }

  const result = compare(intent ?? emptyIntent, terms, claims);
  let explanation: string;
  try {
    explanation = (await explain(terms, result.findings, intent)).explanation;
  } catch {
    explanation = templateExplanation(result.findings);
  }

  try {
    await q(
      `INSERT INTO checkpoints
        (id, plan_id, intent_text, intent_json, merchant_copy, claims_json,
         terms_json, terms_hash, findings_json, max_severity, explanation, paypal_status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, NULL)`,
      [
        id,
        planId,
        intentText,
        JSON.stringify(intent),
        plan.copy,
        claims === null ? null : JSON.stringify(claims),
        JSON.stringify(terms),
        hashTerms(terms),
        JSON.stringify(result.findings),
        result.maxSeverity,
        explanation,
      ],
    );
    await logEvent(id, "CHECKPOINT_EVALUATED", "app", { maxSeverity: result.maxSeverity });
  } catch {
    await safeLogEvent(null, "CHECKPOINT_CREATION_FAILED", { checkpointId: id, stage: "save" });
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  const response: CheckpointResponse = {
    id,
    intent,
    terms,
    findings: result.findings,
    maxSeverity: result.maxSeverity,
    requiresAck: result.requiresAck,
    explanation,
  };
  return Response.json(response);
}
