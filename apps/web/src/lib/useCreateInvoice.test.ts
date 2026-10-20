import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { conflictingInvoice } from './useCreateInvoice';

describe('conflictingInvoice', () => {
  it('recognises the API key-conflict response and names the existing invoice', () => {
    const err = new ApiError('An earlier attempt already created …', 409, {
      code: 'idempotency_conflict',
      invoice: { id: 'inv_1', invoiceNumber: 'KOD/INV/2026/005' },
    });
    expect(conflictingInvoice(err)).toEqual({ id: 'inv_1', invoiceNumber: 'KOD/INV/2026/005' });
  });

  it('ignores every other failure, so it is reported as an ordinary error', () => {
    expect(conflictingInvoice(new ApiError('Client not found', 400, { error: 'Client not found' }))).toBeNull();
    expect(conflictingInvoice(new ApiError('Conflict', 409, { code: 'other' }))).toBeNull();
    expect(conflictingInvoice(new ApiError('Conflict', 409, null))).toBeNull();
    expect(conflictingInvoice(new TypeError('Failed to fetch'))).toBeNull();
  });
});
