import { describe, expect, it } from 'vitest';
import { composeInvoiceInternalNotes, defaultInvoiceTableColumns } from '@kodspot/shared/invoiceTables';
import { renderInvoiceHtml, type RenderInvoiceArgs } from './invoiceRenderer.js';

function render(columns = defaultInvoiceTableColumns()) {
  const internalNotes = composeInvoiceInternalNotes(null, {
    version: 1,
    columns,
    customRowValues: [{ 'custom:days_display': '10 days' }],
    extraTables: [],
  });
  return renderInvoiceHtml({
    invoice: {
      invoiceNumber: 'KOD/INV/2026/001', invoiceDate: Date.UTC(2026, 9, 1), dueDate: null,
      placeOfSupply: 'Karnataka (29)', subtotalPaise: 5_000_000, gstApplicable: false, gstRatePercent: 0,
      gstAmountPaise: 0, gstNote: null, totalPaise: 5_000_000, amountInWords: '', notes: null, internalNotes,
    },
    items: [{
      position: 0, description: 'Retainer', period: 'Oct 2026', rateLabel: null, ratePaise: 500_000,
      days: 10, quantity: 1, amountPaise: 5_000_000,
    }],
    client: { name: 'BHEL', company: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null, gstNumber: null },
    company: { brandName: 'KODSPOT' },
  } as unknown as RenderInvoiceArgs);
}

describe('renderInvoiceHtml', () => {
  it('omits a hidden column even though its values are stored', () => {
    const hidden = defaultInvoiceTableColumns().map((c) => (c.key === 'days' ? { ...c, enabled: false } : c));
    const html = render(hidden);
    expect(html).not.toMatch(/<th[^>]*>Days<\/th>/);
    expect(html).not.toContain('10 days');
    expect(render()).toMatch(/<th[^>]*>Days<\/th>/);
    expect(render()).toContain('10 days');
  });

  it('shows the rate amount when there is no rate text', () => {
    expect(render()).toContain('₹5,000');
  });

  it('fits the A4 sheet to phone screens without changing the print layout', () => {
    const html = render();
    expect(html).toContain('<meta name="viewport" content="width=840">');
    expect(html).not.toMatch(/maximum-scale|user-scalable/);
    // Print/PDF layout is unchanged: A4 page, fixed sheet width, zero page margin.
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('html, body { width: 210mm; }');
    // Screen-only adjustments live inside @media screen.
    const screen = html.match(/@media screen \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    expect(screen).toContain('text-size-adjust: 100%');
    expect(screen).toContain('margin: 16px auto');
  });
});
