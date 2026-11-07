# MandateGuard

MandateGuard helps shoppers compare what they expect to pay with the subscription terms they are about to accept. The current app is a working demo using server-owned sample PayPal-shaped subscriptions and simulated UPI mandates.

## Run the demo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the team's checkpoint mock, or go to [http://localhost:3000/demo](http://localhost:3000/demo) for the live Part B engine and UPI simulator. Both pages run without credentials. To enable live Gemini extraction and explanations in the Part B demo, add a Gemini API key to `.env.local`:

```dotenv
GEMINI_API_KEY=your_key
AI_MODE=live
```

Keep API keys in `.env.local` on the server. Do not add them to browser code or commit them.

## How a subscription check works

1. PayPal-shaped billing-cycle data is normalized into plain terms such as trial length, recurring price, interval, fixed commitment, setup fee, and taxes.
2. Gemini can turn the shopper's sentence into structured expectations and extract claims from the merchant's copy. Outputs are schema-checked; inferred amounts and currencies must be supported by the source text, and merchant claims need exact supporting quotes.
3. The deterministic comparison engine checks the actual terms against those expectations and supported claims. It assigns a severity and marks high-severity findings as requiring acknowledgement.
4. Gemini may write a short explanation using only the checked facts. If AI is unavailable or its response is invalid, manual expectations and a fixed explanation template keep the check usable.

Gemini does not decide whether a plan matches or whether to warn. The checks live in ordinary TypeScript in `lib/compare.ts`.

## Demo routes

- `POST /api/checkpoints` evaluates one of the server-owned PayPal sample plans. Send `planKey` (`honest`, `trap`, or `borderline`) and `intentText`; optionally send `intentOverride` to provide the structured expectations manually. The route does not accept client-supplied billing terms. The `/demo` page calls this route.
- `GET /api/upi-sim/evaluate` lists three sample INR mandates and the simulation notice.
- `POST /api/upi-sim/evaluate` evaluates a selected sample mandate. A mandate amount is a maximum debit cap, not a promise that every possible debit will happen.

The demo uses synthetic data. It does not start subscriptions, create mandates, or send payments. The UPI simulator is not connected to NPCI, a bank, or a UPI app.

## Useful commands

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run ai:eval   # live Gemini evaluation; requires GEMINI_API_KEY
npm run ai:demo   # live Gemini end-to-end sample; requires GEMINI_API_KEY
```

The intent evaluation contains 20 shopper sentences in English and Hinglish and requires at least 18 exact field matches.

## Current integration boundary

`POST /api/checkpoints` is wired to safe, server-owned sample subscription fixtures for the hackathon demo. Connecting it to a real shopper's PayPal subscription requires the authenticated application flow to provide that subscription ID and the server to fetch the current subscription terms before evaluation. The UPI path remains a simulation.
