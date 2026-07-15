import { expect, test } from "@playwright/test";

test("trip management create, stale-cookie fallback, archive, restore, and upload target", async ({ page, context, baseURL }) => {
  const tripName = `E2E Trip ${Date.now()}`;

  await page.goto("/trips");

  const createForm = page.locator("aside form").first();
  await createForm.getByLabel("Trip name").fill(tripName);
  await createForm.getByLabel("Destination").fill("QA City");
  await createForm.getByLabel("Starts on").fill("2027-01-10");
  await createForm.getByLabel("Ends on").fill("2027-01-12");
  await createForm.getByRole("button", { name: "Create and select" }).click();

  await expect(page.getByText("Trip created and selected.")).toBeVisible();
  await expect(page.getByRole("heading", { name: tripName })).toBeVisible();

  await page.goto("/upload");
  await expect(page.getByText(`Evidence will be added to ${tripName}.`)).toBeVisible();

  await context.addCookies([
    {
      name: "marco_selected_trip_id",
      value: "00000000-0000-4000-8000-000000000999",
      domain: new URL(baseURL!).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
  await page.reload();
  await expect(page.getByText(`Evidence will be added to ${tripName}.`)).toBeVisible();

  await page.goto("/trips");
  const activeTripCard = page
    .getByRole("heading", { name: "Active Trips" })
    .locator("..")
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: tripName }) })
    .first();
  await activeTripCard.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Trip archived.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archived Trips" }).locator("..").getByText(tripName)).toBeVisible();

  const archivedPanel = page.getByRole("heading", { name: "Archived Trips" }).locator("..");
  await archivedPanel.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Trip restored and selected.")).toBeVisible();

  await page.goto("/upload");
  await expect(page.getByText(`Evidence will be added to ${tripName}.`)).toBeVisible();
});
