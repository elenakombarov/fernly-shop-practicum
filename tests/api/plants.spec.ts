import { expect, test } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

interface PlantSummary {
  id: string;
  name: string;
  price: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPlants(value: unknown): PlantSummary[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('GET /api/plants did not return a plant list');
  }

  return value.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.price !== 'number'
    ) {
      throw new Error('GET /api/plants returned an item without an id, name, and price');
    }
    return { id: item.id, name: item.name, price: item.price };
  });
}

test('a plant matches the Plant schema', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-07: plant rating is a string, not a number');
  const list = await request.get('/api/plants?pageSize=48');
  expect(list.status()).toBe(200);
  const plants = readPlants(await list.json());
  expect(plants.length).toBeGreaterThan(0);

  const plant = await request.get(`/api/plants/${plants[0].id}`);
  expect(plant.status()).toBe(200);
  await expectSchema(request, await plant.json(), 'Plant');
});

test('price-desc returns the most expensive plant first', { tag: '@api' }, async ({ request }) => {
  test.fail(true, 'F-02: price-desc returns the cheapest plant first');
  const catalog = await request.get('/api/plants?pageSize=48');
  expect(catalog.status()).toBe(200);
  const plants = readPlants(await catalog.json());
  expect(plants.length).toBeGreaterThan(0);
  const mostExpensive = Math.max(...plants.map((plant) => plant.price));

  const sorted = await request.get('/api/plants?sort=price-desc');
  expect(sorted.status()).toBe(200);
  const firstPage = readPlants(await sorted.json());
  expect(firstPage.length).toBeGreaterThan(0);
  expect(firstPage[0].price).toBe(mostExpensive);
});
