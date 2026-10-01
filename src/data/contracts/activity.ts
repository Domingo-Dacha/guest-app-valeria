import { z } from "zod";

export const seasonSchema = z.enum([
  "spring",
  "summer",
  "autumn",
  "winter",
  "all",
]);
export const weatherSchema = z.enum([
  "sunny",
  "hot",
  "cloudy",
  "cool",
  "rain",
  "snow",
  "frost",
  "dry",
  "warm",
  "any",
]);
export const moodSchema = z.enum([
  "calm",
  "active",
  "relax",
  "nature",
  "food",
  "learn",
  "beautiful",
  "creative",
  "romantic",
  "special",
]);
export const companionSchema = z.enum([
  "solo",
  "couple",
  "children",
  "friends",
  "teens",
  "pet",
]);

const minuteRangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const activitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(["draft", "active", "disabled"]),
  source: z.enum(["domingo", "guide", "candidate"]),
  category: z.string().min(1),
  type: z.enum(["activity", "place", "route", "service"]),
  title: z.string().min(1),
  description: z.string().nullable(),
  location: z.string().nullable(),
  locationGroup: z.string().min(1),
  travelMinutes: z.number().int().nonnegative().nullable(),
  durationMinutes: minuteRangeSchema.nullable(),
  totalMinutes: minuteRangeSchema.nullable(),
  seasons: z.array(seasonSchema).min(1),
  weather: z.array(weatherSchema).min(1),
  conditions: z.string().nullable(),
  timeOfDay: z.array(z.enum(["morning", "day", "evening", "any"])).min(1),
  moods: z.array(moodSchema),
  companions: z.array(companionSchema),
  ageRestrictions: z.string().nullable(),
  transport: z.array(z.string()),
  bookingRequirement: z.enum(["none", "recommended", "required", "check"]),
  notes: z.string().nullable(),
  mapAsset: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  priority: z.string().nullable(),
  isSelectable: z.boolean(),
  isPaidService: z.boolean(),
  serviceId: z.string().nullable(),
});

export const activitiesSchema = z.array(activitySchema);

export type Activity = z.infer<typeof activitySchema>;
export type Season = z.infer<typeof seasonSchema>;
export type Weather = z.infer<typeof weatherSchema>;
export type Mood = z.infer<typeof moodSchema>;
export type Companion = z.infer<typeof companionSchema>;

export interface ActivityRepository {
  listActive(): Promise<Activity[]>;
  listBySource(source: Activity["source"]): Promise<Activity[]>;
  getById(id: string): Promise<Activity | null>;
}
