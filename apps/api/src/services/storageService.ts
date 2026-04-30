import { nanoid } from 'nanoid';
import type { DB } from '../db/client.js';
import * as s from '../db/schema.js';

export async function putPdf(
  bucket: R2Bucket,
  workspaceId: string,
  invoiceId: string,
  pdf: Uint8Array,
): Promise<string> {
  const key = `invoices/${workspaceId}/${invoiceId}.pdf`;
  await bucket.put(key, pdf, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  return key;
}

export async function putHtmlSnapshot(
  bucket: R2Bucket,
  workspaceId: string,
  invoiceId: string,
  html: string,
): Promise<string> {
  const key = `invoices/${workspaceId}/${invoiceId}.html`;
  await bucket.put(key, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
  });
  return key;
}

export async function getPdfBytes(bucket: R2Bucket, key: string): Promise<Uint8Array | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const buf = await obj.arrayBuffer();
  return new Uint8Array(buf);
}

export async function logDelivery(
  db: DB,
  args: {
    workspaceId: string;
    invoiceId?: string;
    channel: 'email' | 'whatsapp';
    recipient: string;
    subject?: string;
    status: 'queued' | 'sent' | 'failed' | 'bounced';
    providerMessageId?: string;
    error?: string;
  },
) {
  await db.insert(s.deliveries).values({
    id: nanoid(16),
    workspaceId: args.workspaceId,
    invoiceId: args.invoiceId ?? null,
    channel: args.channel,
    recipient: args.recipient,
    subject: args.subject ?? null,
    status: args.status,
    providerMessageId: args.providerMessageId ?? null,
    error: args.error ?? null,
    sentAt: args.status === 'sent' ? Date.now() : null,
    createdAt: Date.now(),
  });
}
