export async function GET() {
  return Response.json({ clientId: process.env.PAYPAL_CLIENT_ID });
}
