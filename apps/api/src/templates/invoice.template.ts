// Pixel-perfect Kodspot invoice template (matches the approved design).
// Variables use {{path}}, {{#if x}}…{{/if}}, {{#each items}}…{{/each}}.
// {{{key}}} = unescaped (only used for the inline SVG logo).

export const INVOICE_HTML_TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice - {{invoiceNumber}}</title>
<style>
@page { size: A4; margin: 15mm 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; background: #fff; line-height: 1.5; padding: 40px 60px; max-width: 210mm; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.logo-section { display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 48px; height: 48px; }
.logo-text { display: flex; flex-direction: column; }
.logo-text .brand { font-size: 24px; font-weight: 700; color: #1a365d; letter-spacing: -0.5px; line-height: 1.2; }
.logo-text .tagline { font-size: 9px; color: #666; letter-spacing: 0.5px; text-transform: uppercase; }
.invoice-title { text-align: center; font-size: 28px; font-weight: 700; color: #1a365d; letter-spacing: 3px; margin-bottom: 20px; }
.invoice-meta { display: flex; justify-content: space-between; margin-bottom: 10px; }
.invoice-meta .left, .invoice-meta .right { font-size: 11px; }
.invoice-meta .label { font-weight: 600; color: #1a365d; }
.divider { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }
.parties { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 4px; }
.party { flex: 1; }
.party-title { font-size: 12px; font-weight: 700; color: #1a365d; margin-bottom: 8px; text-decoration: underline; text-underline-offset: 3px; }
.party p { font-size: 11px; line-height: 1.6; color: #444; }
.section-title { font-size: 13px; font-weight: 700; color: #1a365d; margin: 20px 0 10px 0; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table thead th { background: #f5f5f5; font-size: 11px; font-weight: 700; color: #1a365d; padding: 8px 10px; text-align: center; border: 1px solid #d0d0d0; }
table tbody td { font-size: 11px; padding: 10px; border: 1px solid #d0d0d0; vertical-align: top; }
table tbody td:first-child { text-align: center; width: 40px; }
table tbody td:nth-child(2) { text-align: left; }
table tbody td:nth-child(3) { text-align: center; width: 100px; }
table tbody td:nth-child(4) { text-align: center; width: 100px; }
table tbody td:nth-child(5) { text-align: center; width: 50px; }
table tbody td:nth-child(6) { text-align: right; width: 90px; }
.summary { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 12px; }
.summary-table { width: 320px; border-collapse: collapse; }
.summary-table td { padding: 4px 0; font-size: 11px; border: none; }
.summary-table td:first-child { text-align: right; font-weight: 600; color: #1a365d; white-space: nowrap; padding-right: 16px; width: 130px; }
.summary-table td:last-child { text-align: right; width: 150px; }
.total-row td { font-weight: 700; font-size: 12px; color: #1a365d; padding-top: 6px; }
.amount-words { text-align: right; font-style: italic; font-size: 11px; color: #555; margin-top: 4px; margin-bottom: 20px; }
.declaration-box { border: 1px solid #d0d0d0; padding: 10px 14px; margin-bottom: 16px; background: #fafafa; }
.declaration-box .box-title { font-size: 11px; font-weight: 700; color: #1a365d; margin-bottom: 6px; }
.declaration-box p { font-size: 10px; line-height: 1.5; color: #555; }
.payment-section { margin-bottom: 24px; }
.payment-section .section-title { margin-top: 0; }
.payment-section ul { list-style: disc; margin-left: 20px; }
.payment-section li { font-size: 11px; line-height: 1.7; color: #444; }
.note { font-size: 11px; font-weight: 700; color: #1a365d; margin-top: 8px; }
.signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 48px; margin-bottom: 24px; min-height: 100px; }
.signature-block { display: flex; flex-direction: column; justify-content: flex-end; min-height: 100px; text-align: left; }
.signature-block:last-child { text-align: right; }
.signature-block .for-label { font-size: 11px; color: #666; margin-bottom: auto; padding-bottom: 8px; }
.signature-block .signatory { font-size: 12px; font-weight: 700; color: #1a365d; text-decoration: underline; text-underline-offset: 3px; margin-bottom: 2px; }
.signature-block .designation { font-size: 10px; color: #666; }
.signature-image { max-height: 50px; max-width: 180px; margin-bottom: 4px; }
.footer { text-align: center; font-size: 9px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 10px; }
.watermark { position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 90px; color: rgba(220, 38, 38, 0.08); font-weight: 900; letter-spacing: 12px; pointer-events: none; }
</style>
</head>
<body>
{{#if showDraftWatermark}}<div class="watermark">DRAFT</div>{{/if}}

<div class="header">
  <div class="logo-section">
    {{{logoSvg}}}
    <div class="logo-text">
      <span class="brand">{{company.brandName}}</span>
      {{#if company.tagline}}<span class="tagline">{{company.tagline}}</span>{{/if}}
    </div>
  </div>
</div>

<div class="invoice-title">INVOICE</div>

<div class="invoice-meta">
  <div class="left"><span class="label">Invoice No:</span> {{invoiceNumber}}</div>
  <div class="right"><span class="label">Invoice Date:</span> {{invoiceDateFormatted}}</div>
</div>
{{#if placeOfSupply}}
<div class="invoice-meta">
  <div class="left"><span class="label">Place of Supply:</span> {{placeOfSupply}}</div>
  {{#if dueDateFormatted}}<div class="right"><span class="label">Due Date:</span> {{dueDateFormatted}}</div>{{/if}}
</div>
{{/if}}

<hr class="divider">

<div class="parties">
  <div class="party">
    <div class="party-title">Billed To:</div>
    {{#if client.name}}<p>{{client.name}}</p>{{/if}}
    {{#if client.company}}<p>{{client.company}}</p>{{/if}}
    {{#if client.addressLine1}}<p>{{client.addressLine1}}</p>{{/if}}
    {{#if client.addressLine2}}<p>{{client.addressLine2}}</p>{{/if}}
    {{#if client.cityLine}}<p>{{client.cityLine}}</p>{{/if}}
    {{#if client.gstNumber}}<p>GSTIN: {{client.gstNumber}}</p>{{/if}}
  </div>
  <div class="party">
    <div class="party-title">From:</div>
    <p>{{company.brandName}}</p>
    {{#if company.addressLine1}}<p>{{company.addressLine1}}</p>{{/if}}
    {{#if company.addressLine2}}<p>{{company.addressLine2}}</p>{{/if}}
    {{#if company.cityLine}}<p>{{company.cityLine}}</p>{{/if}}
    {{#if company.email}}<p>Email: {{company.email}}</p>{{/if}}
    {{#if company.phone}}<p>Phone: {{company.phone}}</p>{{/if}}
    {{#if company.gstNumber}}<p>GSTIN: {{company.gstNumber}}</p>{{/if}}
    {{#if company.udyamNumber}}<p>Udyam: {{company.udyamNumber}}</p>{{/if}}
  </div>
</div>

<hr class="divider">

<div class="section-title">Service Details</div>
<table>
  <thead><tr><th>S.No</th><th>Description</th><th>Period</th><th>Rate</th><th>Days</th><th>Amount</th></tr></thead>
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

<div class="summary">
  <table class="summary-table">
    <tr><td>Subtotal:</td><td>{{subtotalFormatted}}</td></tr>
    <tr><td>GST:</td><td>{{gstDisplay}}</td></tr>
    <tr class="total-row"><td>Total Amount:</td><td>{{totalFormatted}}</td></tr>
  </table>
</div>

<div class="amount-words">Amount in Words: {{amountInWords}}</div>

{{#if gstNote}}
<div class="declaration-box">
  <div class="box-title">GST Compliance Declaration</div>
  <p>{{gstNote}}</p>
</div>
{{/if}}

<div class="payment-section">
  <div class="section-title">Payment Terms &amp; Bank Details</div>
  <ul>
    <li>Payment Mode: Bank Transfer / UPI / NEFT</li>
    {{#if company.bankAccountName}}<li>Account Name: {{company.bankAccountName}}</li>{{/if}}
    {{#if company.bankLine}}<li>Bank: {{company.bankLine}}</li>{{/if}}
    {{#if company.bankIfscLine}}<li>{{company.bankIfscLine}}</li>{{/if}}
    {{#if company.upiId}}<li>UPI: {{company.upiId}}</li>{{/if}}
  </ul>
  {{#if notes}}<div class="note">{{notes}}</div>{{/if}}
</div>

<div class="signatures">
  <div class="signature-block">
    <div class="for-label">For {{client.company}}</div>
  </div>
  <div class="signature-block">
    <div class="for-label">For {{company.brandName}}</div>
    {{#if company.signatureImageSrc}}<img class="signature-image" src="{{company.signatureImageSrc}}" alt="signature" />{{/if}}
    {{#if company.signatoryName}}<div class="signatory">{{company.signatoryName}}</div>{{/if}}
    {{#if company.signatoryDesignation}}<div class="designation">{{company.signatoryDesignation}}</div>{{/if}}
  </div>
</div>

<div class="footer">
  This is a computer-generated invoice and does not require a physical signature. | {{company.brandName}}
</div>
</body>
</html>`;

// Default Kodspot SVG mark — used until a custom logo is uploaded.
export const KODSPOT_DEFAULT_LOGO_SVG = String.raw`<svg class="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="22" fill="#1a365d"/>
  <circle cx="24" cy="24" r="16" fill="#2c5282"/>
  <path d="M24 12 L26 20 L34 20 L28 26 L30 34 L24 28 L18 34 L20 26 L14 20 L22 20 Z" fill="#4fd1c5"/>
  <path d="M24 18 L24 24" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="24" cy="16" r="1.5" fill="#fff"/>
  <circle cx="19" cy="22" r="1" fill="#a0aec0"/>
  <circle cx="29" cy="22" r="1" fill="#a0aec0"/>
  <circle cx="21" cy="28" r="1" fill="#a0aec0"/>
  <circle cx="27" cy="28" r="1" fill="#a0aec0"/>
</svg>`;
