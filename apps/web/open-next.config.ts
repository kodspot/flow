// @ts-ignore
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// @ts-ignore
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
