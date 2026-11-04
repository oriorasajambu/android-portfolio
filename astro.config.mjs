// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://oriorasajambu.github.io',
  base: '/android-portfolio',
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
