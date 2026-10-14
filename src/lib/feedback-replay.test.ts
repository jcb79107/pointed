import { expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ replayIntegration: vi.fn<(options: unknown) => { name: string }>(() => ({ name: "Replay" })), addIntegration: vi.fn(), getReplay: vi.fn() }));
vi.mock("@sentry/nextjs", () => sdk);
import { installFeedbackReplay } from "./feedback-replay";
it("keeps forms, sensitive content, media and network payloads blocked when loaded on demand", () => {
  installFeedbackReplay();
  expect(sdk.replayIntegration).toHaveBeenCalledWith(expect.objectContaining({
    maskAllText: true, maskAllInputs: true, blockAllMedia: true,
    block: expect.arrayContaining(["form", "input", "textarea", "select", "[contenteditable]", "[data-sensitive]", "[data-sentry-block]", ".issue-description"]),
    networkCaptureBodies: false, networkDetailAllowUrls: [], stickySession: false,
  }));
  const options = sdk.replayIntegration.mock.calls[0][0] as unknown as { beforeErrorSampling: () => boolean; beforeAddRecordingEvent: () => null };
  expect(options.beforeErrorSampling()).toBe(false);
  expect(options.beforeAddRecordingEvent()).toBeNull();
  expect(sdk.addIntegration).toHaveBeenCalledWith({ name: "Replay" });
});
