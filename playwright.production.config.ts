import { defineConfig } from '@playwright/test';

const python = process.env.TEST_PYTHON || 'python';
const split = process.env.TEST_SPLIT_DEPLOYMENT === 'true';
const agentEnv = { USE_MOCK_AGENT: 'true', USE_CACHED_DEMO: 'true' };

export default defineConfig({
  testDir: './tests',
  testMatch: 'production.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8013',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: split ? [
    {
      command: `"${python}" -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8014`,
      url: 'http://127.0.0.1:8014/health',
      env: agentEnv,
    },
    {
      command: `npm run build && "${python}" -m http.server 8013 --bind 127.0.0.1 --directory dist`,
      url: 'http://127.0.0.1:8013',
      env: { VITE_API_URL: 'http://127.0.0.1:8014' },
    },
  ] : {
    command: `npm run build && "${python}" -m uvicorn backend.web:app --host 127.0.0.1 --port 8013`,
    url: 'http://127.0.0.1:8013/health',
    env: { ...agentEnv, VITE_API_URL: '' },
  },
});
