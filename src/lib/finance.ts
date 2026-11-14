import type { Catalog, CatalogItem, Selections, Session } from '../db/types';
import { addDays, addMonths, isBetween, monthLabel, shortDayLabel, startOfMonth, startOfWeek } from './dates';

/*
 * Ingresos. No hay precios fijos: en cada sesión se anota cuánto se le cobró a esa clienta
 * por cada opción elegida (tratamiento, aparato, producto…). El total de la sesión es la suma
 * de esos montos más "otros cobros".
 */

/* ------------------------------ Totales ------------------------------ */

/** Suma de los montos anotados en la sesión. null si no se anotó ningún monto. */
export function computeSessionTotal(selections: Selections, extraCharge: number | null): number | null {
  let total = 0;
  let any = false;
  for (const list of Object.values(selections ?? {})) {
    for (const sel of list) {
      if (typeof sel.price === 'number') {
        total += sel.price;
        any = true;
      }
    }
  }
  if (typeof extraCharge === 'number') {
    total += extraCharge;
    any = true;
  }
  return any ? total : null;
}

/* ------------------------------ Migración ------------------------------ */

const LEGACY_NOTE = 'Total de la sesión (sin detallar)';

/** Catálogo guardado con una versión anterior: agrega "allowPrice". */
export function normalizeCatalog(raw: Record<string, unknown>): Catalog {
  const c = raw as unknown as Catalog;
  if (typeof raw.allowPrice === 'boolean') return c;
  return { ...c, allowPrice: raw.key !== 'skinTypes' && raw.key !== 'custom-zonas-ejemplo' };
}

/**
 * Sesión guardada con una versión anterior: el monto total que tenía (sin detalle por opción)
 * pasa a "otros cobros", así no se pierde y sigue sumando en los ingresos.
 */
export function normalizeSession(raw: Record<string, unknown>): Session {
  const s = raw as unknown as Session;
  if ('extraCharge' in raw) return s;
  const hasItemPrices = Object.values(s.selections ?? {}).some((l) => l.some((x) => typeof x.price === 'number'));
  const legacy = typeof s.price === 'number' && !hasItemPrices ? s.price : null;
  return { ...s, extraCharge: legacy, extraChargeNote: legacy !== null ? LEGACY_NOTE : '' };
}

/* ------------------------------ Líneas de cobro ------------------------------ */

export interface ChargeLine {
  sessionId: number;
  date: string;
  clientId: number;
  /** null = "otros cobros" de la sesión */
  catalogId: number | null;
  itemId: number | null;
  /** clave para agrupar: "catálogo:ítem" u "otros" */
  key: string;
  name: string;
  catalogName: string;
  amount: number;
  paid: boolean;
}

export const OTHER_KEY = 'otros';

/** Cada monto cobrado, como una línea (una por opción con precio, más "otros cobros"). */
export function chargeLines(
  sessions: Session[],
  catalogsById: Map<number, Catalog>,
  itemsById: Map<number, CatalogItem>,
): ChargeLine[] {
  const lines: ChargeLine[] = [];
  for (const s of sessions) {
    if (s.id === undefined) continue;
    for (const [catKey, list] of Object.entries(s.selections ?? {})) {
      const catalogId = Number(catKey);
      const catalog = catalogsById.get(catalogId);
      for (const sel of list) {
        if (typeof sel.price !== 'number') continue;
        lines.push({
          sessionId: s.id,
          date: s.date,
          clientId: s.clientId,
          catalogId,
          itemId: sel.itemId,
          key: `${catalogId}:${sel.itemId}`,
          name: itemsById.get(sel.itemId)?.name ?? 'Ítem eliminado',
          catalogName: catalog?.name ?? 'Lista eliminada',
          amount: sel.price,
          paid: s.paid,
        });
      }
    }
    if (typeof s.extraCharge === 'number') {
      lines.push({
        sessionId: s.id,
        date: s.date,
        clientId: s.clientId,
        catalogId: null,
        itemId: null,
        key: OTHER_KEY,
        name: 'Otros cobros',
        catalogName: 'Otros cobros',
        amount: s.extraCharge,
        paid: s.paid,
      });
    }
  }
  return lines;
}

export interface MoneySummary {
  total: number;
  collected: number;
  pending: number;
  /** cantidad de sesiones distintas con algún cobro */
  sessions: number;
  clients: number;
  lines: number;
}

