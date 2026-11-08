import { expect, test, Page } from '@playwright/test';

async function openGraph(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open mock graph' }).click();
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
}

test('one mock file opens a full-width backend graph without dataset controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const graphResponse = page.waitForResponse('**/backend/api/projects/demo/graph');
  await openGraph(page);
  const graph = await (await graphResponse).json();
  await expect(page.locator('[data-node-id]')).toHaveCount(graph.nodes.length);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Sample|Enterprise|FastAPI)$/ })).toHaveCount(0);
  await expect(page.getByRole('complementary')).toHaveCount(0);
  const canvas = await page.getByTestId('graph-canvas').boundingBox();
  expect(canvas!.width).toBe(page.viewportSize()!.width);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('dragging a tile updates arrows continuously without refitting or selecting', async ({ page }) => {
  await openGraph(page);
  const node = page.locator('[data-node-id]').first();
  const originalSize = (await node.boundingBox())!.width;
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  expect((await node.boundingBox())!.width).toBeGreaterThan(originalSize);
  await page.getByRole('button', { name: 'Fit graph', exact: true }).click();
  const original = await node.getAttribute('transform');
  const box = (await node.boundingBox())!;
  const edges = page.locator('[data-edge-id] path:first-child');
  const beforePaths = await edges.evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 12 });
  await expect(node).not.toHaveAttribute('transform', original!);
  const duringPaths = await edges.evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  expect(duringPaths).not.toEqual(beforePaths);
  const moved = (await node.boundingBox())!;
  expect(moved.x - box.x).toBeCloseTo(100, 0);
  expect(moved.y - box.y).toBeCloseTo(50, 0);
  await page.mouse.up();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  expect((await node.boundingBox())!.x).toBeCloseTo(moved.x, 0);
  // Pointer capture must release even if the pointer leaves the canvas.
  await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
  await page.mouse.down();
  await page.mouse.move(10, 10, { steps: 8 });
  await page.mouse.up();
  const released = await node.getAttribute('transform');
  await page.mouse.move(500, 500);
  await expect(node).toHaveAttribute('transform', released!);
});

test('pet stays in the page corner and opens a functional agent drawer', async ({ page }) => {
  await openGraph(page);
  const pet = page.getByRole('button', { name: 'Toggle Agent Workspace' });
  const before = (await pet.boundingBox())!;
  await pet.click();
  const panel = page.getByRole('region', { name: 'Pet and AI agent' });
  await expect(panel).toBeVisible();
  await expect(pet).toHaveAttribute('aria-expanded', 'true');
  const after = (await pet.boundingBox())!;
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0);
  expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0);
  const chatResponse = page.waitForResponse('**/backend/api/projects/demo/chat');
  await page.getByRole('textbox', { name: 'Message the pet' }).fill('How healthy is this codebase?');
  await page.getByRole('button', { name: 'Send message' }).click();
  const reply = await (await chatResponse).json();
  await expect(panel.getByText(reply.message, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close agent' }).click();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page.locator('[data-node-id]').first().click();
  await pet.click();
  await expect(page.getByRole('button', { name: 'Track Blast Radius' })).toBeVisible();
  const blastResponse = page.waitForResponse('**/backend/api/projects/demo/blast');
  await page.getByRole('button', { name: 'Track Blast Radius' }).click();
  expect((await blastResponse).ok()).toBeTruthy();
  await expect(page.getByText('Critical Path Identified')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('backend errors are visible and retry restores the mock graph', async ({ page }) => {
  await page.route('**/backend/api/projects/demo/graph', route => route.fulfill({ status: 503, json: { detail: 'Graph service offline' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open mock graph' }).click();
  await expect(page.getByRole('alert')).toContainText('Graph service offline');
  await expect(page.locator('[data-node-id]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle Agent Workspace' })).toHaveCount(0);
  await page.unroute('**/backend/api/projects/demo/graph');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
});

test('mobile pet drawer can open and close without losing the graph', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGraph(page);
  await page.getByRole('button', { name: 'Toggle Agent Workspace' }).click();
  await expect(page.getByRole('textbox', { name: 'Message the pet' })).toBeVisible();
  await page.getByRole('button', { name: 'Close agent' }).click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
