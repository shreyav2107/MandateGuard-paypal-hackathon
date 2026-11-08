"use client";

import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  type: string;
  source: string;
  payload: unknown;
  verified: boolean;
  created_at: string;
};

type AuditRow = {
  id: string;
  created_at: string;
  max_severity?: string | null;
  decision?: string | null;
  paypal_status?: string | null;
  events: AuditEvent[];
};

const severityClasses: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-700 ring-amber-200",
  HIGH: "bg-orange-100 text-orange-700 ring-orange-200",
  CRITICAL: "bg-red-100 text-red-700 ring-red-200",
  UNKNOWN: "bg-slate-100 text-slate-700 ring-slate-200",
};

const decisionClasses: Record<string, string> = {
  PROCEED: "bg-emerald-100 text-emerald-700",
  ABANDON: "bg-rose-100 text-rose-700",
  PENDING: "bg-slate-100 text-slate-700",
  DEFAULT: "bg-slate-100 text-slate-700",
};

const paypalClasses: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-rose-100 text-rose-700",
  DEFAULT: "bg-slate-100 text-slate-700",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 120 ? `${json.slice(0, 117)}...` : json;
    } catch {
      return "Object";
    }
  }
  return String(value);
}

function AuditBadge({
  value,
  tone,
  className = "",
}: {
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
  className?: string;
}) {
  const toneClasses = {
    success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-100 text-amber-700 ring-amber-200",
    danger: "bg-rose-100 text-rose-700 ring-rose-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]} ${className}`}
    >
      {value}
    </span>
  );
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadAuditRows() {
      try {
        const response = await fetch("/api/audit");
        if (!response.ok) {
          throw new Error("Unable to load audit history.");
        }

        const data = (await response.json()) as AuditRow[];
        if (!isMounted) return;

        setRows(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load audit history.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAuditRows();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded bg-slate-200" />
              <div className="h-4 w-72 rounded bg-slate-200" />
              <div className="space-y-3 pt-6">
                <div className="h-12 rounded bg-slate-200" />
                <div className="h-12 rounded bg-slate-200" />
                <div className="h-12 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Audit unavailable</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">We couldn’t load the audit history.</h1>
          <p className="mt-3 text-slate-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!rows.length) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-2xl text-indigo-700">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">No audit events yet</h1>
          <p className="mt-3 text-slate-600">
            When checkpoints are reviewed, their activity and verification history will appear here.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Audit log</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Checkpoint history</h1>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            {rows.length} {rows.length === 1 ? "record" : "records"}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr className="text-sm text-slate-600">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Severity</th>
                  <th className="px-5 py-3 font-medium">Decision</th>
                  <th className="px-5 py-3 font-medium">PayPal status</th>
                  <th className="px-5 py-3 font-medium text-right">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const isExpanded = !!expanded[row.id];
                  const severity = (row.max_severity ?? "UNKNOWN").toUpperCase();
                  const decision = (row.decision ?? "PENDING").toUpperCase();
                  const paypalStatus = (row.paypal_status ?? "PENDING").toUpperCase();

                  return (
                    <>
                      <tr key={row.id} className="bg-white transition hover:bg-slate-50">
                        <td className="px-5 py-4 text-sm text-slate-700">{formatDate(row.created_at)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${severityClasses[severity] ?? severityClasses.UNKNOWN}`}
                          >
                            {severity}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${decisionClasses[decision] ?? decisionClasses.DEFAULT}`}
                          >
                            {decision}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paypalClasses[paypalStatus] ?? paypalClasses.DEFAULT}`}
                          >
                            {paypalStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((current) => ({
                                ...current,
                                [row.id]: !current[row.id],
                              }))
                            }
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
                          >
                            {isExpanded ? "Hide timeline" : "View timeline"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${row.id}-timeline`} className="bg-slate-50">
                          <td colSpan={5} className="px-5 py-5">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              {row.events.length > 0 ? (
                                <ol className="space-y-4">
                                  {row.events.map((event) => (
                                    <li key={event.id} className="relative pl-6">
                                      <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-indigo-500 bg-indigo-100" />
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-800">{event.type}</p>
                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{event.source}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {event.verified ? (
                                              <AuditBadge value="✔ verified" tone="success" />
                                            ) : (
                                              <AuditBadge value="unverified" tone="neutral" />
                                            )}
                                          </div>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">{formatDate(event.created_at)}</p>
                                        {event.payload !== undefined && event.payload !== null && (
                                          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                                            {formatValue(event.payload)}
                                          </pre>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                                  No activity recorded for this checkpoint.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
