# Part B demo walkthrough

## Before recording

1. Start the app with `npm run dev` and open `http://localhost:3000/demo`.
2. The PayPal sample checks use `POST /api/demo-checkpoints` and server-owned fixture data. For live Gemini extraction, configure `GEMINI_API_KEY` and `AI_MODE=live` in `.env.local`. The demo still works without a key; use the manual expectations form for a stable result.
3. Keep the screen on the MandateGuard page. No PayPal or UPI payment is created during this walkthrough.

## 90-second walkthrough

**Opening (10 seconds)**  
“MandateGuard helps people understand subscription billing terms before they agree. AI can read a shopper’s expectations and the merchant’s wording, while ordinary code makes the actual comparison.”

**Show the PayPal sample (35 seconds)**  
1. Select **Premium**. Point out the $69.99 monthly price and the 24-payment term in the sample details.
2. Keep or enter: “I’m okay with $1 for a trial, then no more than $10 a month.”
3. If Gemini is unavailable, turn on **Enter expectations manually** and enter maximum recurring amount `10`, currency `USD`, expected interval `Monthly`, expected trial price `1`, and expected trial days `7`.
4. Select **Check these terms**. Show the recurring-price and commitment findings. With Gemini live, also point out the checked “cancel anytime” merchant claim.
5. Read the explanation and show the acknowledgement control for high-severity findings. Explain that this demo stops at acknowledgement and does not start a subscription.

**Show the UPI simulator (25 seconds)**  
1. Select **UPI mandate simulator** and choose a sample mandate.
2. The expectation defaults to “Keep debits to ₹100 per month or less.” Select **Check these terms** and show that the ₹149 monthly maximum debit cap exceeds that expectation.
3. Point to the simulation notice: these are sample data and are not connected to NPCI, a bank, a UPI app, or payment rails.

**Close (10 seconds)**  
“The model helps turn text into fields and a short explanation. It does not decide whether a plan is safe; the deterministic comparison code checks the prices, frequency, trial, term, fees, and supported claims.”

## Stable demo notes

- If Gemini is off, invalid, or rate-limited, use the manual form. The deterministic terms comparison still works and the explanation falls back to a fixed template.
- Use **Basic** to show a plan whose recurring price matches the $10 monthly expectation.
- Use **Premium** to show the stronger mismatch and the merchant’s cancellation promise against a fixed term.
- The sample subscription data is PayPal-shaped fixture data served by `/api/demo-checkpoints`. It is not a live shopper subscription.
