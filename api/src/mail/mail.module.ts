import { Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Module({
  providers: [{ provide: Mailer, useClass: SmtpMailer }],
  exports: [Mailer],
})
export class MailModule {}
