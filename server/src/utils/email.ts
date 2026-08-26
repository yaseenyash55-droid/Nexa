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
        const errorText = await response.text().catch(() => '');
        console.error(`[BrevoEmailProvider] HTTP ${response.status} Error from Brevo API:`, errorText);
        logger.error(
          { status: response.status, body: errorText, to: message.to, subject: message.subject },
          '[BrevoEmailProvider] Brevo email API request failed'
        );
        throw new Error(`Brevo email API request failed with status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json().catch(() => ({}));
      console.log('[BrevoEmailProvider] Email accepted by Brevo API:', responseData);
      logger.info(
        { to: message.to, subject: message.subject, messageId: responseData?.messageId },
        '[BrevoEmailProvider] Email delivered successfully'
      );
      return true;
    } catch (err: any) {
      console.error('[BrevoEmailProvider] Dispatch exception:', err?.message || err);
      throw err;
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

      console.log('SMTP response:', result.response);
      console.log('Message accepted:', result.accepted, 'rejected:', result.rejected);

      const accepted = result.accepted.length > 0;
      if (accepted) {
        logger.info(
          { to: message.to, subject: message.subject, response: result.response, accepted: result.accepted },
          '[ProductionEmailProvider] SMTP email delivered successfully'
        );
      } else {
        logger.warn(
          { to: message.to, subject: message.subject, response: result.response, rejected: result.rejected },
          '[ProductionEmailProvider] SMTP email was rejected by server'
        );
      }
      return accepted;
    } catch (err: any) {
      console.error('SMTP SEND FAILED:', err);
      logger.error(
        {
          err,
          code: err?.code,
          command: err?.command,
          response: err?.response,
          responseCode: err?.responseCode,
          to: message.to,
          subject: message.subject
        },
        '[ProductionEmailProvider] Failed to dispatch SMTP email'
      );
      throw err;
    }
  }
}

export function getEmailProvider(): IEmailProvider {
  if (process.env.BREVO_API_KEY) {
    try {
      const provider = new BrevoEmailProvider();
      console.log('[EmailProvider] Active email provider: BrevoEmailProvider (HTTP API)');
      return provider;
    } catch (err) {
      console.warn('[EmailProvider] Failed to initialize BrevoEmailProvider, falling back to SMTP/Fake:', err);
      logger.warn({ err }, 'Failed to initialize BrevoEmailProvider, falling back to SMTP/Fake');
    }
  }

  const hasSmtpPass = Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  const user = process.env.SMTP_USER?.trim();
  const isConfigured = Boolean((process.env.SMTP_HOST || user?.endsWith('@gmail.com')) && user && hasSmtpPass);

  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') {
    if (isConfigured) {
      try {
        const provider = new ProductionEmailProvider();
        console.log('[EmailProvider] Active email provider: ProductionEmailProvider (SMTP)');
        return provider;
      } catch (err) {
        console.warn('[EmailProvider] Failed to initialize ProductionEmailProvider:', err);
        return new FakeEmailProvider();
      }
    }
    console.log('[EmailProvider] Active email provider: FakeEmailProvider (In-Memory Dev/Test)');
    return new FakeEmailProvider();
  }

  if (isConfigured) {
    try {
      const provider = new ProductionEmailProvider();
      console.log('[EmailProvider] Active email provider: ProductionEmailProvider (SMTP)');
      return provider;
    } catch (err) {
      console.error('[EmailProvider] Failed to initialize ProductionEmailProvider:', err);
      logger.error({ err }, 'Failed to initialize ProductionEmailProvider');
      return new FakeEmailProvider();
    }
  }

  console.log('[EmailProvider] Active email provider: FakeEmailProvider (No SMTP/Brevo configured)');
  return new FakeEmailProvider();
}
