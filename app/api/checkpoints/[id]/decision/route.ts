import type { PoolClient } from "pg";
import { z } from "zod";
import { logEvent, pool } from "@/lib/db";
import { paypal, paypalErrorResponse } from "@/lib/paypal";
import { hashTerms, paypalToTerms, type PayPalSubscription } from "@/lib/terms";

const requestSchema = z.object({
  decision: z.enum(["PROCEED", "ABANDON"]),
  ackedIds: z.array(z.string()).default([]),
}).strict();

async function addEvent(
  client: PoolClient,
  checkpointId: string | null,
  type: string,
  payload: unknown = {},
) {
  await client.query(
    `INSERT INTO audit_events (checkpoint_id, type, source, payload)
     VALUES ($1, $2, 'app', $3::jsonb)`,
    [checkpointId, type, JSON.stringify(payload)],
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await logEvent(null, "DECISION_REQUEST_REJECTED", "app", { checkpointId: id, reason: "invalid_json" }).catch(() => undefined);
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    await logEvent(null, "DECISION_REQUEST_REJECTED", "app", { checkpointId: id, reason: "invalid_body" }).catch(() => undefined);
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const { decision, ackedIds } = parsed.data;
    const { rows: [checkpoint] } = await client.query(
      "SELECT * FROM checkpoints WHERE id = $1 FOR UPDATE",
      [id],
    );

    if (!checkpoint) {
      await addEvent(client, null, "CHECKPOINT_NOT_FOUND", { checkpointId: id });
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    if (decision === "ABANDON") {
      if (checkpoint.decision === "PROCEED") {
        await addEvent(client, id, "DECISION_REJECTED", { reason: "already_proceeded" });
        await client.query("COMMIT");
        transactionOpen = false;
        return Response.json({ error: "already_decided" }, { status: 409 });
      }

      if (checkpoint.decision !== "ABANDON") {
        await client.query(
          "UPDATE checkpoints SET decision = 'ABANDON', decided_at = now() WHERE id = $1",
          [id],
        );
      }
      await addEvent(client, id, "USER_ABANDONED");
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ ok: true });
    }

    const highIds: string[] = (checkpoint.findings_json as { id: string; severity: string }[])
      .filter((finding) => finding.severity === "HIGH")
      .map((finding) => finding.id);
    const missing = highIds.filter((findingId) => !ackedIds.includes(findingId));
    if (missing.length > 0) {
      await addEvent(client, id, "DECISION_ACK_REQUIRED", { missing });
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ error: "ack_required", missing }, { status: 400 });
    }

    if (checkpoint.decision === "ABANDON") {
      await addEvent(client, id, "DECISION_REJECTED", { reason: "already_abandoned" });
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ error: "already_decided" }, { status: 409 });
    }

    if (checkpoint.decision === "PROCEED" && checkpoint.subscription_id) {
      await addEvent(client, id, "USER_PROCEEDED_REPLAYED", { ackedIds });
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ subscriptionId: checkpoint.subscription_id });
    }

    let freshTerms;
    try {
      const plan = await paypal<PayPalSubscription["plan"]>(
        `/v1/billing/plans/${encodeURIComponent(checkpoint.plan_id)}`,
      );
      freshTerms = paypalToTerms({ plan });
    } catch {
      await addEvent(client, id, "PAYPAL_REQUEST_FAILED", { stage: "refetch_plan" });
      await client.query("COMMIT");
      transactionOpen = false;
      return paypalErrorResponse();
    }

    if (hashTerms(freshTerms) !== checkpoint.terms_hash) {
      await addEvent(client, id, "TERMS_CHANGED");
      await client.query("COMMIT");
      transactionOpen = false;
      return Response.json({ error: "terms_changed" }, { status: 409 });
    }

    let created: { id?: string };
    try {
      created = await paypal<{ id?: string }>("/v1/billing/subscriptions", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
          "PayPal-Request-Id": id.startsWith("chk_") ? id.slice(4) : id,
        },
        body: JSON.stringify({ plan_id: checkpoint.plan_id, custom_id: id }),
      });
    } catch {
      await addEvent(client, id, "PAYPAL_REQUEST_FAILED", { stage: "create_subscription" });
      await client.query("COMMIT");
      transactionOpen = false;
      return paypalErrorResponse();
    }

    if (!created.id) {
      await addEvent(client, id, "PAYPAL_REQUEST_FAILED", { stage: "subscription_id_missing" });
      await client.query("COMMIT");
      transactionOpen = false;
      return paypalErrorResponse();
    }

    const { rows: [saved] } = await client.query(
      `UPDATE checkpoints
       SET subscription_id = COALESCE(subscription_id, $2), decision = 'PROCEED',
           acked_ids = $3, decided_at = COALESCE(decided_at, now())
       WHERE id = $1
       RETURNING subscription_id`,
      [id, created.id, ackedIds],
    );
    const subscriptionId = saved?.subscription_id ?? created.id;
    await addEvent(client, id, "USER_PROCEEDED", { ackedIds });
    await client.query("COMMIT");
    transactionOpen = false;
    return Response.json({ subscriptionId });
  } catch {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    await logEvent(id, "DECISION_FAILED", "app", {}).catch(() => undefined);
    return Response.json({ error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
