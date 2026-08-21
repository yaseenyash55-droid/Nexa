import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface IEmailProvider {
  sendEmail(message: EmailMessage): Promise<boolean>;
}

export class FakeEmailProvider implements IEmailProvider {
  public sentEmails: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<boolean> {
    this.sentEmails.push(message);
    return true;
  }
}

export class ProductionEmailProvider implements IEmailProvider {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || '465');
    const secure = process.env.SMTP_SECURE !== 'false';
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim() || user;

    if (!host || !user || !password || !from) {
      throw new Error(
        'SMTP configuration is incomplete. Required: SMTP_HOST, SMTP_USER, (SMTP_PASSWORD or SMTP_PASS) and SMTP_FROM.'
      );
    }

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number.');
    }

    this.fromAddress = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password
      }
    });
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    const result = await this.transporter.sendMail({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.body
    });

    return result.accepted.length > 0;
  }
}

export function getEmailProvider(): IEmailProvider {
  const hasSmtpPass = Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && hasSmtpPass) {
      try {
        return new ProductionEmailProvider();
      } catch {
        return new FakeEmailProvider();
      }
    }
    return new FakeEmailProvider();
  }
  return new ProductionEmailProvider();
}
