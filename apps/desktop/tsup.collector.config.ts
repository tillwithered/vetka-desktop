import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/collector/worker.ts'],
  format: ['cjs'],
  platform: 'node',
  external: ['electron', 'playwright-core'],
  outDir: '.vite/build',
  outExtension: () => ({ js: '.cjs' }),
  clean: false,
  sourcemap: false,
});
