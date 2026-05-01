// Premium minimalist Kodspot invoice template — Stripe / Linear / Notion grade.
// All variables and data bindings unchanged from prior version.
// {{path}}, {{#if x}}…{{/if}}, {{#each items}}…{{/each}}, {{{raw}}}.

export const INVOICE_HTML_TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice {{invoiceNumber}}</title>
<style>
  /* ---------- Reset & page ---------- */
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; }
  body {
    font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 12px;
    color: #111827;
    background: #ffffff;
    line-height: 1.55;
    padding: 22mm 20mm;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-feature-settings: 'tnum' 1, 'cv11' 1;
  }

  /* ---------- Tokens ----------
     Primary text:   #111827
     Secondary text: #6B7280
     Tertiary text:  #9CA3AF
     Border:         #E5E7EB
     Surface:        #F9FAFB
  */

  /* ---------- Header ---------- */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 40px; height: 40px; object-fit: contain; }
  .logo-icon-lg { height: 52px; width: auto; max-width: 200px; object-fit: contain; }
  .brand-text { display: flex; flex-direction: column; }
  .brand-text .name { font-size: 16px; font-weight: 600; color: #111827; letter-spacing: -0.2px; line-height: 1.2; }
  .brand-text .tagline { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; }

  .invoice-mark { text-align: right; }
  .invoice-mark .title { font-size: 30px; font-weight: 700; color: #111827; letter-spacing: -0.8px; line-height: 1; }
  .invoice-mark .num { font-size: 11px; color: #6B7280; margin-top: 6px; font-variant-numeric: tabular-nums; letter-spacing: 0.2px; }

  /* ---------- Meta + Parties (single grid) ---------- */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; }

  .meta { margin-bottom: 28px; }
  .meta .label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-bottom: 4px; }
  .meta .value { font-size: 12.5px; color: #111827; font-weight: 600; font-variant-numeric: tabular-nums; }

  .parties { margin-bottom: 32px; }
  .parties .label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-bottom: 8px; }
  .parties .name { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; }
  .parties p { font-size: 12px; color: #374151; line-height: 1.6; }
  .parties .muted { color: #6B7280; }

  /* ---------- Items table ---------- */
  .section-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; margin-bottom: 10px; }

  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
    font-variant-numeric: tabular-nums;
  }
  table.items thead th {
    background: #F9FAFB;
    font-size: 10px;
    font-weight: 600;
    color: #6B7280;
    padding: 12px 12px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-top: 1px solid #E5E7EB;
    border-bottom: 1px solid #E5E7EB;
  }
  table.items thead th.center { text-align: center; }
  table.items thead th.right { text-align: right; }

  table.items tbody td {
    font-size: 12.5px;
    padding: 14px 12px;
    border-bottom: 1px solid #F3F4F6;
    color: #111827;
    vertical-align: top;
  }
  table.items tbody td.center { text-align: center; }
  table.items tbody td.right { text-align: right; }
  table.items tbody td.muted { color: #6B7280; }
  table.items tbody td.sno { color: #9CA3AF; font-variant-numeric: tabular-nums; width: 36px; }
  table.items tbody td.amount { font-weight: 600; font-variant-numeric: tabular-nums; width: 110px; }
  table.items tbody td.period { width: 120px; }
  table.items tbody td.rate { width: 110px; font-variant-numeric: tabular-nums; }
  table.items tbody td.days { width: 60px; }
  table.items tbody tr:last-child td { border-bottom: 1px solid #E5E7EB; }

  /* ---------- Totals ---------- */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 0; margin-bottom: 24px; }
  .totals { width: 320px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12.5px; font-variant-numeric: tabular-nums; }
  .totals .row .k { color: #6B7280; font-weight: 500; }
  .totals .row .v { color: #111827; font-weight: 500; }
  .totals .row.grand { border-top: 1px solid #E5E7EB; margin-top: 4px; padding-top: 14px; padding-bottom: 4px; }
  .totals .row.grand .k { font-size: 13px; color: #111827; font-weight: 600; }
  .totals .row.grand .v { font-size: 18px; color: #111827; font-weight: 700; letter-spacing: -0.3px; }

  /* ---------- Amount in words ---------- */
  .amount-words { font-size: 12px; color: #6B7280; margin-bottom: 32px; padding-top: 4px; }
  .amount-words .k { color: #9CA3AF; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-right: 8px; }
  .amount-words .v { color: #374151; font-style: italic; }

  /* ---------- Footer sections ---------- */
  .section { margin-bottom: 24px; }
  .section .heading { font-size: 11px; font-weight: 600; color: #111827; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }

  .kv-list { display: grid; grid-template-columns: 130px 1fr; row-gap: 6px; column-gap: 16px; font-size: 12px; }
  .kv-list dt { color: #6B7280; font-weight: 500; }
  .kv-list dd { color: #111827; font-weight: 500; }

  .declaration { font-size: 11.5px; color: #6B7280; line-height: 1.6; }

  .note { font-size: 11.5px; color: #111827; font-weight: 500; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E5E7EB; }

  /* ---------- Signatures ---------- */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; margin-bottom: 24px; page-break-inside: avoid; }
  .sig { padding-top: 14px; border-top: 1px solid #E5E7EB; min-height: 92px; display: flex; flex-direction: column; justify-content: space-between; }
  .sig.right { text-align: right; align-items: flex-end; }
  .sig .for { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }
  .sig-image { max-height: 48px; max-width: 160px; margin: 4px 0; }
  .sig .name { font-size: 12.5px; font-weight: 600; color: #111827; }
  .sig .role { font-size: 11px; color: #6B7280; margin-top: 1px; }

  /* ---------- Footer line ---------- */
  .footer { text-align: center; font-size: 10px; color: #9CA3AF; padding-top: 16px; margin-top: 8px; border-top: 1px solid #F3F4F6; }
  .footer .brand-mark { color: #111827; font-weight: 600; }

  /* ---------- Watermark ---------- */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 120px; color: rgba(17, 24, 39, 0.04);
    font-weight: 800; letter-spacing: 16px;
    pointer-events: none; z-index: 0;
  }

  /* keep critical blocks intact across page breaks */
  table.items tr, .signatures, .totals, .section { page-break-inside: avoid; }
</style>
</head>
<body>
{{#if showDraftWatermark}}<div class="watermark">DRAFT</div>{{/if}}

<header class="header">
  <div class="brand">
    {{{logoSvg}}}
    {{#if showBrandText}}
    <div class="brand-text">
      <span class="name">{{company.brandName}}</span>
      {{#if company.tagline}}<span class="tagline">{{company.tagline}}</span>{{/if}}
    </div>
    {{/if}}
  </div>
  <div class="invoice-mark">
    <div class="title">Invoice</div>
    <div class="num">{{invoiceNumber}}</div>
  </div>
</header>

<section class="meta grid-3">
  <div>
    <div class="label">Invoice Date</div>
    <div class="value">{{invoiceDateFormatted}}</div>
  </div>
  <div>
    <div class="label">{{#if dueDateFormatted}}Due Date{{else}}Place of Supply{{/if}}</div>
    <div class="value">{{#if dueDateFormatted}}{{dueDateFormatted}}{{else}}{{placeOfSupply}}{{/if}}</div>
  </div>
  <div>
    <div class="label">{{#if dueDateFormatted}}Place of Supply{{else}}Currency{{/if}}</div>
    <div class="value">{{#if dueDateFormatted}}{{placeOfSupply}}{{else}}INR (Indian Rupee){{/if}}</div>
  </div>
</section>

<section class="parties grid-2">
  <div>
    <div class="label">Billed To</div>
    {{#if client.name}}<div class="name">{{client.name}}</div>{{/if}}
    {{#if client.company}}<p>{{client.company}}</p>{{/if}}
    {{#if client.addressLine1}}<p>{{client.addressLine1}}</p>{{/if}}
    {{#if client.addressLine2}}<p>{{client.addressLine2}}</p>{{/if}}
    {{#if client.cityLine}}<p>{{client.cityLine}}</p>{{/if}}
    {{#if client.gstNumber}}<p class="muted">GSTIN: {{client.gstNumber}}</p>{{/if}}
  </div>
  <div>
    <div class="label">From</div>
    <div class="name">{{company.brandName}}</div>
    {{#if company.addressLine1}}<p>{{company.addressLine1}}</p>{{/if}}
    {{#if company.addressLine2}}<p>{{company.addressLine2}}</p>{{/if}}
    {{#if company.cityLine}}<p>{{company.cityLine}}</p>{{/if}}
    {{#if company.email}}<p class="muted">{{company.email}}</p>{{/if}}
    {{#if company.phone}}<p class="muted">{{company.phone}}</p>{{/if}}
    {{#if company.gstNumber}}<p class="muted">GSTIN: {{company.gstNumber}}</p>{{/if}}
    {{#if company.udyamNumber}}<p class="muted">Udyam: {{company.udyamNumber}}</p>{{/if}}
  </div>
</section>

<div class="section-label">Service Details</div>
<table class="items">
  <thead>
    <tr>
      <th class="center">#</th>
      <th>Description</th>
      <th>Period</th>
      <th class="right">Rate</th>
      <th class="center">Days</th>
      <th class="right">Amount</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td class="center sno">{{@number}}</td>
      <td>{{description}}</td>
      <td class="period muted">{{period}}</td>
      <td class="right rate">{{rateLabel}}</td>
      <td class="center days muted">{{days}}</td>
      <td class="right amount">{{amountFormatted}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="row"><span class="k">Subtotal</span><span class="v">{{subtotalFormatted}}</span></div>
    <div class="row"><span class="k">GST</span><span class="v">{{gstDisplay}}</span></div>
    <div class="row grand"><span class="k">Total</span><span class="v">{{totalFormatted}}</span></div>
  </div>
</div>

<div class="amount-words">
  <span class="k">Amount in Words</span>
  <span class="v">{{amountInWords}}</span>
</div>

{{#if gstNote}}
<section class="section">
  <div class="heading">GST Compliance Declaration</div>
  <p class="declaration">{{gstNote}}</p>
</section>
{{/if}}

<section class="section">
  <div class="heading">Payment Details</div>
  <dl class="kv-list">
    <dt>Payment Mode</dt><dd>Bank Transfer / UPI / NEFT</dd>
    {{#if company.bankAccountName}}<dt>Account Name</dt><dd>{{company.bankAccountName}}</dd>{{/if}}
    {{#if company.bankLine}}<dt>Bank</dt><dd>{{company.bankLine}}</dd>{{/if}}
    {{#if company.bankIfscLine}}<dt>IFSC / A/C</dt><dd>{{company.bankIfscLine}}</dd>{{/if}}
    {{#if company.upiId}}<dt>UPI</dt><dd>{{company.upiId}}</dd>{{/if}}
  </dl>
  {{#if notes}}<div class="note">{{notes}}</div>{{/if}}
</section>

<div class="signatures">
  <div class="sig">
    <div class="for">For {{client.company}}</div>
    <div>
      <div class="name">&nbsp;</div>
      <div class="role">Authorised Signatory</div>
    </div>
  </div>
  <div class="sig right">
    <div class="for">For {{company.brandName}}</div>
    <div>
      {{#if company.signatureImageSrc}}<img class="sig-image" src="{{company.signatureImageSrc}}" alt="signature" />{{/if}}
      {{#if company.signatoryName}}<div class="name">{{company.signatoryName}}</div>{{/if}}
      {{#if company.signatoryDesignation}}<div class="role">{{company.signatoryDesignation}}</div>{{/if}}
    </div>
  </div>
</div>

<footer class="footer">
  This is a computer-generated invoice and does not require a physical signature. &nbsp;·&nbsp; <span class="brand-mark">{{company.brandName}}</span>
</footer>
</body>
</html>`;

// Default Kodspot SVG mark — used until a custom logo is uploaded.
export const KODSPOT_DEFAULT_LOGO_SVG = String.raw`<svg class="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="22" fill="#111827"/>
  <path d="M24 12 L26 20 L34 20 L28 26 L30 34 L24 28 L18 34 L20 26 L14 20 L22 20 Z" fill="#fff"/>
</svg>`;
