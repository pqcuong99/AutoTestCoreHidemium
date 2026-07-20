import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Man Automation chay long trong cua so chinh, khong con la trang rieng.
 *
 * Vi vay build o che do LIB / IIFE:
 *  - ra mot file .js chay ngay khi nap (khong phai ES module)
 *    -> the <script src> thuong cua index.html nap duoc, khong vuong CORS file://
 *  - ten file co dinh (automation.js / automation.css) de index.html tro thang toi.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Che do lib giu nguyen `process.env.NODE_ENV` cho bundler phia sau thay ho.
  // O day script chay thang trong trinh duyet, khong co ai thay -> phai tu thay,
  // khong thi React nem "process is not defined" ngay khi nap.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssTarget: 'chrome120',   // giu nguyen CSS nesting, dung ha cap
    lib: {
      entry: 'src/mount.jsx',
      name: 'AutomationApp',
      formats: ['iife'],
      fileName: () => 'automation.js',
      cssFileName: 'automation',
    },
  },
});
