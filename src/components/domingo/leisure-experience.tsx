"use client";

import {
  ArrowRight,
  Bike,
  CalendarClock,
  Car,
  ChevronRight,
  Clock3,
  ExternalLink,
  House,
  Map,
  MapPin,
  RefreshCw,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  Activity,
  Season,
} from "@/data/contracts/activity";
import { ACTIVITY_OPTIONS, LABELS } from "@/data/fixtures/activity-options";
import { trackLeisureEvent } from "@/lib/analytics/leisure";
import {
  buildDayPlan,
  filterCatalog,
  type DayLength,
  type DayPlan,
  type PlannerPreferences,
  type TravelPreference,
} from "@/lib/leisure/planner";

type Section = "domingo" | "guide" | "planner";

const durationOptions: { value: DayLength; label: string }[] = [
  { value: "short", label: "1–2 часа" },
  { value: "medium", label: "3–4 часа" },
  { value: "half-day", label: "Полдня" },
  { value: "full-day", label: "Весь день" },
];

const travelOptions: { value: TravelPreference; label: string }[] = [
  { value: "home", label: "Не хочу уезжать" },
  { value: "nearby", label: "Только рядом" },
  { value: "20", label: "До 20 минут" },
  { value: "40", label: "До 40 минут" },
  { value: "any", label: "Можно дальше" },
];

