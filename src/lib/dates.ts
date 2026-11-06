/** Utilidades de fechas. Internamente se guardan como "aaaa-mm-dd" (hora local). */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convierte "aaaa-mm-dd" a Date en hora local (sin corrimientos por zona horaria). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidISODate(iso: string | undefined | null): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime());
}

/** dd/mm/aaaa */
export function formatDate(iso: string | undefined | null): string {
  if (!isValidISODate(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Fecha de un ISO con hora (ej: createdAt) en dd/mm/aaaa. */
export function formatDateTime(isoDateTime: string | undefined | null): string {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const longFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "jueves 6 de noviembre de 2026" */
export function formatDateLong(iso: string): string {
  if (!isValidISODate(iso)) return '';
  return longFormatter.format(parseISODate(iso));
}

const weekdayFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'long' });
export function weekdayName(iso: string): string {
  if (!isValidISODate(iso)) return '';
  return weekdayFormatter.format(parseISODate(iso));
}

/** Diferencia en días entre dos fechas ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(iso: string, n: number): string {
  const d = parseISODate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISODate(d);
}

/** "hoy", "ayer", "hace 5 días", "en 3 días", "hace 2 meses"… */
export function relativeDays(iso: string, today = todayISO()): string {
  if (!isValidISODate(iso)) return '';
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'hoy';
  if (diff === -1) return 'ayer';
  if (diff === 1) return 'mañana';
  const abs = Math.abs(diff);
  let text: string;
  if (abs < 31) text = `${abs} días`;
  else if (abs < 365) {
    const months = Math.round(abs / 30.4);
    text = months === 1 ? '1 mes' : `${months} meses`;
  } else {
    const years = Math.floor(abs / 365);
    text = years === 1 ? 'más de 1 año' : `más de ${years} años`;
  }
  return diff < 0 ? `hace ${text}` : `en ${text}`;
}

export function ageFromBirthDate(birthDate: string, today = todayISO()): number | null {
  if (!isValidISODate(birthDate)) return null;
  const b = parseISODate(birthDate);
  const t = parseISODate(today);
  let age = t.getFullYear() - b.getFullYear();
  const beforeBirthday = t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Lunes de la semana de la fecha dada. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "nov 26" */
export function monthLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** "03/11" */
export function shortDayLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function isBetween(iso: string, from: string | null, to: string | null): boolean {
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
