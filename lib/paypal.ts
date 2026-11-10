type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

export class PayPalApiError extends Error {
  constructor(readonly status: number, readonly debugId: string | null) {
    super("PayPal request failed");
    this.name = "PayPalApiError";
  }
}

let cached: { token: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function baseUrl(): string {
  const base = process.env.PAYPAL_BASE;
  if (!base) throw new PayPalApiError(503, null);
  return base.replace(/\/+$/, "");
}

function logPayPalResponse(status: number | null, debugId: string | null) {
  console.info(JSON.stringify({ event: "paypal_response", status, debugId }));
}

async function requestToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new PayPalApiError(503, null);

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch {
    logPayPalResponse(null, null);
    throw new PayPalApiError(502, null);
  }

  const debugId = response.headers.get("PayPal-Debug-Id");
  logPayPalResponse(response.status, debugId);
  if (!response.ok) throw new PayPalApiError(response.status, debugId);

  const payload = await response.json().catch(() => null) as TokenResponse | null;
  if (!payload || typeof payload.access_token !== "string") {
    throw new PayPalApiError(502, debugId);
  }

  const expiresIn = Number(payload.expires_in);
  cached = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (Number.isFinite(expiresIn) ? expiresIn : 0) - 60) * 1000,
  };
  return cached.token;
}

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  if (!tokenRequest) {
    tokenRequest = requestToken().finally(() => {
      tokenRequest = null;
    });
  }
  return tokenRequest;
}

export async function paypal<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await accessToken()}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(new URL(path, `${baseUrl()}/`), { ...init, headers });
  } catch {
    logPayPalResponse(null, null);
    throw new PayPalApiError(502, null);
  }

  const debugId = response.headers.get("PayPal-Debug-Id");
  logPayPalResponse(response.status, debugId);
  if (!response.ok) throw new PayPalApiError(response.status, debugId);

  const payload = await response.json().catch(() => null);
  if (payload === null) throw new PayPalApiError(502, debugId);
  return payload as T;
}

export function paypalErrorResponse(): Response {
  return Response.json({ error: "paypal_request_failed" }, { status: 502 });
}
