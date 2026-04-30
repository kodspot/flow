import { z } from 'zod';
import { RECURRING_FREQUENCIES } from '../constants.js';

export const recurringCreateSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(500),
  frequency: z.enum(RECURRING_FREQUENCIES).default('monthly'),
  amountPaise: z.number().int().nonnegative(),
  rateLabel: z.string().max(100).optional().nullable(),
  startDate: z.string().min(8),
  endDate: z.string().min(8).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).default(1),
  autoSendEmail: z.boolean().default(false),
  autoSendWhatsapp: z.boolean().default(false),
  gstApplicable: z.boolean().default(false),
  gstRatePercent: z.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;
