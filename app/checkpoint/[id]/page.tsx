import { Suspense } from "react";
import CheckpointPageClient from "@/components/CheckpointPageClient";

async function CheckpointPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckpointPageClient id={id} />;
}

export default function CheckpointPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">Loading</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Checking your subscription review…</h1>
        </div>
      </main>
    }>
      <CheckpointPageContent params={params} />
    </Suspense>
  );
}
