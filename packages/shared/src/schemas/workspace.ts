import { z } from 'zod';

export const companyProfileUpdateSchema = z.object({
  legalName: z.string().min(1).max(200),
  brandName: z.string().min(1).max(100),
  tagline: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).default('India'),
  gstNumber: z.string().max(20).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  udyamNumber: z.string().max(50).optional().nullable(),
  // Bank
  bankAccountName: z.string().max(200).optional().nullable(),
  bankName: z.string().max(200).optional().nullable(),
  bankBranch: z.string().max(200).optional().nullable(),
  bankIfsc: z.string().max(20).optional().nullable(),
  bankAccountNumber: z.string().max(40).optional().nullable(),
  upiId: z.string().max(100).optional().nullable(),
  upiQrR2Key: z.string().max(500).optional().nullable(),
  logoR2Key: z.string().max(500).optional().nullable(),
  signatureR2Key: z.string().max(500).optional().nullable(),
  signatoryName: z.string().max(100).optional().nullable(),
  signatoryDesignation: z.string().max(100).optional().nullable(),
  // Invoice config
  invoiceNumberPrefix: z.string().max(20).default('KOD/INV'),
  defaultPlaceOfSupply: z.string().max(100).optional().nullable(),
  defaultGstNote: z.string().max(500).optional().nullable(),
  defaultInvoiceNotes: z.string().max(2000).optional().nullable(),
  defaultDueDays: z.number().int().min(0).max(365).default(0),
});

export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>;
