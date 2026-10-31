import { checkMandate } from "../lib/gemini";

const samples = [
  {
    label: "fair",
    description: "StreamNest is $9.99 per month at a flat price. Cancel anytime.",
  },
  {
    label: "trial renewal",
    description:
      "Start with a 7-day free trial, then automatically renews at $69.99 per month. Cancel anytime.",
  },
  {
    label: "unclear",
    description:
      "Enjoy flexible access to StreamNest. Renewal and cancellation details are provided during signup.",
  },
];

async function main() {
  for (const sample of samples) {
    try {
      const result = await checkMandate(sample.description);
      console.log(
        `${sample.label}: verdict=${result.verdict}, risk_score=${result.risk_score}, source=${result.source}`,
      );
    } catch {
      console.error(`${sample.label}: check failed`);
      process.exitCode = 1;
    }
  }
}

void main();
