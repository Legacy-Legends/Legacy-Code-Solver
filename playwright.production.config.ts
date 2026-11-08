import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'production.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8013',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: `npm run build && "${process.env.TEST_PYTHON || 'python'}" -m uvicorn backend.web:app --host 127.0.0.1 --port 8013`,
    url: 'http://127.0.0.1:8013/health',
    env: { USE_MOCK_AGENT: 'true', USE_CACHED_DEMO: 'true' },
  },
});
