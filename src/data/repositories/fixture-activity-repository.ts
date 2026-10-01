import rawActivities from "@/data/fixtures/activities.generated.json";
import {
  activitiesSchema,
  type ActivityRepository,
} from "@/data/contracts/activity";

const activities = activitiesSchema.parse(rawActivities);

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
