import type { PoolClient } from "pg";
import { logEvent, pool } from "@/lib/db";
import { paypal } from "@/lib/paypal";

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
  [key: string]: unknown;
};

async function addEvent(
  client: PoolClient,
  checkpointId: string | null,
  type: string,
  payload: unknown,
  paypalEventId: string,
  verified: boolean,
) {
  await client.query(
    `INSERT INTO audit_events
       (checkpoint_id, type, source, paypal_event_id, verified, payload)
     VALUES ($1, $2, 'paypal_webhook', $3, $4, $5::jsonb)
     ON CONFLICT (paypal_event_id) DO NOTHING`,
    [checkpointId, type, paypalEventId, verified, JSON.stringify(payload)],
  );
}

async function invalidBodyResponse(): Promise<Response> {
  await logEvent(null, "WEBHOOK_REJECTED", "paypal_webhook", { reason: "invalid_body" }).catch(() => undefined);
  return Response.json({ error: "invalid_body" }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  let event: PayPalWebhookEvent;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (
      typeof parsed !== "object" || parsed === null ||
      !("id" in parsed) || typeof parsed.id !== "string" || !parsed.id ||
      !("event_type" in parsed) || typeof parsed.event_type !== "string" || !parsed.event_type
    ) {
      return invalidBodyResponse();
    }
    event = parsed as PayPalWebhookEvent;
  } catch {
    return invalidBodyResponse();
  }

  const headers = request.headers;
  let verified = false;
  try {
    const result = await paypal<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: event,
        }),
      },
    );
    verified = result.verification_status === "SUCCESS";
  } catch {
    verified = false;
  }

  const resource = event.resource ?? {};
  const resourceIdValue = resource.billing_agreement_id ?? resource.id;
  const resourceId = typeof resourceIdValue === "string" ? resourceIdValue : null;
  const customIdValue = resource.custom_id ?? resource.custom;
  const customId = typeof customIdValue === "string" ? customIdValue : null;

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
    const inserted = await client.query(
      `INSERT INTO webhook_events (event_id, type, resource_id, raw, verified)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.event_type, resourceId, rawBody, verified],
    );

    if (inserted.rowCount === 0) {
      await client.query("COMMIT");
      transactionOpen = false;
      return new Response("ok", { status: 200 });
    }

    const checkpointResult = await client.query(
      `SELECT id FROM checkpoints
       WHERE ($1::text IS NOT NULL AND subscription_id = $1)
          OR ($2::text IS NOT NULL AND id = $2)
       LIMIT 1`,
      [resourceId, customId],
    );
    const checkpointId = checkpointResult.rows[0]?.id ?? null;

    await addEvent(
      client,
      checkpointId,
      `WEBHOOK_${event.event_type}`,
      event,
      event.id,
      verified,
    );

    if (verified && checkpointId && event.event_type.startsWith("BILLING.SUBSCRIPTION.")) {
      const status = typeof resource.status === "string" ? resource.status : null;
      await client.query(
        "UPDATE checkpoints SET paypal_status = $2 WHERE id = $1",
        [checkpointId, status],
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return new Response("ok", { status: 200 });
  } catch {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    return Response.json({ error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
