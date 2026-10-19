// Loaded only after the user explicitly requests a recording.
import * as Sentry from "@sentry/nextjs";

export function installFeedbackReplay() {
  if (!Sentry.getReplay()) {
    Sentry.addIntegration(Sentry.replayIntegration({
      maskAllText: true,
      block: ["form", "input", "textarea", "select", "[contenteditable]", "[data-sensitive]", "[data-sentry-block]", ".issue-description", ".issue-tags", ".room-title", ".participant-list"],
      maskAllInputs: true,
      blockAllMedia: true,
      stickySession: false,
      minReplayDuration: 0,
      networkDetailAllowUrls: [],
      networkCaptureBodies: false,
      beforeErrorSampling: () => false,
      // Keep the visual interaction recording, not console or network payloads.
      beforeAddRecordingEvent: () => null,
    }));
  }
}
