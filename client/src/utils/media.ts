import { API_BASE_URL } from '../api/client.js';

export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim().replace(/\\/g, '/');
  if (!trimmed) return null;

  // Handle data URIs or blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Handle full HTTP / HTTPS URLs (e.g. S3 / Supabase / Cloudinary / external CDNs)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const backendHost = API_BASE_URL.replace(/\/api$/, '');

  // Handle relative upload paths
  if (trimmed.startsWith('/uploads/')) {
    return `${backendHost}${trimmed}`;
  }

  if (trimmed.startsWith('uploads/')) {
    return `${backendHost}/${trimmed}`;
  }

  return `${backendHost}/${trimmed.replace(/^\/+/, '')}`;
}

export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackSrc?: string
) {
  const target = event.currentTarget;
  target.onerror = null; // Prevent infinite error loops
  if (fallbackSrc) {
    target.src = fallbackSrc;
  } else {
    // Default SVG avatar fallback
    target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%236366F1"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z"/></svg>';
  }
}
