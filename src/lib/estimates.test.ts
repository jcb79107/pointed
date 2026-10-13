import { describe, expect, it } from "vitest";

import {
  isFinalizableEstimate,
  LEGACY_POINTING_CARDS,
  linearTeamEstimateCards,
  resolvePointingCards,
  voteLabel,
  selectableEstimateCards,
} from "@/lib/estimates";

describe("pointing scale", () => {
  it("uses the exact internal pointing scale", () => {
    expect(LEGACY_POINTING_CARDS).toEqual([
      { value: 0, label: "0" },
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
      { value: 4, label: "4" },
    ]);
    expect(isFinalizableEstimate(4, LEGACY_POINTING_CARDS)).toBe(true);
    expect(isFinalizableEstimate(5, LEGACY_POINTING_CARDS)).toBe(false);
    expect(voteLabel(0, LEGACY_POINTING_CARDS)).toBe("0");
  });

  it("mirrors Linear team scales and customizes only compatible values", () => {
    const team = {
      id: "team",
      key: "ENG",
      name: "Engineering",
      issueEstimationType: "fibonacci" as const,
      issueEstimationAllowZero: true,
      issueEstimationExtended: true,
    };
    expect(linearTeamEstimateCards(team).map((card) => card.value)).toEqual([
      1, 2, 3, 5, 8, 13, 21,
    ]);
    expect(
      resolvePointingCards(
        { pointingPreset: "custom", customPointValues: [0, 1, 3, 8] },
        team,
      ).map((card) => card.value),
    ).toEqual([1, 3, 8]);
    expect(() =>
      resolvePointingCards(
        { pointingPreset: "custom", customPointValues: [0, 1, 4] },
        team,
      ),
    ).toThrow(/does not accept/);
  });
});

it("excludes zero from existing decks and rejects it for finalization without rewriting history", () => {
  const cards = [{ value: 0, label: "0" }, { value: 1, label: "XS" }, { value: 3, label: "M" }];
  expect(selectableEstimateCards(cards)).toEqual(cards.slice(1));
  expect(cards).toHaveLength(3);
  expect(isFinalizableEstimate(0, cards)).toBe(false);
  expect(isFinalizableEstimate(1, cards)).toBe(true);
});
