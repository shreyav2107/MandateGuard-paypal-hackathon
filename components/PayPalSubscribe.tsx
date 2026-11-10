"use client";
import Script from "next/script";
import { useRef, useState } from "react";

type SubscriptionData = { subscriptionId: string };
type PayPalSdkError = { code?: string; message?: string };
type SubscriptionSession = {
  start: (options: { presentationMode: "auto" }, subscription: Promise<SubscriptionData>) => void;
};
type PayPalSdkInstance = {
  findEligibleMethods: (options: { paymentFlow: "RECURRING_PAYMENT"; currencyCode: string }) => Promise<{
    isEligible: (method: string) => boolean;
  }>;
  createPayPalSubscriptionPaymentSession: (options: {
    onApprove: (data: SubscriptionData) => void;
    onCancel: () => void;
    onError: (error: PayPalSdkError) => void;
  }) => SubscriptionSession;
};
type PayPalSdk = {
  createInstance: (options: { clientId: string; components: string[]; pageType: "checkout" }) => Promise<PayPalSdkInstance>;
};

declare global { interface Window { paypal: PayPalSdk } }

export default function PayPalSubscribe({ getSubscriptionId, onApproved }: {
  getSubscriptionId: () => Promise<{ subscriptionId: string }>;
  onApproved: (subscriptionId: string) => void;
}) {
  const btn = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  async function init() {
    const response = await fetch("/api/client-id");
    const body = await response.json() as { clientId?: unknown };
    if (!response.ok || typeof body.clientId !== "string") return;
    const clientId = body.clientId;
    const sdk = await window.paypal.createInstance({ clientId, components: ["paypal-subscriptions"], pageType: "checkout" });
    const methods = await sdk.findEligibleMethods({ paymentFlow: "RECURRING_PAYMENT", currencyCode: "USD" });
    if (!methods.isEligible("paypal")) return;
    const session = sdk.createPayPalSubscriptionPaymentSession({
      onApprove: (data) => onApproved(data.subscriptionId),
      onCancel: () => console.log("buyer cancelled"),
      onError: (error) => console.error(error.code, error.message),
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
      <paypal-button ref={btn} type="subscribe" hidden={!ready}></paypal-button>
    </>
  );
}
