export function canonicalJobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function jobUrlVariants(url: string): string[] {
  const trimmed = url.trim();
  const canonical = canonicalJobUrl(trimmed);
  return [...new Set([trimmed, canonical].filter((value): value is string => Boolean(value)))];
}

export function sqlPlaceholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}
