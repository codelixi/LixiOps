import { Resend } from 'resend'
import { env } from './env.js'

// ───────────────────────────────────────────
// Email service — wraps Resend with a thin abstraction.
//
// Behaviour:
//   - If RESEND_API_KEY is set, sends through Resend.
//   - If not, falls back to console.log (dev/preview).
//   - Send failures NEVER throw to the caller — they're logged and
//     the function returns { ok: false }. Auth flows treat email
//     failures as non-fatal (token/OTP still works via logs).
//
// To swap providers (SES, Postmark, Mailgun, SendGrid), only this
// file changes. The interface stays the same.
// ───────────────────────────────────────────

interface SendOptions {
  to: string
  subject: string
  /** HTML body. Use buildEmail() for branded wrapping. */
  html: string
  /** Optional plain-text fallback. Auto-generated from html if omitted. */
  text?: string
}

interface SendResult {
  ok: boolean
  id?: string
  error?: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const FROM = env.RESEND_FROM_EMAIL

export function isEmailConfigured(): boolean {
  return resend !== null
}

export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  // Fall back to console in dev or when RESEND_API_KEY isn't set.
  if (!resend) {
    console.log(`[email] (no Resend key) to=${opts.to} subject="${opts.subject}"`)
    console.log(`[email] html-preview:\n${stripHtml(opts.html).slice(0, 400)}…`)
    return { ok: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? stripHtml(opts.html),
    })
    if (error) {
      console.error('[email] Resend returned error:', error)
      return { ok: false, error: error.message ?? String(error) }
    }
    return { ok: true, id: data?.id }
  } catch (err: any) {
    console.error('[email] send failed:', err)
    return { ok: false, error: err?.message ?? 'unknown error' }
  }
}

// ─── Branded template wrapper ──────────────────
// Keeps the look-and-feel consistent across OTP, reset, notifications.
// Inline styles only — most email clients ignore <style> blocks.
export function buildEmail(opts: {
  heading: string
  body: string
  cta?: { label: string; url: string }
  footer?: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#171717;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;">
          <tr>
            <td style="padding:32px 32px 24px 32px;border-bottom:1px solid #f4f4f4;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#ff5b01;border-radius:8px;width:32px;height:32px;text-align:center;font-weight:700;color:#ffffff;font-size:14px;">L</td>
                  <td style="padding-left:10px;font-size:15px;font-weight:700;color:#171717;letter-spacing:-0.01em;">LixiOps</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#171717;letter-spacing:-0.01em;">${escapeHtml(opts.heading)}</h1>
              <div style="font-size:14px;line-height:1.55;color:#525252;">${opts.body}</div>
              ${
                opts.cta
                  ? `<div style="margin:28px 0 8px 0;">
                       <a href="${escapeAttr(opts.cta.url)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(opts.cta.label)}</a>
                     </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f4f4f4;font-size:12px;color:#a3a3a3;line-height:1.5;">
              ${opts.footer ?? "If you didn't request this email, you can safely ignore it."}
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#a3a3a3;margin:16px 0 0 0;">LixiOps · Business Operating System</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
