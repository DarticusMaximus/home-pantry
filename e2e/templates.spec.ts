import { test, expect } from "@playwright/test";

test.describe("Item Templates", () => {
  test.beforeEach(async ({ page }) => {
    // We skip the actual login flow in CI/local if no test user is configured,
    // but we'll write the tests as if it's there.
    await page.goto("/login");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/settings/templates");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test.describe("Authenticated Template Management", () => {
    // Skip these tests by default as they require a real Appwrite session
    // Similar to other spec files in the project
    test.skip(
      true,
      "Requires authenticated Appwrite session - skip until test user is set up",
    );

    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("testpassword123");
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
      await page.goto("/settings/templates");
    });

    test("can navigate to templates page and view list", async ({ page }) => {
      await expect(page.locator("h1")).toContainText("Item Templates");
      // Seeded templates should be visible (e.g., "Milk" or "Eggs" from seed script)
      await expect(page.locator("text=Milk").first() || page.locator("text=Eggs").first()).toBeVisible();
    });

    test("can search templates", async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search templates/i);
      await searchInput.fill("Milk");
      
      // Should show Milk
      await expect(page.locator("text=Milk")).toBeVisible();
      // Should NOT show something unrelated like "Chicken"
      await expect(page.locator("text=Chicken")).not.toBeVisible();
    });

    test("can filter by category", async ({ page }) => {
      const categoryFilter = page.locator("select");
      // Assuming "Dairy" category exists from seed
      await categoryFilter.selectOption({ label: "Dairy" });

      // Should show Dairy items
      await expect(page.locator("text=Milk")).toBeVisible();
      // Should NOT show Meat items
      await expect(page.locator("text=Steak")).not.toBeVisible();
    });

    test("can create a new template", async ({ page }) => {
      await page.getByRole("button", { name: /add template/i }).click();

      await page.locator('input[name="name"]').fill("Test Template");
      await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
      await page.locator('input[name="defaultQuantity"]').fill("5");
      await page.locator('select[name="defaultUnit"]').selectOption("each");
      
      await page.getByRole("button", { name: /create template/i }).click();

      await expect(page.getByText("Template created successfully")).toBeVisible();
      await expect(page.locator("text=Test Template")).toBeVisible();
    });

    test("can edit an existing template", async ({ page }) => {
      // Find the first template card and click edit
      const firstCard = page.locator(".bg-white.rounded-xl.shadow-sm").first();
      await firstCard.getByRole("button").filter({ has: page.locator(".lucide-edit") }).click();

      await page.locator('input[name="name"]').fill("Updated Template Name");
      await page.getByRole("button", { name: /update template/i }).click();

      await expect(page.getByText("Template updated successfully")).toBeVisible();
      await expect(page.locator("text=Updated Template Name")).toBeVisible();
    });

    test("can delete a template", async ({ page }) => {
      const firstCard = page.locator(".bg-white.rounded-xl.shadow-sm").first();
      const templateName = await firstCard.locator("h3").textContent();
      
      await firstCard.getByRole("button").filter({ has: page.locator(".lucide-trash-2") }).click();

      // Confirm dialog
      await expect(page.getByText("Delete Template")).toBeVisible();
      await page.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByText("Template deleted successfully")).toBeVisible();
      if (templateName) {
        await expect(page.locator(`text=${templateName}`)).not.toBeVisible();
      }
    });
  });
});
