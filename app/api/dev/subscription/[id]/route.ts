import { paypal } from "@/lib/paypal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
}
