# MandateGuard

MandateGuard helps shoppers compare what they expect to pay with the subscription terms they are about to accept. It combines a deterministic terms comparison engine, AI-assisted text extraction, PayPal Sandbox checkpoint flows, and a simulated UPI demo.

Live deployment: [mandateguard-tbjq.onrender.com](https://mandateguard-tbjq.onrender.com).

## Run locally

Use Node.js 20.9 or later. Clone the repository, install dependencies, copy the environment template, and start the development server:

```bash
git clone https://github.com/shreyav2107/MandateGuard-paypal-hackathon.git
cd MandateGuard-paypal-hackathon
npm install
cp .env.example .env.local
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env.local` for the copy step. Keep `.env.local` private and out of Git. Open [http://localhost:3000](http://localhost:3000).

## App and API

- `/` is the team's checkpoint review UI.
- `/demo` runs the Part B terms engine against server-owned sample plans and the UPI simulator.
- `POST /api/demo-checkpoints` evaluates the sample plans. It accepts a plan key and shopper expectations; billing terms always come from server fixtures.
- `GET` and `POST /api/upi-sim/evaluate` list and evaluate simulated UPI mandates. A mandate amount is a maximum debit cap, not a promise that every possible debit will happen.
- `POST /api/checkpoints` creates a checkpoint from a configured PayPal Sandbox plan and stores the result in Neon. It requires the PayPal plan IDs and database configuration below.
- `/api/checkpoints/[id]`, `/api/checkpoints/[id]/decision`, and `/api/checkpoints/[id]/verify` read a checkpoint, record the shopper's decision, and re-check the terms.
- `/api/audit` exposes audit records. `/api/webhooks/paypal` receives PayPal Sandbox webhook events.

The sample PayPal-shaped plans and UPI mandates are synthetic. The `/demo` flow does not create subscriptions, mandates, or payments. The production checkpoint routes use PayPal Sandbox when configured.

## Environment variables

Set these in `.env.local` for local work and in the Render service environment for deployment:

| Variable | Purpose |
|---|---|
| `PAYPAL_CLIENT_ID` | Client ID for the PayPal Sandbox REST app. |
| `PAYPAL_CLIENT_SECRET` | Server-side secret for that REST app; never expose it to the browser. |
| `PAYPAL_BASE` | PayPal API base URL. Use the Sandbox API base while developing. |
| `PAYPAL_WEBHOOK_ID` | ID of the webhook registered for the deployed service. |
| `PLAN_HONEST` | PayPal plan ID for the honest example. |
| `PLAN_TRAP` | PayPal plan ID for the trap example. |
| `PLAN_BORDERLINE` | PayPal plan ID for the borderline example. |
| `GEMINI_API_KEY` | API key used for intent, claims, and explanation generation. |
| `GEMINI_MODEL` | Primary Gemini model name. |
| `GEMINI_FALLBACK_MODEL` | Fallback Gemini model name. |
| `AI_MODE` | Set to `mock` to disable AI calls, or `live` to use Gemini. |
| `DATABASE_URL` | Neon Postgres connection string, including its SSL parameters. |

## PayPal Sandbox and database setup

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), create Sandbox Business and Personal test accounts. Use the Business account as the seller and the Personal account as the buyer.
2. Create a Sandbox REST app for the Business account. Copy its Client ID and Secret into the matching environment variables and keep `PAYPAL_BASE` set to the Sandbox API base.
3. Create the three Sandbox plans with `npx tsx --env-file=.env.local scripts/seed-paypal.ts`, then copy the printed IDs into `PLAN_HONEST`, `PLAN_TRAP`, and `PLAN_BORDERLINE`.
4. Create a Postgres project in [Neon](https://neon.tech/) and put its connection string in `DATABASE_URL`.
5. Create the database tables with `npm run db:migrate`; check connectivity with `npm run db:check`.

## How the checks work

1. PayPal billing-cycle data is normalized into plain terms such as trial length, recurring price, interval, commitment, setup fee, and taxes.
2. Gemini can turn the shopper's sentence into structured expectations and extract claims from merchant copy. The app validates model output, checks that inferred numbers appear in the source text, and requires exact quotes for merchant claims.
3. The deterministic comparison engine checks the actual terms against expectations and supported claims. It assigns a severity and requires acknowledgement for high-severity findings.
4. Gemini can write a short explanation using only checked facts. If AI is unavailable or returns invalid output, manual expectations and a fixed explanation template keep the check usable.

Gemini does not decide whether a plan matches or whether to warn. Those decisions live in ordinary TypeScript in `lib/compare.ts`. The UPI route is a simulation and is not connected to NPCI, a bank, or a UPI app.

Run `npm run ai:eval` with a live Gemini key to score the 20 English and Hinglish shopper examples. The target is at least 18 exact field matches; this evaluation is separate from the normal test and build commands.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Next.js development server. |
| `npm run build` | Create the production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the Vitest suite. |
| `npm run db:migrate` | Create the database tables from `db/schema.sql`. |
| `npm run db:check` | Check the Neon connection. |
| `npm run ai:check` | Check Gemini connectivity. |
| `npm run ai:eval` | Run the intent extraction evaluation. |
| `npm run ai:demo` | Run the AI demo script. |
| `npm run fixtures` | Create Sandbox subscriptions and save sanitized PayPal responses under `tests/fixtures/`. |

The PayPal seed and fixture scripts make Sandbox API calls. Run them manually after configuring Sandbox credentials; the build and database migration do not run them.

## Render and PayPal webhooks

Deploy using `render.yaml`, then add the environment variables in the Render dashboard. After the service has an HTTPS URL, register a Sandbox webhook at `https://YOUR-SERVICE.onrender.com/api/webhooks/paypal`. Subscribe to `BILLING.SUBSCRIPTION.*` and `PAYMENT.SALE.*` events, then set the webhook ID as `PAYPAL_WEBHOOK_ID`.

See [the Part B demo walkthrough](docs/part-b-demo-script.md) for the demo flow.
