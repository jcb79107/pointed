import { expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), replayIntegration: vi.fn(() => ({ name: 'Replay' })), addEventProcessor: vi.fn() }));
vi.mock('@sentry/nextjs', () => sdk);
import './instrumentation-client';
it('never samples replay automatically and blocks forms and sensitive content', () => {
  const config = sdk.init.mock.calls[0][0];
  expect(config.replaysSessionSampleRate).toBe(0);
  expect(config.replaysOnErrorSampleRate).toBe(0);
  config.integrations([]);
  expect(sdk.replayIntegration).toHaveBeenCalledWith(expect.objectContaining({
    maskAllText: true, maskAllInputs: true, blockAllMedia: true,
    block: expect.arrayContaining(['form','input','textarea','select','[contenteditable]','[data-sensitive]','[data-sentry-block]','.issue-description']),
    networkCaptureBodies: false,
  }));
});
