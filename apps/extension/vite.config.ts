import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@uni-apply/shared': path.resolve(rootDir, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        sidePanel: 'src/side-panel/index.html',
        popup: 'src/popup/index.html',
      },
    },
  },
});
