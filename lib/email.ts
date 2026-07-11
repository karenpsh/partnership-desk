// Server-side email via Resend. Gracefully no-ops when unconfigured so the
// pipeline and all record-keeping keep working without the email service.
//
// Env:
//   RESEND_API_KEY    - Resend API key (server-only)
//   EMAIL_FROM        - sender, e.g. "Partnership Desk <desk@aeonbank.example>"
//   DESK_NOTIFY_EMAIL - recipient inbox for v1 (deals store owner names, not
//                       addresses, until the auth lock-down sprint)

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(subject: string, html: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.DESK_NOTIFY_EMAIL;
  if (!apiKey || !from || !to) {
    return { sent: false, reason: "email not configured (RESEND_API_KEY / EMAIL_FROM / DESK_NOTIFY_EMAIL)" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { sent: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}