const bookingLabels: Record<Activity["bookingRequirement"], string> = {
  none: "Без записи",
  recommended: "Лучше заранее",
  required: "Нужна запись",
  check: "Уточнить доступность",
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function durationLabel(activity: Activity): string {
  if (!activity.durationMinutes) return "Время уточняется";
  const { min, max } = activity.durationMinutes;
  if (min === max) return `${min} мин`;
  return `${min}–${max} мин`;
}

function ActivityCard({
  activity,
  onOpen,
}: {
  activity: Activity;
  onOpen: (activity: Activity) => void;
}) {
  return (
    <button
      className="activity-card"
      type="button"
      onClick={() => onOpen(activity)}
    >
      <span
        className={`activity-card__visual activity-card__visual--${activity.type}`}
        aria-hidden="true"
      >
        {activity.type === "route" ? (
          <Route />
        ) : activity.travelMinutes === 0 ? (
          <House />
        ) : (
          <MapPin />
        )}
      </span>
      <span className="activity-card__body">
        <span className="eyebrow">{activity.category}</span>
        <strong>{activity.title}</strong>
        <span>{activity.description}</span>
        <span className="activity-card__meta">
          <Clock3 size={15} /> {durationLabel(activity)}
          {activity.travelMinutes !== null && activity.travelMinutes > 0 ? (
            <>
              <Car size={15} /> {activity.travelMinutes} мин
            </>
          ) : null}
        </span>
      </span>
      <ChevronRight className="activity-card__chevron" aria-hidden="true" />
    </button>
  );
}

function Catalog({
  activities,
  scope,
  onOpen,
}: {
  activities: Activity[];
  scope: "domingo" | "guide";
  onOpen: (activity: Activity) => void;
}) {
  const categories = useMemo(
    () =>
      [
        "Все",
        ...new Set(activities.map((activity) => activity.category)),
      ].slice(0, 9),
    [activities],
  );
  const [category, setCategory] = useState("Все");
  const visible =
    category === "Все"
      ? activities
      : activities.filter((item) => item.category === category);
  return (
    <section className="leisure-panel" aria-labelledby={`${scope}-title`}>
      <div className="leisure-panel__intro">
        <p className="eyebrow">
          {scope === "domingo" ? "Не выезжая" : "Проверенные идеи"}
        </p>
        <h2 id={`${scope}-title`}>
          {scope === "domingo" ? "В Domingo Dacha" : "Гид по окрестностям"}
        </h2>
        <p>
          {scope === "domingo"
            ? "Дом, природа, отдых и услуги, которые можно вписать в свой ритм."
            : "Места для одной содержательной поездки — от Серпухова до Тарусы."}
        </p>
      </div>
      <div className="filter-strip" aria-label="Категории">
        {categories.map((item) => (
          <button
            type="button"
            className={`choice-chip ${category === item ? "choice-chip--selected" : ""}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="activity-grid">
        {visible.map((activity) => (
          <ActivityCard activity={activity} onOpen={onOpen} key={activity.id} />
        ))}
      </div>
    </section>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  values,
  onChange,
  multiple = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
  multiple?: boolean;
}) {
  return (
    <fieldset className="planner-question">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              type="button"
              className={`choice-chip ${selected ? "choice-chip--selected" : ""}`}
              aria-pressed={selected}
              onClick={() => {
                const next = multiple
                  ? toggleValue(values, option.value)
                  : [option.value];
                onChange(next);
                trackLeisureEvent("planner_filter_selected", {
                  filter: label,
                  value: option.value,
                });
              }}
              key={option.value}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PlanResult({
  plan,
  preferences,
  onAlternative,
  onOpen,
}: {
  plan: DayPlan;
  preferences: PlannerPreferences;
  onAlternative: () => void;
  onOpen: (activity: Activity) => void;
}) {
  const summary = [
    LABELS[preferences.season],
    LABELS[preferences.weather],
    ...preferences.moods.slice(0, 2).map((mood) => LABELS[mood]),
    ...preferences.companions.slice(0, 1).map((item) => LABELS[item]),
    durationOptions.find((item) => item.value === preferences.dayLength)?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="plan-result" aria-live="polite" id="day-plan">
      <div className="plan-result__heading">
        <div>
          <p className="eyebrow">Персональный сценарий</p>
          <h2>Ваш день в Domingo</h2>
          <p>{summary}</p>
        </div>
        <Sparkles aria-hidden="true" />
      </div>
      {plan.relaxed ? (
        <p className="plan-notice">
          Подходящего варианта один в один не нашлось, но вот что хорошо
          подойдёт сегодня.
        </p>
      ) : null}
      {plan.items.length ? (
        <ol className="timeline">
          {plan.items.map(
            ({ activity, startTime, endTime, travelBeforeMinutes, reason }) => (
              <li key={activity.id}>
                {travelBeforeMinutes > 0 ? (
                  <div className="timeline__travel">
                    <Car size={16} /> {travelBeforeMinutes} мин в пути
                  </div>
                ) : null}
                <button type="button" onClick={() => onOpen(activity)}>
                  <time>{startTime}</time>
                  <span className="timeline__content">
                    <strong>{activity.title}</strong>
                    <span>
                      {endTime} · {durationLabel(activity)}
                    </span>
                    <em>{reason}</em>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            ),
          )}
          {plan.returnTravelMinutes > 0 ? (
            <li className="timeline__return">
              <span className="timeline__travel">
                <Car size={16} /> {plan.returnTravelMinutes} мин обратно
              </span>
              <time>{plan.endTime}</time>
              <strong>Возвращение в Domingo</strong>
            </li>
          ) : null}
        </ol>
      ) : (
        <div className="empty-state">
          <strong>Попробуем немного иначе</strong>
          <p>
            Измените время или радиус поездки — безопасные ограничения мы
            сохраним.
          </p>
        </div>
      )}
      <Button
        variant="secondary"
        className="alternative-button"
        onClick={onAlternative}
      >
        <RefreshCw size={18} /> Подобрать другой вариант
      </Button>
    </section>
  );
}

function Planner({
  activities,
  initialSeason,
  onOpen,
}: {
  activities: Activity[];
  initialSeason: Season;
  onOpen: (activity: Activity) => void;
}) {
  const [preferences, setPreferences] = useState<PlannerPreferences>({
    season: initialSeason,
    weather: "cloudy",
    moods: ["calm"],
    companions: ["couple"],
    dayLength: "full-day",
    startTime: "10:00",
    travel: "40",
    variation: 0,
  });
  const [plan, setPlan] = useState<DayPlan | null>(null);

  const generate = (alternative = false) => {
    const next = alternative
      ? {
          ...preferences,
          variation: (preferences.variation ?? 0) + 1,
          avoidIds: plan?.items.map(({ activity }) => activity.id),
        }
      : preferences;
    setPreferences(next);
    trackLeisureEvent(
      alternative ? "planner_alternative_requested" : "planner_started",
      {
        dayLength: next.dayLength,
        travel: next.travel,
      },
    );
    const result = buildDayPlan(activities, next);
    setPlan(result);
    trackLeisureEvent("planner_result_received", {
      items: result.items.length,
      relaxed: result.relaxed,
    });
    window.setTimeout(
      () =>
        document
          .querySelector("#day-plan")
          ?.scrollIntoView({ behavior: "smooth" }),
      20,
    );
  };

  return (
    <section className="leisure-panel planner" aria-labelledby="planner-title">
      <div className="leisure-panel__intro">
        <p className="eyebrow">Несколько ответов — готовый день</p>
        <h2 id="planner-title">Подобрать мой отдых</h2>
        <p>
          Учтём погоду, компанию, дорогу и темп. Получится расписание, а не
          список ссылок.
        </p>
      </div>
      <div className="planner-form">
        <ChoiceGroup
          label="Время года"
          options={ACTIVITY_OPTIONS.seasons}
          values={[preferences.season]}
          onChange={([season]) =>
            season && setPreferences({ ...preferences, season })
          }
        />
        <ChoiceGroup
          label="Погода"
          options={ACTIVITY_OPTIONS.weather}
          values={[preferences.weather]}
          onChange={([weather]) =>
            weather && setPreferences({ ...preferences, weather })
          }
        />
        <ChoiceGroup
          label="Как хочется провести время"
          options={ACTIVITY_OPTIONS.moods}
          values={preferences.moods}
          multiple
          onChange={(moods) => setPreferences({ ...preferences, moods })}
        />
        <ChoiceGroup
          label="С кем отдыхаете"
          options={ACTIVITY_OPTIONS.companions}
          values={preferences.companions}
          multiple
          onChange={(companions) =>
            setPreferences({ ...preferences, companions })
          }
        />
        <ChoiceGroup
          label="Сколько времени есть"
          options={durationOptions}
          values={[preferences.dayLength]}
          onChange={([dayLength]) =>
            dayLength && setPreferences({ ...preferences, dayLength })
          }
        />
        <ChoiceGroup
          label="Готовность ехать"
          options={travelOptions}
          values={[preferences.travel]}
          onChange={([travel]) =>
            travel && setPreferences({ ...preferences, travel })
          }
        />
        <label className="start-time">
          <span>С какого времени начать</span>
          <input
            type="time"
            value={preferences.startTime}
            onChange={(event) =>
              setPreferences({ ...preferences, startTime: event.target.value })
            }
          />
        </label>
      </div>
      <div className="planner-cta">
        <Button onClick={() => generate(false)}>
          Собрать мой день <ArrowRight size={18} />
        </Button>
      </div>
      {plan ? (
        <PlanResult
          plan={plan}
          preferences={preferences}
          onAlternative={() => generate(true)}
          onOpen={onOpen}
        />
      ) : null}
    </section>
  );
}

function ActivityDialog({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const mapIsUrl = activity.mapAsset?.startsWith("http");
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <article
        className="dialog-panel activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-dialog-title"
      >
        <button
          className="icon-button"
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </button>
        <p className="eyebrow">{activity.category}</p>
        <h2 id="activity-dialog-title">{activity.title}</h2>
        <p>{activity.description}</p>
        <dl className="activity-details">
          <div>
            <dt>
              <MapPin size={17} /> Локация
            </dt>
            <dd>{activity.location ?? "Уточняется"}</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={17} /> Время
            </dt>
            <dd>{durationLabel(activity)}</dd>
          </div>
          <div>
            <dt>
              <Car size={17} /> Дорога
            </dt>
            <dd>
              {activity.travelMinutes === null
                ? "Уточняется"
                : activity.travelMinutes === 0
                  ? "На месте"
                  : `${activity.travelMinutes} мин`}
            </dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={17} /> Запись
            </dt>
            <dd>{bookingLabels[activity.bookingRequirement]}</dd>
          </div>
        </dl>
        {activity.conditions ? (
          <p className="activity-note">
            <strong>Условия</strong>
            {activity.conditions}
          </p>
        ) : null}
        {activity.ageRestrictions ? (
          <p className="activity-note">
            <strong>Ограничения</strong>
            {activity.ageRestrictions}
          </p>
        ) : null}
        {activity.bookingRequirement === "required" ||
        activity.bookingRequirement === "check" ? (
          <p className="plan-notice">
            Нужно уточнить доступность перед поездкой.
          </p>
        ) : null}
        {message ? <p className="plan-notice">{message}</p> : null}
        <div className="dialog-actions activity-dialog__actions">
          {activity.isPaidService ? (
            <Button
              onClick={() => {
                trackLeisureEvent("activity_order_clicked", {
                  id: activity.id,
                });
                setMessage(
                  "В демо-версии заказ не отправляется. Команда Domingo поможет подтвердить услугу.",
                );
              }}
            >
              Заказать
            </Button>
          ) : null}
          {mapIsUrl ? (
            <a
              className="button button--secondary"
              href={activity.mapAsset ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackLeisureEvent("activity_map_clicked", { id: activity.id })
              }
            >
              <Map size={17} /> Карта
            </a>
          ) : null}
          {activity.sourceUrl ? (
            <a
              className="button button--ghost"
              href={activity.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackLeisureEvent("activity_external_link_clicked", {
                  id: activity.id,
                })
              }
            >
              <ExternalLink size={17} /> Подробнее
            </a>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function LeisureExperience({
  activities,
  initialSeason,
}: {
  activities: Activity[];
  initialSeason: Season;
}) {
  const [section, setSection] = useState<Section>("planner");
  const [selected, setSelected] = useState<Activity | null>(null);
  useEffect(() => {
    trackLeisureEvent("leisure_opened");
  }, []);
  const openActivity = (activity: Activity) => {
    setSelected(activity);
    trackLeisureEvent("activity_opened", { id: activity.id });
  };
  const changeSection = (next: Section) => {
    setSection(next);
    if (next === "planner") trackLeisureEvent("planner_opened");
  };
  return (
    <>
      <section className="leisure-hero">
        <div className="leisure-hero__copy">
          <p className="eyebrow">Domingo рядом</p>
          <h1>Чем заняться сегодня</h1>
          <p>
            Выберите идею сами — или доверьте нам собрать спокойный, выполнимый
            день целиком.
          </p>
        </div>
        <div
          className="leisure-hero__image"
          role="img"
          aria-label="Дом Domingo среди сосен"
        >
          <span>Ваш день начинается здесь</span>
        </div>
      </section>
      <nav className="leisure-tabs" aria-label="Разделы отдыха">
        {(
          [
            ["domingo", House, "В Domingo"],
            ["guide", Bike, "Гид"],
            ["planner", Sparkles, "Подобрать"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            type="button"
            className={section === value ? "is-active" : ""}
            aria-current={section === value ? "page" : undefined}
            onClick={() => changeSection(value)}
            key={value}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
      {section === "domingo" ? (
        <Catalog
          activities={filterCatalog(activities, "domingo")}
          scope="domingo"
          onOpen={openActivity}
        />
      ) : null}
      {section === "guide" ? (
        <Catalog
          activities={filterCatalog(activities, "guide")}
          scope="guide"
          onOpen={openActivity}
        />
      ) : null}
      {section === "planner" ? (
        <Planner
          activities={activities}
          initialSeason={initialSeason}
          onOpen={openActivity}
        />
      ) : null}
      {selected ? (
        <ActivityDialog activity={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
