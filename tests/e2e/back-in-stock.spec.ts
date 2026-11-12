import { expect, test } from '@playwright/test';
import { BrowsePage } from '../pages/BrowsePage';
import { PlantPage } from '../pages/PlantPage';

const OUT_OF_STOCK_ID = 'pl-pilea';
const OUT_OF_STOCK_NAME = 'Chinese Money Plant';
const IN_STOCK_ID = 'pl-pothos';
const IN_STOCK_NAME = "Pothos 'Golden'";

test(
  'E2E-01 signs up for an out-of-stock plant, refuses a duplicate email, and hides the form when in stock',
  { tag: '@e2e' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const email = `e2e-notify-${crypto.randomUUID()}@fernly.test`;

    const outOfStock = new PlantPage(page);
    await outOfStock.open(OUT_OF_STOCK_ID);
    await expect(outOfStock.plantNameHeading).toHaveText(OUT_OF_STOCK_NAME);

    const emailField = page.getByLabel("Email me when it's back");
    const notifyButton = page.getByRole('button', { name: 'Notify me' });
    await expect(emailField).toBeVisible();
    await expect(notifyButton).toBeVisible();

    await emailField.fill(email);
    await notifyButton.click();
    await expect(page.getByText(`We'll email ${email} when ${OUT_OF_STOCK_NAME} is back`)).toBeVisible();

    await outOfStock.open(OUT_OF_STOCK_ID);
    await expect(outOfStock.plantNameHeading).toHaveText(OUT_OF_STOCK_NAME);
    await page.getByLabel("Email me when it's back").fill(email.toUpperCase());
    await page.getByRole('button', { name: 'Notify me' }).click();
    await expect(page.getByText("You're already on the list")).toBeVisible();

    const inStock = new PlantPage(page);
    await inStock.open(IN_STOCK_ID);
    await expect(inStock.plantNameHeading).toHaveText(IN_STOCK_NAME);
    await expect(page.getByLabel("Email me when it's back")).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notify me' })).toHaveCount(0);

    const browse = new BrowsePage(page);
    await browse.open();
    await expect(browse.plantCardByName(OUT_OF_STOCK_NAME).getByText('Out of stock')).toBeVisible();
  },
);
