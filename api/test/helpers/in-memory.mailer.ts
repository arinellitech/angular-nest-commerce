import { Mailer, type MailMessage } from '../../src/mail/mailer.js';

/** Collects outgoing e-mail instead of talking SMTP. */
export class InMemoryMailer extends Mailer {
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }
}
