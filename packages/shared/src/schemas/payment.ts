import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants.js';

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1),
  amountPaise: z.number().int().positive(),
  paidAt: z.string().min(8),
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
