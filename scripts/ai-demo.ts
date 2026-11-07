import { explain, extractClaims, extractIntent } from "../lib/ai";
import { compare } from "../lib/compare";
import { PLANS } from "../lib/plans";
import { paypalToTerms } from "../lib/terms";
import { borderline, honest, trap } from "../tests/fixtures";

// B7 check: the full engine on the 3 demo plans' marketing copy, offline PayPal fixtures
// and one shopper sentence. Run: npm run ai:demo

const SUBS = { honest, trap, borderline };
const SHOPPER = "I'll pay $1 for the trial, then max $10 a month.";

async function main() {
  const { intent, source: intentSource } = await extractIntent(SHOPPER);
  console.log(`Shopper: "${SHOPPER}"\nIntent [${intentSource}]: ${JSON.stringify(intent)}\n`);
  if (!intent) return void (process.exitCode = 1);

  for (const plan of PLANS) {
    const terms = paypalToTerms(SUBS[plan.key as keyof typeof SUBS]);
    const { claims, source: claimsSource } = await extractClaims(plan.copy);
    const result = compare(intent, terms, claims);
    const { explanation, source } = await explain(terms, result.findings, intent);

    console.log(`== ${plan.title} (${plan.key}) ==  "${plan.copy}"`);
    console.log(`Claims [${claimsSource}]: ${JSON.stringify(claims)}`);
    console.log(`Max severity: ${result.maxSeverity}  requiresAck=${result.requiresAck}`);
    for (const f of result.findings) console.log(`  ${f.severity.padEnd(6)} ${f.field}: expected ${f.expected} | actual ${f.actual}`);
    console.log(`Explanation [${source}]: ${explanation}\n`);
  }
}

void main();
