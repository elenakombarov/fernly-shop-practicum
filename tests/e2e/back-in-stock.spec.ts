import { expect, test } from '@playwright/test';
import { BrowsePage } from '../pages/BrowsePage';
import { PlantPage } from '../pages/PlantPage';

interface CatalogPlant {
  id: string;
  name: string;
  stock: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPlants(value: unknown): CatalogPlant[] {
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

test(
  'E2E-01 shows Only N left for low stock and Out of stock without Only 0 left',
  { tag: '@e2e' },
  async ({ page, request }) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const plants = readPlants(await catalog.json());
    const lowStock = plants.find((plant) => plant.stock >= 1 && plant.stock <= 3);
    const outOfStock = plants.find((plant) => plant.stock === 0);
    expect(lowStock, 'plant with stock 1–3').toBeTruthy();
    expect(outOfStock, 'plant with stock 0').toBeTruthy();

    const browse = new BrowsePage(page);
    await browse.open();
    await expect(browse.plantsHeading(plants.length)).toBeVisible();

    await browse.searchPlants(lowStock!.name);
    await expect(browse.plantCardByName(lowStock!.name)).toBeVisible();
    const lowCard = browse.plantCardByName(lowStock!.name);
    await expect(lowCard.getByText(`Only ${lowStock!.stock} left`)).toBeVisible();

    await browse.searchPlants(outOfStock!.name);
    await expect(browse.plantCardByName(outOfStock!.name)).toBeVisible();
    const outCard = browse.plantCardByName(outOfStock!.name);
    await expect(outCard.getByText('Out of stock')).toBeVisible();
    await expect(outCard.getByText('Only 0 left')).toHaveCount(0);
  },
);

test(
  'E2E-02 signs up for an out-of-stock plant, blocks a duplicate case, and hides the form when in stock',
  { tag: '@e2e' },
  async ({ page, request }) => {
    const catalog = await request.get('/api/plants?pageSize=48');
    expect(catalog.status()).toBe(200);
    const plants = readPlants(await catalog.json());
    const outOfStock = plants.find((plant) => plant.stock === 0);
    const inStock = plants.find((plant) => plant.stock > 0);
    expect(outOfStock, 'out-of-stock plant').toBeTruthy();
    expect(inStock, 'in-stock plant').toBeTruthy();

    const plant = new PlantPage(page);
    await plant.open(outOfStock!.id);
    await expect(plant.heading(outOfStock!.name)).toBeVisible();
    await plant.submitNotifyEmail('name@example.com');
    await expect(plant.confirmation('name@example.com', outOfStock!.name)).toBeVisible();

    await plant.open(outOfStock!.id);
    await expect(plant.notifyEmail).toBeVisible();
    await plant.submitNotifyEmail('Name@Example.com');
    await expect(plant.alreadySubscribed).toBeVisible();
    await expect(plant.confirmation('Name@Example.com', outOfStock!.name)).toHaveCount(0);

    await plant.open(inStock!.id);
    await expect(plant.heading(inStock!.name)).toBeVisible();
    await expect(plant.notifyEmail).toHaveCount(0);
    await expect(plant.notifyMe).toHaveCount(0);
  },
);
