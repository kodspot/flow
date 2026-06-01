import { z } from 'zod';
import { INVOICE_STATUSES } from '../constants.js';

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description required').max(500),
  period: z.string().max(100).optional().nullable(), // e.g. "17 Apr – 30 Apr 2026"
  rateLabel: z.string().max(100).optional().nullable(), // e.g. "₹12,000/month"
  ratePaise: z.number().int().nonnegative().optional().nullable(),
  days: z.number().int().nonnegative().optional().nullable(),
  quantity: z.number().nonnegative().default(1),
  amountPaise: z.number().int().nonnegative(),
});

export const invoiceCreateSchema = z.object({
  clientId: z.string().min(1),
  invoiceDate: z.string().datetime().or(z.string().min(8)), // ISO or YYYY-MM-DD
  dueDate: z.string().datetime().or(z.string().min(8)).optional().nullable(),
  placeOfSupply: z.string().max(100).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
  gstApplicable: z.boolean().default(false),
  gstRatePercent: z.number().min(0).max(100).default(0),
  gstNote: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  internalNotes: z.string().max(50000).optional().nullable(),
  idempotencyKey: z.string().max(100).optional(),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
