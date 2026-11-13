import { expect, test } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

interface PlantSummary {
  id: string;
  name: string;
  stock: number;
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
      typeof item.stock !== 'number'
    ) {
      throw new Error('GET /api/plants returned an item without an id, name, and stock');
    }
    return { id: item.id, name: item.name, stock: item.stock };
  });
}

async function catalog(request: import('@playwright/test').APIRequestContext): Promise<PlantSummary[]> {
  const list = await request.get('/api/plants?pageSize=48');
  expect(list.status()).toBe(200);
  const plants = readPlants(await list.json());
  expect(plants.length).toBeGreaterThan(0);
  return plants;
}

test(
  'API-01 subscribes an out-of-stock plant without auth and trims the email',
  { tag: '@api' },
  async ({ request }) => {
    const plants = await catalog(request);
    const outOfStock = plants.filter((plant) => plant.stock === 0);
    expect(outOfStock.length, 'out-of-stock plants').toBeGreaterThan(0);
    const plantId = outOfStock[0].id;

    const response = await request.post(`/api/plants/${plantId}/notify`, {
      data: { email: '  name@example.com  ' },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      status: 'subscribed',
      plantId,
      email: 'name@example.com',
    });
    await expectSchema(request, body, 'NotifyResult');
  },
);

test(
  'API-02 refuses incomplete emails with validation_error',
  { tag: '@api' },
  async ({ request }) => {
    test.fail(true, 'F-13: Invalid emails accepted');
    const plants = await catalog(request);
    const outOfStock = plants.filter((plant) => plant.stock === 0);
    expect(outOfStock.length, 'out-of-stock plants').toBeGreaterThan(0);
    const plantId = outOfStock[0].id;

    for (const email of ['a@b', 'name@', 'not-an-email']) {
      const response = await request.post(`/api/plants/${plantId}/notify`, {
        data: { email },
      });
      expect(response.status(), email).toBe(400);
      expect((await response.json()).rule, email).toBe('validation_error');
    }
  },
);

test(
  'API-03 refuses notify for an in-stock plant with rule in_stock',
  { tag: '@api' },
  async ({ request }) => {
    const plants = await catalog(request);
    const inStock = plants.find((plant) => plant.stock > 0);
    expect(inStock, 'in-stock plant').toBeTruthy();

    const response = await request.post(`/api/plants/${inStock!.id}/notify`, {
      data: { email: 'instock-check@example.com' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).rule).toBe('in_stock');
  },
);

test(
  'API-04 returns 404 without a rule for an unknown plant',
  { tag: '@api' },
  async ({ request }) => {
    const response = await request.post('/api/plants/pl-does-not-exist/notify', {
      data: { email: 'unknown-plant@example.com' },
    });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body, '404 body').not.toHaveProperty('rule');
  },
);

test(
  'API-05 refuses a second sign-up for the same email and plant in any case',
  { tag: '@api' },
  async ({ request }) => {
    test.fail(true, 'F-14: Duplicate signups accepted');
    const plants = await catalog(request);
    const outOfStock = plants.filter((plant) => plant.stock === 0);
    expect(outOfStock.length, 'out-of-stock plants').toBeGreaterThan(0);
    const plantId = outOfStock[0].id;
    const email = 'duplicate-case@example.com';

    const first = await request.post(`/api/plants/${plantId}/notify`, {
      data: { email },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`/api/plants/${plantId}/notify`, {
      data: { email: 'Duplicate-Case@Example.com' },
    });
    expect(second.status()).toBe(409);
    expect(await second.json()).toEqual({
      detail: "You're already on the list",
      rule: 'already_subscribed',
    });
  },
);

test(
  'API-06 accepts a different email for the same out-of-stock plant',
  { tag: '@api' },
  async ({ request }) => {
    const plants = await catalog(request);
    const outOfStock = plants.filter((plant) => plant.stock === 0);
    expect(outOfStock.length, 'out-of-stock plants').toBeGreaterThan(0);
    const plantId = outOfStock[0].id;

    const first = await request.post(`/api/plants/${plantId}/notify`, {
      data: { email: 'first-share@example.com' },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`/api/plants/${plantId}/notify`, {
      data: { email: 'other-share@example.com' },
    });
    expect(second.status()).toBe(201);
    const body = await second.json();
    expect(body).toEqual({
      status: 'subscribed',
      plantId,
      email: 'other-share@example.com',
    });
    await expectSchema(request, body, 'NotifyResult');
  },
);

async function makeOutOfStock(
  request: import('@playwright/test').APIRequestContext,
  plantId: string,
  quantity: number,
): Promise<void> {
  const email = process.env.FERNLY_USER_EMAIL;
  const password = process.env.FERNLY_USER_PASSWORD;
  expect(email, 'FERNLY_USER_EMAIL').toBeTruthy();
  expect(password, 'FERNLY_USER_PASSWORD').toBeTruthy();

  const signedIn = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(signedIn.status()).toBe(200);
  const session = await signedIn.json();
  expect(session.token, 'login token').toEqual(expect.any(String));
  const headers = { Authorization: `Bearer ${session.token}` };

  const cart = await request.get('/api/cart', { headers });
  expect(cart.status()).toBe(200);
  const cartBody = await cart.json();
  for (const line of cartBody.lines as { id: string }[]) {
    const removed = await request.delete(`/api/cart/lines/${line.id}`, { headers });
    expect(removed.status()).toBe(200);
  }

  const added = await request.post('/api/cart/lines', {
    headers,
    data: { plantId, size: 'S', quantity },
  });
  expect(added.status()).toBe(200);

  const ordered = await request.post('/api/orders', {
    headers,
    data: {
      shippingAddress: {
        fullName: 'Ava Test',
        address: '1 Test Street',
        city: 'Testville',
        postalCode: '12345',
      },
    },
  });
  expect(ordered.status()).toBe(201);
}

test(
  'API-07 accepts the same email for a different out-of-stock plant',
  { tag: '@api' },
  async ({ request }) => {
    const plants = await catalog(request);
    const firstPlant = plants.find((plant) => plant.stock === 0);
    const depletable = plants.find((plant) => plant.stock >= 1 && plant.stock <= 3);
    expect(firstPlant, 'seed out-of-stock plant').toBeTruthy();
    expect(depletable, 'plant to deplete').toBeTruthy();

    await makeOutOfStock(request, depletable!.id, depletable!.stock);
    const secondPlantId = depletable!.id;
    const email = 'cross-plant@example.com';

    const first = await request.post(`/api/plants/${firstPlant!.id}/notify`, {
      data: { email },
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`/api/plants/${secondPlantId}/notify`, {
      data: { email },
    });
    expect(second.status()).toBe(201);
    const body = await second.json();
    expect(body).toEqual({
      status: 'subscribed',
      plantId: secondPlantId,
      email: 'cross-plant@example.com',
    });
    await expectSchema(request, body, 'NotifyResult');
  },
);
