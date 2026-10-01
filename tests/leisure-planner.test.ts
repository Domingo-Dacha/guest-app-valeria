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
    const result = plan({
      dayLength: "short",
      travel: "20",
      endTime: "12:00",
    });
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

  it("offers SUP only in summer and a morning run in every season and weather", () => {
    const sup = activityFixture.find((activity) => activity.id === "dd-012")!;
    const run = activityFixture.find((activity) => activity.id === "a-002")!;
    expect(sup.seasons).toEqual(["summer"]);
    expect(run.timeOfDay).toEqual(["morning"]);
    expect(run.title).toBe("Пробежка");
    expect(run.seasons).toEqual(["all"]);
    expect(run.weather).toEqual(["any"]);
    expect(
      plan({ season: "autumn", weather: "cool" }).items.some(
        ({ activity }) => activity.id === "dd-012",
      ),
    ).toBe(false);
  });

  it("matches each health trail level to an active short or medium day", () => {
    const shortPlan = plan({
      dayLength: "short",
      moods: ["active"],
      startTime: "09:00",
      endTime: "12:00",
      travel: "home",
    });
    const mediumPlan = plan({
      dayLength: "medium",
      moods: ["active"],
      startTime: "09:00",
      endTime: "14:00",
      travel: "home",
    });
    expect(shortPlan.items.some((item) => item.activity.id === "a-001")).toBe(
      true,
    );
    expect(
      shortPlan.items.some(
        (item) => item.activity.id === "a-health-trail-level-2",
      ),
    ).toBe(false);
    expect(
      mediumPlan.items.some(
        (item) => item.activity.id === "a-health-trail-level-2",
      ),
    ).toBe(true);
    expect(mediumPlan.items.some((item) => item.activity.id === "a-001")).toBe(
      false,
    );
  });

  it("attaches the four supplied maps to their route cards", () => {
    const expected = new Map([
      ["a-001", "/activity-maps/health-trail-level-1.webp"],
      ["a-health-trail-level-2", "/activity-maps/health-trail-level-2.webp"],
      ["a-002", "/activity-maps/running-route.webp"],
      ["a-003", "/activity-maps/bike-route.webp"],
    ]);
    for (const [id, imageAsset] of expected) {
      expect(
        activityFixture.find((activity) => activity.id === id)?.imageAsset,
      ).toBe(imageAsset);
    }
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

  it("supports varied off-property trips starting at ten minutes away", () => {
    const result = plan({ travel: "far", dayLength: "full-day" });
    expect(result.items.length).toBeGreaterThan(1);
    expect(
      result.items.every(
        ({ activity }) =>
          activity.source !== "domingo" && (activity.travelMinutes ?? 0) >= 10,
      ),
    ).toBe(true);
  });

  it("fills the requested interval from its exact start with several blocks", () => {
    const result = plan({
      season: "autumn",
      weather: "rain",
      companions: ["teens"],
      moods: ["relax", "learn"],
      startTime: "10:00",
      endTime: "20:00",
      travel: "40",
    });
    expect(result.items.length).toBeGreaterThan(1);
    expect(result.items[0]?.startTime).toBe("10:00");
    expect(result.endTime).toBe("20:00");
  });

  it("never leaves a full-day filter combination empty or half-filled", () => {
    const seasons = ["spring", "summer", "autumn", "winter"] as const;
    const weather = ["sunny", "hot", "cool", "rain", "snow"] as const;
    const companions = [
      "solo",
      "couple",
      "children",
      "friends",
      "teens",
      "pet",
    ] as const;
    const travel = ["home", "20", "40", "far", "any"] as const;

    for (const season of seasons) {
      for (const weatherValue of weather) {
        for (const companion of companions) {
          for (const travelValue of travel) {
            const result = plan({
              season,
              weather: weatherValue,
              companions: [companion],
              travel: travelValue,
              startTime: "10:00",
              endTime: "20:00",
            });
            const scenario = `${season}/${weatherValue}/${companion}/${travelValue}`;
            expect(result.items.length, scenario).toBeGreaterThan(1);
            expect(
              elapsed("10:00", result.items[0]?.startTime ?? "10:00"),
              scenario,
            ).toBe(result.items[0]?.travelBeforeMinutes ?? 0);
            expect(result.endTime, scenario).toBe("20:00");
          }
        }
      }
    }
  });

  it("removes grocery delivery and includes teen bowling and cinema", () => {
    expect(
      activityFixture.some(
        (activity) =>
          activity.status === "active" &&
          activity.title === "Доставка продуктов",
      ),
    ).toBe(false);
    expect(
      activityFixture.find((activity) => activity.id === "g-039"),
    ).toMatchObject({
      title: "Боулинг Mr. Mish",
      phone: "+7 (999) 505-57-70",
    });
    expect(
      activityFixture.find((activity) => activity.id === "g-korston-cinema"),
    ).toMatchObject({
      title: "Кинотеатр «Корстон»",
      phone: "+7 (4967) 39-16-39",
    });
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
