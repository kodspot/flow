import type { Invoice, InvoiceItem, Client, CompanyProfile } from '../db/schema.js';
import { renderTemplate } from '../lib/template.js';
import { INVOICE_HTML_TEMPLATE, KODSPOT_DEFAULT_LOGO_SVG } from '../templates/invoice.template.js';
import { amountInWords, formatINRCompact } from '@kodspot/shared/money';

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

export function renderInvoiceHtml(args: RenderInvoiceArgs): string {
  const { invoice, items, client, company } = args;

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
    logoSvg: args.logoDataUrl
      ? `<img class="logo-icon" src="${args.logoDataUrl}" alt="logo" />`
      : KODSPOT_DEFAULT_LOGO_SVG,
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
    items: items
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        description: it.description,
        period: it.period ?? '',
        rateLabel: it.rateLabel ?? (it.ratePaise != null ? formatINRCompact(it.ratePaise) : ''),
        days: it.days ?? '',
        amountFormatted: formatINRCompact(it.amountPaise),
      })),
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
