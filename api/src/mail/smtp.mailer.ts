import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import { Mailer, type MailMessage } from './mailer.js';

@Injectable()
export class SmtpMailer extends Mailer implements OnModuleDestroy {
  private readonly transport: Transporter;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.transport = createTransport(config.get('SMTP_URL', { infer: true }), {
      from: config.get('MAIL_FROM', { infer: true }),
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail(message);
  }

  onModuleDestroy(): void {
    this.transport.close();
  }
}
