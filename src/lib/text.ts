/** Normaliza texto para búsquedas: minúsculas y sin tildes. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function matches(text: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(text);
  return q.split(/\s+/).every((part) => t.includes(part));
}

export function compareEs(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
