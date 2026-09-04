import { test, expect } from "@playwright/test";

test("app boots to the home screen with no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page).toHaveTitle("Kings Manager 7v7");

  expect(consoleErrors).toEqual([]);
});
