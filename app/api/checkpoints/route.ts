import { z } from "zod";
import { evaluateCheckpoint } from "@/lib/checkpoint";
import { DEMO_SUBSCRIPTIONS } from "@/lib/demo-subscriptions";
import { PLANS } from "@/lib/plans";
import type { Intent } from "@/lib/types";

const intentSchema = z.object({
  maxRecurringAmount: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).nullable(),
  expectedTrialDays: z.number().int().nonnegative().nullable(),
  expectedTrialPrice: z.number().finite().nonnegative().nullable(),
  expectedInterval: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
  maxCommitmentMonths: z.number().finite().nonnegative().nullable(),
  wantsOneTime: z.boolean().nullable(),
}).strict();

const requestSchema = z.object({
  planKey: z.enum(["honest", "trap", "borderline"]),
  intentText: z.string().trim().max(1200).optional(),
  intentOverride: intentSchema.nullable().optional(),
}).strict();

/** Evaluate one of the server-owned demo subscriptions; never trust client terms. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request body" }, { status: 400 });

  const plan = PLANS.find((item) => item.key === parsed.data.planKey);
  if (!plan) return Response.json({ error: "Unknown demo plan" }, { status: 404 });

  try {
    const result = await evaluateCheckpoint({
      subscription: DEMO_SUBSCRIPTIONS[parsed.data.planKey],
      intentText: parsed.data.intentText,
      intentOverride: parsed.data.intentOverride as Intent | null | undefined,
      planCopy: plan.copy,
    });
    return Response.json({ plan, ...result });
  } catch {
    return Response.json({ error: "Unable to evaluate this subscription" }, { status: 500 });
  }
}
