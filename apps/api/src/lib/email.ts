/**
 * Minimal Resend email sender. Returns false on any failure but never throws.
 * No-ops (returns false) when RESEND_API_KEY is not configured.
 */
export interface SendEmailArgs {
  apiKey: string | undefined;
  from: string | undefined;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<boolean> {
  if (!args.apiKey || !args.from) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function passwordResetEmailHtml(args: {
  userName: string;
  resetUrl: string;
  expiresMinutes: number;
}): string {
  const safeName = escapeHtml(args.userName);
  const safeUrl = escapeAttr(args.resetUrl);
  return `<!doctype html>
<html><body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f1f5f9;margin:0;padding:32px 16px;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0b2138;padding:20px 24px;color:#fff;font-size:18px;font-weight:700;letter-spacing:1px">KODSPOT FLOW</td></tr>
    <tr><td style="padding:28px 24px">
      <p style="margin:0 0 12px;font-size:16px;font-weight:600">Hi ${safeName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">We received a request to reset your password. Click the button below to choose a new one. The link expires in ${args.expiresMinutes} minutes.</p>
      <p style="margin:24px 0;text-align:center">
        <a href="${safeUrl}" style="display:inline-block;background:#0b2138;color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:6px">Reset password</a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b">If the button doesn't work, paste this URL into your browser:</p>
      <p style="margin:0 0 16px;font-size:12px;color:#0b2138;word-break:break-all">${safeUrl}</p>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">If you didn't request this, you can safely ignore this email.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">© Kodspot Flow · This is an automated message.</td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
