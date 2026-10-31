# MandateGuard: 3-person team plan

This goes with `MandateGuard-Build-Guide.md`; the phase numbers below refer to that guide.

Deadline: **Nov 12, 12:00pm PST = Nov 13, 00:30 IST**. Team target: **submit on Nov 11**.

---

## 1. Who does what

| Role | Owns | Phases in the build guide |
|---|---|---|
| **A: PayPal & Backend lead** | PayPal Sandbox, `lib/paypal.ts`, plans seed, database, all `/api/*` routes, webhooks, Render deployment | 1, 3, 4, 5 (API side), 8.1–8.3, 9, 11.1 |
| **B: AI & Engine lead** | `lib/terms.ts`, `lib/compare.ts` + tests, `lib/ai.ts` (Gemini), prompt testing, UPI simulator logic | 6, 7, 10, 12 (logic) |
| **C: Frontend & Demo lead** | All pages and components, the PayPal button component, design, README, demo video, pitch | 5.2–5.3, 8.4, 11.2, 12 (UI), 13, 14 |

💡 Pick **A** for whoever is most comfortable with APIs and debugging, **B** for whoever likes logic and AI, and **C** for whoever has the best design sense and presentation skills. Everyone tests everything in the final days.

---

## 2. How you build together (setup on Day 1, everyone together, about 2 hours)

### 2.1 One repo, one owner

- **A** creates the Next.js project (Build Guide Phase 2) and pushes it to a **public GitHub repo**.
- **A** adds B and C as collaborators: GitHub repo → Settings → Collaborators.
- B and C clone it:

```bash
git clone https://github.com/YOUR-TEAM/mandateguard.git
```

```bash
cd mandateguard && npm install
```

### 2.2 Branch rules (keep it simple)

- `main` is always working. Nobody pushes directly to `main`.
- Each person works on a branch per task, for example `a/checkpoint-api`, `b/compare-engine`, `c/checkpoint-page`.
- Opening a PR: push the branch → open a **Pull Request** on GitHub → **one teammate reviews** → merge.
- Merge small and often (at least once a day). Big late merges cause conflicts.
- Before starting work each day, update your copy of `main`:

```bash
git checkout main && git pull
```

Then create your branch:

```bash
git checkout -b b/your-task
```

**Why this split avoids conflicts:** each person mostly touches their own folders. A owns `app/api/`, `lib/paypal.ts`, `lib/db.ts`, `db/` and `scripts/`. B owns `lib/terms.ts`, `lib/compare.ts`, `lib/ai.ts` and `tests/`. C owns the page files under `app/` (outside `app/api/`) and `components/`. The only shared file is `lib/types.ts` (see 2.4).

### 2.3 Secrets (never commit them)

- **A** creates **one** PayPal sandbox app and shares the Client ID and Secret with B and C **privately** (WhatsApp or Discord DM, not the repo).
- **Everyone** gets their **own** free Gemini key from AI Studio, so each person has their own free-tier quota.
- **A** creates the Render Postgres database on Day 1 and shares the External URL privately. Everyone uses the same dev database.
- Commit a `.env.example` file with the variable names only, and keep the real values in each person's `.env.local`:

```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_BASE=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=
PLAN_HONEST=
PLAN_TRAP=
PLAN_BORDERLINE=
GEMINI_API_KEY=
DATABASE_URL=
```

### 2.4 The contract file: agree on it on Day 1, together

This is the most important team step. Write `lib/types.ts` **together on Day 1**. Once everyone agrees on these shapes, all three can work **in parallel**, using fake data, without waiting for each other.

