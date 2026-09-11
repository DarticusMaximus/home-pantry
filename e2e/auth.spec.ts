import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page loads and displays form elements", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toContainText("Home Pantry");

    await expect(page.locator('label[for="email"]')).toContainText("Email");
    await expect(page.locator("#email")).toBeVisible();

    await expect(page.locator('label[for="password"]')).toContainText(
      "Password",
    );
    await expect(page.locator("#password")).toBeVisible();

    await expect(page.locator('button[type="submit"]')).toContainText(
      "Sign In",
    );
  });

  test("unauthenticated user is redirected to login from home", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login/);
  });

  test("protected route redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authentication flows (requires Appwrite test user)", () => {
  test.skip("login flow redirects to home and shows bottom nav", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("testpassword123");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);

    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator('nav a:has-text("Home")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Add")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Settings")')).toBeVisible();
  });

  test.skip("logout flow clears session and redirects to login", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("testpassword123");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/settings");
    await page.locator('button:has-text("Log Out")').click();

    await expect(page).toHaveURL(/\/login/);
  });
});
