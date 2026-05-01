// Pixel-perfect Kodspot invoice template — designed for single-page A4 fit
// and a professional Indian-business look (GST/MSME compliant).
//
// Variables: {{path}}, {{#if x}}…{{/if}}, {{#each items}}…{{/each}}.
// {{{key}}} = unescaped (only used for the inline SVG/img logo).

export const INVOICE_HTML_TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice - {{invoiceNumber}}</title>
<style>
  /* ---------- Page ---------- */
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; }
  body {
    font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 10.5px;
    color: #111827;
    background: #fff;
    line-height: 1.45;
    padding: 12mm 14mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
  }
  /* Greyscale print fallback — keeps hierarchy when colour is off. */
  @media print and (monochrome) {
    .party-title, table.items thead th, .summary-table tr.total td { background: #000 !important; color: #fff !important; }
    .amount-words { border-left-color: #000 !important; }
    .declaration-box { border-left-color: #000 !important; }
  }

  /* ---------- Header band ---------- */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid #0f2944;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .logo-section { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 44px; height: 44px; object-fit: contain; }
  .logo-icon-lg { height: 56px; width: auto; max-width: 220px; object-fit: contain; }
  .logo-text { display: flex; flex-direction: column; }
  .logo-text .brand { font-size: 20px; font-weight: 800; color: #0f2944; letter-spacing: -0.3px; line-height: 1.1; }
  .logo-text .tagline { font-size: 8.5px; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase; margin-top: 2px; }

  .invoice-stamp { text-align: right; }
  .invoice-stamp .word { font-size: 26px; font-weight: 800; color: #0f2944; letter-spacing: 6px; line-height: 1; }
  .invoice-stamp .num { font-size: 11px; font-weight: 600; color: #475569; margin-top: 4px; font-family: 'Consolas', 'Monaco', monospace; }

  /* ---------- Meta strip ---------- */
  .meta-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 14px;
  }
  .meta-strip .cell { font-size: 10px; }
  .meta-strip .k { color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; font-size: 8.5px; font-weight: 600; margin-bottom: 2px; }
  .meta-strip .v { color: #0f172a; font-weight: 600; font-size: 11px; }

  /* ---------- Parties ---------- */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
  .party { border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; background: #fff; }
  .party-title { font-size: 9px; font-weight: 700; color: #fff; background: #0f2944; display: inline-block; padding: 3px 10px; border-radius: 2px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
  .party .name { font-size: 12px; font-weight: 700; color: #0f2944; margin-bottom: 4px; }
  .party p { font-size: 10.5px; line-height: 1.55; color: #334155; }
  .party .meta-line { color: #64748b; font-size: 10px; margin-top: 4px; }

  /* ---------- Items table ---------- */
  .section-title { font-size: 10px; font-weight: 700; color: #0f2944; letter-spacing: 1.2px; text-transform: uppercase; margin: 4px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th { background: #0f2944; color: #fff; font-size: 10px; font-weight: 600; padding: 8px 10px; text-align: center; letter-spacing: 0.4px; text-transform: uppercase; }
  table.items thead th:nth-child(2) { text-align: left; }
  table.items thead th:last-child { text-align: right; }
  table.items tbody td { font-size: 10.5px; padding: 9px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #1f2937; }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  table.items tbody td:first-child { text-align: center; width: 36px; color: #64748b; font-weight: 600; }
  table.items tbody td:nth-child(2) { text-align: left; }
  table.items tbody td:nth-child(3) { text-align: center; width: 110px; color: #475569; }
  table.items tbody td:nth-child(4) { text-align: center; width: 100px; }
  table.items tbody td:nth-child(5) { text-align: center; width: 50px; }
  table.items tbody td:nth-child(6) { text-align: right; width: 100px; font-weight: 600; }

  /* ---------- Summary ---------- */
  .summary-row { display: grid; grid-template-columns: 1fr 280px; gap: 14px; margin-top: 12px; margin-bottom: 12px; align-items: start; }
  .amount-words { font-size: 10.5px; color: #475569; background: #f8fafc; border-left: 3px solid #14b8a6; padding: 8px 10px; border-radius: 2px; }
  .amount-words .k { font-size: 8.5px; font-weight: 700; color: #0f2944; text-transform: uppercase; letter-spacing: 0.6px; display: block; margin-bottom: 2px; }
  .amount-words .v { font-style: italic; color: #1f2937; font-weight: 500; }
  .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
  .summary-table td { padding: 7px 12px; font-size: 10.5px; border-bottom: 1px solid #e2e8f0; }
  .summary-table td:first-child { color: #475569; font-weight: 600; }
  .summary-table td:last-child { text-align: right; color: #0f172a; font-weight: 600; }
  .summary-table tr:last-child td { border-bottom: none; }
  .summary-table tr.total td { background: #0f2944; color: #fff; font-size: 14px; font-weight: 800; padding: 10px 14px; letter-spacing: 0.3px; white-space: nowrap; }
  .summary-table tr.total td:first-child { color: #cbd5e1; text-transform: uppercase; letter-spacing: 1.5px; font-size: 11px; font-weight: 700; width: 90px; }

  /* ---------- Compliance + payment ---------- */
  .declaration-box { border: 1px solid #e2e8f0; border-left: 3px solid #0f2944; background: #f8fafc; padding: 8px 12px; margin-bottom: 12px; border-radius: 2px; }
  .declaration-box .box-title { font-size: 9.5px; font-weight: 700; color: #0f2944; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.6px; }
  .declaration-box p { font-size: 9.5px; line-height: 1.5; color: #475569; }

  .payment-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
  .payment-grid .row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; font-size: 10.5px; padding: 2px 0; }
  .payment-grid .row .k { color: #64748b; font-weight: 600; }
  .payment-grid .row .v { color: #0f172a; font-weight: 500; }
  .payment-note { font-size: 10px; font-weight: 600; color: #b45309; margin-top: 6px; }

  /* ---------- Signatures ---------- */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 18px; margin-bottom: 12px; page-break-inside: avoid; }
  .signature-block { padding-top: 10px; border-top: 1px dashed #cbd5e1; min-height: 78px; display: flex; flex-direction: column; justify-content: space-between; }
  .signature-block.right { text-align: right; align-items: flex-end; }
  .signature-block .for-label { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
  .signature-image { max-height: 44px; max-width: 160px; margin: 6px 0 4px 0; }
  .signature-block .signatory { font-size: 11.5px; font-weight: 700; color: #0f2944; margin-bottom: 1px; }
  .signature-block .designation { font-size: 9.5px; color: #64748b; }

  /* ---------- Footer ---------- */
  .footer { text-align: center; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 6px; }
  .footer .brand-mark { font-weight: 700; color: #0f2944; }

  /* ---------- Watermark ---------- */
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 110px; color: rgba(220, 38, 38, 0.07); font-weight: 900; letter-spacing: 14px; pointer-events: none; z-index: 0; }

  table.items tr, .signatures, .declaration-box, .summary-row, .payment-grid { page-break-inside: avoid; }
</style>
</head>
<body>
{{#if showDraftWatermark}}<div class="watermark">DRAFT</div>{{/if}}

<div class="header">
  <div class="logo-section">
    {{{logoSvg}}}
    {{#if showBrandText}}
    <div class="logo-text">
      <span class="brand">{{company.brandName}}</span>
      {{#if company.tagline}}<span class="tagline">{{company.tagline}}</span>{{/if}}
    </div>
    {{/if}}
  </div>
  <div class="invoice-stamp">
    <div class="word">INVOICE</div>
    <div class="num">{{invoiceNumber}}</div>
  </div>
</div>

<div class="meta-strip">
  <div class="cell">
    <div class="k">Invoice Date</div>
    <div class="v">{{invoiceDateFormatted}}</div>
  </div>
  <div class="cell">
    <div class="k">{{#if dueDateFormatted}}Due Date{{else}}Place of Supply{{/if}}</div>
    <div class="v">{{#if dueDateFormatted}}{{dueDateFormatted}}{{else}}{{placeOfSupply}}{{/if}}</div>
  </div>
  <div class="cell">
    <div class="k">{{#if dueDateFormatted}}Place of Supply{{else}}Currency{{/if}}</div>
    <div class="v">{{#if dueDateFormatted}}{{placeOfSupply}}{{else}}INR (Indian Rupee){{/if}}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-title">Billed To</div>
    {{#if client.name}}<div class="name">{{client.name}}</div>{{/if}}
    {{#if client.company}}<p>{{client.company}}</p>{{/if}}
    {{#if client.addressLine1}}<p>{{client.addressLine1}}</p>{{/if}}
    {{#if client.addressLine2}}<p>{{client.addressLine2}}</p>{{/if}}
    {{#if client.cityLine}}<p>{{client.cityLine}}</p>{{/if}}
    {{#if client.gstNumber}}<p class="meta-line">GSTIN: {{client.gstNumber}}</p>{{/if}}
  </div>
  <div class="party">
    <div class="party-title">From</div>
    <div class="name">{{company.brandName}}</div>
    {{#if company.addressLine1}}<p>{{company.addressLine1}}</p>{{/if}}
    {{#if company.addressLine2}}<p>{{company.addressLine2}}</p>{{/if}}
    {{#if company.cityLine}}<p>{{company.cityLine}}</p>{{/if}}
    {{#if company.email}}<p class="meta-line">Email: {{company.email}}</p>{{/if}}
    {{#if company.phone}}<p class="meta-line">Phone: {{company.phone}}</p>{{/if}}
    {{#if company.gstNumber}}<p class="meta-line">GSTIN: {{company.gstNumber}}</p>{{/if}}
    {{#if company.udyamNumber}}<p class="meta-line">Udyam: {{company.udyamNumber}}</p>{{/if}}
  </div>
</div>

<div class="section-title">Service Details</div>
<table class="items">
  <thead>
    <tr>
      <th>S.No</th>
      <th>Description</th>
      <th>Period</th>
      <th>Rate</th>
      <th>Days</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{@number}}</td>
      <td>{{description}}</td>
      <td>{{period}}</td>
      <td>{{rateLabel}}</td>
      <td>{{days}}</td>
      <td>{{amountFormatted}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="summary-row">
  <div class="amount-words">
    <span class="k">Amount in Words</span>
    <span class="v">{{amountInWords}}</span>
  </div>
  <table class="summary-table">
    <tr><td>Subtotal</td><td>{{subtotalFormatted}}</td></tr>
    <tr><td>GST</td><td>{{gstDisplay}}</td></tr>
    <tr class="total"><td>Total</td><td>{{totalFormatted}}</td></tr>
  </table>
</div>

{{#if gstNote}}
<div class="declaration-box">
  <div class="box-title">GST Compliance Declaration</div>
  <p>{{gstNote}}</p>
</div>
{{/if}}

<div class="section-title">Payment Terms &amp; Bank Details</div>
<div class="payment-grid">
  <div class="row"><span class="k">Payment Mode</span><span class="v">Bank Transfer / UPI / NEFT</span></div>
  {{#if company.bankAccountName}}<div class="row"><span class="k">Account Name</span><span class="v">{{company.bankAccountName}}</span></div>{{/if}}
  {{#if company.bankLine}}<div class="row"><span class="k">Bank</span><span class="v">{{company.bankLine}}</span></div>{{/if}}
  {{#if company.bankIfscLine}}<div class="row"><span class="k">IFSC / A/C</span><span class="v">{{company.bankIfscLine}}</span></div>{{/if}}
  {{#if company.upiId}}<div class="row"><span class="k">UPI</span><span class="v">{{company.upiId}}</span></div>{{/if}}
  {{#if notes}}<div class="payment-note">{{notes}}</div>{{/if}}
</div>

<div class="signatures">
  <div class="signature-block">
    <div class="for-label">For {{client.company}}</div>
    <div>
      <div class="signatory">&nbsp;</div>
      <div class="designation">Authorised Signatory</div>
    </div>
  </div>
  <div class="signature-block right">
    <div class="for-label">For {{company.brandName}}</div>
    <div>
      {{#if company.signatureImageSrc}}<img class="signature-image" src="{{company.signatureImageSrc}}" alt="signature" />{{/if}}
      {{#if company.signatoryName}}<div class="signatory">{{company.signatoryName}}</div>{{/if}}
      {{#if company.signatoryDesignation}}<div class="designation">{{company.signatoryDesignation}}</div>{{/if}}
    </div>
  </div>
</div>

<div class="footer">
  This is a computer-generated invoice and does not require a physical signature. &nbsp;|&nbsp; <span class="brand-mark">{{company.brandName}}</span>
</div>
</body>
</html>`;

// Default Kodspot SVG mark — used until a custom logo is uploaded.
export const KODSPOT_DEFAULT_LOGO_SVG = String.raw`<svg class="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="22" fill="#0f2944"/>
  <circle cx="24" cy="24" r="16" fill="#1e40af"/>
  <path d="M24 12 L26 20 L34 20 L28 26 L30 34 L24 28 L18 34 L20 26 L14 20 L22 20 Z" fill="#14b8a6"/>
  <path d="M24 18 L24 24" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="24" cy="16" r="1.5" fill="#fff"/>
</svg>`;
