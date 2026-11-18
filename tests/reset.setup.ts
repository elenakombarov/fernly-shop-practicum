import { expect, test } from '@playwright/test';

test('POST /api/admin/reset', async ({ request }) => {
  const response = await request.post('/api/admin/reset');
  expect(response.status()).toBe(200);
});
