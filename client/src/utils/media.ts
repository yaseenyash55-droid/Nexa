const BACKEND_BASE_URL = 'https://nexa-backend-in6s.onrender.com';

export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Replace old cloudflare tunnel URLs with current backend domain
  if (trimmed.includes('trycloudflare.com')) {
    const parts = trimmed.split('/uploads/');
    if (parts.length === 2) {
      return `${BACKEND_BASE_URL}/uploads/${parts[1]}`;
    }
  }

  // Handle relative upload paths
  if (trimmed.startsWith('/uploads/')) {
    return `${BACKEND_BASE_URL}${trimmed}`;
  }

  if (trimmed.startsWith('uploads/')) {
    return `${BACKEND_BASE_URL}/${trimmed}`;
  }

  // Handle full HTTP / HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Handle data URIs if any exist
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  return `${BACKEND_BASE_URL}/${trimmed.replace(/^\/+/, '')}`;
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