```ts
// lib/types.ts  — the shared contract. Change only with the whole team's agreement.
export type Interval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type Terms = {
  currency: string; initialCharge: number; trialDays: number | null; trialPrice: number | null;
  recurringAmount: number | null; intervalUnit: Interval | null; intervalCount: number | null;
  regularCycles: number | null; commitmentMonths: number | null; totalCommitted: number | null;
  setupFee: number; taxPercent: number; taxInclusive: boolean; startTime: string | null; planOverridden: boolean;
};

export type Intent = {
  maxRecurringAmount: number | null; currency: string | null; expectedTrialDays: number | null;
  expectedTrialPrice: number | null; expectedInterval: Interval | null; maxCommitmentMonths: number | null;
  wantsOneTime: boolean | null;
};

export type Claims = { cancelAnytime: boolean | null; claimedPrice: number | null; quotes: string[] };

export type Finding = {
  id: string; field: string; severity: "LOW" | "MEDIUM" | "HIGH";
  expected: string; actual: string; source: "deterministic" | "ai_claim+deterministic";
};

// What POST /api/checkpoints returns to the frontend
export type CheckpointResponse = {
  id: string; intent: Intent | null; terms: Terms;
  findings: Finding[]; maxSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  requiresAck: boolean; explanation: string | null;
};
```

**API contract, also agreed on Day 1:**

| Endpoint | Request | Response |
|---|---|---|
| `POST /api/checkpoints` | `{ planKey, intentText, intentOverride? }` | `CheckpointResponse` |
| `GET /api/checkpoints/:id` | — | `CheckpointResponse + { decision, paypalStatus }` |
| `POST /api/checkpoints/:id/decision` | `{ decision: "PROCEED" \| "ABANDON", ackedIds }` | `{ subscriptionId }`, or 400 `{ error: "ack_required", missing }`, or 409 `terms_changed` |
| `POST /api/checkpoints/:id/verify` | — | `{ status, sameTerms }` |
| `GET /api/audit` | — | `[{ id, createdAt, maxSeverity, decision, paypalStatus, events[] }]` |

**Mock data:** C builds the UI against a file of fake data (`lib/mock.ts`, containing a `CheckpointResponse` for the trap plan). B tests the engine against saved PayPal JSON. Nobody waits for anyone.

### 2.5 Team rhythm

- **15-minute call every day** at a fixed time. Each person answers three questions: what I finished, what I'm doing today, what's blocking me.
- **A task board:** GitHub repo → **Projects** → board with columns *To do / Doing / Review / Done*. One card per step below.
- **Integration points** (everyone joins): end of Day 3, end of Day 5, Day 8, Day 10. That's when you merge everything and test the full flow together.
- **If you're blocked for more than 30 minutes, say so in the group chat.**

---

## 3. Person A: PayPal & Backend lead, step by step

| Day | Step | What and why | Done when |
|---|---|---|---|
| 1 | A1 | Create the PayPal sandbox app plus US Business and Personal test accounts (Guide 1.1–1.3). Share the credentials privately. | `curl` returns an access token |
| 1 | A2 | Create the Next.js repo (Guide 2.1–2.4), invite B and C, add `.env.example`. | B and C can clone and run `npm run dev` |
| 1 | A3 | Create Render Postgres, `db/schema.sql`, `lib/db.ts`, run the migrate script (Guide Phase 4). | Tables exist |
| 1–2 | A4 | `lib/paypal.ts` + `scripts/seed-paypal.ts`: create the product and the 3 plans (Guide 3.1–3.2). Share the plan IDs. | Plans visible in the sandbox business account |
| 2 | A5 | `GET /api/client-id` + a temporary "create subscription" route. Pair with C to get the PayPal button working end to end (Guide Phase 5). | A sandbox buyer approves → `ACTIVE` |
| 2 | A6 | **Test the key trick:** pre-create the subscription, then pass `Promise.resolve({subscriptionId})` to the button (Guide 5.5). Tell the team: Plan A or Plan B. | Decision posted in the chat |
| 3 | A7 | Save a real `GET /v1/billing/subscriptions/{id}?fields=plan` response for each plan as JSON files in `tests/fixtures/` and give them to B. | B has real data to test with |
| 3–4 | A8 | `POST /api/checkpoints` (Guide 8.1) using B's `paypalToTerms` and `compare`. Use stub AI functions until B finishes Gemini. | Returns a `CheckpointResponse` for the trap plan |
| 4 | A9 | `/decision` (the server gate) and `/verify` routes (Guide 8.2–8.3), plus `GET /api/checkpoints/:id`. | 400 without acks, `subscriptionId` with acks |
| 5 | A10 | Deploy to Render, add environment variables, register the PayPal webhook, build `/api/webhooks/paypal` with verification (Guide Phase 9). | Verified webhook rows appear after a live subscription |
| 6 | A11 | `GET /api/audit` (Guide 11.1). | JSON list with an event timeline per checkpoint |
| 7–8 | A12 | Hardening: token refresh, error messages, a terms-changed test, logging PayPal debug IDs. | The error checklist passes |
| 9–10 | A13 | Help C test everything on the live URL. Fix bugs. | — |
| 11 | A14 | Write the README's **setup section** (environment variables, seed script, webhook steps). | A teammate can set it up from the README alone |

