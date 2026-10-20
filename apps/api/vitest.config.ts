import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Workers runtime module; unit tests only need the class to exist.
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
