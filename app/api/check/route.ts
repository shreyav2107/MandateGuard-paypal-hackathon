import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { checkMandate, type CheckMandateLog, type CheckSource } from "@/lib/gemini";
import { getPool } from "@/lib/db";

const requestSchema = z
  .object({
    description: z.string().trim().min(1),
    plan_id: z.string().min(1).optional(),
    max_amount: z.number().finite().nonnegative().optional(),
  })
  .strict();

function logRequest(
  source: CheckSource | "none",
  skippedStatusCodes: number[] = [],
  httpStatus?: number,
) {
  const entry: {
    event: "mandate_check";
    source: CheckSource | "none";
    skipped_status_codes?: number[];
    http_status?: number;
  } = { event: "mandate_check", source };

  if (skippedStatusCodes.length > 0) {
    entry.skipped_status_codes = skippedStatusCodes;
  }
  if (httpStatus !== undefined) {
    entry.http_status = httpStatus;
  }

  console.info(JSON.stringify(entry));
}

export async function POST(request: Request): Promise<Response> {
  let hasLoggedRequest = false;
  const emitLog = (
    source: CheckSource | "none",
    skippedStatusCodes: number[] = [],
    httpStatus?: number,
  ) => {
    if (hasLoggedRequest) return;
    hasLoggedRequest = true;
    logRequest(source, skippedStatusCodes, httpStatus);
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    emitLog("none", [], 400);
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    emitLog("none", [], 400);
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  let pool: Pool | undefined;

  try {
    pool = await getPool();
    const mandateInsert = await pool.query<{ id: string }>(
      `INSERT INTO mandates (plan_id, description, max_amount, status)
       VALUES ($1, $2, $3, 'checked')
       RETURNING id`,
      [
        parsedBody.data.plan_id ?? null,
        parsedBody.data.description,
        parsedBody.data.max_amount ?? null,
      ],
    );
    const mandateId = mandateInsert.rows[0]?.id;

    if (!mandateId) {
      emitLog("none", [], 500);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const logger = (details: CheckMandateLog) => {
      emitLog(details.source, details.skippedStatusCodes);
    };
    const result = await checkMandate(parsedBody.data.description, logger);
    const descriptionHash = createHash("sha256")
      .update(parsedBody.data.description.trim().toLowerCase())
      .digest("hex");

    await pool.query(
      `INSERT INTO checks
         (mandate_id, ai_verdict, ai_reason, risk_score, description_hash, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        mandateId,
        result.verdict,
        result.reason,
        result.risk_score,
        descriptionHash,
        result.source,
      ],
    );

    return Response.json({ mandate_id: mandateId, ...result });
  } catch {
    emitLog("none", [], 500);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
