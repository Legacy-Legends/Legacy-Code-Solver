import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: 'production.spec.ts',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: [
    {
      command: `"${process.env.TEST_PYTHON || 'python'}" -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8012`,
      url: 'http://127.0.0.1:8012/health',
      env: { USE_MOCK_AGENT: 'true', USE_CACHED_DEMO: 'true' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:8012' },
    },
  ],
});
