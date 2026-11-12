import { useEffect, useState } from "react";

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ElapsedTimer({
  activeStartedAt,
  baseSeconds,
  compact = false,
  label,
}: {
  activeStartedAt: string | null;
  baseSeconds: number;
  compact?: boolean;
  label?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!activeStartedAt) return;
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [activeStartedAt]);
  const activeSeconds =
    now !== null && activeStartedAt
      ? Math.max(0, Math.floor((now - Date.parse(activeStartedAt)) / 1000))
      : 0;
  return (
    <span className={compact ? "elapsed-timer compact" : "elapsed-timer"}>
      {label && `${label} `}
      {formatDuration(baseSeconds + activeSeconds)}
    </span>
  );
}
