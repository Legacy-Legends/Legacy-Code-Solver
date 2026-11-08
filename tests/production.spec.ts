import { expect, test } from '@playwright/test';

test('Render entry point serves built assets, graph and chat on one origin', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  expect((await request.get('/health')).ok()).toBeTruthy();
  const graph = page.waitForResponse('**/api/projects/demo/graph');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open mock graph' }).click();
  expect((await graph).ok()).toBeTruthy();
  expect(new URL((await graph).url()).origin).toBe('http://127.0.0.1:8013');
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Toggle Agent Workspace' }).click();
  const chat = page.waitForResponse('**/api/projects/demo/chat');
  await page.getByRole('textbox', { name: 'Message the pet' }).fill('How healthy is this codebase?');
  await page.getByRole('button', { name: 'Send message' }).click();
  const response = await chat;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText((await response.json()).message, { exact: true })).toBeVisible();
  expect((await request.get('/api/unknown')).status()).toBe(404);
  expect(errors).toEqual([]);
});
