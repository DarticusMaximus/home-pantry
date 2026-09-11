import { test, expect } from "@playwright/test";

test.describe("Item CRUD", () => {
  test("unauthenticated user is redirected to login from add item page", async ({
    page,
  }) => {
    await page.goto("/items/add");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("unauthenticated user is redirected to login from item detail page", async ({
    page,
  }) => {
    await page.goto("/items/test-id");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test.describe("Authenticated Item Management", () => {
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
    });

    test("User can add a new item", async ({ page }) => {
      await page.goto("/items/add");

      await expect(page.locator("h1")).toContainText("Add Item");

      await page.locator("#name").fill("Test Item E2E");
      await page.locator("#locationId").selectOption({ index: 1 });
      await page.locator("#quantity").fill("5");
      await page.locator("#unit").selectOption("each");

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });

      await expect(page.locator("h1")).toContainText("Test Item E2E");
      await expect(page.getByText("5 each")).toBeVisible();
    });

    test("User can add item using template", async ({ page }) => {
      await page.goto("/items/add");

      await page.locator("#name").fill("Mil");

      await expect(page.locator("text=Milk")).toBeVisible({ timeout: 5000 });

      await page.locator("button:has-text('Milk')").first().click();

      await expect(page.locator("#name")).toHaveValue("Milk");

      await page.locator("#locationId").selectOption({ index: 1 });

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });
      await expect(page.locator("h1")).toContainText("Milk");
    });

    test("User can view item details", async ({ page }) => {
      await page.goto("/items/add");

      await page.locator("#name").fill("Detail Test Item");
      await page.locator("#locationId").selectOption({ index: 1 });
      await page.locator("#quantity").fill("10");
      await page.locator("#unit").selectOption("lbs");
      await page.locator("#notes").fill("Test notes for detail view");

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });

      await expect(page.locator("h1")).toContainText("Detail Test Item");
      await expect(page.getByText("10 lbs")).toBeVisible();
      await expect(page.getByText("Test notes for detail view")).toBeVisible();

      await expect(page.getByText("Location")).toBeVisible();
      await expect(page.getByText("Quantity")).toBeVisible();
      await expect(page.getByText("Purchase Date")).toBeVisible();
      await expect(page.getByText("Expiration Date")).toBeVisible();
      await expect(page.getByText("Created")).toBeVisible();
    });

    test("User can edit an item", async ({ page }) => {
      await page.goto("/items/add");

      await page.locator("#name").fill("Original Name");
      await page.locator("#locationId").selectOption({ index: 1 });
      await page.locator("#quantity").fill("3");

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });

      await page.locator("a[href*='/edit']").click();

      await expect(page.locator("h2")).toContainText("Edit Item");

      await page.locator("#name").fill("Updated Name");
      await page.locator("#quantity").fill("7");

      await page.getByRole("button", { name: /update item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });

      await expect(page.locator("h1")).toContainText("Updated Name");
      await expect(page.getByText("7 each")).toBeVisible();
    });

    test("User can delete an item", async ({ page }) => {
      await page.goto("/items/add");

      await page.locator("#name").fill("Item To Delete");
      await page.locator("#locationId").selectOption({ index: 1 });

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });
      const itemUrl = page.url();

      await page.getByRole("button", { name: /delete item/i }).click();

      await expect(page.getByText("Delete Item")).toBeVisible();
      await expect(
        page.getByText("Are you sure you want to delete this item?"),
      ).toBeVisible();

      await page.getByRole("button", { name: "Delete" }).click();

      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

      await page.goto(itemUrl);
      await expect(page.getByText("Item not found")).toBeVisible();
    });

    test("Delete shows confirmation dialog and cancel does not delete", async ({
      page,
    }) => {
      await page.goto("/items/add");

      await page.locator("#name").fill("Item With Cancel Test");
      await page.locator("#locationId").selectOption({ index: 1 });

      await page.getByRole("button", { name: /add item/i }).click();

      await expect(page).toHaveURL(/\/items\/[^/]+$/, { timeout: 10000 });

      await page.getByRole("button", { name: /delete item/i }).click();

      await expect(page.getByText("Delete Item")).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();

      await page.getByRole("button", { name: "Cancel" }).click();

      await expect(page.getByText("Delete Item")).not.toBeVisible();

      await expect(page.locator("h1")).toContainText("Item With Cancel Test");
    });
  });
});
