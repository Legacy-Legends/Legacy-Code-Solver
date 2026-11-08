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

test('System theme follows repeated OS changes and manual choices persist', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openGraph(page);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme-preference', 'system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Large \(115%\)/ }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Appearance').selectOption('light');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Appearance').selectOption('system');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const background = page.getByTestId('graph-3d');
  const darkColor = await background.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await background.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('radial-gradient');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  expect(await background.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(darkColor);
  await expect(background.locator('canvas')).toBeVisible();
});

test('organic layout is stable with visible, non-overlapping cards', async ({ page }) => {
  await openGraph(page);
  const cards = page.locator('[data-node-id]');
  const positions = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  const boxes = await cards.evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBeTruthy();
    }
  }
  expect(new Set(boxes.map(box => Math.round(box.left))).size).toBeGreaterThan(boxes.length * 0.8);
  await page.reload();
  await expect(cards.first()).toBeVisible();
  expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')))).toEqual(positions);
});

test('pet previews proposal health on hover and focus without changing measured health', async ({ page }) => {
  await page.route('**/backend/api/projects/demo/proposals', route => route.fulfill({ json: {
    id: 'preview-proposal', target_node_ids: [], rationale: 'Reduce deeply nested branches.',
    diffs: [{ path: 'Legacy.java', before: 'class Legacy {}', after: 'final class Legacy {}' }],
    health_before: 65, health_after: 82, change_blast_node_ids: [], status: 'pending',
  } }));
  await openGraph(page);
  await page.locator('[data-node-id]').first().click();
  await page.getByRole('button', { name: 'Toggle Agent Workspace' }).click();
  const health = page.getByTestId('pet-health');
  const currentHealth = await health.getAttribute('data-health');
  await page.getByRole('button', { name: 'Modernize Class' }).click();
  const approve = page.getByRole('button', { name: 'Approve change' });
  await approve.hover();
  await expect(health).toHaveAttribute('data-health', '82');
  await expect(health).toContainText('+17 points');
  await expect(health.getByRole('img')).toHaveAttribute('aria-label', 'Code pet: healthy');
  await page.getByRole('textbox', { name: 'Message the pet' }).hover();
  await expect(health).toHaveAttribute('data-health', currentHealth!);
  await approve.focus();
  await expect(health).toHaveAttribute('data-preview', 'true');
  await page.getByRole('textbox', { name: 'Message the pet' }).focus();
  await expect(health).toHaveAttribute('data-preview', 'false');
  await page.getByText('Legacy.java', { exact: true }).click();
  await expect(page.getByText('final class Legacy {}', { exact: true })).toBeVisible();
  await approve.click();
  await expect(page.getByRole('alert')).toContainText('no editable Java source');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await health.locator('.pet-body').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('long chat histories stay within the API contract and provider errors remain visible', async ({ page }) => {
  let turns = 0;
  await page.route('**/backend/api/projects/demo/chat', route => {
    expect(route.request().postDataJSON().history.length).toBeLessThanOrEqual(8);
    turns++;
    return route.fulfill(turns > 6 ? { status: 503, json: { detail: 'Groq temporarily unavailable' } } :
      { json: { message: `Reply ${turns}`, intent: 'answer', target_node_ids: [] } });
  });
  await openGraph(page);
  await page.getByRole('button', { name: 'Toggle Agent Workspace' }).click();
  for (let index = 1; index <= 7; index++) {
    await page.getByRole('textbox', { name: 'Message the pet' }).fill(`Question ${index}`);
    await page.getByRole('button', { name: 'Send message' }).click();
    if (index <= 6) await expect(page.getByText(`Reply ${index}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('Groq temporarily unavailable');
});
