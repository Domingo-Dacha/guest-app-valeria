import { describe, expect, it } from "vitest";

import type { Activity } from "@/data/contracts/activity";
import { ACTIVITY_OPTIONS } from "@/data/fixtures/activity-options";
import { activityFixture } from "@/data/repositories/fixture-activity-repository";
import { buildDayPlan, type PlannerPreferences } from "@/lib/leisure/planner";

const basePreferences: PlannerPreferences = {
  season: "summer",
  weather: "sunny",
  moods: ["active"],
  companions: ["couple"],
  dayLength: "full-day",
  startTime: "10:00",
  endTime: "21:00",
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
  it("exposes only the requested weather and mood filters", () => {
    expect(ACTIVITY_OPTIONS.weather.map((option) => option.label)).toEqual([
      "Солнечно",
      "Жарко",
      "Прохладно",
      "Дождь",
      "Снег",
    ]);
    expect(ACTIVITY_OPTIONS.moods.map((option) => option.value)).not.toContain(
      "creative",
    );
    expect(ACTIVITY_OPTIONS.moods.map((option) => option.value)).not.toContain(
      "beautiful",
    );
  });

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
      result.items.every(
        ({ activity }) =>
          !/велосипед|веломаршрут|пробеж|пеш|прогул/i.test(activity.title),
      ),
    ).toBe(true);
  });

  it("never leaves Domingo when the guest does not want to travel", () => {
    const result = plan({ travel: "home" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        ({ activity }) =>
          activity.source === "domingo" ||
          activity.locationGroup === "Domingo" ||
          activity.travelMinutes === 0,
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
    const overlap = second.items.filter(({ activity }) =>
      first.items.some((item) => item.activity.id === activity.id),
    );
    expect(overlap.length).toBeLessThanOrEqual(1);
  });

  it("finishes by the requested end time", () => {
    const result = plan({ endTime: "15:00", dayLength: "full-day" });
    expect(elapsed("10:00", result.endTime)).toBeLessThanOrEqual(300);
  });

  it("offers SUP only in summer and runs only in the morning", () => {
    const sup = activityFixture.find((activity) => activity.id === "dd-012")!;
    const run = activityFixture.find((activity) => activity.id === "a-002")!;
    expect(sup.seasons).toEqual(["summer"]);
    expect(run.timeOfDay).toEqual(["morning"]);
    expect(
      plan({ season: "autumn", weather: "cool" }).items.some(
        ({ activity }) => activity.id === "dd-012",
      ),
    ).toBe(false);
  });

  it("uses Forest Fishing as the only fishing option", () => {
    const fishing = activityFixture.filter(
      (activity) =>
        activity.status === "active" && /рыбал|fishing/i.test(activity.title),
    );
    expect(fishing.map((activity) => activity.id)).toEqual(["dd-014"]);
  });

  it("keeps repeated route captions to at most two", () => {
    const reasons = plan({
      weather: "rain",
      moods: ["calm", "relax"],
    }).items.map((item) => item.reason);
    for (const reason of new Set(reasons)) {
      expect(
        reasons.filter((item) => item === reason).length,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("supports a far-only car trip", () => {
    const result = plan({ travel: "far", dayLength: "full-day" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        ({ activity }) =>
          (activity.travelMinutes ?? 0) >= 40 &&
          activity.transport.some((item) => /машин/i.test(item)),
      ),
    ).toBe(true);
  });

  it("splits games and movies and keeps new calm activities in their time slots", () => {
    const games = activityFixture.find(
      (activity) => activity.id === "dd-board-games",
    )!;
    const movie = activityFixture.find(
      (activity) => activity.id === "dd-movie",
    )!;
    expect(games.durationMinutes).toEqual({ min: 120, max: 120 });
    expect(movie.durationMinutes).toEqual({ min: 120, max: 120 });
    expect(movie.timeOfDay).toEqual(["evening"]);
    expect(
      activityFixture.find((activity) => activity.id === "dd-reading")
        ?.timeOfDay,
    ).toEqual(["evening"]);
    expect(
      activityFixture.find((activity) => activity.id === "dd-wine")?.timeOfDay,
    ).toEqual(["evening"]);
    expect(
      activityFixture.find((activity) => activity.id === "dd-siesta")
        ?.timeOfDay,
    ).toEqual(["day"]);
    expect(
      activityFixture.find((activity) => activity.id === "dd-sleep-in")
        ?.timeOfDay,
    ).toEqual(["morning"]);
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
