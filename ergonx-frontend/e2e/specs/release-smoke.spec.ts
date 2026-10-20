import { expect, test, type Page } from "@playwright/test";

/** Seeded demo accounts (seed_ergonx_demo). Override any of them with E2E_<ROLE>_EMAIL / _PASSWORD. */
const DOMAIN = process.env.E2E_EMAIL_DOMAIN ?? "apexenergy.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "ErgonxDemo!2026";
const account = (role: string, local: string) => ({
  email: process.env[`E2E_${role}_EMAIL`] ?? `${local}@${DOMAIN}`,
  password: process.env[`E2E_${role}_PASSWORD`] ?? PASSWORD,
});
const ADMIN = account("INSTITUTION_ADMIN", "kwame.mensah");
const DIRECTOR = account("DIRECTOR", "evelyn.darko");
const FINANCE = account("FINANCE_MANAGER", "yaw.osei");
const AUDITOR = account("AUDITOR", "sandra.appiah");
const EMPLOYEE = account("EMPLOYEE", "nana.nyarko");

const DENIED = /You don.t have access|Access denied/i;

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Opens a page and checks it rendered real content: a heading, no crash screen, no access-denied. */
async function opens(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.getByText(DENIED)).toHaveCount(0);
  await expect(page.getByText(/Application error|Something went wrong/i)).toHaveCount(0);
}

test("institution admin reaches the main workspaces", async ({ page }) => {
  await signIn(page, ADMIN);
  await opens(page, "/hr/employees", /^Employees$/);
  await opens(page, "/hr/employees/import", /Import employees/);
  await opens(page, "/payroll/runs", /Payroll runs/i);
  await opens(page, "/payroll/employee-profiles", /Employee payroll profiles/i);
  await opens(page, "/settings/holidays", /Public holidays/);
  await opens(page, "/leave/requests", /Leave/i);
});

test("director sees the executive dashboard", async ({ page }) => {
  await signIn(page, DIRECTOR);
  await opens(page, "/dashboard", /dashboard|insights/i);
});

test("finance manager reaches accounting and payroll", async ({ page }) => {
  await signIn(page, FINANCE);
  await opens(page, "/accounting", /Accounting|Finance/i);
  await opens(page, "/payroll/runs", /Payroll runs/i);
});

test("auditor can read the audit trail but not import employees", async ({ page }) => {
  await signIn(page, AUDITOR);
  await opens(page, "/audit", /Audit/i);
  await page.goto("/hr/employees/import");
  await expect(page.getByText(DENIED).first()).toBeVisible();
});

test("employee uses self-service", async ({ page }) => {
  await signIn(page, EMPLOYEE);
  await opens(page, "/me/payslips", /My payslips/);
  await opens(page, "/me/leave", /leave/i);
  await opens(page, "/my-work", /My work/i);
  // The team leave workspace sends an employee to their own leave instead of a dead end.
  await page.goto("/leave");
  await expect(page).toHaveURL(/\/me\/leave$/);
});

test("help and unknown pages are friendly", async ({ page }) => {
  await signIn(page, EMPLOYEE);
  await opens(page, "/help", /^Help$/);
  await page.getByRole("link", { name: /Running monthly payroll/ }).click();
  await expect(page.getByRole("heading", { name: /Running monthly payroll/ })).toBeVisible();
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
});

test("health endpoint is ready", async ({ request }) => {
  const api = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";
  const response = await request.get(`${api}/api/v1/health/ready/`);
  expect(response.status()).toBe(200);
  expect((await response.json()).status).toBe("ok");
});
