import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/backend': {
    target:
      (globalThis as unknown as { process?: { env?: Record<string, string> } })
        .process?.env?.API_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/backend/, ''),
  },
};
const threeDir = decodeURIComponent(new URL('./node_modules/three', import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^three\/webgpu$/, replacement: `${threeDir}/build/three.webgpu.js` },
      { find: /^three\/examples\/(.*)$/, replacement: `${threeDir}/examples/$1` },
      { find: /^three\/addons\/(.*)$/, replacement: `${threeDir}/examples/jsm/$1` },
      { find: /^three$/, replacement: `${threeDir}/build/three.module.js` },
    ],
    dedupe: ['three'],
  },
  server: { host: true, proxy },
  preview: { proxy },
});
