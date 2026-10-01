import type {
  Companion,
  Mood,
  Season,
  Weather,
} from "@/data/contracts/activity";

export const ACTIVITY_OPTIONS = {
  seasons: [
    { value: "spring", label: "Весна" },
    { value: "summer", label: "Лето" },
    { value: "autumn", label: "Осень" },
    { value: "winter", label: "Зима" },
  ] satisfies { value: Season; label: string }[],
  weather: [
    { value: "sunny", label: "Солнечно" },
    { value: "hot", label: "Жарко" },
    { value: "cloudy", label: "Облачно" },
    { value: "cool", label: "Прохладно" },
    { value: "rain", label: "Дождь" },
    { value: "snow", label: "Снег" },
    { value: "frost", label: "Мороз" },
  ] satisfies { value: Weather; label: string }[],
  moods: [
    { value: "calm", label: "Спокойно" },
    { value: "active", label: "Активно" },
    { value: "relax", label: "Расслабиться" },
    { value: "nature", label: "На природе" },
    { value: "food", label: "Вкусно" },
    { value: "learn", label: "Узнать новое" },
    { value: "beautiful", label: "Красивые места" },
    { value: "creative", label: "Творчески" },
    { value: "romantic", label: "Романтично" },
    { value: "special", label: "Особенный день" },
  ] satisfies { value: Mood; label: string }[],
  companions: [
    { value: "solo", label: "Один / одна" },
    { value: "couple", label: "Вдвоём" },
    { value: "children", label: "С детьми" },
    { value: "friends", label: "С друзьями" },
    { value: "teens", label: "С подростками" },
    { value: "pet", label: "С питомцем" },
  ] satisfies { value: Companion; label: string }[],
} as const;

export const LABELS = Object.fromEntries(
  Object.values(ACTIVITY_OPTIONS)
    .flat()
    .map(({ value, label }) => [value, label]),
) as Record<string, string>;
