import { describe, expect, it } from "vitest";

import type { Activity } from "@/data/contracts/activity";
import { activityFixture } from "@/data/repositories/fixture-activity-repository";
import { buildDayPlan, type PlannerPreferences } from "@/lib/leisure/planner";

const basePreferences: PlannerPreferences = {
  season: "summer",
  weather: "sunny",
  moods: ["active"],
  companions: ["couple"],
  dayLength: "full-day",
  startTime: "10:00",
  travel: "40",
  variation: 0,
};

function plan(overrides: Partial<PlannerPreferences> = {}) {
  return buildDayPlan(activityFixture, { ...basePreferences, ...overrides });
}

function elapsed(start: string, end: string) {
  const value = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return value(end) - value(start);
}

describe("leisure day planner", () => {
  it("builds an outdoor-capable active summer plan for a couple", () => {
    const result = plan();
    expect(result.items.length).toBeGreaterThan(1);
    expect(
      result.items.some(({ activity }) => activity.moods.includes("active")),
    ).toBe(true);
    expect(
      result.items.every(
        ({ activity }) =>
          activity.seasons.includes("all") ||
          activity.seasons.includes("summer"),
      ),
    ).toBe(true);
  });

  it("keeps a snowy winter plan suitable for children", () => {
    const result = plan({
      season: "winter",
      weather: "snow",
      companions: ["children"],
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        ({ activity }) => !/(^|\D)18\+/.test(activity.ageRestrictions ?? ""),
      ),
    ).toBe(true);
  });

  it("does not suggest dry-weather-only activities for an autumn rain plan", () => {
    const result = plan({
      season: "autumn",
      weather: "rain",
      moods: ["relax"],
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(({ activity }) =>
        activity.weather.some((weather) =>
          ["rain", "cloudy", "cool", "any"].includes(weather),
        ),
      ),
    ).toBe(true);
  });

  it("never leaves Domingo when the guest does not want to travel", () => {
    const result = plan({ travel: "home" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        ({ activity }) =>
          activity.locationGroup === "Domingo" || activity.travelMinutes === 0,
      ),
    ).toBe(true);
  });

  it("keeps a short plan within two hours including travel", () => {
    const result = plan({ dayLength: "short", travel: "20" });
    expect(elapsed("10:00", result.endTime)).toBeLessThanOrEqual(120);
  });

  it("builds several blocks for a full day", () => {
    expect(plan().items.length).toBeGreaterThanOrEqual(3);
  });

  it("produces an alternative while avoiding the previous result", () => {
    const first = plan();
    const second = plan({
      variation: 1,
      avoidIds: first.items.map(({ activity }) => activity.id),
    });
    expect(second.items.map(({ activity }) => activity.id)).not.toEqual(
      first.items.map(({ activity }) => activity.id),
    );
  });

  it("never returns a disabled activity even when it is otherwise perfect", () => {
    const disabled: Activity = {
      ...activityFixture.find((activity) => activity.status === "active")!,
      id: "disabled-perfect-match",
      status: "disabled",
      moods: ["active"],
    };
    const result = buildDayPlan([disabled], basePreferences);
    expect(result.items).toHaveLength(0);
  });

  it("does not crash on nullable optional facts", () => {
    const incomplete: Activity = {
      ...activityFixture.find((activity) => activity.status === "active")!,
      id: "incomplete-activity",
      description: null,
      location: null,
      travelMinutes: null,
      durationMinutes: null,
      totalMinutes: null,
      conditions: null,
      ageRestrictions: null,
      mapAsset: null,
      sourceUrl: null,
    };
    expect(() => buildDayPlan([incomplete], basePreferences)).not.toThrow();
  });
});
