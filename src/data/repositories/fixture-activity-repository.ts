import rawActivities from "@/data/fixtures/activities.generated.json";
import {
  activitiesSchema,
  type ActivityRepository,
} from "@/data/contracts/activity";
import {
  ACTIVITY_PATCHES,
  ADDITIONAL_ACTIVITIES,
  DOMINGO_GUIDE_URL,
  DOMINGO_PHONE,
  DOMINGO_WHATTODO_URL,
} from "@/data/fixtures/activity-enrichments";

const enrichedActivities = rawActivities.map((raw) => {
  const patch = ACTIVITY_PATCHES[raw.id] ?? {};
  const sourceUrl =
    patch.sourceUrl ??
    (raw.source === "domingo" ? DOMINGO_WHATTODO_URL : DOMINGO_GUIDE_URL);
  return {
    ...raw,
    ...patch,
    sourceUrl,
    phone: patch.phone ?? (raw.source === "domingo" ? DOMINGO_PHONE : null),
  };
});

const activities = activitiesSchema.parse([
  ...enrichedActivities,
  ...ADDITIONAL_ACTIVITIES,
]);

export const fixtureActivityRepository: ActivityRepository = {
  async listActive() {
    return activities.filter(
      (activity) => activity.status === "active" && activity.isSelectable,
    );
  },
  async listBySource(source) {
    return activities.filter(
      (activity) =>
        activity.source === source &&
        activity.status === "active" &&
        activity.isSelectable,
    );
  },
  async getById(id) {
    return (
      activities.find(
        (activity) => activity.id === id && activity.status === "active",
      ) ?? null
    );
  },
};

export { activities as activityFixture };
