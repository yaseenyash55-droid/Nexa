import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface IEmailProvider {
  sendEmail(message: EmailMessage): Promise<boolean>;
}

export class FakeEmailProvider implements IEmailProvider {
  public sentEmails: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<boolean> {
    this.sentEmails.push(message);
    logger.info({ to: message.to, subject: message.subject }, '[FakeEmailProvider] Simulated email dispatched');
    return true;
  }
}

function normalizeBrevoApiKey(rawKey?: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();
  if (trimmed.startsWith('xkeysib-') || trimmed.startsWith('xsmtpsib-')) {
    return trimmed;
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.includes('api_key') || decoded.includes('{')) {
      const parsed = JSON.parse(decoded);
      if (parsed.api_key && typeof parsed.api_key === 'string') {
        return parsed.api_key.trim();
      }
    }
  } catch {}

  try {
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.api_key && typeof parsed.api_key === 'string') {
        return parsed.api_key.trim();
      }
    }
  } catch {}

  return trimmed;
}

export class BrevoEmailProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor() {
    this.apiKey = normalizeBrevoApiKey(process.env.BREVO_API_KEY);
    this.senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.SMTP_USER?.trim() || 'nexadoomsorb@gmail.com';
    this.senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Nexa Social';

    if (!this.apiKey || !this.senderEmail) {
      throw new Error('Brevo configuration is incomplete. Required: BREVO_API_KEY and BREVO_SENDER_EMAIL.');
    }
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const payload: Record<string, any> = {
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.body
      };

      if (message.html) {
        payload.htmlContent = message.html;
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Brevo email API request failed with status ${response.status}`);
      }

      logger.info({ to: message.to, subject: message.subject }, '[BrevoEmailProvider] Email delivered successfully');
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

    const user = process.env.SMTP_USER?.trim() || brevoSenderEmail || 'nexadoomsorb@gmail.com';
    const isGmail = user.toLowerCase().endsWith('@gmail.com');

    const host = process.env.SMTP_HOST?.trim() || (isGmail ? 'smtp.gmail.com' : brevoApiKey ? 'smtp-relay.brevo.com' : undefined);
    const port = Number(process.env.SMTP_PORT || (isGmail ? '465' : brevoApiKey ? '587' : '465'));
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
    
    const password = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim() || brevoApiKey;
    
    let from = process.env.SMTP_FROM?.trim();
    if (!from && brevoSenderEmail) {
      from = brevoSenderName ? `"${brevoSenderName}" <${brevoSenderEmail}>` : brevoSenderEmail;
    } else if (!from && isGmail) {
      from = `"Nexa Security" <${user}>`;
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
    try {
      const result = await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.body,
        html: message.html || undefined
      });

      const accepted = result.accepted.length > 0;
      if (accepted) {
        logger.info({ to: message.to, subject: message.subject }, '[ProductionEmailProvider] SMTP email delivered');
      } else {
        logger.warn({ to: message.to, subject: message.subject, result }, '[ProductionEmailProvider] SMTP email rejected');
      }
      return accepted;
    } catch (err) {
      logger.error({ err, to: message.to, subject: message.subject }, '[ProductionEmailProvider] Failed to dispatch SMTP email');
      throw err;
    }
  }
}

export function getEmailProvider(): IEmailProvider {
  if (process.env.BREVO_API_KEY) {
    try {
      return new BrevoEmailProvider();
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize BrevoEmailProvider, falling back to SMTP/Fake');
    }
  }

  const hasSmtpPass = Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  const user = process.env.SMTP_USER?.trim();
  const isConfigured = Boolean((process.env.SMTP_HOST || user?.endsWith('@gmail.com')) && user && hasSmtpPass);

  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
    if (isConfigured) {
      try {
        return new ProductionEmailProvider();
      } catch {
        return new FakeEmailProvider();
      }
    }
    return new FakeEmailProvider();
  }

  if (isConfigured) {
    try {
      return new ProductionEmailProvider();
    } catch (err) {
      logger.error({ err }, 'Failed to initialize ProductionEmailProvider');
      return new FakeEmailProvider();
    }
  }

  return new FakeEmailProvider();
}
