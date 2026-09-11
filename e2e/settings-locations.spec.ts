import { test, expect } from "@playwright/test";

test.describe("Settings - Locations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from locations page", async ({
    page,
  }) => {
    await page.goto("/settings/locations");
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("with authentication (requires Appwrite test user)", () => {
    test.skip(
      true,
      "Requires authenticated Appwrite session - skip for CI until test user is set up",
    );

    test("locations list page loads with header and add button", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations");
      await expect(page.locator("h1")).toContainText("Locations");
      await expect(
        page.getByRole("link", { name: /add location/i }),
      ).toBeVisible();
    });

    test("add location form has all required fields", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations/add");

      await expect(page.locator('label[for="name"]')).toContainText("Name");
      await expect(page.locator("#name")).toBeVisible();

      await expect(page.locator('label[for="description"]')).toContainText(
        "Description",
      );
      await expect(page.locator("#description")).toBeVisible();

      await expect(page.locator('label[for="sortOrder"]')).toContainText(
        "Sort Order",
      );
      await expect(page.locator("#sortOrder")).toBeVisible();

      await expect(
        page.getByRole("button", { name: /save|submit|create/i }),
      ).toBeVisible();
    });

    test("validation error shows on empty name when submitting", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations/add");
      await page.getByRole("button", { name: /save|submit|create/i }).click();

      await expect(page.getByText(/name is required/i)).toBeVisible();
    });

    test("can add new location with valid data", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations/add");

      await page.locator("#name").fill("Test Garage");
      await page.locator("#description").fill("Testing location");
      await page.locator("#sortOrder").fill("10");

      await page.getByRole("button", { name: /save|submit|create/i }).click();

      await expect(page).toHaveURL(/\/settings\/locations/);
      await expect(page.getByText("Test Garage")).toBeVisible();
    });

    test("can navigate to edit existing location", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations");

      const firstEditButton = page
        .getByRole("button", { name: /edit/i })
        .first();
      if (await firstEditButton.isVisible()) {
        await firstEditButton.click();
        await expect(page.locator('label[for="name"]')).toBeVisible();
      } else {
        test.skip(true, "No locations exist to edit");
      }
    });

    test("can delete location with confirmation", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/locations");

      const firstDeleteButton = page
        .getByRole("button", { name: /delete/i })
        .first();
      if (await firstDeleteButton.isVisible()) {
        await firstDeleteButton.click();

        await expect(
          page.getByRole("button", { name: /confirm|delete/i }),
        ).toBeVisible();
        await page.getByRole("button", { name: /confirm|delete/i }).click();
      } else {
        test.skip(true, "No locations exist to delete");
      }
    });
  });
});
