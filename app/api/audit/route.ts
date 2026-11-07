import { logEvent, q } from "@/lib/db";

export async function GET(): Promise<Response> {
  await logEvent(null, "AUDIT_VIEWED", "app", {}).catch(() => undefined);

  try {
    const { rows } = await q(
      `SELECT c.id, c.created_at, c.plan_id, c.subscription_id, c.intent_text,
              c.intent_json, c.merchant_copy, c.claims_json, c.terms_json,
              c.terms_hash, c.findings_json, c.max_severity, c.explanation,
              c.decision, c.acked_ids, c.decided_at, c.paypal_status,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', e.id,
                    'type', e.type,
                    'source', e.source,
                    'payload', e.payload,
                    'verified', e.verified,
                    'created_at', e.created_at
                  ) ORDER BY e.created_at DESC
                ) FILTER (WHERE e.id IS NOT NULL),
                '[]'::json
              ) AS events
       FROM checkpoints c
       LEFT JOIN audit_events e ON e.checkpoint_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 50`,
    );
    return Response.json(rows);
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
