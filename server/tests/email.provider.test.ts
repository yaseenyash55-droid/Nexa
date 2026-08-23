import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrevoEmailProvider, getEmailProvider } from '../src/utils/email.js';

describe('Brevo HTTPS email provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
  });

  it('sends transactional email through the HTTPS API without SMTP', async () => {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.BREVO_SENDER_EMAIL = 'verified@example.com';
    process.env.BREVO_SENDER_NAME = 'Nexa';

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetchMock);

    const provider = getEmailProvider();
    expect(provider).toBeInstanceOf(BrevoEmailProvider);

    await expect(provider.sendEmail({
      to: 'user@example.com',
      subject: 'Reset password',
      body: 'Open the reset link.'
    })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      sender: { name: 'Nexa', email: 'verified@example.com' },
      to: [{ email: 'user@example.com' }],
      subject: 'Reset password'
    });
  });

  it('fails closed when the API rejects the request', async () => {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.BREVO_SENDER_EMAIL = 'verified@example.com';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const provider = new BrevoEmailProvider();
    await expect(provider.sendEmail({
      to: 'user@example.com',
      subject: 'Reset password',
      body: 'Open the reset link.'
    })).rejects.toThrow('Brevo email API request failed with status 401');
  });
});
