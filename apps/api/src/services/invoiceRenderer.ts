import type { Invoice, InvoiceItem, Client, CompanyProfile } from '../db/schema.js';
import { renderTemplate } from '../lib/template.js';
import { INVOICE_HTML_TEMPLATE, KODSPOT_DEFAULT_LOGO_SVG } from '../templates/invoice.template.js';
import { amountInWords, formatINRCompact } from '@kodspot/shared/money';
import { isCustomInvoiceColumnKey, parseInvoiceInternalNotes } from '@kodspot/shared/invoiceTables';

export interface RenderInvoiceArgs {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client;
  company: CompanyProfile;
  showDraftWatermark?: boolean;
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function joinNonEmpty(parts: Array<string | null | undefined>, sep = ', '): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(sep);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cellClassForColumnKey(key: string): string {
  if (key === 'amount') return 'col-right';
  if (key === 'description' || isCustomInvoiceColumnKey(key)) return 'col-left';
  if (key === 'sno') return 'col-sno';
  return 'col-center';
}

function cellValueForKey(
  key: string,
  rowIndex: number,
  item: InvoiceItem,
  customRowValues: Array<Record<string, string>>,
): string {
  if (key === 'sno') return String(rowIndex + 1);
  if (key === 'description') return item.description;
  if (key === 'period') return item.period ?? '';
  if (key === 'rateLabel') return item.rateLabel ?? (item.ratePaise != null ? formatINRCompact(item.ratePaise) : '');
  if (key === 'days') return item.days != null ? String(item.days) : '';
  if (key === 'quantity') return String(item.quantity ?? 1);
  if (key === 'amount') return formatINRCompact(item.amountPaise);
  if (isCustomInvoiceColumnKey(key)) return customRowValues[rowIndex]?.[key] ?? '';
  return '';
}

function renderServiceDetailsTable(
  columns: Array<{ key: string; label: string; enabled: boolean }>,
  items: InvoiceItem[],
  customRowValues: Array<Record<string, string>>,
): string {
  const visible = columns.filter((c) => c.enabled);
  const safeColumns = visible.length > 0 ? visible : [{ key: 'description', label: 'Item Name', enabled: true }, { key: 'amount', label: 'Amount', enabled: true }];

  const head = safeColumns
    .map((c) => `<th class="${cellClassForColumnKey(c.key)}">${escapeHtml(c.label)}</th>`)
    .join('');

  const body = items
    .map((item, rowIndex) => {
      const cells = safeColumns
        .map((c) => `<td class="${cellClassForColumnKey(c.key)}">${escapeHtml(cellValueForKey(c.key, rowIndex, item, customRowValues))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table class="items"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderExtraTables(
  extraTables: Array<{ id: string; title: string; headers: string[]; rows: string[][] }>,
): string {
  if (extraTables.length === 0) return '';

  return extraTables
    .map((table) => {
      if (table.headers.length === 0) return '';

      const head = table.headers
        .map((header) => `<th class="col-left">${escapeHtml(header)}</th>`)
        .join('');

      const rows = table.rows
        .map((row) => {
          const cells = table.headers
            .map((_, idx) => `<td class="col-left">${escapeHtml(row[idx] ?? '')}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');

      return [
        `<div class="section-title">${escapeHtml(table.title)}</div>`,
        `<table class="items extra-items"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`,
      ].join('');
    })
    .join('');
}

export function renderInvoiceHtml(args: RenderInvoiceArgs): string {
  const { invoice, items, client, company } = args;
  const parsedInternal = parseInvoiceInternalNotes(invoice.internalNotes);
  const sortedItems = [...items].sort((a, b) => a.position - b.position);
  const serviceDetailsTableHtml = renderServiceDetailsTable(
    parsedInternal.tableMeta.columns,
    sortedItems,
    parsedInternal.tableMeta.customRowValues,
  );
  const extraTablesHtml = renderExtraTables(parsedInternal.tableMeta.extraTables);

  const clientCity = joinNonEmpty([
    [client.city, client.postalCode].filter(Boolean).join(' – '),
    client.state,
  ]);
  const companyCity = joinNonEmpty([
    [company.city, company.postalCode].filter(Boolean).join(' – '),
    company.state,
  ]);

  const bankLine = joinNonEmpty([company.bankName, company.bankBranch]);
  const bankIfscLine = joinNonEmpty(
    [
      company.bankIfsc ? `IFSC: ${company.bankIfsc}` : null,
      company.bankAccountNumber ? `Account No: ${company.bankAccountNumber}` : null,
    ],
    ' | ',
  );

  const gstDisplay = invoice.gstApplicable
    ? formatINRCompact(invoice.gstAmountPaise) + ` (${(invoice.gstRatePercent / 100).toFixed(0)}%)`
    : 'Not Applicable (Micro Enterprise)';

  const ctx: Record<string, unknown> = {
    showDraftWatermark: args.showDraftWatermark ?? false,
    // When the user uploads a custom logo, render it larger and hide the
    // textual wordmark — most uploaded brand logos already include the name.
    // The default Kodspot SVG is a small mark and pairs with the wordmark.
    logoSvg: args.logoDataUrl
      ? `<img class="logo-icon-lg" src="${args.logoDataUrl}" alt="${escapeAttr(company.brandName)}" />`
      : KODSPOT_DEFAULT_LOGO_SVG,
    showBrandText: !args.logoDataUrl,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDateFormatted: fmtDate(invoice.invoiceDate),
    dueDateFormatted: fmtDate(invoice.dueDate ?? undefined),
    placeOfSupply: invoice.placeOfSupply,
    notes: invoice.notes,
    gstNote: invoice.gstNote,
    amountInWords: invoice.amountInWords || amountInWords(invoice.totalPaise),
    subtotalFormatted: formatINRCompact(invoice.subtotalPaise),
    gstDisplay,
    totalFormatted: formatINRCompact(invoice.totalPaise),
    serviceDetailsTableHtml,
    extraTablesHtml,
    client: {
      name: client.name,
      company: client.company ?? '',
      addressLine1: client.addressLine1 ?? '',
      addressLine2: client.addressLine2 ?? '',
      cityLine: clientCity,
      gstNumber: client.gstNumber ?? '',
    },
    company: {
      brandName: company.brandName,
      tagline: company.tagline ?? '',
      addressLine1: company.addressLine1 ?? '',
      addressLine2: company.addressLine2 ?? '',
      cityLine: companyCity,
      email: company.email ?? '',
      phone: company.phone ?? '',
      gstNumber: company.gstNumber ?? '',
      udyamNumber: company.udyamNumber ?? '',
      bankAccountName: company.bankAccountName ?? '',
      bankLine,
      bankIfscLine,
      upiId: company.upiId ?? '',
      signatoryName: company.signatoryName ?? '',
      signatoryDesignation: company.signatoryDesignation ?? '',
      signatureImageSrc: args.signatureDataUrl ?? '',
    },
  };

  return renderTemplate(INVOICE_HTML_TEMPLATE, ctx);
}
