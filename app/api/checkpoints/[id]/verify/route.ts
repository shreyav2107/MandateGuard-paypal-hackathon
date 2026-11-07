import { logEvent, q } from "@/lib/db";
import { paypal, paypalErrorResponse } from "@/lib/paypal";
import { hashTerms, paypalToTerms, type PayPalSubscription } from "@/lib/terms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let checkpoint;
  try {
    const result = await q(
      "SELECT id, subscription_id, decision, terms_json, terms_hash FROM checkpoints WHERE id = $1",
      [id],
    );
    checkpoint = result.rows[0];
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  if (!checkpoint) {
    await logEvent(null, "CHECKPOINT_NOT_FOUND", "app", { checkpointId: id }).catch(() => undefined);
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (checkpoint.decision !== "PROCEED" || !checkpoint.subscription_id) {
    await logEvent(id, "CHECKPOINT_VERIFY_REJECTED", "app", { reason: "not_proceeded" }).catch(() => undefined);
    return Response.json({ error: "not_proceeded" }, { status: 409 });
  }

  let subscription: PayPalSubscription;
  try {
    subscription = await paypal<PayPalSubscription>(
      `/v1/billing/subscriptions/${encodeURIComponent(checkpoint.subscription_id)}?fields=plan`,
    );
  } catch {
    await logEvent(id, "PAYPAL_REQUEST_FAILED", "app", { stage: "verify_subscription" }).catch(() => undefined);
    return paypalErrorResponse();
  }

  let sameTerms: boolean;
  try {
    const comparable = paypalToTerms({
      ...subscription,
      start_time: checkpoint.terms_json.startTime ?? undefined,
    });
    sameTerms = hashTerms(comparable) === checkpoint.terms_hash;
  } catch {
    await logEvent(id, "PAYPAL_RESPONSE_INVALID", "app", { stage: "verify_subscription" }).catch(() => undefined);
    return paypalErrorResponse();
  }

  try {
    await q("UPDATE checkpoints SET paypal_status = $2 WHERE id = $1", [id, subscription.status ?? null]);
    await logEvent(id, "PAYPAL_APPROVAL_VERIFIED", "paypal_api", {
      status: subscription.status ?? null,
      sameTerms,
    });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  return Response.json({ status: subscription.status ?? "UNKNOWN", sameTerms });
}
