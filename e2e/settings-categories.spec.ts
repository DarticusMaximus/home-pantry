import { test, expect } from "@playwright/test";

test.describe("Settings - Categories", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from categories page", async ({
    page,
  }) => {
    await page.goto("/settings/categories");
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("with authentication (requires Appwrite test user)", () => {
    test.skip(
      true,
      "Requires authenticated Appwrite session - skip for CI until test user is set up",
    );

    test("categories list page loads with header and add button", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories");
      await expect(page.locator("h1")).toContainText("Categories");
      await expect(
        page.getByRole("link", { name: /add category/i }),
      ).toBeVisible();
    });

    test("add category form has all required fields", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories/add");

      await expect(page.locator('label[for="name"]')).toContainText("Name");
      await expect(page.locator("#name")).toBeVisible();

      await expect(page.locator('label[for="description"]')).toContainText(
        "Description",
      );
      await expect(page.locator("#description")).toBeVisible();

      await expect(page.locator('label[for="color"]')).toContainText("Color");
      await expect(page.locator("#color")).toBeVisible();

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

      await page.goto("/settings/categories/add");
      await page.getByRole("button", { name: /save|submit|create/i }).click();

      await expect(page.getByText(/name is required/i)).toBeVisible();
    });

    test("validation error shows on invalid hex color", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories/add");

      await page.locator("#name").fill("Test Category");
      await page.locator("#color").fill("not-a-color");
      await page.getByRole("button", { name: /save|submit|create/i }).click();

      await expect(page.getByText(/invalid hex color/i)).toBeVisible();
    });

    test("can add new category with valid data", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories/add");

      await page.locator("#name").fill("Test Snacks");
      await page.locator("#description").fill("Testing category");
      await page.locator("#color").fill("#ff6b6b");
      await page.locator("#sortOrder").fill("20");

      await page.getByRole("button", { name: /save|submit|create/i }).click();

      await expect(page).toHaveURL(/\/settings\/categories/);
      await expect(page.getByText("Test Snacks")).toBeVisible();
    });

    test("can navigate to edit existing category", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories");

      const firstEditButton = page
        .getByRole("button", { name: /edit/i })
        .first();
      if (await firstEditButton.isVisible()) {
        await firstEditButton.click();
        await expect(page.locator('label[for="name"]')).toBeVisible();
      } else {
        test.skip(true, "No categories exist to edit");
      }
    });

    test("can delete category with confirmation", async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto("/settings/categories");

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
        test.skip(true, "No categories exist to delete");
      }
    });
  });
});
