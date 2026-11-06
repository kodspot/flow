import { describe, expect, it } from 'vitest';
import { fillBlanks, toSavePayload } from './companySettings';
import { emptyInvoiceForm, defaultGstNote, defaultNotes } from './invoiceForm';

describe('toSavePayload', () => {
  it('sends cleared optional fields as null so they validate (e.g. Email)', () => {
    const out = toSavePayload({ legalName: 'Kodspot', email: '', phone: '  ', tagline: 'Hi', defaultDueDays: 0 });
    expect(out).toEqual({ legalName: 'Kodspot', email: null, phone: null, tagline: 'Hi', defaultDueDays: 0 });
  });

  it('leaves out a cleared country or invoice prefix so the server default applies', () => {
    const out = toSavePayload({ country: '', invoiceNumberPrefix: ' ', legalName: 'K' });
    expect(out).toEqual({ legalName: 'K' });
  });
});

describe('fillBlanks', () => {
  it('takes newly filled server values only where the form is blank', () => {
    type P = { legalName: string; bankName: string; upiId: string | null };
    const form: P = { legalName: 'Typed name', bankName: '', upiId: null };
    const server: P = { legalName: 'Server name', bankName: 'HDFC', upiId: 'kodspot@hdfc' };
    expect(fillBlanks(form, server)).toEqual({ legalName: 'Typed name', bankName: 'HDFC', upiId: 'kodspot@hdfc' });
  });
});

describe('emptyInvoiceForm', () => {
  it('starts from the company defaults in Settings', () => {
    const v = emptyInvoiceForm({ defaultPlaceOfSupply: 'Maharashtra (27)', defaultGstNote: 'Our note', defaultInvoiceNotes: 'Our footer' });
    expect(v).toMatchObject({ placeOfSupply: 'Maharashtra (27)', gstNote: 'Our note', notes: 'Our footer' });
  });

  it('falls back to the built-in text where a default is empty', () => {
    const v = emptyInvoiceForm({ defaultPlaceOfSupply: '', defaultGstNote: null });
    expect(v).toMatchObject({ placeOfSupply: 'Karnataka (29)', gstNote: defaultGstNote, notes: defaultNotes });
  });
});
