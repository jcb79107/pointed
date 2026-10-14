import * as Sentry from "@sentry/nextjs";

// getReplay() is exported by the recorder bundle itself. Reading the installed
// integration through the client keeps that bundle out of ordinary feedback.
function getFeedbackReplay() {
  return Sentry.getClient()?.getIntegrationByName<ReturnType<typeof Sentry.replayIntegration>>("Replay");
}

export async function sendPointedFeedback(message: string, email: string, screenshot?: File, includeReplay = false) {
  const client = Sentry.getClient();
  if (!client?.getDsn()) throw new Error("Feedback is unavailable. Please use the support page.");
  const replay = getFeedbackReplay();
  const replayId = includeReplay ? replay?.getReplayId() : undefined;
  const attachments = screenshot ? [{ filename: `screenshot.${screenshot.type === "image/jpeg" ? "jpg" : screenshot.type === "image/webp" ? "webp" : "png"}`, contentType: screenshot.type, data: new Uint8Array(await screenshot.arrayBuffer()) }] : undefined;
  let removeListener: (() => void) | undefined;
  try {
    // Only attach a recording explicitly started and selected by this user.
    if (replayId) await replay?.flush({ continueRecording: false });
    removeListener = client.on("beforeSendFeedback", (event) => {
      if (replayId && event.contexts?.feedback) event.contexts.feedback.replay_id = replayId;
    });
    await Sentry.sendFeedback({ message, email: email || undefined }, { includeReplay: false, attachments });
  } finally {
    removeListener?.();
    // Submission ends recording. A new recording needs a new user action.
    await replay?.stop({ flush: false });
  }
}

export async function startFeedbackRecording(signal?: AbortSignal) {
  if (!Sentry.getClient()?.getDsn()) throw new Error("Recording is unavailable. You can still attach a screenshot.");
  if (!getFeedbackReplay()) {
    const { installFeedbackReplay } = await import("./feedback-replay");
    if (signal?.aborted) return;
    installFeedbackReplay();
  }
  if (signal?.aborted) return;
  const replay = getFeedbackReplay();
  if (!Sentry.getClient()?.getDsn() || !replay) throw new Error("Recording is unavailable. You can still attach a screenshot.");
  replay.startBuffering();
}

export async function discardFeedbackRecording() {
  await getFeedbackReplay()?.stop({ flush: false });
}
