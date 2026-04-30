import type { Env } from '../env.js';

/**
 * Cron entry. Two schedules in wrangler.toml:
 *   "0 * * * *"  — hourly: trigger recurring profiles whose next_run_at <= now
 *   "0 3 * * *"  — daily 03:00 UTC: dispatch reminders + mark overdue
 */
export async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const cron = event.cron;
  console.log('[cron] tick', cron, new Date(event.scheduledTime).toISOString());

  if (cron === '0 * * * *') {
    // TODO: enqueue recurring.generate jobs (P3)
    await env.JOBS.send({ type: 'recurring.generate', payload: { tick: event.scheduledTime } });
  } else if (cron === '0 3 * * *') {
    // TODO: scan invoices.due_date < now and update status to overdue
    await env.JOBS.send({ type: 'reminder.send', payload: { tick: event.scheduledTime } });
  }
}