## 4. Person B: AI & Engine lead, step by step

| Day | Step | What and why | Done when |
|---|---|---|---|
| 1 | B1 | Get your own Gemini key (AI Studio), clone the repo, help write `lib/types.ts`. | Contract merged |
| 1–2 | B2 | Read about PayPal billing cycles (trial vs regular, `total_cycles`, where 0 means forever). Write `lib/terms.ts` → `paypalToTerms()` + `hashTerms()` (Guide Phase 6). Until A7 lands, use the sample JSON in the plan doc. | It converts the trap plan correctly |
| 2–3 | B3 | `lib/compare.ts` (Guide 7.1): every check and severity rule. | — |
| 3 | B4 | `tests/compare.test.ts` with vitest: honest (no HIGH), trap (HIGH amount and commitment), borderline (HIGH interval if the user expects monthly), plus edge cases. Run `npx vitest run`. | All green. **Merge before the Day-3 integration.** |
| 4–5 | B5 | `lib/ai.ts` → `extractIntent` with Gemini (Guide 10.1). First confirm that one call works with your installed `@google/genai`. | Returns valid JSON |
| 5 | B6 | Build an **intent test set**: 20 sentences (clear, vague, messy, Hinglish like "1 rupee trial, 100 se zyada nahi monthly"), each with the expected result. Write a small script that runs them all and prints how many are correct. | 18 or more out of 20 correct |
| 6 | B7 | `extractClaims` (quotes required) + `explain` with the number-lock check. Test them on the 3 plans' marketing copy. | "Cancel anytime" vs 24 months is flagged; no invented numbers |
| 6 | B8 | Caching + fallbacks: if Gemini fails or hits a rate limit (429), return `null` so the manual intent form takes over. Swap A's stub functions for the real ones. | The app still works with a wrong API key |
| 7–8 | B9 | UPI simulator logic: 3 mock INR mandates (max amount, frequency, validity end date) → `Terms` → `compare`. Expose it as `POST /api/upi-sim/evaluate` (coordinate with A). | Findings returned for the INR examples |
| 9–10 | B10 | Test the AI under demo conditions; tune prompts. Write the README's **"How the AI works"** section (what the AI does vs what code does). | — |
| 11 | B11 | Review the final video script for technical accuracy. | — |

## 5. Person C: Frontend & Demo lead, step by step

