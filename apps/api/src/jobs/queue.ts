import type { Env, JobMessage } from '../env.js';

export async function handleQueue(
  batch: MessageBatch<JobMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const job = msg.body;
      switch (job.type) {
        case 'invoice.send_email':
          // TODO P2: Resend
          console.log('[queue] invoice.send_email', job.payload);
          break;
        case 'invoice.send_whatsapp':
          // TODO P2: WhatsApp Cloud API
          console.log('[queue] invoice.send_whatsapp', job.payload);
          break;
        case 'recurring.generate':
          // TODO P3
          console.log('[queue] recurring.generate', job.payload);
          break;
        case 'reminder.send':
          // TODO P4
          console.log('[queue] reminder.send', job.payload);
          break;
      }
      msg.ack();
    } catch (err) {
      console.error('[queue] error', err);
      msg.retry();
    }
  }
  // unused env reference for future use
  void env;
}
