import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env, AppVariables, JobMessage } from './env.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { invoiceRoutes } from './routes/invoices.js';
import { settingsRoutes } from './routes/settings.js';
import { handleScheduled } from './jobs/cron.js';
import { handleQueue } from './jobs/queue.js';

export { InvoiceCounter } from './services/invoiceCounter.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : allowed[0] ?? '*'),
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })(c, next);
});

app.get('/', (c) =>
  c.json({
    name: 'Kodspot Flow API',
    version: '0.1.0',
    env: c.env.APP_ENV,
    time: new Date().toISOString(),
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.route('/v1/auth', authRoutes);
app.route('/v1/clients', clientRoutes);
app.route('/v1/invoices', invoiceRoutes);
app.route('/v1/settings', settingsRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: async (
    event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> => {
    ctx.waitUntil(handleScheduled(event, env));
  },
  queue: async (
    batch: MessageBatch<JobMessage>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> => {
    ctx.waitUntil(handleQueue(batch, env));
  },
} satisfies ExportedHandler<Env, JobMessage>;
