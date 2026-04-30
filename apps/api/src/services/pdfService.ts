import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

/**
 * PDF service using Cloudflare Browser Rendering.
 * Requires the BROWSER binding in wrangler.toml.
 */
export class PdfService {
  constructor(private readonly browser: BrowserWorker) {}

  async renderPdf(html: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch(this.browser);
    try {
      const page = await browser.newPage();
      // Block external network — invoices must be self-contained
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return new Uint8Array(pdf);
    } finally {
      await browser.close();
    }
  }
}
