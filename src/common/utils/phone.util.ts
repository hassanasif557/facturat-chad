export function normalizePhoneE164(phone?: string | null): string | null {
  if (!phone) return null;

  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function maskPhone(phone?: string | null): string {
  const normalized = normalizePhoneE164(phone || '');
  if (!normalized) return '';

  const tail = normalized.slice(-2);
  return `${normalized.slice(0, 4)} ** ** ** ${tail}`;
}
