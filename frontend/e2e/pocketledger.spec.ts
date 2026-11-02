import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * These tests share one disposable backend database. They run serially in
 * dependency order, mirroring a single user session.
 */
test.describe.configure({ mode: "serial" });

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

async function waitForReady(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#api-status-text")).toHaveText("API connected");
}

async function fillForm(
  page: import("@playwright/test").Page,
  options: {
    type: "income" | "expense";
    amount: string;
    category: string;
    description: string;
  },
): Promise<void> {
  await page.locator(`.type-option.${options.type}`).click();
  await page.locator("#amount").fill(options.amount);
  await page.locator("#category").selectOption(options.category);
  await page.locator("#date").fill(todayIso());
  await page.locator("#description").fill(options.description);
}

test("loads an empty ledger with a live API connection", async ({ page }) => {
  await waitForReady(page);

  await expect(page.locator("#summary-income")).toHaveText(/0\.00/);
  await expect(page.locator("#summary-expense")).toHaveText(/0\.00/);
  await expect(page.locator("#summary-balance")).toHaveText(/0\.00/);
  await expect(page.locator("#ledger-feedback")).toContainText(
    "Your ledger is empty",
  );
  await expect(page.locator("#transaction-count")).toHaveText("0 entries");
});

test("shows validation errors for incomplete submissions", async ({ page }) => {
  await waitForReady(page);

  await page.locator("#submit-button").click();
  await expect(page.locator("#form-error")).toContainText(
    "Enter an amount greater than zero",
  );

  await page.locator("#amount").fill("0");
  await page.locator("#submit-button").click();
  await expect(page.locator("#form-error")).toContainText(
    "Enter an amount greater than zero",
  );

  await page.locator("#amount").fill("100");
  await page.locator("#submit-button").click();
  await expect(page.locator("#form-error")).toContainText(
    "Choose a category for this transaction",
  );

  await expect(page.locator("#transaction-count")).toHaveText("0 entries");
});

test("adds income and updates the summary", async ({ page }) => {
  await waitForReady(page);

  await fillForm(page, {
    type: "income",
    amount: "500000",
    category: "Salary",
    description: "Playwright income",
  });
  await expect(page.locator("#submit-label")).toHaveText("Add income");
  await page.locator("#submit-button").click();

  await expect(page.locator(".transaction", { hasText: "Playwright income" })).toBeVisible();
  await expect(page.locator("#summary-income")).toHaveText(/500,000\.00/);
  await expect(page.locator("#summary-balance")).toHaveText(/500,000\.00/);
  await expect(page.locator("#transaction-count")).toHaveText("1 entry");
});

test("adds expenses, recalculates balance and renders the breakdown", async ({ page }) => {
  await waitForReady(page);

  await fillForm(page, {
    type: "expense",
    amount: "1250.50",
    category: "Food",
    description: "Playwright groceries",
  });
  await page.locator("#submit-button").click();
  await expect(page.locator(".transaction", { hasText: "Playwright groceries" })).toBeVisible();

  await expect(page.locator("#summary-income")).toHaveText(/500,000\.00/);
  await expect(page.locator("#summary-expense")).toHaveText(/1,250\.50/);
  await expect(page.locator("#summary-balance")).toHaveText(/498,749\.50/);
  await expect(page.locator("#transaction-count")).toHaveText("2 entries");

  await expect(page.locator("#breakdown")).toContainText("Food");
  await expect(page.locator("#breakdown")).toContainText("Salary");
  await expect(page.locator("#breakdown")).toContainText("<1%");
  await expect(page.locator(".bar-fill.expense").first()).toBeVisible();

  await fillForm(page, {
    type: "expense",
    amount: "750",
    category: "Transport",
    description: "Playwright bus pass",
  });
  await page.locator("#submit-button").click();
  await expect(page.locator(".transaction", { hasText: "Playwright bus pass" })).toBeVisible();
});