| Day | Step | What and why | Done when |
|---|---|---|---|
| 1 | C1 | Clone, help write `lib/types.ts`, create `lib/mock.ts` with a fake trap-plan `CheckpointResponse`. Make quick paper or Figma sketches of the 4 screens. | Team agrees on the screens |
| 1–2 | C2 | `components/PayPalSubscribe.tsx` + `types/paypal.d.ts` (Guide 5.2–5.3). Pair with A on the first live sandbox subscription. | The PayPal popup opens and the approval works |
| 2–3 | C3 | **Store page** (`app/page.tsx`): StreamNest brand, 3 plan cards with the marketing copy (`lib/plans.ts`), an "What do you expect to pay?" box. | Looks real; works with mock data |
| 3–4 | C4 | **Checkpoint page** (`app/checkpoint/[id]/page.tsx`): editable intent chips; findings in red, amber and grey; "You expected vs Actually"; explanation; a checkbox per HIGH finding; *Don't subscribe* / *I understand, continue*; then the PayPal button; then success (Guide 8.4). Build against `lib/mock.ts` first. | Full screen works on mock data |
| 4 | C5 | **Day-4 integration with A:** switch from mock data to the real API. | Trap plan: blocked → acknowledged → PayPal → `ACTIVE` |
| 5–6 | C6 | **Audit page** (`app/audit/page.tsx`): table with severity badge, decision, PayPal status, and an expandable event timeline with a ✔ for verified events. Decide with the team on Day 7 whether to use AG Grid. | Shows real rows |
| 7–8 | C7 | **UPI simulator page** with a clear "Simulation: not connected to NPCI, any bank or any UPI app" banner. Reuse the findings component. | Works with B's endpoint |
| 8–9 | C8 | Polish: mobile layout, loading spinners, friendly errors, a consistent color system, a landing explainer line, an accessibility pass (labels, contrast, keyboard use). | Looks like a finished product |
| 9 | C9 | Write the **video script** and storyboard (0:00 problem → 0:15 trap blocked → 1:15 informed approval in PayPal → 2:00 audit and webhooks → 2:30 UPI vision). Add an architecture image for the README (export the diagram from the plan doc). | Script approved by the team |
| 10–11 | C10 | Record the video (pre-record the PayPal popup part), edit it to under 3 minutes, and upload it to YouTube as **public**. Write the Devpost text: problem, solution, how it's built, AI tools used, challenges, what's next. | Video link works in a private browser window |
| 11 | C11 | Final README polish (screenshots, live URL, LICENSE visible). | — |

---

## 6. Day-by-day team calendar

| Day (date) | A (Backend) | B (AI/Engine) | C (Frontend/Demo) | Team checkpoint |
|---|---|---|---|---|
| 1 (Nov 1) | Sandbox, repo, DB | Gemini key, types | Types, mocks, sketches | ✅ Contract agreed, everyone runs the app |
| 2 (Nov 2) | Seed plans, subscription flow | `terms.ts` | PayPal button (pair with A) | ✅ **First real `ACTIVE` subscription** |
| 3 (Nov 3) | Fixtures, checkpoints API | `compare.ts` + tests | Store page | ✅ **Integration 1:** engine merged |
| 4 (Nov 4) | Decision and verify routes | Gemini `extractIntent` | Checkpoint page → real API | ✅ **MVP works end to end (without AI)** |
| 5 (Nov 5) | Render deploy + webhooks | Intent test set | Checkpoint polish | ✅ **Integration 2:** live URL + verified webhooks |
| 6 (Nov 6) | Audit API | Claims + explain + fallbacks | Audit page | — |
| 7 (Nov 7) | Hardening | AI merged into the app | Audit page; **AG Grid yes/no** | ✅ Full flow **with AI** on the live URL |
| 8 (Nov 8) | UPI API support | UPI logic | UPI page | ✅ **Integration 3:** feature freeze. No new features after this. |
| 9 (Nov 9) | Bug fixes | Prompt tuning | Polish + video script | — |
| 10 (Nov 10) | Full test checklist on live URL | Full test checklist | Full test checklist + record | ✅ **Integration 4:** everyone tests everything |
| 11 (Nov 11) | README setup | README AI section | Video upload + Devpost text | ✅ **SUBMIT** |
| 12 (Nov 12) | Buffer | Buffer | Buffer | Deadline 00:30 IST Nov 13 |

---

## 7. Rules that save hackathon teams

1. **`main` must always run.** If you break it, fixing it is the top priority.
2. **Never commit secrets.** If one leaks, regenerate it right away: a new PayPal secret in the Dashboard, a new Gemini key in AI Studio.
3. **Change `lib/types.ts` only after telling the whole team.** Everyone's code depends on it.
4. **Feature freeze on Day 8.** After that, only fixes and polish.
5. **One person submits on Devpost** (the team representative), and adds the other two as teammates through the project's team section. Everyone must be registered for the hackathon first (see the hackathon FAQ).
6. **Before submitting, check from a private browser window:** the live URL loads, the repo is public, the LICENSE is visible, the video is public and under 3 minutes, and the Devpost text lists Gemini as the AI tool.
