import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { expectSchema } from '../helpers/schema';

/**
 * POST /api/plants/{plantId}/notify against docs/features/back-in-stock.md and OpenAPI.
 * Status codes and `rule` values come from the registered path (201, 400 validation_error|in_stock,
 * 404 unknown plant with no rule, 409 already_subscribed). A mismatch with the running API is a
 * failure to keep, not an assertion to edit.
 */

const OUT_OF_STOCK_ID = 'pl-pilea';
const IN_STOCK_ID = 'pl-pothos';
const UNKNOWN_ID = 'pl-does-not-exist';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonBody(response: APIResponse): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

async function notify(
  request: APIRequestContext,
  plantId: string,
  email: string,
): Promise<{ status: number; body: unknown }> {
  const response = await request.post(`/api/plants/${plantId}/notify`, {
    data: { email },
  });
  return { status: response.status(), body: await jsonBody(response) };
}

function uniqueEmail(label: string): string {
  return `api-01-${label}-${crypto.randomUUID()}@example.com`;
}

test('API-01 successful notify signup returns 201 NotifyResult', { tag: '@api' }, async ({ request }) => {
  const email = uniqueEmail('ok');
  const { status, body } = await notify(request, OUT_OF_STOCK_ID, email);

  expect(status).toBe(201);
  await expectSchema(request, body, 'NotifyResult');
  if (!isRecord(body)) throw new Error(`Expected NotifyResult object, got ${JSON.stringify(body)}`);
  expect(body.status).toBe('subscribed');
  expect(body.plantId).toBe(OUT_OF_STOCK_ID);
  expect(body.email).toBe(email);
});

test('API-01 invalid email a@b is refused with 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const { status, body } = await notify(request, OUT_OF_STOCK_ID, 'a@b');

  expect(status).toBe(400);
  if (!isRecord(body) || typeof body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(body)}`);
  }
  expect(body.rule).toBe('validation_error');
});

test('API-01 invalid email name@ is refused with 400 validation_error', { tag: '@api' }, async ({ request }) => {
  const { status, body } = await notify(request, OUT_OF_STOCK_ID, 'name@');

  expect(status).toBe(400);
  if (!isRecord(body) || typeof body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(body)}`);
  }
  expect(body.rule).toBe('validation_error');
});

test('API-01 in-stock plant signup is refused with 400 in_stock', { tag: '@api' }, async ({ request }) => {
  // OpenAPI: 400 covers validation_error or in_stock (not 409).
  const { status, body } = await notify(request, IN_STOCK_ID, uniqueEmail('in-stock'));

  expect(status).toBe(400);
  if (!isRecord(body) || typeof body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(body)}`);
  }
  expect(body.rule).toBe('in_stock');
});

test('API-01 unknown plant ID returns 404 without a rule', { tag: '@api' }, async ({ request }) => {
  const { status, body } = await notify(request, UNKNOWN_ID, uniqueEmail('unknown'));

  expect(status).toBe(404);
  if (!isRecord(body) || typeof body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(body)}`);
  }
  expect(body.rule, 'a 404 has no rule').toBeUndefined();
});

test('API-01 duplicate signup is refused with 409 already_subscribed', { tag: '@api' }, async ({ request }) => {
  const email = uniqueEmail('dup');
  const first = await notify(request, OUT_OF_STOCK_ID, email);
  expect(first.status).toBe(201);

  const second = await notify(request, OUT_OF_STOCK_ID, email);
  expect(second.status).toBe(409);
  if (!isRecord(second.body) || typeof second.body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(second.body)}`);
  }
  expect(second.body.rule).toBe('already_subscribed');
  expect(second.body.detail).toContain("You're already on the list");
});

test('API-01 case-insensitive duplicate is refused with 409 already_subscribed', { tag: '@api' }, async ({ request }) => {
  const email = uniqueEmail('case');
  const first = await notify(request, OUT_OF_STOCK_ID, email);
  expect(first.status).toBe(201);

  const second = await notify(request, OUT_OF_STOCK_ID, email.toUpperCase());
  expect(second.status).toBe(409);
  if (!isRecord(second.body) || typeof second.body.detail !== 'string') {
    throw new Error(`Expected an error body, received ${JSON.stringify(second.body)}`);
  }
  expect(second.body.rule).toBe('already_subscribed');
  expect(second.body.detail).toContain("You're already on the list");
});
