const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

type HttpResult = {
  status: number;
  body: string;
  data: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(path: string, init?: RequestInit): Promise<HttpResult | null> {
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    const body = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      data = null;
    }
    return { status: response.status, body, data };
  } catch {
    return null;
  }
}

const sensitiveKey = /(token|secret|password|authorization|api.?key|client.?id|database.?url)/i;

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/((?:access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|authorization)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[REDACTED]");
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "string") return redactText(value);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redact(child),
    ]),
  );
}

function safePreview(body: string): string {
  try {
    return JSON.stringify(redact(JSON.parse(body))).slice(0, 200);
  } catch {
    return redactText(body).slice(0, 200);
  }
}

let failed = false;

function report(
  name: string,
  passed: boolean,
  result: HttpResult | null,
  reason: string,
) {
  const status = result?.status ?? "NO_RESPONSE";
  console.log(`${passed ? "PASS" : "FAIL"} ${name} HTTP ${status} — ${reason}`);
  if (!passed) {
    failed = true;
    if (result) console.log(`  body: ${safePreview(result.body)}`);
  }
}

async function main() {
  const jsonHeaders = { "Content-Type": "application/json" };
  const trapResult = await request("/api/checkpoints", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      planKey: "trap",
      intentText: "I expect $1 for 7 days, then at most $10 per month, with no commitment.",
      intentOverride: {
        maxRecurringAmount: 10,
        currency: "USD",
        expectedTrialDays: 7,
        expectedTrialPrice: 1,
        expectedInterval: "MONTH",
        maxCommitmentMonths: null,
        wantsOneTime: null,
      },
    }),
  });
  const trapData = trapResult && isRecord(trapResult.data) ? trapResult.data : null;
  const trapId = trapData && typeof trapData.id === "string" ? trapData.id : null;
  const trapPassed = Boolean(
    trapResult?.status === 200 && trapId && trapData?.maxSeverity === "HIGH",
  );
  report("TRAP", trapPassed, trapResult, trapPassed ? "HIGH findings present" : "expected checkpoint id and HIGH severity");

  if (trapId) {
    const gateResult = await request(`/api/checkpoints/${encodeURIComponent(trapId)}/decision`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ decision: "PROCEED", ackedIds: [] }),
    });
    const gateData = gateResult && isRecord(gateResult.data) ? gateResult.data : null;
    const gatePassed = Boolean(
      gateResult?.status === 400 &&
      gateData?.error === "ack_required" &&
      Array.isArray(gateData.missing) &&
      gateData.missing.length > 0,
    );
    report("GATE", gatePassed, gateResult, gatePassed ? "acknowledgement required" : "expected 400 ack_required with missing IDs");
  } else {
    report("GATE", false, null, "skipped because the trap checkpoint has no ID");
  }

  const honestResult = await request("/api/checkpoints", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      planKey: "honest",
      intentText: "I expect $1 for 7 days, then $9.99 per month.",
      intentOverride: {
        maxRecurringAmount: 9.99,
        currency: "USD",
        expectedTrialDays: 7,
        expectedTrialPrice: 1,
        expectedInterval: "MONTH",
        maxCommitmentMonths: null,
        wantsOneTime: null,
      },
    }),
  });
  const honestData = honestResult && isRecord(honestResult.data) ? honestResult.data : null;
  const honestPassed = Boolean(honestResult?.status === 200 && honestData?.maxSeverity === "NONE");
  report("HONEST", honestPassed, honestResult, honestPassed ? "no findings" : "expected maxSeverity NONE");

  const auditResult = await request("/api/audit");
  const auditPassed = Boolean(
    auditResult?.status === 200 &&
    Array.isArray(auditResult.data) &&
    trapId &&
    auditResult.data.some((item) => isRecord(item) && item.id === trapId),
  );
  report("AUDIT", auditPassed, auditResult, auditPassed ? "trap checkpoint is listed" : "expected audit array to include trap checkpoint");

  if (failed) process.exitCode = 1;
}

main().catch(() => {
  console.log("FAIL SMOKE HTTP NO_RESPONSE — unexpected test runner error");
  process.exitCode = 1;
});
