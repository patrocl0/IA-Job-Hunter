import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  server: { proxy: { '/api': 'http://127.0.0.1:3000', '/health': 'http://127.0.0.1:3000' } },
}));
