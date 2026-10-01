export type LeisureEventName =
  | "leisure_opened"
  | "planner_opened"
  | "planner_filter_selected"
  | "planner_started"
  | "planner_result_received"
  | "planner_alternative_requested"
  | "activity_opened"
  | "activity_map_clicked"
  | "activity_order_clicked"
  | "activity_external_link_clicked"
  | "plan_saved";

export function trackLeisureEvent(
  name: LeisureEventName,
  detail: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  const payload = { event: name, ...detail };
  window.dispatchEvent(
    new CustomEvent("domingo:analytics", { detail: payload }),
  );
  const analyticsWindow = window as Window & {
    dataLayer?: Record<string, unknown>[];
  };
  analyticsWindow.dataLayer?.push(payload);
}
