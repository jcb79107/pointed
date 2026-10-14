"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { discardFeedbackRecording, startFeedbackRecording, sendPointedFeedback } from "@/lib/feedback";

export function FeedbackButton({ compact = false }: { compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const noticeId = useId();
  const recordingRequest = useRef<AbortController | null>(null);
  const [startingRecording, setStartingRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [screenshot, setScreenshot] = useState<File>();
  const [recording, setRecording] = useState(false);
  const [includeReplay, setIncludeReplay] = useState(false);
  useEffect(() => () => { recordingRequest.current?.abort(); void discardFeedbackRecording(); }, []);
  async function cancel() {
    recordingRequest.current?.abort();
    setStartingRecording(false);
    await discardFeedbackRecording();
    setRecording(false);
    setIncludeReplay(false);
    dialog.current?.close();
  }
  async function record() {
    if (startingRecording) return;
    const request = new AbortController();
    recordingRequest.current = request;
    setStartingRecording(true);
    try {
      await startFeedbackRecording(request.signal);
      if (request.signal.aborted) return;
      setRecording(true);
      setIncludeReplay(true);
      setError("");
      dialog.current?.close();
    } catch (caught) {
      if (!request.signal.aborted) setError(caught instanceof Error ? caught.message : "Recording is unavailable.");
    } finally {
      if (recordingRequest.current === request) setStartingRecording(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const message = String(data.get("message") ?? "").trim();
    if (!message) { setError("Tell us what happened or what you’d change."); return; }
    setBusy(true);
    setError("");
    try {
      await sendPointedFeedback(message, String(data.get("email") ?? "").trim(), screenshot, includeReplay);
      dialog.current?.close();
      form.current?.reset();
      setScreenshot(undefined);
      setSent(true);
    } catch {
      setError("Couldn’t send your feedback. Your message is still here—please try again or use Help.");
    } finally { setBusy(false); setRecording(false); setIncludeReplay(false); }
  }

  return <span className="feedback-control">
    <button ref={trigger} type="button" className={compact ? "header-icon-link" : "button button-secondary"} aria-label="Send feedback" title="Send feedback" onClick={() => { setSent(false); dialog.current?.showModal(); }}>
      <MessageSquare size={16} aria-hidden="true" />{!compact && "Send feedback"}
    </button>
    {recording && <span className="feedback-recording" role="status">Recording locally <button type="button" onClick={() => void cancel()}>Discard recording</button></span>}
    {sent && <span className="feedback-fallback" role="status">Thanks — your feedback was sent.</span>}
    <dialog onClose={() => trigger.current?.focus()} ref={dialog} className="feedback-dialog" aria-labelledby={titleId} aria-describedby={noticeId} onCancel={(event) => { event.preventDefault(); if (!busy) void cancel(); }} data-sentry-block>
      <form ref={form} onSubmit={submit}>
        <h2 id={titleId}>Send feedback</h2>
        <label>What happened, or what would you change?<textarea name="message" required maxLength={5000} rows={5} /></label>
        <label><span>Email (optional, for a reply)</span><input name="email" type="email" maxLength={254} autoComplete="email" /></label>
        <label><span>Screenshot (optional)</span><input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
            setError("Choose a PNG, JPG, or WebP image under 5 MB."); event.target.value = ""; setScreenshot(undefined); return;
          }
          setError(""); setScreenshot(file);
        }} /></label>
        {screenshot && <button className="button button-secondary" type="button" onClick={() => { setScreenshot(undefined); const input = form.current?.elements.namedItem("screenshot") as HTMLInputElement; if (input) input.value = ""; }}>Remove screenshot</button>}
        <p id={noticeId}>Sending shares your message, optional email, and any screenshot you attach with the maintainer through Sentry. Review screenshots for private information. <Link href="/privacy" target="_blank">Privacy</Link></p>
        <p>Replay is off by default. You can start a recording, reproduce the problem, then reopen feedback to attach up to the last minute. Text is masked; forms and sensitive content are blocked. Nothing is uploaded until you send it.</p>
        {recording ? <label className="feedback-replay-choice"><input type="checkbox" checked={includeReplay} onChange={event => setIncludeReplay(event.target.checked)} />Attach my recording</label> : <button type="button" className="button button-secondary" disabled={startingRecording} onClick={() => void record()}>{startingRecording ? "Loading recorder…" : "Start recording to reproduce a problem"}</button>}
        {error && <p role="alert">{error} <Link href="/support" target="_blank">Help</Link></p>}
        <div className="feedback-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => void cancel()}>Cancel</button><button type="submit" className="button button-primary" disabled={busy || startingRecording}>{busy ? "Sending…" : "Send feedback"}</button></div>
      </form>
    </dialog>
  </span>;
}
