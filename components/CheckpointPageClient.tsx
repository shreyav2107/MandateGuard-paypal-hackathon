"use client";

import { useEffect, useState } from "react";
import CheckpointReview from "@/components/CheckpointReview";
import type { CheckpointResponse } from "@/lib/types";

export default function CheckpointPageClient({ id }: { id: string }) {
  const [checkpoint, setCheckpoint] = useState<CheckpointResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCheckpoint() {
      try {
        const response = await fetch(`/api/checkpoints/${id}`);
        const payload = (await response.json().catch(() => null)) as { error?: string } | CheckpointResponse | null;

        if (!response.ok || !payload || typeof payload !== "object") {
          throw new Error(
            payload && typeof payload === "object" && "error" in payload && payload.error === "not_found"
              ? "We couldn’t find that checkpoint."
              : "We couldn’t load this checkpoint right now.",
          );
        }

        if (isMounted) {
          setCheckpoint(payload as CheckpointResponse);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError("We couldn’t load this checkpoint right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCheckpoint();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">Loading</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Checking your subscription review…</h1>
        </div>
      </main>
    );
  }

  if (error || !checkpoint) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">Review unavailable</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">We couldn’t load this checkpoint</h1>
          <p className="mt-3 text-slate-700">{error ?? "Please try again in a moment."}</p>
        </div>
      </main>
    );
  }

  return <CheckpointReview checkpoint={checkpoint} />;
}
