import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  flush: vi.fn(), stop: vi.fn(), startBuffering: vi.fn(), sendFeedback: vi.fn(), off: vi.fn(),
  listener: undefined as undefined | ((event: { contexts: { feedback: Record<string, unknown> } }) => void),
}));
vi.mock("@sentry/nextjs", () => ({
  getClient: () => ({ getDsn: () => ({}), getIntegrationByName: () => ({ getReplayId: () => "a".repeat(32), flush: sdk.flush, stop: sdk.stop, startBuffering: sdk.startBuffering }), on: (_: string, listener: typeof sdk.listener) => { sdk.listener = listener; return sdk.off; } }),
  sendFeedback: sdk.sendFeedback,
}));
import { sendPointedFeedback, startFeedbackRecording, discardFeedbackRecording } from "./feedback";

describe("feedback submission", () => {
  beforeEach(() => { vi.clearAllMocks(); sdk.flush.mockResolvedValue(undefined); sdk.stop.mockResolvedValue(undefined); sdk.sendFeedback.mockResolvedValue("event"); });
  it("starts only on request and discards without uploading", async () => {
    await startFeedbackRecording();
    expect(sdk.startBuffering).toHaveBeenCalledOnce();
    await discardFeedbackRecording();
    expect(sdk.stop).toHaveBeenCalledWith({flush:false});
    expect(sdk.flush).not.toHaveBeenCalled();
  });
  it("does not start when consent was canceled", async () => {
    const controller = new AbortController();
    controller.abort();
    await startFeedbackRecording(controller.signal);
    expect(sdk.startBuffering).not.toHaveBeenCalled();
  });
  it("uploads an explicitly attached buffer, links it, and stops recording", async () => {
    expect(sdk.flush).not.toHaveBeenCalled();
    sdk.sendFeedback.mockImplementationOnce(async () => {
      const event = { contexts: { feedback: {} } };
      sdk.listener?.(event);
      expect(event.contexts.feedback).toEqual({ replay_id: "a".repeat(32) });
    });
    await sendPointedFeedback("The queue jumps", "", undefined, true);
    expect(sdk.flush).toHaveBeenCalledWith({ continueRecording: false });
    expect(sdk.sendFeedback).toHaveBeenCalledWith({ message: "The queue jumps", email: undefined }, { includeReplay: false, attachments: undefined });
    expect(sdk.stop).toHaveBeenCalledWith({ flush: false });
    expect(sdk.startBuffering).not.toHaveBeenCalled();
    expect(sdk.off).toHaveBeenCalledOnce();
  });
  it("sends text-only feedback without uploading any replay", async () => {
    await sendPointedFeedback("Text only", "");
    expect(sdk.flush).not.toHaveBeenCalled();
    expect(sdk.startBuffering).not.toHaveBeenCalled();
  });
  it("stops recording after a failed upload", async () => {
    sdk.sendFeedback.mockRejectedValueOnce(new Error("offline"));
    await expect(sendPointedFeedback("Retry this", "")).rejects.toThrow("offline");
    expect(sdk.stop).toHaveBeenCalledWith({ flush: false });
    expect(sdk.startBuffering).not.toHaveBeenCalled();
    expect(sdk.off).toHaveBeenCalledOnce();
  });
});
