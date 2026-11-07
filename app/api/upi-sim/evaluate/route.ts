import { z } from "zod";
import { evaluateUpiMandate, UPI_MOCK_MANDATES, UPI_SIMULATION_NOTICE } from "@/lib/upi";

const intentSchema = z.object({
  maxRecurringAmount: z.number().finite().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  expectedTrialDays: z.number().int().nonnegative().nullable(),
  expectedTrialPrice: z.number().finite().nonnegative().nullable(),
  expectedInterval: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
  maxCommitmentMonths: z.number().finite().nonnegative().nullable(),
  wantsOneTime: z.boolean().nullable(),
}).strict();

const requestSchema = z.object({
  mandateId: z.string().min(1).max(80),
  intentText: z.string().trim().max(1200).optional(),
  intentOverride: intentSchema.nullable().optional(),
}).strict();

export async function GET(): Promise<Response> {
  return Response.json({ simulation: true, notice: UPI_SIMULATION_NOTICE, mandates: UPI_MOCK_MANDATES });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request body" }, { status: 400 });

  try {
    const result = await evaluateUpiMandate(parsed.data);
    if (!result) return Response.json({ error: "Unknown mock mandate" }, { status: 404 });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Unable to evaluate the simulated mandate" }, { status: 500 });
  }
}
