/* Cloudflare bindings — keep in sync with wrangler.toml */
import type { InvoiceCounter } from './services/invoiceCounter.js';

export interface JobMessage {
  type:
    | 'invoice.send_email'
    | 'invoice.send_whatsapp'
    | 'recurring.generate'
    | 'reminder.send';
  payload: Record<string, unknown>;
}

export interface Env {
  // Bindings
  DB: D1Database;
  PDFS: R2Bucket;
  ASSETS: R2Bucket;
  KV: KVNamespace;
  JOBS: Queue<JobMessage>;
  BROWSER: Fetcher; // Browser Rendering binding
  INVOICE_COUNTER: DurableObjectNamespace<InvoiceCounter>;

  // Vars
  APP_ENV: string;
  APP_URL: string;
  API_URL: string;
  ALLOWED_ORIGINS: string;

  // Secrets
  JWT_SECRET: string;
  AUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  R2_PUBLIC_DOMAIN: string;
  SENTRY_DSN: string;
}

export interface AuthCtx {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
}

export type AppVariables = {
  auth: AuthCtx;
};
