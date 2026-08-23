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

export class BrevoEmailProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY?.trim() || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || '';
    this.senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Nexa';

    if (!this.apiKey || !this.senderEmail) {
      throw new Error('Brevo configuration is incomplete. Required: BREVO_API_KEY and BREVO_SENDER_EMAIL.');
    }
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.body
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Brevo email API request failed with status ${response.status}`);
      }

      return true;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ProductionEmailProvider implements IEmailProvider {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor() {
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    const brevoSenderName = process.env.BREVO_SENDER_NAME?.trim();

    const host = process.env.SMTP_HOST?.trim() || (brevoApiKey ? 'smtp-relay.brevo.com' : undefined);
    const port = Number(process.env.SMTP_PORT || (brevoApiKey ? '587' : '465'));
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
    const user = process.env.SMTP_USER?.trim() || brevoSenderEmail;
    const password = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim() || brevoApiKey;
    
    let from = process.env.SMTP_FROM?.trim();
    if (!from && brevoSenderEmail) {
      from = brevoSenderName ? `"${brevoSenderName}" <${brevoSenderEmail}>` : brevoSenderEmail;
    } else if (!from) {
      from = user;
    }

    if (!host || !user || !password || !from) {
      throw new Error(
        'SMTP configuration is incomplete. Required: SMTP_HOST, SMTP_USER, (SMTP_PASSWORD or SMTP_PASS) and SMTP_FROM, or BREVO_API_KEY and BREVO_SENDER_EMAIL.'
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
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
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
  if (process.env.BREVO_API_KEY) {
    return new BrevoEmailProvider();
  }

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
