import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLANS } from "../lib/plans";
import { paypal } from "../lib/paypal";

function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/token|secret|authorization/i.test(key))
      .map(([key, child]) => [key, withoutSecrets(child)]),
  );
}

async function main() {
  const fixtureDir = join(process.cwd(), "tests", "fixtures");
  mkdirSync(fixtureDir, { recursive: true });

  for (const plan of PLANS) {
    const planId = process.env[plan.envId];
    if (!planId) throw new Error("A PayPal plan is not configured");

    const created = await paypal<{ id?: string }>("/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
        "PayPal-Request-Id": `fixture-${plan.key}`,
      },
      body: JSON.stringify({ plan_id: planId, custom_id: `fixture-${plan.key}` }),
    });
    if (!created.id) throw new Error("PayPal did not return a subscription ID");

    const fixture = await paypal<unknown>(
      `/v1/billing/subscriptions/${encodeURIComponent(created.id)}?fields=plan`,
    );
    writeFileSync(
      join(fixtureDir, `${plan.key}.json`),
      `${JSON.stringify(withoutSecrets(fixture), null, 2)}\n`,
      "utf8",
    );
  }

  console.log("Saved sanitized subscription fixtures");
}

main().catch(() => {
  console.error("Failed to save PayPal fixtures");
  process.exitCode = 1;
});