test("filters transactions by category and type", async ({ page }) => {
  await waitForReady(page);

  await page.locator("#filter-category").selectOption("Food");
  await expect(page.locator("#transaction-count")).toHaveText("1 entry");
  await expect(page.locator(".transaction", { hasText: "Playwright groceries" })).toBeVisible();
  await expect(page.locator(".transaction", { hasText: "Playwright bus pass" })).toHaveCount(0);

  await page.locator("#filter-type").selectOption("income");
  await expect(page.locator("#ledger-feedback")).toContainText("No matching transactions");

  await page.locator("#filter-category").selectOption("all");
  await expect(page.locator(".transaction", { hasText: "Playwright income" })).toBeVisible();
  await expect(page.locator(".transaction", { hasText: "Playwright groceries" })).toHaveCount(0);

  await page.locator("#clear-filters").click();
  await expect(page.locator("#transaction-count")).toHaveText("3 entries");
});

test("edits a transaction and recalculates totals", async ({ page }) => {
  await waitForReady(page);

  await page.getByRole("button", { name: "Edit Playwright income" }).click();
  await expect(page.locator("#form-title")).toHaveText("Edit transaction");
  await expect(page.locator("#form-card")).toHaveClass(/editing/);
  await page.locator("#amount").fill("600000");
  await page.locator("#submit-button").click();

  await expect(page.locator("#summary-income")).toHaveText(/600,000\.00/);
  await expect(page.locator("#summary-balance")).toHaveText(/597,999\.50/);
  await expect(page.locator(".transaction", { hasText: "Playwright income" })).toContainText(
    "600,000.00",
  );
  await expect(page.locator("#form-title")).toHaveText("Add a transaction");
});

test("deletes a transaction with confirmation", async ({ page }) => {
  await waitForReady(page);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Playwright bus pass" }).click();

  await expect(page.locator(".transaction", { hasText: "Playwright bus pass" })).toHaveCount(0);
  await expect(page.locator("#transaction-count")).toHaveText("2 entries");
  await expect(page.locator("#summary-expense")).toHaveText(/1,250\.50/);
  await expect(page.locator("#summary-balance")).toHaveText(/598,749\.50/);
});

test("persists transactions across a page refresh", async ({ page }) => {
  await waitForReady(page);

  await page.reload();
  await expect(page.locator("#api-status-text")).toHaveText("API connected");
  await expect(page.locator(".transaction", { hasText: "Playwright income" })).toBeVisible();
  await expect(page.locator(".transaction", { hasText: "Playwright groceries" })).toBeVisible();
  await expect(page.locator("#summary-balance")).toHaveText(/598,749\.50/);
});

test("renders responsive layouts without horizontal overflow and captures screenshots", async ({
  page,
}) => {
  await waitForReady(page);
  const screenshotDir = resolve(process.cwd(), "../docs/screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  // Mobile — 390 px
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".summary-card.balance")).toBeVisible();
  const mobileMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(mobileMetrics.scrollWidth).toBeLessThanOrEqual(mobileMetrics.innerWidth);
  await page.screenshot({
    path: resolve(screenshotDir, "mobile-390.png"),
    fullPage: true,
  });

  // Tablet — 768 px: form and ledger sit side by side.
  await page.setViewportSize({ width: 768, height: 1024 });
  const formBox = await page.locator("#form-card").boundingBox();
  const ledgerBox = await page.locator("#transactions").boundingBox();
  expect(formBox).not.toBeNull();
  expect(ledgerBox).not.toBeNull();
  if (formBox && ledgerBox) {
    expect(formBox.x).toBeLessThan(ledgerBox.x);
  }
  const tabletMetrics = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(tabletMetrics).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: resolve(screenshotDir, "tablet-768.png"),
    fullPage: true,
  });

  // Desktop — 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopMetrics = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(desktopMetrics).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: resolve(screenshotDir, "desktop-1440.png"),
    fullPage: true,
  });
});

test("recovers gracefully from an API connection failure", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");

  await expect(page.locator("#api-status-text")).toHaveText("API offline");
  await expect(page.locator("#ledger-feedback")).toContainText(
    "Could not load transactions",
  );
  await expect(page.locator("#form-error")).toBeHidden();

  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.locator("#api-status-text")).toHaveText("API connected");
  await expect(page.locator(".transaction", { hasText: "Playwright income" })).toBeVisible();
  await expect(page.locator("#summary-balance")).toHaveText(/598,749\.50/);
});
