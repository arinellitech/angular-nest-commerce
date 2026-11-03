export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Outbound e-mail port. The app sends through SmtpMailer (Mailpit locally,
 * any SMTP relay in production); tests swap in an in-memory outbox.
 */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
