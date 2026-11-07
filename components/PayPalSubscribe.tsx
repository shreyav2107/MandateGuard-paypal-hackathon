"use client";
import Script from "next/script";
import { useRef, useState } from "react";

declare global { interface Window { paypal: any } }

export default function PayPalSubscribe({ getSubscriptionId, onApproved }: {
  getSubscriptionId: () => Promise<{ subscriptionId: string }>;
  onApproved: (subscriptionId: string) => void;
}) {
  const btn = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);

  async function init() {
    const { clientId } = await (await fetch("/api/client-id")).json();
    const sdk = await window.paypal.createInstance({ clientId, components: ["paypal-subscriptions"], pageType: "checkout" });
    const methods = await sdk.findEligibleMethods({ paymentFlow: "RECURRING_PAYMENT", currencyCode: "USD" });
    if (!methods.isEligible("paypal")) return;
    const session = sdk.createPayPalSubscriptionPaymentSession({
      onApprove: (data: any) => onApproved(data.subscriptionId),
      onCancel: () => console.log("buyer cancelled"),
      onError: (e: any) => console.error(e?.code, e?.message),
    });
    btn.current?.addEventListener("click", () => {
      // IMPORTANT: no `await` before session.start, or the browser blocks the popup
      session.start({ presentationMode: "auto" }, getSubscriptionId());
    });
    setReady(true);
  }

  return (
    <>
      <Script src="https://www.sandbox.paypal.com/web-sdk/v6/core" onLoad={init} />
      <paypal-button ref={btn as any} type="subscribe" hidden={!ready}></paypal-button>
    </>
  );
}
