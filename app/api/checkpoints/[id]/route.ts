import { logEvent, q } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  try {
    const { rows: [checkpoint] } = await q(
      "SELECT * FROM checkpoints WHERE id = $1",
      [id],
    );
    if (!checkpoint) {
      await logEvent(null, "CHECKPOINT_NOT_FOUND", "app", { checkpointId: id }).catch(() => undefined);
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    await logEvent(id, "CHECKPOINT_VIEWED", "app", {});
    return Response.json({
      id: checkpoint.id,
      intent: checkpoint.intent_json,
      terms: checkpoint.terms_json,
      findings: checkpoint.findings_json,
      maxSeverity: checkpoint.max_severity,
      requiresAck: checkpoint.max_severity === "HIGH",
      explanation: checkpoint.explanation,
      decision: checkpoint.decision,
      paypalStatus: checkpoint.paypal_status,
    });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
