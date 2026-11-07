import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/checkpoints/route";

const intentOverride = {
  maxRecurringAmount: 10,
  currency: "USD",
  expectedTrialDays: 7,
  expectedTrialPrice: 1,
  expectedInterval: "MONTH" as const,
  maxCommitmentMonths: null,
  wantsOneTime: null,
};

function request(body: string): Request {
  return new Request("http://localhost/api/checkpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/checkpoints", () => {
  beforeEach(() => vi.stubEnv("AI_MODE", "mock"));
  afterEach(() => vi.unstubAllEnvs());

  it("rejects invalid JSON and unknown request fields", async () => {
    const malformed = await POST(request("{"));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON body" });

    const untrustedTerms = await POST(request(JSON.stringify({
      planKey: "trap",
      subscription: { plan: { billing_cycles: [] } },
    })));
    expect(untrustedTerms.status).toBe(400);
    await expect(untrustedTerms.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("evaluates server-owned sample terms against manual expectations", async () => {
    const response = await POST(request(JSON.stringify({ planKey: "trap", intentOverride })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.plan.key).toBe("trap");
    expect(body.terms.recurringAmount).toBe(69.99);
    expect(body.findings.map((finding: { field: string }) => finding.field)).toEqual([
      "recurringAmount",
      "commitment",
    ]);
    expect(body).toMatchObject({ maxSeverity: "HIGH", requiresAck: true, needsIntent: false });
    expect(body.termsHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
