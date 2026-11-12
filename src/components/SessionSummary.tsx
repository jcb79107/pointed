import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import type { GroomingOutcome, SessionSnapshot } from "@/lib/domain";
import { accumulatedElapsedSeconds } from "@/lib/timing";
import { voteLabel } from "@/lib/estimates";
import { ElapsedTimer, formatDuration } from "./ElapsedTimer";

export function groomingOutcomeLabel(outcome: GroomingOutcome | null) {
  switch (outcome) {
    case "ready":
      return "Estimated";
    case "skipped":
      return "Skipped";
    default:
      return "Not discussed";
  }
}

export function SessionSummary({
  busy,
  demoMode,
  items,
  cards,
  title,
  isFacilitator,
  onResume,
  sessionActiveStartedAt,
  sessionElapsedSeconds,
}: {
  busy: boolean;
  demoMode: boolean;
  items: SessionSnapshot["queue"];
  cards: SessionSnapshot["estimateCards"];
  title: string;
  isFacilitator: boolean;
  onResume: (queueItemId: string) => void;
  sessionActiveStartedAt: string | null;
  sessionElapsedSeconds: number;
}) {
  const [copied, setCopied] = useState(false);
  const remaining = items.filter(
    (item) => item.status === "pending" || item.status === "active",
  );
  const [copyFailed, setCopyFailed] = useState(false);
  const summaryText = [
    title,
    `Total time: ${formatDuration(
      accumulatedElapsedSeconds(
        sessionElapsedSeconds,
        sessionActiveStartedAt,
      ),
    )}`,
    "",
    ...items.map((item) => {
      const outcome =
        item.groomingOutcome ??
        (item.status === "estimated"
          ? "ready"
          : item.status === "skipped"
            ? "skipped"
            : null);
      const estimate =
        item.finalEstimate === null ? "" : ` · ${voteLabel(item.finalEstimate, cards)}`;
      const duration = item.elapsedSeconds
        ? ` · ${formatDuration(item.elapsedSeconds)}`
        : "";
      return `${item.identifier}: ${groomingOutcomeLabel(outcome)}${estimate}${duration}`;
    }),
  ].join("\n");

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="session-summary">
      <div className="session-summary-heading">
        <span><Check size={22} /></span>
        <div>
          <p className="step-label">Session summary</p>
          <h1>{remaining.length ? "Finished for now." : "Session complete"}</h1>
          <p>
            {items.filter((item) => item.groomingOutcome === "ready" || item.status === "estimated").length} estimated ·{" "}
            {items.filter(item => item.status === "skipped").length} skipped ·{" "}
            {remaining.length} remaining ·{" "}
            <ElapsedTimer
              activeStartedAt={sessionActiveStartedAt}
              baseSeconds={sessionElapsedSeconds}
            />
          </p>
        </div>
      </div>
      <div className="summary-list">
        {items.map((item) => {
          const outcome =
            item.groomingOutcome ??
            (item.status === "estimated"
              ? "ready"
              : item.status === "skipped"
                ? "skipped"
                : null);
          const TicketLink = demoMode ? "div" : "a";
          return (
            <div className="summary-item" key={item.id}><TicketLink className="summary-ticket" {...(!demoMode ? { href: item.url, rel: "noreferrer", target: "_blank" } : {})}>
              <div>
                <b>{item.identifier}</b>
                <span>{item.title}</span>
              </div>
              <em className={outcome ?? "pending"}>
                {outcome === "ready" && !demoMode ? "Saved to Linear" : groomingOutcomeLabel(outcome)}
                {item.finalEstimate !== null && ` · ${voteLabel(item.finalEstimate, cards)}`}
                {item.elapsedSeconds > 0 && ` · ${formatDuration(item.elapsedSeconds)}`}
              </em>
            </TicketLink>{isFacilitator && item.status === "skipped" && <button type="button" disabled={busy} onClick={() => onResume(item.id)}>Revisit {item.identifier}</button>}</div>
          );
        })}
      </div>
      {copyFailed && (
        <label>
          <span role="alert">Could not copy automatically. Select and copy the summary below.</span>
          <textarea className="resize-none" aria-label="Session summary to copy" readOnly rows={8} value={summaryText} />
        </label>
      )}
      <div className="session-summary-actions">
        {isFacilitator && remaining[0] && (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => onResume(remaining[0].id)}
            type="button"
          >
            Resume {remaining.length} remaining
          </button>
        )}
        <button className="button button-ghost" onClick={copySummary} type="button">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy summary"}
        </button>
        <Link className="button button-dark" href="/sessions">
          {demoMode ? "Create your first session" : "Back to sessions"}
        </Link>
      </div>
      {demoMode && <p>This was a practice session. Connect Linear to bring your own tickets and invite your team.</p>}
    </div>
  );
}
