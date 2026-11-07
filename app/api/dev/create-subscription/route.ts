import { PLANS } from "@/lib/plans";
import { paypal } from "@/lib/paypal";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("planKey" in body) ||
    typeof body.planKey !== "string"
  ) {
    return Response.json({ error: "Invalid plan key" }, { status: 400 });
  }

  const plan = PLANS.find((candidate) => candidate.key === body.planKey);
  if (!plan) {
    return Response.json({ error: "Invalid plan key" }, { status: 400 });
  }

  const planId = process.env[plan.envId];
  if (!planId) {
    return Response.json({ error: "Plan is not configured" }, { status: 500 });
  }

  try {
    const data = await paypal<{ id: string }>("/v1/billing/subscriptions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ plan_id: planId }),
    });
    return Response.json({ subscriptionId: data.id });
  } catch {
    return Response.json({ error: "Unable to create subscription" }, { status: 502 });
  }
}
