# Kodspot Flow

Edge-native invoice automation & finance for Kodspot — runs at `flow.kodspot.co.in`.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) on Cloudflare Pages |
| API | Cloudflare Workers + Hono |
| DB | Cloudflare D1 (SQLite, edge) + Drizzle ORM |
| Storage | Cloudflare R2 (PDFs + assets) |
| Cache/Sessions | Cloudflare KV |
| Async jobs | Cloudflare Queues |
| Schedules | Cloudflare Cron Triggers |
| PDF | Cloudflare Browser Rendering (Puppeteer) |
| Numbering | Durable Object (atomic per workspace) |
| Auth | JWT (HS256) with PBKDF2 password hashing |
| Email | Resend |
| WhatsApp | Meta WhatsApp Cloud API |

All money stored as **integer paise** (no float math). Multi-tenant from day 1.

## Folder structure

```
apps/
  api/          Cloudflare Worker (Hono + Drizzle + D1 + DO + Browser)
  web/          Next.js 15 frontend
packages/
  shared/       Zod schemas, money utils, constants (used by both)
```

## Prerequisites

1. **Node ≥ 20.10**, **pnpm ≥ 9** (`corepack enable && corepack prepare pnpm@latest --activate`)
2. **Cloudflare account** with **Workers Paid plan** ($5/mo) — required for Queues, Durable Objects, Browser Rendering
3. `wrangler` CLI logged in: `npx wrangler login`

## ☁️ One-time Cloudflare setup

> Run from `apps/api/` directory.

### 1. Create resources

```powershell
# D1 database
npx wrangler d1 create kodspot-flow-db
# → copy the database_id into wrangler.toml

# R2 buckets
npx wrangler r2 bucket create kodspot-flow-pdfs
npx wrangler r2 bucket create kodspot-flow-assets

# KV namespace
npx wrangler kv namespace create KODSPOT_FLOW_KV
# → copy id into wrangler.toml under [[kv_namespaces]]

# Queues
npx wrangler queues create kodspot-flow-jobs
npx wrangler queues create kodspot-flow-jobs-dlq
```

Update `apps/api/wrangler.toml`:
- `account_id`
- `database_id`
- `kv_namespaces.id`

### 2. Enable Browser Rendering

Cloudflare dashboard → **Workers & Pages → Browser Rendering → Enable**.
The `[browser]` binding in `wrangler.toml` will then work.

### 3. Set secrets

```powershell
cd apps/api

# Generate strong random values for these:
npx wrangler secret put JWT_SECRET
npx wrangler secret put AUTH_SECRET
npx wrangler secret put ENCRYPTION_KEY

# Email
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL    # e.g. invoices@kodspot.co.in

# WhatsApp (Meta Business → WhatsApp → Cloud API)
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_VERIFY_TOKEN

# Optional
npx wrangler secret put SENTRY_DSN
npx wrangler secret put R2_PUBLIC_DOMAIN
```

For local dev, copy `apps/api/.dev.vars.example` → `apps/api/.dev.vars` and fill values.

### 4. DNS routes

You already have `kodspot.co.in` in Cloudflare. Add:

| Subdomain | Type | Target |
|---|---|---|
| `flow.kodspot.co.in` | (auto) | Pages project `kodspot-flow-web` |
| `api.flow.kodspot.co.in` | (auto) | Worker `kodspot-flow-api` (set via `wrangler.toml` route in `[env.production]`) |

### 5. Resend setup

1. Sign up at resend.com
2. **Add Domain → kodspot.co.in** → copy SPF, DKIM, DMARC DNS records → add them in Cloudflare DNS
3. Wait for verification → create API key → set as `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL=invoices@kodspot.co.in`

### 6. WhatsApp Cloud API setup

1. Create Meta Business app → add **WhatsApp** product
2. Get test phone number → note `phone_number_id`
3. Generate **System User access token** (permanent, not 24-hour)
4. Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
5. Pick any string as `WHATSAPP_VERIFY_TOKEN` (used when configuring webhook later)

## 🚀 Local development

```powershell
# from repo root
pnpm install

# 1. Run D1 migrations locally
pnpm db:generate           # generate SQL from schema
pnpm db:migrate:local      # apply to local D1

# 2. Start API worker (port 8787)
pnpm --filter @kodspot/api dev

# 3. Start frontend (port 3000)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @kodspot/web dev
```

Open http://localhost:3000 → sign up → create client → create invoice → generate PDF.

> **Browser Rendering doesn't work in `wrangler dev` locally** — for full PDF testing, deploy to a `--env=staging` worker or `wrangler dev --remote`.

## 🌐 Production deploy

```powershell
# 1. Apply migrations to remote D1
pnpm db:migrate:remote

# 2. Deploy API
pnpm --filter @kodspot/api deploy:production
# → bound at api.flow.kodspot.co.in

# 3. Deploy frontend (first time, create the Pages project)
cd apps/web
npx @opennextjs/cloudflare build
npx wrangler pages deploy .open-next/dist --project-name=kodspot-flow-web

# In Cloudflare dashboard → Pages → kodspot-flow-web → Custom domains
# → add flow.kodspot.co.in
# → set environment variable NEXT_PUBLIC_API_URL=https://api.flow.kodspot.co.in
```

## 🧮 Database schema (high level)

- `workspaces` — tenant root
- `users` — per-workspace, role: owner/admin/member
- `company_profiles` — Kodspot's branding, bank, GST, signatory (1:1 with workspace)
- `clients` — soft-delete via `deleted_at`
- `invoices` — locked + immutable after first send (frozen pdf+html in R2)
- `invoice_items` — line items
- `recurring_profiles` — monthly auto-invoice rules
- `payments`, `reminders`, `deliveries`, `audit_logs`, `sessions`

## 🔒 Security notes

- All API routes (except `/v1/auth/*`) require `Authorization: Bearer <jwt>`
- JWT signed HS256, 7-day expiry
- Passwords: PBKDF2-SHA256, 210k iterations
- All R2 reads gated through API (no public buckets)
- CORS allowlist via `ALLOWED_ORIGINS` var
- Once an invoice is sent, the rendered HTML+PDF are frozen in R2 — legal/tax immutability

## 🧭 Roadmap

- [x] **Phase 0/1**: Auth, Clients, Invoices CRUD, PDF generation, dashboard
- [ ] **Phase 2**: Resend email + WhatsApp delivery (queues)
- [ ] **Phase 3**: Recurring profiles + cron generation
- [ ] **Phase 4**: Payments tracking + reminders
- [ ] **Phase 5**: Charts, command palette, dark mode, mobile polish
- [ ] **Phase 6**: Public API, webhooks, multi-user invites
