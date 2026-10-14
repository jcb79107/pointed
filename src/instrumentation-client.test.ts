import { expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), replayIntegration: vi.fn(() => ({ name: 'Replay' })), addEventProcessor: vi.fn() }));
vi.mock('@sentry/nextjs', () => sdk);
import './instrumentation-client';
it('never loads or samples replay automatically', () => {
  const config = sdk.init.mock.calls[0][0];
  expect(config.replaysSessionSampleRate).toBe(0);
  expect(config.replaysOnErrorSampleRate).toBe(0);
  config.integrations([]);
  expect(sdk.replayIntegration).not.toHaveBeenCalled();
});
