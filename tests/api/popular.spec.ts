import { expect, test } from '@playwright/test';

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

test('API-01 GET /api/popular returns up to four in-stock plants ranked by units sold', { tag: '@api' }, async ({
  request,
}) => {
  const response = await request.get('/api/popular');
  expect(response.status()).toBe(200);
  const items = readPopularItems(await response.json());
  expect(items.length).toBeLessThanOrEqual(4);

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    if (previous.unitsSold === current.unitsSold) {
      expect(previous.name.localeCompare(current.name)).toBeLessThanOrEqual(0);
    } else {
      expect(previous.unitsSold).toBeGreaterThan(current.unitsSold);
    }
  }

  for (const item of items) {
    expect(item.unitsSold).toBeGreaterThan(0);
    const plant = await request.get(`/api/plants/${item.id}`);
    expect(plant.status()).toBe(200);
    const body = await plant.json();
    expect(body.stock, `${item.name} stock`).toBeGreaterThan(0);
  }
});

test('API-02 GET /api/popular?limit=N returns at most N items for limits 1 through 12', { tag: '@api' }, async ({
  request,
}) => {
  for (const limit of [1, 4, 12] as const) {
    const response = await request.get(`/api/popular?limit=${limit}`);
    expect(response.status(), `limit=${limit} status`).toBe(200);
    const items = readPopularItems(await response.json());
    expect(items.length, `limit=${limit} length`).toBeLessThanOrEqual(limit);
  }
});

test('API-03 GET /api/popular with limit outside 1–12 returns 400 validation_error', { tag: '@api' }, async ({
  request,
}) => {
  for (const limit of [0, 13] as const) {
    const response = await request.get(`/api/popular?limit=${limit}`);
    expect(response.status(), `limit=${limit} status`).toBe(400);
    const body = await response.json();
    expect(body.rule, `limit=${limit} rule`).toBe('validation_error');
  }
});
