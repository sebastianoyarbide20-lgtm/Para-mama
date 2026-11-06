const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return moneyFormatter.format(n);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return numberFormatter.format(n);
}

/** Convierte lo que escribe la usuaria ("25.000", "25000,50", "$ 25000") a número. */
export function parseMoneyInput(text: string): number | null {
  const clean = text.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return null;
  let normalized = clean;
  if (clean.includes(',')) {
    // Formato argentino: los puntos son miles y la coma es decimal.
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    // "25.000" → 25000
    normalized = clean.replace(/\./g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
