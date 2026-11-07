import { paypal, paypalErrorResponse } from "@/lib/paypal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { id } = await params;
  try {
    const data = await paypal<{
      id: string;
      status: string;
      plan_id: string;
    }>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);

    return Response.json({
      id: data.id,
      status: data.status,
      plan_id: data.plan_id,
    });
  } catch {
    return paypalErrorResponse();
  }
}
