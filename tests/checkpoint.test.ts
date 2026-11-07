import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateCheckpoint } from "../lib/checkpoint";
import { hashTerms, paypalToTerms } from "../lib/terms";
import type { Intent } from "../lib/types";
import { honest, trap } from "./fixtures";

const manual: Intent = {
  maxRecurringAmount: 10, currency: "USD", expectedTrialDays: null, expectedTrialPrice: 1,
  expectedInterval: "MONTH", maxCommitmentMonths: null, wantsOneTime: null,
};
const copy = "Start StreamNest Premium for just $1! Cancel anytime.";

// B8 "done when": the app still works with a wrong API key.
describe.each([
  ["AI off", { AI_MODE: "mock", GEMINI_API_KEY: "" }],
  ["wrong API key", { AI_MODE: "live", GEMINI_API_KEY: "definitely-not-a-key" }],
])("evaluateCheckpoint with %s", (_, env) => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks for the manual form but still flags the 24-month term", async () => {
    const r = await evaluateCheckpoint({ subscription: trap, intentText: "max $10 a month", planCopy: copy });
    expect(r).toMatchObject({ intent: null, needsIntent: true, maxSeverity: "HIGH", requiresAck: true });
    expect(r.findings.map((f) => f.field)).toEqual(["commitment"]);
    expect(r.ai).toEqual({ intent: "off", claims: "off", explanation: "template" });
    expect(r.explanation).toMatch(/24 months/);
  }, 30_000);

  it("with the manual form filled in, gives the full result", async () => {
    const r = await evaluateCheckpoint({ subscription: trap, intentText: "ignored", intentOverride: manual, planCopy: copy });
    expect(r).toMatchObject({ intent: manual, needsIntent: false, requiresAck: true });
    expect(r.findings.map((f) => f.field)).toEqual(["recurringAmount", "commitment"]);
    expect(r.ai.intent).toBe("manual");
    expect(r.termsHash).toBe(hashTerms(paypalToTerms(trap)));
  }, 30_000);

  it("honest plan passes with the manual form", async () => {
    const r = await evaluateCheckpoint({ subscription: honest, intentOverride: manual });
    expect(r).toMatchObject({ findings: [], maxSeverity: "NONE", requiresAck: false, explanation: "These terms match what you told us you expected." });
    expect(r.ai).toEqual({ intent: "manual", claims: "none", explanation: "template" });
  });
});
