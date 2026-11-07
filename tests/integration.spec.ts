import { test, expect } from '@playwright/test';

test('browser uses server impact, blast, proposal, domain and pet routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigate SessionManager' }).first().click();
  const impactResponse = page.waitForResponse(response => response.url().includes('/impact?') && response.ok());
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByText('Mock agent · no LLM calls · demo graph')).toBeVisible();
  const impact = await impactResponse;
  expect((await impact.json()).targetNode.id).toBeTruthy();
  await page.getByRole('button', { name: 'Ask impact', exact: true }).click();
  await expect(page.getByText(/affected components · 100%/)).toBeVisible();
  await expect(page.getByText(/DIRECT DEPENDENCIES · STATIC GRAPH/)).toBeVisible();
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Backend agent workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview refactor', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Proposal preview' })).toContainText('DEMO PREVIEW');
  await expect(page.getByRole('button', { name: 'Apply unavailable' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reject proposal', exact: true }).click();
  await expect(page.getByText('Proposal · rejected')).toBeVisible();
  await page.getByRole('button', { name: 'Infer domains', exact: true }).click();
  await expect(page.getByText('Inferred domain: Payments', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chat with pet', exact: true }).click();
  await expect(page.getByText(/Steady paws/)).toBeVisible();
  await page.getByText('Connection and action log', { exact: true }).click();
  await expect(page.getByText(/AETHER agent connected/)).toBeVisible();
  // Existing 3D rendering must interoperate with objects constructed by the app.
  await page.getByTitle('Switch 2D Planar Map / 3D Orbit Canvas').click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1000); // allow WebGL's render loop to surface errors
  expect(errors).toEqual([]);
});

test('failed backend graph is visible and never replaced with a local fixture', async ({ page }) => {
  await page.route('**/backend/api/projects/demo/graph', route => route.fulfill({ status: 503, json: { detail: 'Graph service offline' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigate SessionManager' }).first().click();
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByText(/Backend 503: Graph service offline/)).toBeVisible();
  await expect(page.getByText('0 indexed classes · 0 calls')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Backend agent workspace' })).toHaveCount(0);
  await page.unroute('**/backend/api/projects/demo/graph');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Backend agent workspace' })).toBeVisible();
});

test('agent errors stay visible and switching datasets cancels stale responses', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigate SessionManager' }).first().click();
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByText('Mock agent · no LLM calls · demo graph')).toBeVisible();
  await page.route('**/backend/api/projects/demo/blast', route => route.fulfill({ status: 503, json: { detail: 'Provider unavailable' } }));
  await page.getByRole('button', { name: 'Ask impact', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Provider unavailable');
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Backend agent workspace' })).toHaveCount(0);
  await expect(page.getByText('4 indexed classes · 2 calls')).toBeVisible();
});


test('switching to Sample ignores a pending backend graph response', async ({ page }) => {
  let release: () => void = () => {};
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/backend/api/projects/demo/graph', async route => {
    await delayed;
    try { await route.continue(); } catch { /* switching mode cancels the request */ }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigate SessionManager' }).first().click();
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByText('Loading backend graph…')).toBeVisible();
  await page.getByRole('button', { name: 'Sample', exact: true }).click();
  release();
  await expect(page.getByText('4 indexed classes · 2 calls')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Backend agent workspace' })).toHaveCount(0);
});


test('impact failure is shown instead of a zero-dependency result and can be retried', async ({ page }) => {
  await page.route('**/backend/api/projects/demo/impact?*', route => route.fulfill({ status: 503, json: { detail: 'Impact temporarily unavailable' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Investigate SessionManager' }).first().click();
  await page.getByRole('button', { name: 'FastAPI', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Impact temporarily unavailable');
  await expect(page.getByText(/NO INBOUND DEPENDENCIES IN THIS GRAPH/)).toHaveCount(0);
  await page.unroute('**/backend/api/projects/demo/impact?*');
  await page.getByRole('button', { name: 'Retry impact', exact: true }).click();
  await expect(page.getByText(/DIRECT DEPENDENCIES · STATIC GRAPH/)).toBeVisible();
});
