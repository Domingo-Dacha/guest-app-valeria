import type {
  Activity,
  Companion,
  Mood,
  Season,
  Weather,
} from "@/data/contracts/activity";

export type TravelPreference = "home" | "20" | "40" | "far" | "any";
export type DayLength = "short" | "medium" | "half-day" | "full-day";

export interface PlannerPreferences {
  season: Season;
  weather: Weather;
  moods: Mood[];
  companions: Companion[];
  dayLength: DayLength;
  startTime: string;
  endTime: string;
  travel: TravelPreference;
  variation?: number;
  avoidIds?: string[];
}

export interface PlannedActivity {
  activity: Activity;
  startTime: string;
  endTime: string;
  travelBeforeMinutes: number;
  travelStartTime: string;
  reason: string;
}

export interface DayPlan {
  items: PlannedActivity[];
  endTime: string;
  returnTravelMinutes: number;
  relaxed: boolean;
}

export const DAY_LENGTH_WINDOWS: Record<
  DayLength,
  { min: number; max: number; preferred: number }
> = {
  short: { min: 60, max: 120, preferred: 120 },
  medium: { min: 180, max: 240, preferred: 240 },
  "half-day": { min: 300, max: 420, preferred: 360 },
  "full-day": { min: 480, max: 720, preferred: 600 },
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

function isAtDomingo(activity: Activity): boolean {
  return (
    activity.source === "domingo" ||
    activity.locationGroup === "Domingo" ||
    activity.travelMinutes === 0
  );
}

function isOnDomingoProperty(activity: Activity): boolean {
  return activity.locationGroup === "Domingo" && activity.travelMinutes === 0;
}

function travelMatches(
  activity: Activity,
  preference: TravelPreference,
): boolean {
  const travel = activity.travelMinutes ?? Number.POSITIVE_INFINITY;
  if (preference === "home") return isOnDomingoProperty(activity);
  if (preference === "20") return travel <= 20;
  if (preference === "40") return travel <= 40;
  if (preference === "far") {
    return activity.source !== "domingo" && travel >= 10;
  }
  return true;
}

function isSafeForChildren(activity: Activity): boolean {
  const restriction = activity.ageRestrictions?.toLocaleLowerCase("ru") ?? "";
  return !/(^|\D)18\+|только взросл/.test(restriction);
}

function isUnavailableWithPets(activity: Activity): boolean {
  const value =
    `${activity.title} ${activity.category} ${activity.description ?? ""}`.toLocaleLowerCase(
      "ru",
    );
  return /ферм|музей/.test(value);
}

function avoidsEveningCompliment(activity: Activity): boolean {
  const value =
    `${activity.title} ${activity.category} ${activity.description ?? ""}`.toLocaleLowerCase(
      "ru",
    );
  return /веломаршрут|храм|музей|парк/.test(value);
}

function isIndoor(activity: Activity): boolean {
  if (activity.id === "a-002") return true;
  const value =
    `${activity.title} ${activity.category} ${activity.description ?? ""}`.toLocaleLowerCase(
      "ru",
    );
  return /ресторан|кафе|кофе|едаль|кухн|музей|галере|усадьб|экспозиц|аквапарк|спа|spa|саун|хаммам|баня|фурако|массаж|кино|настольн|чтени|книг|бокал вина|сиест|выспаться|мастер-класс|керамик|боулинг|батут|доставк/.test(
    value,
  );
}

function minutesFromTime(value: string): number {
  const [hours = 10, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function plannerEndMinutes(preferences: PlannerPreferences): number {
  const start = minutesFromTime(preferences.startTime);
  const requestedEnd = minutesFromTime(preferences.endTime);
  const requestedDuration = requestedEnd - start;
  const window = DAY_LENGTH_WINDOWS[preferences.dayLength];
  if (requestedDuration >= window.min && requestedDuration <= window.max)
    return requestedEnd;

  const availableToday = 24 * 60 - 1 - start;
  if (availableToday < window.min && requestedDuration > 0) return requestedEnd;
  return start + Math.min(window.preferred, availableToday);
}

export function recommendedEndTime(
  startTime: string,
  dayLength: DayLength,
): string {
  const start = minutesFromTime(startTime);
  const availableToday = 24 * 60 - 1 - start;
  const window = DAY_LENGTH_WINDOWS[dayLength];
  return displayTime(start + Math.min(window.preferred, availableToday));
}

export function normalizedEndTime(
  startTime: string,
  endTime: string,
  dayLength: DayLength,
): string {
  return displayTime(
    plannerEndMinutes({
      season: "all",
      weather: "any",
      moods: [],
      companions: [],
      dayLength,
      startTime,
      endTime,
      travel: "any",
    }),
  );
}

function timeWindowMatches(
  activity: Activity,
  preferences: PlannerPreferences,
): boolean {
  if (activity.timeOfDay.includes("any")) return true;
  const start = minutesFromTime(preferences.startTime);
  const end = plannerEndMinutes(preferences);
  if (activity.timeOfDay.includes("morning") && start < 12 * 60) return true;
  if (activity.timeOfDay.includes("day") && start < 18 * 60 && end > 12 * 60)
    return true;
  return activity.timeOfDay.includes("evening") && end > 18 * 60;
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
  if (activity.id === "a-001") {
    if (
      preferences.dayLength !== "short" ||
      !preferences.moods.includes("active")
    )
      return false;
  }
  if (activity.id === "a-health-trail-level-2") {
    if (
      preferences.dayLength !== "medium" ||
      !preferences.moods.includes("active")
    )
      return false;
  }
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
  if (!travelMatches(activity, preferences.travel)) return false;
  if (preferences.weather === "rain" && !isIndoor(activity)) return false;
  if (!timeWindowMatches(activity, preferences)) return false;
  if (
    (preferences.companions.includes("children") ||
      preferences.companions.includes("teens")) &&
    !isSafeForChildren(activity)
  )
    return false;
  if (preferences.companions.includes("pet") && isUnavailableWithPets(activity))
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
  const variety = hash(`${activity.id}:${preferences.variation ?? 0}`) * 12;
  const avoided = preferences.avoidIds?.includes(activity.id) ? 100 : 0;
  const bookingPenalty = activity.bookingRequirement === "required" ? 2 : 0;
  const priorityBonus = activity.priority
    ?.toLocaleLowerCase("ru")
    .includes("выс")
    ? 2
    : 0;
  const hotBonus =
    preferences.weather === "hot" &&
    /пляж|загорать|шезлонг/i.test(activity.title)
      ? 18
      : 0;
  const healthTrailBonus =
    activity.id === "a-001" || activity.id === "a-health-trail-level-2"
      ? 40
      : 0;
  return (
    moodMatches * 6 +
    companionMatches * 4 +
    priorityBonus +
    hotBonus +
    healthTrailBonus +
    variety -
    avoided -
    bookingPenalty
  );
}

function activityMinutes(activity: Activity): number {
  return activity.durationMinutes?.min ?? 0;
}

function chooseExcursionGroup(
  activities: Activity[],
  preferences: PlannerPreferences,
): string | null {
  if (preferences.travel === "home") return null;
  const totals = new Map<string, number>();
  const avoidedGroups = new Set(
    activities
      .filter((activity) => preferences.avoidIds?.includes(activity.id))
      .map((activity) => activity.locationGroup),
  );
  for (const activity of activities) {
    if (isAtDomingo(activity)) continue;
    totals.set(
      activity.locationGroup,
      (totals.get(activity.locationGroup) ?? 0) + score(activity, preferences),
    );
  }
  const fresh = [...totals.entries()].filter(
    ([group]) => !avoidedGroups.has(group),
  );
  const candidates = fresh.length ? fresh : [...totals.entries()];
  return candidates.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function categoryFamily(activity: Activity): string {
  const value = activity.category.toLocaleLowerCase("ru");
  if (
    activity.moods.includes("food") ||
    /ресторан|вкус|кафе|ферм|поесть/.test(value)
  )
    return "food";
  if (/музей|истор|культур|усадьб/.test(value)) return "culture";
  if (/spa|бан|фурако|восстанов|отдых/.test(value)) return "relax";
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
    ["bike", /велосипед|веломаршрут/],
    ["run", /пробеж|беговой/],
    ["walk", /прогул|тропа|пеший|поход/],
    ["museum", /музей|усадьб|экспозиц/],
    ["food", /ресторан|кафе|завтрак|обед|ужин|доставк|пикник|мангал/],
    ["bath", /баня|сауна|фурако|spa|спа|массаж/],
    ["fishing", /рыбал|fishing/],
    ["creative", /мастер-класс|керамик|рисован|творч/],
  ];
  return topics.find(([, pattern]) => pattern.test(value))?.[0] ?? activity.id;
}

function selectionConflictKey(activity: Activity): string | null {
  if (activity.id === "dd-siesta" || activity.id === "dd-sleep-in")
    return "rest-or-sleep";
  if (activity.id === "dd-017" || activity.id === "g-020") return "margo";
  return null;
}

function conflictsWithSelection(
  activity: Activity,
  selected: Activity[],
): boolean {
  const conflict = selectionConflictKey(activity);
  return Boolean(
    conflict &&
    selected.some((item) => selectionConflictKey(item) === conflict),
  );
}

function orderForRoute(items: Activity[]): Activity[] {
  const timeRank = (item: Activity) =>
    item.timeOfDay.includes("morning")
      ? 0
      : item.timeOfDay.includes("evening")
        ? 2
        : 1;
  const home = items.filter(isAtDomingo);
  const away = items.filter((item) => !isAtDomingo(item));
  return [
    ...home.filter((item) => timeRank(item) === 0),
    ...home.filter((item) => timeRank(item) === 1),
    ...away.sort((a, b) => timeRank(a) - timeRank(b)),
    ...home.filter((item) => timeRank(item) === 2),
  ];
}

function displayTime(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function alignToTimeOfDay(cursor: number, activity: Activity): number | null {
  if (activity.timeOfDay.includes("any")) return cursor;
  if (activity.timeOfDay.includes("morning") && cursor < 12 * 60) return cursor;
  if (activity.timeOfDay.includes("day") && cursor < 18 * 60) return cursor;
  if (activity.timeOfDay.includes("evening")) return Math.max(cursor, 18 * 60);
  return null;
}

interface ScheduledItem {
  activity: Activity;
  start: number;
  end: number;
  travelBeforeMinutes: number;
}

function schedule(
  activities: Activity[],
  preferences: PlannerPreferences,
  durations = new Map<string, number>(),
  enforceEnd = true,
): { items: ScheduledItem[]; end: number; returnTravelMinutes: number } | null {
  const start = minutesFromTime(preferences.startTime);
  const requestedEnd = plannerEndMinutes(preferences);
  const endLimit = requestedEnd;
  if (requestedEnd <= start) return null;
  let cursor = start;
  let currentGroup = "Domingo";
  let lastTravel = 0;
  const items: ScheduledItem[] = [];
  for (const activity of orderForRoute(activities)) {
    const travelBeforeMinutes =
      activity.locationGroup === currentGroup
        ? 0
        : (activity.travelMinutes ?? 0);
    cursor += travelBeforeMinutes;
    const aligned = alignToTimeOfDay(cursor, activity);
    if (aligned === null) return null;
    cursor = aligned;
    const itemEnd =
      cursor + (durations.get(activity.id) ?? activityMinutes(activity));
    if (enforceEnd && itemEnd > endLimit) return null;
    items.push({ activity, start: cursor, end: itemEnd, travelBeforeMinutes });
    cursor = itemEnd;
    currentGroup = activity.locationGroup;
    lastTravel = activity.travelMinutes ?? lastTravel;
  }
  const returnTravelMinutes = currentGroup === "Domingo" ? 0 : lastTravel;
  cursor += returnTravelMinutes;
  if (enforceEnd && cursor > endLimit) return null;
  return { items, end: cursor, returnTravelMinutes };
}

function maximumScheduleEnd(
  activities: Activity[],
  preferences: PlannerPreferences,
): number {
  const durations = new Map(
    activities.map((activity) => [
      activity.id,
      activity.durationMinutes?.max ?? activityMinutes(activity),
    ]),
  );
  return (
    schedule(activities, preferences, durations, false)?.end ??
    minutesFromTime(preferences.startTime)
  );
}

function scheduleToEnd(
  activities: Activity[],
  preferences: PlannerPreferences,
): { items: ScheduledItem[]; end: number; returnTravelMinutes: number } | null {
  const endLimit = plannerEndMinutes(preferences);
  const durations = new Map(
    activities.map((activity) => [activity.id, activityMinutes(activity)]),
  );
  let result = schedule(activities, preferences, durations);
  if (!result) return null;

  // Durations in the catalog are ranges. Extend suitable blocks minute by
  // minute so the requested window is occupied exactly, without inventing
  // gaps between activities or moving the requested start time.
  const ordered = orderForRoute(activities).toReversed();
  let changed = true;
  while (result.end < endLimit && changed) {
    changed = false;
    for (const activity of ordered) {
      const current = durations.get(activity.id) ?? activityMinutes(activity);
      const maximum = activity.durationMinutes?.max ?? current;
      if (current >= maximum) continue;
      durations.set(activity.id, current + 1);
      const next = schedule(activities, preferences, durations);
      if (next) {
        result = next;
        changed = true;
      } else {
        durations.set(activity.id, current);
      }
      if (result.end === endLimit) break;
    }
  }
  return result;
}

function reasonCandidates(
  activity: Activity,
  preferences: PlannerPreferences,
): string[] {
  const values: string[] = [];
  if (preferences.weather === "rain")
    values.push("Хорошо подходит для дождливого дня");
  if (preferences.companions.includes("children"))
    values.push("Хороший вариант с детьми");
  if (
    activity.timeOfDay.includes("evening") &&
    !avoidsEveningCompliment(activity)
  )
    values.push("Особенно приятно вечером");
  if (!isAtDomingo(activity))
    values.push(`Логично совместить с поездкой в ${activity.locationGroup}`);
  if (activity.moods.some((mood) => preferences.moods.includes(mood)))
    values.push("Совпадает с вашим настроением");
  values.push(
    `Подходит для формата «${activity.category}»`,
    "Дополняет день без лишней спешки",
  );
  return values;
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
  const desiredCount = targetCounts[preferences.dayLength];
  const fresh = ranked.filter(
    (activity) => !preferences.avoidIds?.includes(activity.id),
  );
  const endLimit = plannerEndMinutes(preferences);
  const passes = fresh.length ? [fresh, ranked] : [ranked];
  let complete = false;
  for (const candidates of passes) {
    for (const activity of candidates) {
      if (selected.includes(activity)) continue;
      if (conflictsWithSelection(activity, selected)) continue;
      const family = categoryFamily(activity);
      const topic = topicKey(activity);
      if (topics.has(topic)) continue;
      const diversityPenalty = (families.get(family) ?? 0) * 5;
      if (
        diversityPenalty > score(activity, preferences) &&
        ranked.length > desiredCount
      )
        continue;
      if (schedule([...selected, activity], preferences)) {
        selected.push(activity);
        families.set(family, (families.get(family) ?? 0) + 1);
        topics.add(topic);
      }
      complete =
        selected.length >= desiredCount &&
        maximumScheduleEnd(selected, preferences) >= endLimit;
      if (complete) break;
    }
    if (complete) break;
  }

  // A full interval matters more than topic de-duplication. If the varied
  // pass is too short, add different cards from the same sensible route.
  if (!complete) {
    for (const activity of ranked) {
      if (selected.includes(activity)) continue;
      if (conflictsWithSelection(activity, selected)) continue;
      if (schedule([...selected, activity], preferences))
        selected.push(activity);
      complete =
        selected.length >= 2 &&
        maximumScheduleEnd(selected, preferences) >= endLimit;
      if (complete) break;
    }
  }
  const scheduled = scheduleToEnd(selected, preferences);
  const reasonCounts = new Map<string, number>();
  const items =
    scheduled?.items.map(({ activity, start, end, travelBeforeMinutes }) => {
      const reason =
        reasonCandidates(activity, preferences).find(
          (candidate) => (reasonCounts.get(candidate) ?? 0) < 2,
        ) ?? `Подходит для «${activity.title}»`;
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      return {
        activity,
        startTime: displayTime(start),
        endTime: displayTime(end),
        travelBeforeMinutes,
        travelStartTime: displayTime(start - travelBeforeMinutes),
        reason,
      };
    }) ?? [];
  return {
    items,
    endTime: displayTime(
      scheduled?.end ?? minutesFromTime(preferences.startTime),
    ),
    returnTravelMinutes: scheduled?.returnTravelMinutes ?? 0,
    relaxed: false,
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