export function summarize(lines: ChargeLine[]): MoneySummary {
  let total = 0;
  let collected = 0;
  const sessions = new Set<number>();
  const clients = new Set<number>();
  for (const l of lines) {
    total += l.amount;
    if (l.paid) collected += l.amount;
    sessions.add(l.sessionId);
    clients.add(l.clientId);
  }
  return {
    total,
    collected,
    pending: total - collected,
    sessions: sessions.size,
    clients: clients.size,
    lines: lines.length,
  };
}

export function linesInRange(lines: ChargeLine[], from: string | null, to: string | null): ChargeLine[] {
  return lines.filter((l) => isBetween(l.date, from, to));
}

/* ------------------------------ Agrupaciones ------------------------------ */

export interface ItemIncome {
  key: string;
  catalogId: number | null;
  itemId: number | null;
  name: string;
  catalogName: string;
  count: number;
  total: number;
  pending: number;
  avg: number;
  min: number;
  max: number;
  clients: number;
}

/** Ingresos por opción (tratamiento, aparato, producto…), de mayor a menor. */
export function incomeByItem(lines: ChargeLine[]): ItemIncome[] {
  const groups = new Map<string, ChargeLine[]>();
  for (const l of lines) {
    const g = groups.get(l.key);
    if (g) g.push(l);
    else groups.set(l.key, [l]);
  }
  return [...groups.values()]
    .map((g) => {
      const amounts = g.map((l) => l.amount);
      const total = amounts.reduce((a, b) => a + b, 0);
      const first = g[0]!;
      return {
        key: first.key,
        catalogId: first.catalogId,
        itemId: first.itemId,
        name: first.name,
        catalogName: first.catalogName,
        count: g.length,
        total,
        pending: g.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0),
        avg: total / g.length,
        min: Math.min(...amounts),
        max: Math.max(...amounts),
        clients: new Set(g.map((l) => l.clientId)).size,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
}

export interface ClientIncome {
  clientId: number;
  sessions: number;
  total: number;
  pending: number;
}

export function incomeByClient(lines: ChargeLine[]): ClientIncome[] {
  const groups = new Map<number, { sessions: Set<number>; total: number; pending: number }>();
  for (const l of lines) {
    const g = groups.get(l.clientId) ?? { sessions: new Set<number>(), total: 0, pending: 0 };
    g.sessions.add(l.sessionId);
    g.total += l.amount;
    if (!l.paid) g.pending += l.amount;
    groups.set(l.clientId, g);
  }
  return [...groups.entries()]
    .map(([clientId, g]) => ({ clientId, sessions: g.sessions.size, total: g.total, pending: g.pending }))
    .sort((a, b) => b.total - a.total);
}

export interface MoneyPoint {
  key: string;
  label: string;
  total: number;
  collected: number;
}

/** Ingresos por semana o por mes, completando los períodos sin cobros. */
export function moneySeries(
  lines: ChargeLine[],
  from: string | null,
  to: string | null,
  granularity: 'week' | 'month',
): MoneyPoint[] {
  const dates = lines.map((l) => l.date).sort();
  const start = from ?? dates[0];
  const end = to ?? dates[dates.length - 1];
  if (!start || !end) return [];
  const bucketOf = granularity === 'week' ? startOfWeek : startOfMonth;
  const points = new Map<string, MoneyPoint>();
  let cursor = bucketOf(start);
  let guard = 0;
  while (cursor <= bucketOf(end) && guard++ < 600) {
    points.set(cursor, {
      key: cursor,
      label: granularity === 'week' ? shortDayLabel(cursor) : monthLabel(cursor),
      total: 0,
      collected: 0,
    });
    cursor = granularity === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1);
  }
  for (const l of lines) {
    const p = points.get(bucketOf(l.date));
    if (!p) continue;
    p.total += l.amount;
    if (l.paid) p.collected += l.amount;
  }
  return [...points.values()];
}

/** Variación porcentual (null si no hay base para comparar). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Último monto cobrado a una clienta por una opción (para sugerirlo, nunca como precio fijo). */
export function lastPriceForClient(
  sessions: Session[],
  clientId: number,
  catalogId: number,
  itemId: number,
  excludeSessionId?: number | null,
): { price: number; date: string } | null {
  let best: { price: number; date: string } | null = null;
  const key = String(catalogId);
  for (const s of sessions) {
    if (s.clientId !== clientId || s.id === excludeSessionId) continue;
    const sel = s.selections?.[key]?.find((x) => x.itemId === itemId);
    if (sel && typeof sel.price === 'number' && (!best || s.date > best.date))
      best = { price: sel.price, date: s.date };
  }
  return best;
}
