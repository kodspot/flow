import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* ────────────────────────────────────────────────────────────
 * Conventions
 *   - All IDs are short nanoid strings (TEXT)
 *   - All money is INTEGER (paise)
 *   - All timestamps are INTEGER (unix ms)
 *   - Every tenant-owned row has workspace_id (FK + index)
 *   - Soft delete via deleted_at where relevant
 * ──────────────────────────────────────────────────────────── */

const ts = () => integer('').notNull().default(sql`(unixepoch() * 1000)`);

// ── workspaces (tenants) ────────────────────────────────────
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'business'] }).notNull().default('free'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
});

// ── users ───────────────────────────────────────────────────
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('owner'),
    emailVerifiedAt: integer('email_verified_at'),
    lastLoginAt: integer('last_login_at'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    emailUq: uniqueIndex('users_email_uq').on(t.email),
    workspaceIdx: index('users_workspace_idx').on(t.workspaceId),
  }),
);

// ── company profile (one per workspace) ─────────────────────
export const companyProfiles = sqliteTable(
  'company_profiles',
  {
    workspaceId: text('workspace_id')
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    brandName: text('brand_name').notNull(),
    tagline: text('tagline'),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('India'),
    gstNumber: text('gst_number'),
    panNumber: text('pan_number'),
    udyamNumber: text('udyam_number'),
    // Bank
    bankAccountName: text('bank_account_name'),
    bankName: text('bank_name'),
    bankBranch: text('bank_branch'),
    bankIfsc: text('bank_ifsc'),
    bankAccountNumber: text('bank_account_number'),
    upiId: text('upi_id'),
    upiQrR2Key: text('upi_qr_r2_key'),
    logoR2Key: text('logo_r2_key'),
    signatureR2Key: text('signature_r2_key'),
    signatoryName: text('signatory_name'),
    signatoryDesignation: text('signatory_designation'),
    // Invoice config
    invoiceNumberPrefix: text('invoice_number_prefix').notNull().default('KOD/INV'),
    defaultPlaceOfSupply: text('default_place_of_supply'),
    defaultGstNote: text('default_gst_note'),
    defaultInvoiceNotes: text('default_invoice_notes'),
    defaultDueDays: integer('default_due_days').notNull().default(0),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
);

// ── clients ─────────────────────────────────────────────────
export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    company: text('company'),
    email: text('email'),
    phone: text('phone'),
    whatsappPhone: text('whatsapp_phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('India'),
    gstNumber: text('gst_number'),
    notes: text('notes'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    workspaceIdx: index('clients_workspace_idx').on(t.workspaceId),
    nameIdx: index('clients_name_idx').on(t.workspaceId, t.name),
  }),
);

// ── invoices ────────────────────────────────────────────────
export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
    // Snapshot of client at issue time (for legal immutability)
    clientSnapshot: text('client_snapshot').notNull(), // JSON

    invoiceNumber: text('invoice_number').notNull(),
    sequenceYear: integer('sequence_year').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),

    invoiceDate: integer('invoice_date').notNull(),
    dueDate: integer('due_date'),
    placeOfSupply: text('place_of_supply'),

    status: text('status', {
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    }).notNull().default('draft'),

    subtotalPaise: integer('subtotal_paise').notNull().default(0),
    gstApplicable: integer('gst_applicable', { mode: 'boolean' }).notNull().default(false),
    gstRatePercent: integer('gst_rate_percent').notNull().default(0), // stored x100 (e.g. 1800 = 18%)
    gstAmountPaise: integer('gst_amount_paise').notNull().default(0),
    gstNote: text('gst_note'),
    totalPaise: integer('total_paise').notNull().default(0),
    paidPaise: integer('paid_paise').notNull().default(0),
    amountInWords: text('amount_in_words').notNull().default(''),

    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // Frozen artefacts after first send/finalise
    pdfR2Key: text('pdf_r2_key'),
    htmlSnapshotR2Key: text('html_snapshot_r2_key'),
    lockedAt: integer('locked_at'),

    sentAt: integer('sent_at'),
    paidAt: integer('paid_at'),

    recurringProfileId: text('recurring_profile_id'),
    recurringPeriodKey: text('recurring_period_key'), // e.g. "2026-05"
    idempotencyKey: text('idempotency_key'),

    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    workspaceIdx: index('invoices_workspace_idx').on(t.workspaceId),
    clientIdx: index('invoices_client_idx').on(t.clientId),
    statusIdx: index('invoices_status_idx').on(t.workspaceId, t.status),
    numberUq: uniqueIndex('invoices_workspace_number_uq').on(t.workspaceId, t.invoiceNumber),
    seqUq: uniqueIndex('invoices_workspace_seq_uq').on(t.workspaceId, t.sequenceYear, t.sequenceNumber),
    idempotencyUq: uniqueIndex('invoices_workspace_idem_uq').on(t.workspaceId, t.idempotencyKey),
    recurringPeriodUq: uniqueIndex('invoices_recurring_period_uq').on(
      t.recurringProfileId,
      t.recurringPeriodKey,
    ),
  }),
);

