import type { CatalogItem, Client, Session } from '../db/types';
import {
  addDays,
  daysBetween,
  isBetween,
  monthLabel,
  shortDayLabel,
  startOfMonth,
  startOfWeek,
  todayISO,
  addMonths,
} from './dates';

/* ----------------------------- Orden de sesiones ---------------------------- */

export function compareSessions(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.time || '';
  const tb = b.time || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Más recientes primero. */
export function sortSessionsDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => compareSessions(b, a));
}

/* ------------------------------ Por clienta -------------------------------- */

export interface ClientStat {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  lastSessionId: number | null;
  /** Próxima sesión sugerida en la última sesión registrada. */
  nextSessionDate: string | null;
  totalSpent: number;
  unpaid: number;
}

export const EMPTY_CLIENT_STAT: ClientStat = {
  count: 0,
  firstDate: null,
  lastDate: null,
  lastSessionId: null,
  nextSessionDate: null,
  totalSpent: 0,
  unpaid: 0,
};

export function computeClientStats(sessions: Session[]): Map<number, ClientStat> {
  const byClient = new Map<number, Session[]>();
  for (const s of sessions) {
    const list = byClient.get(s.clientId);
    if (list) list.push(s);
    else byClient.set(s.clientId, [s]);
  }
  const result = new Map<number, ClientStat>();
  for (const [clientId, list] of byClient) {
    list.sort(compareSessions);
    const last = list[list.length - 1]!;
    let totalSpent = 0;
    let unpaid = 0;
    for (const s of list) {
      if (typeof s.price === 'number') {
        if (s.paid) totalSpent += s.price;
        else unpaid += s.price;
      }
    }
    result.set(clientId, {
      count: list.length,
      firstDate: list[0]!.date,
      lastDate: last.date,
      lastSessionId: last.id ?? null,
      nextSessionDate: last.nextSessionDate || null,
      totalSpent,
      unpaid,
    });
  }
  return result;
}

export function isInactive(stat: ClientStat | undefined, inactiveDays: number, today = todayISO()): boolean {
  if (!stat?.lastDate) return false;
  return daysBetween(stat.lastDate, today) > inactiveDays;
}

export type NextStatus = 'pendiente' | 'vencida' | null;

export function nextSessionStatus(stat: ClientStat | undefined, today = todayISO()): NextStatus {
  if (!stat?.nextSessionDate) return null;
  return stat.nextSessionDate >= today ? 'pendiente' : 'vencida';
}

/** Promedio de días entre visitas (null si hay menos de 2 sesiones). */
export function averageDaysBetweenVisits(sessions: Session[]): number | null {
  const dates = [...new Set(sessions.map((s) => s.date))].sort();
  if (dates.length < 2) return null;
  const total = daysBetween(dates[0]!, dates[dates.length - 1]!);
  return total / (dates.length - 1);
}

/* ------------------------------ Rankings ----------------------------------- */

export interface RankingRow {
  id: number;
  name: string;
  count: number;
}

export function countSelections(sessions: Session[], catalogId: number): Map<number, number> {
  const counts = new Map<number, number>();
  const key = String(catalogId);
  for (const s of sessions) {
    const selected = s.selections?.[key];
    if (!selected) continue;
    for (const sel of selected) counts.set(sel.itemId, (counts.get(sel.itemId) ?? 0) + 1);
  }
  return counts;
}

export function ranking(
  sessions: Session[],
  catalogId: number,
  itemsById: Map<number, CatalogItem>,
  limit = 10,
): RankingRow[] {
  const counts = countSelections(sessions, catalogId);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: itemsById.get(id)?.name ?? 'Ítem eliminado', count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}

/* ------------------------------ Indicadores -------------------------------- */

export interface Kpis {
  totalSessions: number;
  activeClients: number;
  newClients: number;
  income: number;
  collected: number;
  pending: number;
  sessionsWithPrice: number;
  avgSessionsPerClient: number | null;
}

export function filterSessionsByRange(sessions: Session[], from: string | null, to: string | null): Session[] {
  return sessions.filter((s) => isBetween(s.date, from, to));
}

export function computeKpis(allSessions: Session[], from: string | null, to: string | null): Kpis {
  const inRange = filterSessionsByRange(allSessions, from, to);
  const active = new Set(inRange.map((s) => s.clientId));

  // Clienta nueva = su primera sesión cae dentro del período.
  const firstDates = new Map<number, string>();
  for (const s of allSessions) {
    const prev = firstDates.get(s.clientId);
    if (!prev || s.date < prev) firstDates.set(s.clientId, s.date);
  }
  let newClients = 0;
  for (const first of firstDates.values()) if (isBetween(first, from, to)) newClients++;

  let income = 0;
  let collected = 0;
  let sessionsWithPrice = 0;
  for (const s of inRange) {
    if (typeof s.price === 'number') {
      income += s.price;
      sessionsWithPrice++;
      if (s.paid) collected += s.price;
    }
  }
  return {
    totalSessions: inRange.length,
    activeClients: active.size,
    newClients,
    income,
    collected,
    pending: income - collected,
    sessionsWithPrice,
    avgSessionsPerClient: active.size ? inRange.length / active.size : null,
  };
}

