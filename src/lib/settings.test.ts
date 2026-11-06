import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_SETTINGS } from "./preferences";
import { getUserSettings, saveUserSettings } from "./settings";

const mocks = vi.hoisted(() => ({ limit: vi.fn(), values: vi.fn(), conflict: vi.fn(), returning: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
  insert: () => ({ values: mocks.values }),
} }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
  mocks.conflict.mockReturnValue({ returning: mocks.returning });
});

describe("stored user settings", () => {
  it.each([{ rows: [] }, { rows: [{ autoReveal: "invalid" }] }])("falls back for missing or invalid rows", async ({ rows }) => {
    mocks.limit.mockResolvedValue(rows);
    expect(await getUserSettings("user")).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("normalizes legacy preferences and strips database-only fields", async () => {
    mocks.limit.mockResolvedValue([{ ...DEFAULT_USER_SETTINGS, userId: "user", updatedAt: new Date(), pointingPreset: "custom", defaultSort: "custom", autoReveal: false }]);
    expect(await getUserSettings("user")).toEqual({ ...DEFAULT_USER_SETTINGS, autoReveal: false });
  });

  it("persists only validated settings and the authenticated owner", async () => {
    const expected = { ...DEFAULT_USER_SETTINGS, autoReveal: false };
    mocks.returning.mockResolvedValue([{ ...expected, userId: "user", updatedAt: new Date() }]);
    const input = { ...expected, pointingPreset: "custom" as const, userId: "other-user", unrelated: true };
    expect(await saveUserSettings("user", input)).toEqual(expected);
    expect(mocks.values).toHaveBeenCalledWith({ ...expected, userId: "user", updatedAt: expect.any(Date) });
    expect(mocks.conflict).toHaveBeenCalledWith({ target: expect.anything(), set: { ...expected, updatedAt: expect.any(Date) } });
  });

  it("rejects invalid writes before reaching storage", async () => {
    await expect(saveUserSettings("user", { ...DEFAULT_USER_SETTINGS, customPointValues: [1] })).rejects.toThrow();
    expect(mocks.values).not.toHaveBeenCalled();
  });
});