// ── invoice items ───────────────────────────────────────────
export const invoiceItems = sqliteTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull(),
    position: integer('position').notNull().default(0),
    description: text('description').notNull(),
    period: text('period'),
    rateLabel: text('rate_label'),
    ratePaise: integer('rate_paise'),
    days: integer('days'),
    quantity: integer('quantity').notNull().default(1),
    amountPaise: integer('amount_paise').notNull(),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    invoiceIdx: index('invoice_items_invoice_idx').on(t.invoiceId),
  }),
);

// ── recurring profiles ──────────────────────────────────────
export const recurringProfiles = sqliteTable(
  'recurring_profiles',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    frequency: text('frequency', { enum: ['monthly', 'quarterly', 'yearly'] })
      .notNull()
      .default('monthly'),
    amountPaise: integer('amount_paise').notNull(),
    rateLabel: text('rate_label'),
    startDate: integer('start_date').notNull(),
    endDate: integer('end_date'),
    dayOfMonth: integer('day_of_month').notNull().default(1),
    nextRunAt: integer('next_run_at').notNull(),
    lastRunAt: integer('last_run_at'),
    autoSendEmail: integer('auto_send_email', { mode: 'boolean' }).notNull().default(false),
    autoSendWhatsapp: integer('auto_send_whatsapp', { mode: 'boolean' }).notNull().default(false),
    gstApplicable: integer('gst_applicable', { mode: 'boolean' }).notNull().default(false),
    gstRatePercent: integer('gst_rate_percent').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    workspaceIdx: index('recurring_workspace_idx').on(t.workspaceId),
    nextRunIdx: index('recurring_next_run_idx').on(t.active, t.nextRunAt),
  }),
);

// ── payments ────────────────────────────────────────────────
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amountPaise: integer('amount_paise').notNull(),
    paidAt: integer('paid_at').notNull(),
    method: text('method', {
      enum: ['bank_transfer', 'upi', 'neft', 'cash', 'cheque', 'other'],
    }).notNull().default('bank_transfer'),
    reference: text('reference'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    invoiceIdx: index('payments_invoice_idx').on(t.invoiceId),
    workspaceIdx: index('payments_workspace_idx').on(t.workspaceId),
  }),
);

// ── reminders ───────────────────────────────────────────────
export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['email', 'whatsapp'] }).notNull(),
    kind: text('kind', { enum: ['pre_due', 'due', 'overdue'] }).notNull(),
    scheduledAt: integer('scheduled_at').notNull(),
    sentAt: integer('sent_at'),
    error: text('error'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    scheduledIdx: index('reminders_scheduled_idx').on(t.scheduledAt, t.sentAt),
    invoiceIdx: index('reminders_invoice_idx').on(t.invoiceId),
  }),
);

// ── delivery log (every email / whatsapp sent) ──────────────
export const deliveries = sqliteTable(
  'deliveries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['email', 'whatsapp'] }).notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    status: text('status', { enum: ['queued', 'sent', 'failed', 'bounced'] }).notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    sentAt: integer('sent_at'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    invoiceIdx: index('deliveries_invoice_idx').on(t.invoiceId),
    workspaceIdx: index('deliveries_workspace_idx').on(t.workspaceId),
  }),
);

// ── audit log ───────────────────────────────────────────────
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    actorUserId: text('actor_user_id'),
    action: text('action').notNull(), // e.g. invoice.created
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    metadata: text('metadata'), // JSON
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    workspaceIdx: index('audit_workspace_idx').on(t.workspaceId, t.createdAt),
    entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
  }),
);

// ── auth sessions (refresh tokens / opaque session ids) ─────
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type RecurringProfile = typeof recurringProfiles.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type CompanyProfile = typeof companyProfiles.$inferSelect;
