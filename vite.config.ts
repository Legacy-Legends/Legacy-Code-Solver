import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/backend': {
    target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/backend/, ''),
  },
};
export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy },
  preview: { proxy },
});
