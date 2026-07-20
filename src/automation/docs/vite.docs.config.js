import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build rieng cho bo sinh tai lieu: dong goi generate.jsx thanh mot file node chay duoc.
 * Tach khoi vite.config.js vi day la build cho Node (ssr), khong phai cho trinh duyet.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    ssr: 'generate.jsx',
    outDir: '.build',
    emptyOutDir: true,
    target: 'node18',
    rollupOptions: { output: { entryFileNames: 'generate.mjs' } },
  },
});
