"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const storageKey = "pointed-session-analytics";
const changeEvent = "pointed-analytics-change";
type Choice = "allowed" | "declined" | null;
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global { interface Window { clarity?: Clarity } }

function readChoice(): Choice {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "allowed" || value === "declined" ? value : null;
  } catch { return null; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

export function SessionAnalytics({ preferences = false }: { preferences?: boolean }) {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const pathname = usePathname();
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    if (preferences || !projectId || !/^[a-z0-9]+$/.test(projectId)) return;
    if (choice !== "allowed") {
      window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
      window.clarity?.("stop");
      return;
    }
    if (document.getElementById("pointed-clarity")) {
      window.clarity?.("start");
      window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
      return;
    }
    const clarity: Clarity = (...args) => { (clarity.q ??= []).push(args); };
    window.clarity = clarity;
    clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    const script = document.createElement("script");
    script.id = "pointed-clarity";
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${projectId}`;
    document.head.appendChild(script);
  }, [choice, projectId, preferences]);

  function choose(value: Exclude<Choice, null>) {
    try {
      localStorage.setItem(storageKey, value);
      setStorageError(false);
      window.dispatchEvent(new Event(changeEvent));
    } catch { setStorageError(true); }
  }

  if (!projectId || !/^[a-z0-9]+$/.test(projectId) || (!preferences && (choice || pathname === "/privacy"))) return null;
  return <aside className={`analytics-choice${preferences ? " analytics-preferences" : ""}`} aria-label="Session analytics">
    <div><strong>{preferences ? "This browser" : "Optional session analytics"}</strong>
      {!preferences && <p>Allow Microsoft Clarity to record masked sessions, clicks, and pages visited? Optional analytics cookies connect visits. <Link href="/privacy">Privacy details</Link></p>}
      {preferences && <p role="status">Session analytics: {choice === "allowed" ? "on" : "off"}. You can change this anytime.</p>}
      {storageError && <p role="alert">Your browser could not save this choice. Session analytics stays off unless you previously allowed it.</p>}
    </div>
    <div className="analytics-actions">
      <button className="button button-ghost" onClick={() => choose("declined")}>{choice === "allowed" ? "Turn off analytics" : "Decline"}</button>
      <button className="button button-ghost" onClick={() => choose("allowed")} disabled={choice === "allowed"}>Allow analytics</button>
    </div>
  </aside>;
}
