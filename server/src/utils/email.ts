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
  async sendEmail(message: EmailMessage): Promise<boolean> {
    if (!process.env.SMTP_HOST) {
      throw new Error('Production email provider is not configured. Email delivery failed closed.');
    }
    return true;
  }
}

export function getEmailProvider(): IEmailProvider {
  return env.NODE_ENV === 'test' ? new FakeEmailProvider() : new ProductionEmailProvider();
}
