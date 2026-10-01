import type {
  Activity,
  Companion,
  Mood,
  Season,
  Weather,
} from "@/data/contracts/activity";

export type TravelPreference = "home" | "nearby" | "20" | "40" | "any";
export type DayLength = "short" | "medium" | "half-day" | "full-day";

export interface PlannerPreferences {
  season: Season;
  weather: Weather;
  moods: Mood[];
  companions: Companion[];
  dayLength: DayLength;
  startTime: string;
  travel: TravelPreference;
  variation?: number;
  avoidIds?: string[];
}

export interface PlannedActivity {
  activity: Activity;
  startTime: string;
  endTime: string;
  travelBeforeMinutes: number;
  reason: string;
}

export interface DayPlan {
  items: PlannedActivity[];
  endTime: string;
  returnTravelMinutes: number;
  relaxed: boolean;
}

const budgets: Record<DayLength, number> = {
  short: 120,
  medium: 240,
  "half-day": 360,
  "full-day": 660,
};

const targetCounts: Record<DayLength, number> = {
  short: 2,
  medium: 3,
  "half-day": 4,
  "full-day": 5,
};

const weatherCompatibility: Record<Weather, Weather[]> = {
  sunny: ["sunny", "dry", "warm", "any"],
  hot: ["hot", "sunny", "dry", "warm", "any"],
  cloudy: ["cloudy", "dry", "cool", "any"],
  cool: ["cool", "cloudy", "dry", "any"],
  rain: ["rain", "cloudy", "cool", "any"],
  snow: ["snow", "frost", "cool", "any"],
  frost: ["frost", "snow", "cool", "any"],
  dry: ["dry", "sunny", "cloudy", "any"],
  warm: ["warm", "sunny", "cloudy", "any"],
  any: ["any"],
};

function maxTravel(preference: TravelPreference): number {
  return {
    home: 0,
    nearby: 10,
    "20": 20,
    "40": 40,
    any: Number.POSITIVE_INFINITY,
  }[preference];
}

function isAtDomingo(activity: Activity): boolean {
  return activity.locationGroup === "Domingo" || activity.travelMinutes === 0;
}

function isSafeForChildren(activity: Activity): boolean {
  const restriction = activity.ageRestrictions?.toLocaleLowerCase("ru") ?? "";
  return !/(^|\D)18\+|только взросл/.test(restriction);
}

function hardFilter(
  activity: Activity,
  preferences: PlannerPreferences,
): boolean {
  if (
    activity.status !== "active" ||
    !activity.isSelectable ||
    !activity.durationMinutes
  )
    return false;
  if (
    !activity.seasons.includes("all") &&
    !activity.seasons.includes(preferences.season)
  )
    return false;
  if (
    !activity.weather.some((item) =>
      weatherCompatibility[preferences.weather].includes(item),
    )
  )
    return false;
  if (
    (activity.travelMinutes ?? Number.POSITIVE_INFINITY) >
    maxTravel(preferences.travel)
  )
    return false;
  if (preferences.travel === "home" && !isAtDomingo(activity)) return false;
  if (
    preferences.companions.includes("children") &&
    !isSafeForChildren(activity)
  )
    return false;
  if (
    preferences.companions.length &&
    activity.companions.length &&
    !preferences.companions.some((item) => activity.companions.includes(item))
  )
    return false;
  return true;
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967295;
}

function score(activity: Activity, preferences: PlannerPreferences): number {
  const moodMatches = activity.moods.filter((mood) =>
    preferences.moods.includes(mood),
  ).length;
  const companionMatches = activity.companions.filter((item) =>
    preferences.companions.includes(item),
  ).length;
  const variety = hash(`${activity.id}:${preferences.variation ?? 0}`) * 3;
  const avoidPenalty = preferences.avoidIds?.includes(activity.id) ? 14 : 0;
  const bookingPenalty = activity.bookingRequirement === "required" ? 2 : 0;
  const priorityBonus = activity.priority
    ?.toLocaleLowerCase("ru")
    .includes("выс")
    ? 2
    : 0;
  return (
    moodMatches * 6 +
    companionMatches * 4 +
    priorityBonus +
    variety -
    avoidPenalty -
    bookingPenalty
  );
}

function activityMinutes(activity: Activity): number {
  return activity.durationMinutes?.min ?? 0;
}

function routeMinutes(items: Activity[]): number {
  let total = items.reduce((sum, item) => sum + activityMinutes(item), 0);
  let group = "Domingo";
  let lastTravel = 0;
  for (const item of items) {
    if (item.locationGroup !== group) {
      total += item.travelMinutes ?? 0;
      group = item.locationGroup;
    }
    lastTravel = item.travelMinutes ?? lastTravel;
  }
  if (group !== "Domingo") total += lastTravel;
  return total;
}

