import { Resend } from "resend";

const key = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded file content */
  content: string;
};

export type SendResult =
  { sent: true; id: string } | { sent: false; error: string; simulated?: boolean };

export async function sendEmail({
  to,
  subject,
  body,
  replyTo,
  attachments,
}: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<SendResult> {
  if (!key) {
    return { sent: false, error: "RESEND_API_KEY not set", simulated: true };
  }
  const resend = new Resend(key);
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      text: body,
      replyTo: replyTo ?? undefined,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true, id: data!.id };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
