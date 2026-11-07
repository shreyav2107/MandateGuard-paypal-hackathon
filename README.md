This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup

### Requirements and install

Use Node.js 20.9 or later. Clone the repository, install dependencies, and create your local environment file:

```bash
git clone https://github.com/shreyav2107/MandateGuard-paypal-hackathon.git
cd MandateGuard-paypal-hackathon
npm install
cp .env.example .env.local
```

In PowerShell, use `Copy-Item .env.example .env.local` for the copy step. Keep `.env.local` private and out of Git.

### Environment variables

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

### PayPal Sandbox

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), create Sandbox Business and Personal test accounts. Use the Business account as the seller and the Personal account as the buyer.
2. Create a Sandbox REST app for the Business account. Copy its Client ID and Secret into the matching environment variables; use the Sandbox API base for `PAYPAL_BASE`.
3. Create the three subscription plans by running `npx tsx --env-file=.env.local scripts/seed-paypal.ts`. Copy the printed plan IDs into `PLAN_HONEST`, `PLAN_TRAP`, and `PLAN_BORDERLINE`.

### Neon database

1. Create a Postgres project in [Neon](https://neon.tech/) and copy its connection string into `DATABASE_URL`.
2. Create the schema with `npm run db:migrate`. Check connectivity with `npm run db:check`.

### Useful npm scripts

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
| `npm run fixtures` | Create one Sandbox subscription per plan and save sanitized PayPal responses under `tests/fixtures/`. |

The fixture and seed scripts make PayPal API calls and are intended to be run manually after configuring Sandbox credentials. They are not run by the build or migration.

### Render and PayPal webhooks

Deploy the service to Render using `render.yaml`, then add the environment variables in the Render dashboard. After the service has an HTTPS URL, open the Sandbox REST app in the PayPal Developer Dashboard and add a webhook at `https://YOUR-SERVICE.onrender.com/api/webhooks/paypal`. Subscribe to `BILLING.SUBSCRIPTION.*` and `PAYMENT.SALE.*` events. Copy the webhook ID into Render as `PAYPAL_WEBHOOK_ID`, then send a Sandbox event or complete a Sandbox approval and review the recorded verification status through `/api/audit`.

## How the AI works

Google Gemini turns a shopper's description into structured expectations and reads merchant marketing copy for advertised prices or cancellation claims. The application validates the model output, checks extracted numbers against the source text, and requires supporting quotes for merchant claims. If Gemini is unavailable or returns invalid output, the shopper can enter expectations manually and the app uses a deterministic explanation.

The comparison engine in `lib/compare.ts` is ordinary TypeScript. It checks amounts, currency, billing frequency, trial terms, fixed commitments, fees, taxes, and supported marketing claims. Gemini does not decide whether terms match or whether a warning is required; it only extracts text fields and can phrase a summary of findings.

The UPI route is a simulation over three fixed INR examples. It is not connected to NPCI, a bank, or a UPI app, and it does not create mandates or payments. A mandate's amount is treated as a maximum debit cap; the number of possible debit dates is not a promise that those debits will occur.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