function chooseExcursionGroup(
  activities: Activity[],
  preferences: PlannerPreferences,
): string | null {
  if (preferences.travel === "home") return null;
  const totals = new Map<string, number>();
  for (const activity of activities) {
    if (isAtDomingo(activity)) continue;
    totals.set(
      activity.locationGroup,
      (totals.get(activity.locationGroup) ?? 0) + score(activity, preferences),
    );
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function categoryFamily(activity: Activity): string {
  const value = activity.category.toLocaleLowerCase("ru");
  if (
    activity.moods.includes("food") ||
    /ресторан|вкус|кафе|ферм|поесть/.test(value)
  )
    return "food";
  if (/музей|истор|культур|усадьб/.test(value)) return "culture";
  if (/spa|бан|фурако|восстанов/.test(value)) return "relax";
  if (/природ|маршрут|прогул|рыбал/.test(value)) return "nature";
  return activity.type;
}

function topicKey(activity: Activity): string {
  const value = `${activity.title} ${activity.category}`.toLocaleLowerCase(
    "ru",
  );
  if (activity.moods.includes("food")) return "food";
  const topics: [string, RegExp][] = [
    ["quad", /квадроцикл|питбайк|мото/],
    ["water", /sup|сап|катер|лодк|сплав/],
    ["bike", /велосипед/],
    ["walk", /прогул|тропа|маршрут|поход/],
    ["museum", /музей|усадьб|экспозиц/],
    ["food", /ресторан|кафе|завтрак|обед|ужин|доставк|пикник|мангал/],
    ["bath", /баня|сауна|фурако|spa|спа|массаж/],
    ["fishing", /рыбал/],
    ["creative", /мастер-класс|керамик|рисован|творч/],
  ];
  return topics.find(([, pattern]) => pattern.test(value))?.[0] ?? activity.id;
}

function orderForRoute(items: Activity[]): Activity[] {
  const home = items.filter(isAtDomingo);
  const away = items.filter((item) => !isAtDomingo(item));
  const timeRank = (item: Activity) => {
    if (item.timeOfDay.includes("morning")) return 0;
    if (item.timeOfDay.includes("day")) return 1;
    if (item.timeOfDay.includes("evening")) return 2;
    return 1;
  };
  const morningHome = home
    .filter((item) => timeRank(item) < 2)
    .sort((a, b) => timeRank(a) - timeRank(b));
  const eveningHome = home.filter((item) => timeRank(item) === 2);
  return [
    ...morningHome,
    ...away.sort((a, b) => timeRank(a) - timeRank(b)),
    ...eveningHome,
  ];
}

function minutesFromTime(value: string): number {
  const [hours = 10, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function displayTime(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function reasonFor(
  activity: Activity,
  preferences: PlannerPreferences,
): string {
  if (preferences.weather === "rain")
    return "Хорошо подходит для дождливого дня";
  if (preferences.companions.includes("children"))
    return "Хороший вариант с детьми";
  if (activity.timeOfDay.includes("evening")) return "Особенно приятно вечером";
  if (!isAtDomingo(activity))
    return `Логично совместить с поездкой в ${activity.locationGroup}`;
  if (activity.moods.some((mood) => preferences.moods.includes(mood)))
    return "Совпадает с вашим настроением";
  return "Дополняет день без лишней спешки";
}

export function buildDayPlan(
  activities: Activity[],
  preferences: PlannerPreferences,
): DayPlan {
  const eligible = activities.filter((activity) =>
    hardFilter(activity, preferences),
  );
  const excursionGroup = chooseExcursionGroup(eligible, preferences);
  const routed = eligible.filter(
    (activity) =>
      isAtDomingo(activity) || activity.locationGroup === excursionGroup,
  );
  const ranked = [...routed].sort(
    (a, b) => score(b, preferences) - score(a, preferences),
  );
  const selected: Activity[] = [];
  const families = new Map<string, number>();
  const topics = new Set<string>();
  const limit = budgets[preferences.dayLength];

  for (const activity of ranked) {
    const family = categoryFamily(activity);
    const topic = topicKey(activity);
    if (topics.has(topic)) continue;
    const diversityPenalty = (families.get(family) ?? 0) * 5;
    if (
      diversityPenalty > score(activity, preferences) &&
      ranked.length > targetCounts[preferences.dayLength]
    )
      continue;
    const attempt = orderForRoute([...selected, activity]);
    if (routeMinutes(attempt) <= limit) {
      selected.push(activity);
      families.set(family, (families.get(family) ?? 0) + 1);
      topics.add(topic);
    }
    if (selected.length >= targetCounts[preferences.dayLength]) break;
  }

  const ordered = orderForRoute(selected);
  let cursor = minutesFromTime(preferences.startTime);
  let currentGroup = "Domingo";
  let lastTravel = 0;
  const items = ordered.map((activity) => {
    const travelBeforeMinutes =
      activity.locationGroup === currentGroup
        ? 0
        : (activity.travelMinutes ?? 0);
    cursor += travelBeforeMinutes;
    const startTime = displayTime(cursor);
    cursor += activityMinutes(activity);
    currentGroup = activity.locationGroup;
    lastTravel = activity.travelMinutes ?? lastTravel;
    return {
      activity,
      startTime,
      endTime: displayTime(cursor),
      travelBeforeMinutes,
      reason: reasonFor(activity, preferences),
    };
  });
  const returnTravelMinutes = currentGroup === "Domingo" ? 0 : lastTravel;
  cursor += returnTravelMinutes;
  const exactMoodMatch = items.some(({ activity }) =>
    activity.moods.some((mood) => preferences.moods.includes(mood)),
  );
  return {
    items,
    endTime: displayTime(cursor),
    returnTravelMinutes,
    relaxed: preferences.moods.length > 0 && !exactMoodMatch,
  };
}

export function filterCatalog(
  activities: Activity[],
  scope: "domingo" | "guide",
): Activity[] {
  return activities.filter((activity) =>
    scope === "domingo" ? isAtDomingo(activity) : !isAtDomingo(activity),
  );
}
