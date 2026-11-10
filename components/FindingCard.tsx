import type { Finding } from "../lib/types";

type FindingCardProps = {
  finding: Finding;
  acknowledgementLabel?: string;
  acknowledged?: boolean;
  onAcknowledgedChange?: (acknowledged: boolean) => void;
};

const severityStyles: Record<Finding["severity"], string> = {
  HIGH: "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  LOW: "border-gray-200 bg-gray-50 text-gray-700",
};

export default function FindingCard({
  finding,
  acknowledgementLabel,
  acknowledged = false,
  onAcknowledgedChange,
}: FindingCardProps) {
  const checkboxId = `finding-ack-${finding.id}`;

  return (
    <article
      className={`rounded-xl border p-4 sm:p-5 ${severityStyles[finding.severity]}`}
      aria-labelledby={`${checkboxId}-title`}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 id={`${checkboxId}-title`} className="text-sm font-semibold uppercase tracking-wide">
          {finding.severity} finding
        </h3>
        <span className="min-w-0 break-words text-xs opacity-75">{finding.field}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <section className="rounded-lg border border-current/15 bg-white/60 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide opacity-75">You expected</h4>
          <p className="mt-1 break-words text-sm">{finding.expected}</p>
        </section>
        <section className="rounded-lg border border-current/15 bg-white/60 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide opacity-75">Actually</h4>
          <p className="mt-1 break-words text-sm">{finding.actual}</p>
        </section>
      </div>

      {finding.severity === "HIGH" && acknowledgementLabel ? (
        <div className="mt-4 border-t border-current/15 pt-4">
          <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              id={checkboxId}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange?.(event.currentTarget.checked)}
              className="mt-0.5 size-4 shrink-0 accent-red-700"
            />
            <span>{acknowledgementLabel}</span>
          </label>
        </div>
      ) : null}
    </article>
  );
}
