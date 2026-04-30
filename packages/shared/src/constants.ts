export const APP_NAME = 'Kodspot Flow';
export const APP_DOMAIN = 'flow.kodspot.co.in';
export const SUPPORT_EMAIL = 'kishan@kodspot.com';

export const INVOICE_PREFIX = 'KOD/INV';
export const INVOICE_NUMBER_PADDING = 3; // KOD/INV/2026/001

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['bank_transfer', 'upi', 'neft', 'cash', 'cheque', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECURRING_FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const USER_ROLES = ['owner', 'admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];
