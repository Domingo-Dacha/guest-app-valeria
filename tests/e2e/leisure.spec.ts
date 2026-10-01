import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const secret = "e2e-only-session-secret-at-least-32-characters";

function sessionToken() {
  const encoded = Buffer.from(
    JSON.stringify({
      v: 1,
      team: "local",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "domingo_guest_session",
      value: sessionToken(),
      url: "http://localhost:3000",
    },
  ]);
});

test("builds a realistic day and keeps the layout inside the viewport", async ({
  page,
}) => {
  await page.goto("/leisure");
  await expect(
    page.getByRole("heading", { name: "Ваш день в Domingo" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Лето" }).click();
  await page.getByRole("button", { name: "Солнечно" }).click();
  await page.getByRole("button", { name: "Активно" }).click();
  await page.getByRole("button", { name: "С детьми" }).click();
  await page.getByRole("button", { name: /Собрать мой день/ }).click();
  await expect(
    page
      .locator(".plan-result")
      .getByRole("heading", { name: "Ваш день в Domingo" }),
  ).toBeVisible();
  await expect(page.locator(".timeline > li").first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("opens a catalog activity detail card", async ({ page }) => {
  await page.goto("/leisure");
  await page.getByRole("button", { name: /В Domingo/ }).click();
  await page.locator(".activity-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Телефон", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeVisible();
});

test("limits moods to three and shows both time boundaries", async ({
  page,
}) => {
  await page.goto("/leisure");
  await page.getByRole("button", { name: "Активно" }).click();
  await page.getByRole("button", { name: "Расслабиться" }).click();
  await expect(page.getByRole("button", { name: "На природе" })).toBeDisabled();
  await expect(page.getByLabel("С какого времени начать")).toBeVisible();
  await expect(page.getByLabel("К какому времени закончить")).toBeVisible();

  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    const start = await page
      .getByLabel("С какого времени начать")
      .boundingBox();
    const end = await page
      .getByLabel("К какому времени закончить")
      .boundingBox();
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(end!.y).toBeGreaterThanOrEqual(start!.y + start!.height);
  }
});

test("always builds a complete rainy-day plan with teenagers", async ({
  page,
}) => {
  await page.goto("/leisure");
  await page.getByRole("button", { name: "Осень" }).click();
  await page.getByRole("button", { name: "Дождь" }).click();
  await page.getByRole("button", { name: "С подростками" }).click();
  await page.getByLabel("К какому времени закончить").fill("20:00");
  await page.getByRole("button", { name: /Собрать мой день/ }).click();

  expect(await page.locator(".timeline > li").count()).toBeGreaterThan(1);
  await expect(
    page.getByText(/Подходящего варианта|Попробуем немного иначе/),
  ).toHaveCount(0);
  await expect(page.locator(".timeline")).toContainText("20:00");
});

test("keeps the selected duration and end time in sync", async ({ page }) => {
  await page.goto("/leisure");
  const endTime = page.getByLabel("К какому времени закончить");

  await page.getByRole("button", { name: "1–2 часа" }).click();
  await expect(endTime).toHaveValue("12:00");
  await page.getByRole("button", { name: "3–4 часа" }).click();
  await expect(endTime).toHaveValue("14:00");
  await page.getByRole("button", { name: "Полдня · около 6 часов" }).click();
  await expect(endTime).toHaveValue("16:00");
  await page.getByRole("button", { name: "Весь день · 8–12 часов" }).click();
  await expect(endTime).toHaveValue("20:00");
});

test("shows the supplied map in each matching route card and dialog", async ({
  page,
}) => {
  await page.goto("/leisure");
  await page.getByRole("button", { name: /В Domingo/ }).click();

  for (const title of [
    "Веломаршрут",
    "Пробежка",
    "Тропа здоровья — 1-й лайт уровень",
    "Тропа здоровья — 2-й активный уровень",
  ]) {
    const card = page.locator(".activity-card").filter({ hasText: title });
    await expect(card.locator("img")).toBeVisible();
  }

  await page
    .locator(".activity-card")
    .filter({ hasText: "Веломаршрут" })
    .click();
  await expect(
    page.getByAltText("Карта активности «Веломаршрут»"),
  ).toBeVisible();
});
