"use client";
import Script from "next/script";
import { useRef, useState } from "react";

type PayPalSubscription = { subscriptionId: string };

type PayPalSession = {
  start: (
    options: { presentationMode: "auto" },
    subscription: Promise<PayPalSubscription>,
  ) => void;
};

type PayPalClient = {
  findEligibleMethods: (options: { paymentFlow: string; currencyCode: string }) => Promise<{
    isEligible: (method: string) => boolean;
  }>;
  createPayPalSubscriptionPaymentSession: (options: {
    onApprove: (data: PayPalSubscription) => void;
    onCancel: () => void;
    onError: () => void;
  }) => PayPalSession;
};

type PayPalSdk = {
  createInstance: (options: {
    clientId: string;
    components: string[];
    pageType: string;
  }) => Promise<PayPalClient>;
};

declare global { interface Window { paypal: PayPalSdk } }

export default function PayPalSubscribe({ getSubscriptionId, onApproved }: {
  getSubscriptionId: () => Promise<{ subscriptionId: string }>;
  onApproved: (subscriptionId: string) => void;
}) {
  const btn = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function init() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/client-id");
      const payload = (await response.json().catch(() => null)) as { clientId?: string } | null;
      if (!response.ok || !payload?.clientId) {
        throw new Error("client_id_unavailable");
      }

      const sdk = await window.paypal.createInstance({
        clientId: payload.clientId,
        components: ["paypal-subscriptions"],
        pageType: "checkout",
      });
      const methods = await sdk.findEligibleMethods({ paymentFlow: "RECURRING_PAYMENT", currencyCode: "USD" });
      if (!methods.isEligible("paypal")) {
        setError("PayPal checkout is not available right now. Please try again later.");
        return;
      }

      const session = sdk.createPayPalSubscriptionPaymentSession({
        onApprove: (data) => onApproved(data.subscriptionId),
        onCancel: () => setError(null),
        onError: () => setError("PayPal could not complete checkout. Please try again."),
      });
      btn.current?.addEventListener("click", () => {
        // IMPORTANT: no `await` before session.start, or the browser blocks the popup
        session.start({ presentationMode: "auto" }, getSubscriptionId());
      });
      setReady(true);
    } catch {
      setError("PayPal checkout could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://www.sandbox.paypal.com/web-sdk/v6/core"
        onLoad={() => void init()}
        onError={() => {
          setLoading(false);
          setError("PayPal checkout could not be loaded. Please try again.");
        }}
      />
      {loading ? <p role="status" className="mb-3 text-sm text-slate-600">Loading secure PayPal checkout…</p> : null}
      {error ? <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p> : null}
      <paypal-button
        ref={btn}
        className="block min-h-11 w-full max-w-full"
        type="subscribe"
        role="button"
        aria-label="Subscribe with PayPal"
        tabIndex={ready ? 0 : -1}
        hidden={!ready}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      ></paypal-button>
    </>
  );
}
