import { expect, test } from '@playwright/test';

interface CatalogPlant {
  name: string;
  price: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPlants(value: unknown): CatalogPlant[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('GET /api/plants did not return a plant list');
  }

  return value.items.map((item) => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.price !== 'number') {
      throw new Error('GET /api/plants returned an item without a name and price');
    }
    return { name: item.name, price: item.price };
  });
}

test(
  'choosing Price: high to low shows the most expensive plant first',
  { tag: '@e2e' },
  async ({ page, request }) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const plants = readPlants(await catalog.json());
    expect(plants.length).toBeGreaterThan(0);
    const mostExpensive = plants.reduce((best, plant) => (plant.price > best.price ? plant : best));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: `${plants.length} plants` })).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption({ label: 'Price: high to low' });
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText(mostExpensive.name);
  },
);
