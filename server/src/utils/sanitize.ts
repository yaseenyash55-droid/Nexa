/**
 * Input sanitization utilities to prevent Cross-Site Scripting (XSS),
 * script injection, and control character injection.
 */

export function sanitizeInputString(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    // Neutralize script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Neutralize dangerous inline event handlers (e.g. onerror=, onload=, onclick=)
    .replace(/on\w+\s*=\s*(['"]?).*?\1/gi, '')
    // Neutralize pseudo-protocol URLs (javascript:, data:text/html)
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    // Strip HTML tags for unformatted text
    .replace(/<[^>]*>/g, '')
    // Strip null characters and dangerous control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInputString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
