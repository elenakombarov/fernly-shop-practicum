import { expect, test } from '@playwright/test';
import { PlantPage } from '../pages/PlantPage';

interface PopularItem {
  id: string;
  name: string;
  unitsSold: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPopularItems(value: unknown): PopularItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('GET /api/popular did not return an items list');
  }

  return value.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.unitsSold !== 'number'
    ) {
      throw new Error('GET /api/popular returned an item without id, name, and unitsSold');
    }
    return { id: item.id, name: item.name, unitsSold: item.unitsSold };
  });
}

test(
  'E2E-01 Popular right now lists other plants and a link opens that plant page',
  { tag: '@e2e' },
  async ({ page, request }) => {
    const plantId = 'pl-aloe';
    const popularResponse = await request.get('/api/popular?limit=5');
    expect(popularResponse.status()).toBe(200);
    const popular = readPopularItems(await popularResponse.json());
    const expected = popular.filter((item) => item.id !== plantId).slice(0, 4);
    expect(expected.length).toBeGreaterThan(0);

    const plantPage = new PlantPage(page);
    await plantPage.open(plantId);
    await expect(plantPage.popularHeading).toBeVisible();
    await expect(plantPage.popularLinks).toHaveCount(expected.length);

    for (const item of expected) {
      await expect(plantPage.popularLinkByName(item.name)).toBeVisible();
      await expect(plantPage.soldThisMonth(item.unitsSold)).toBeVisible();
    }

    const first = expected[0];
    await plantPage.openPopularPlant(first.name);
    await expect(page).toHaveURL(new RegExp(`/plants/${first.id}$`));
    await expect(page.getByRole('heading', { name: first.name, level: 1 })).toBeVisible();
  },
);