/* ------------------------------ Series de tiempo --------------------------- */

export type Granularity = 'week' | 'month';

export interface TimePoint {
  key: string;
  label: string;
  sesiones: number;
  ingresos: number;
  cobrado: number;
}

export function timeSeries(
  sessions: Session[],
  from: string | null,
  to: string | null,
  granularity: Granularity,
): TimePoint[] {
  const inRange = filterSessionsByRange(sessions, from, to);
  const dates = inRange.map((s) => s.date).sort();
  const start = from ?? dates[0];
  const end = to ?? dates[dates.length - 1] ?? todayISO();
  if (!start) return [];

  const bucketOf = granularity === 'week' ? startOfWeek : startOfMonth;
  const points = new Map<string, TimePoint>();
  let cursor = bucketOf(start);
  const last = bucketOf(end);
  let guard = 0;
  while (cursor <= last && guard < 600) {
    points.set(cursor, {
      key: cursor,
      label: granularity === 'week' ? shortDayLabel(cursor) : monthLabel(cursor),
      sesiones: 0,
      ingresos: 0,
      cobrado: 0,
    });
    cursor = granularity === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1);
    guard++;
  }
  for (const s of inRange) {
    const p = points.get(bucketOf(s.date));
    if (!p) continue;
    p.sesiones++;
    if (typeof s.price === 'number') {
      p.ingresos += s.price;
      if (s.paid) p.cobrado += s.price;
    }
  }
  return [...points.values()];
}

/** Sugiere semanas para rangos cortos y meses para rangos largos. */
export function suggestGranularity(from: string | null, to: string | null, sessions: Session[]): Granularity {
  const dates = sessions.map((s) => s.date).sort();
  const start = from ?? dates[0];
  const end = to ?? dates[dates.length - 1];
  if (!start || !end) return 'month';
  return daysBetween(start, end) <= 92 ? 'week' : 'month';
}

/* ------------------------------ Distribuciones ----------------------------- */

export interface SliceRow {
  id: number | null;
  name: string;
  value: number;
}

export function skinTypeDistribution(clients: Client[], itemsById: Map<number, CatalogItem>): SliceRow[] {
  const counts = new Map<number | null, number>();
  for (const c of clients) {
    const k = c.skinTypeId ?? null;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, value]) => ({
      id,
      name: id === null ? 'Sin cargar' : (itemsById.get(id)?.name ?? 'Sin cargar'),
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

/* ------------------------------ Análisis cruzado --------------------------- */

export interface CrossRow {
  id: number | null;
  name: string;
  /** Cantidad de sesiones del grupo. */
  sessions: number;
  top: RankingRow[];
}

/** Para cada tipo de piel: qué ítems de un catálogo se usan más. */
export function crossBySkinType(
  sessions: Session[],
  clientsById: Map<number, Client>,
  catalogId: number,
  itemsById: Map<number, CatalogItem>,
  topN = 4,
): CrossRow[] {
  const groups = new Map<number | null, Session[]>();
  for (const s of sessions) {
    const skin = clientsById.get(s.clientId)?.skinTypeId ?? null;
    const list = groups.get(skin);
    if (list) list.push(s);
    else groups.set(skin, [s]);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({
      id,
      name: id === null ? 'Sin tipo de piel' : (itemsById.get(id)?.name ?? 'Sin tipo de piel'),
      sessions: list.length,
      top: ranking(list, catalogId, itemsById, topN),
    }))
    .filter((r) => r.top.length > 0)
    .sort((a, b) => b.sessions - a.sessions);
}

/** Para cada ítem del catálogo A: qué ítems del catálogo B aparecen en las mismas sesiones. */
export function crossCatalogs(
  sessions: Session[],
  catalogAId: number,
  catalogBId: number,
  itemsById: Map<number, CatalogItem>,
  topN = 4,
  limitRows = 8,
): CrossRow[] {
  const keyA = String(catalogAId);
  const groups = new Map<number, Session[]>();
  for (const s of sessions) {
    for (const sel of s.selections?.[keyA] ?? []) {
      const list = groups.get(sel.itemId);
      if (list) list.push(s);
      else groups.set(sel.itemId, [s]);
    }
  }
  return [...groups.entries()]
    .map(([id, list]) => ({
      id,
      name: itemsById.get(id)?.name ?? 'Ítem eliminado',
      sessions: list.length,
      top: ranking(list, catalogBId, itemsById, topN),
    }))
    .filter((r) => r.top.length > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limitRows);
}
