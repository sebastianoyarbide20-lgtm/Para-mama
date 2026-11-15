import type { CatalogItem, MoneyConcept, MoneyKind, MoneyMovement, Session } from '../db/types';
import type { ChargeLine } from './finance';
import {
  addDays,
  addMonths,
  daysBetween,
  isBetween,
  monthLabel,
  shortDayLabel,
  startOfMonth,
  startOfWeek,
} from './dates';

/*
 * Economía: lo que entra (sesiones + otros ingresos cargados a mano) y lo que sale
 * (gastos del día a día e inversiones). Todo con cuentas simples: sumas y restas.
 */

export const KIND_LABEL: Record<MoneyKind, string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  inversion: 'Inversión',
};

export const KIND_PLURAL: Record<MoneyKind, string> = {
  ingreso: 'Otros ingresos',
  gasto: 'Gastos',
  inversion: 'Inversiones',
};

export function movementsInRange(movements: MoneyMovement[], from: string | null, to: string | null): MoneyMovement[] {
  return movements.filter((m) => isBetween(m.date, from, to));
}

/* ------------------------------ Resumen ------------------------------ */

export interface EconomySummary {
  /** Lo anotado en las sesiones (cobrado + lo que falta cobrar). */
  sessionsIncome: number;
  sessionsPending: number;
  sessions: number;
  /** Ingresos cargados a mano (ventas de cremas, etc.). */
  otherIncome: number;
  income: number;
  gastos: number;
  inversion: number;
  egresos: number;
  /** Ingresos − gastos − inversiones. */
  resultado: number;
  /** Ingresos − gastos (lo que deja el día a día, sin contar inversiones). */
  resultadoSinInversion: number;
  /** De cada $100 que entraron, cuántos quedaron. null si no entró nada. */
  keptPer100: number | null;
}

/** Totales de un período (las líneas y los movimientos ya vienen filtrados por fecha). */
export function economySummary(lines: ChargeLine[], movements: MoneyMovement[]): EconomySummary {
  let sessionsIncome = 0;
  let sessionsPending = 0;
  const sessionIds = new Set<number>();
  for (const l of lines) {
    sessionsIncome += l.amount;
    if (!l.paid) sessionsPending += l.amount;
    sessionIds.add(l.sessionId);
  }
  const sum = (kind: MoneyKind) => movements.filter((m) => m.kind === kind).reduce((a, m) => a + m.amount, 0);
  const otherIncome = sum('ingreso');
  const gastos = sum('gasto');
  const inversion = sum('inversion');
  const income = sessionsIncome + otherIncome;
  const egresos = gastos + inversion;
  const resultado = income - egresos;
  return {
    sessionsIncome,
    sessionsPending,
    sessions: sessionIds.size,
    otherIncome,
    income,
    gastos,
    inversion,
    egresos,
    resultado,
    resultadoSinInversion: income - gastos,
    keptPer100: income > 0 ? (resultado / income) * 100 : null,
  };
}

/* ------------------------------ Por período (acumulado) ------------------------------ */

export type EconomyGranularity = 'week' | 'month';

export interface EconomyRow {
  /** Inicio de la semana (lunes) o del mes. */
  key: string;
  /** Desde qué día cuenta: el inicio del período o el del filtro, el que sea posterior. */
  start: string;
  /** Hasta qué día cuenta. */
  end: string;
  label: string;
  sesiones: number;
  otrosIngresos: number;
  ingresos: number;
  gastos: number;
  inversion: number;
  egresos: number;
  resultado: number;
  /** Suma de los resultados desde el primer período mostrado hasta este. */
  acumulado: number;
}

function dataExtent(lines: ChargeLine[], movements: MoneyMovement[]): [string | undefined, string | undefined] {
  const dates = [...lines.map((l) => l.date), ...movements.map((m) => m.date)].sort();
  return [dates[0], dates[dates.length - 1]];
}

/** Semanas para rangos cortos (hasta 2 meses), meses para el resto. */
export function suggestEconomyGranularity(
  from: string | null,
  to: string | null,
  lines: ChargeLine[],
  movements: MoneyMovement[],
): EconomyGranularity {
  const [first, last] = dataExtent(lines, movements);
  const start = from ?? first;
  const end = to ?? last;
  if (!start || !end) return 'month';
  return daysBetween(start, end) <= 62 ? 'week' : 'month';
}

/** Ingresos, egresos y resultado por semana o por mes, con el acumulado. Completa los períodos vacíos. */
export function economySeries(
  lines: ChargeLine[],
  movements: MoneyMovement[],
  from: string | null,
  to: string | null,
  granularity: EconomyGranularity,
): EconomyRow[] {
  const inLines = lines.filter((l) => isBetween(l.date, from, to));
  const inMovements = movementsInRange(movements, from, to);
  const [first, last] = dataExtent(inLines, inMovements);
  const start = from ?? first;
  const end = to ?? last;
  if (!start || !end) return [];

  const bucketOf = granularity === 'week' ? startOfWeek : startOfMonth;
  const rows = new Map<string, EconomyRow>();
  let cursor = bucketOf(start);
  let guard = 0;
  while (cursor <= bucketOf(end) && guard++ < 600) {
    rows.set(cursor, {
      key: cursor,
      start: from && from > cursor ? from : cursor,
      end: '',
      label: granularity === 'week' ? shortDayLabel(from && from > cursor ? from : cursor) : monthLabel(cursor),
      sesiones: 0,
      otrosIngresos: 0,
      ingresos: 0,
      gastos: 0,
      inversion: 0,
      egresos: 0,
      resultado: 0,
      acumulado: 0,
    });
    cursor = granularity === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1);
  }
  for (const l of inLines) {
    const r = rows.get(bucketOf(l.date));
    if (r) r.sesiones += l.amount;
  }
  for (const m of inMovements) {
    const r = rows.get(bucketOf(m.date));
    if (!r) continue;
    if (m.kind === 'ingreso') r.otrosIngresos += m.amount;
    else if (m.kind === 'gasto') r.gastos += m.amount;
    else r.inversion += m.amount;
  }
  let running = 0;
  for (const r of rows.values()) {
    const last = granularity === 'week' ? addDays(r.key, 6) : addDays(addMonths(r.key, 1), -1);
    r.end = to && to < last ? to : last;
    r.ingresos = r.sesiones + r.otrosIngresos;
    r.egresos = r.gastos + r.inversion;
    r.resultado = r.ingresos - r.egresos;
    running += r.resultado;
    r.acumulado = running;
  }
  return [...rows.values()];
}

/* ------------------------------ Por concepto ------------------------------ */

export interface ConceptTotal {
  conceptId: number;
  name: string;
  kind: MoneyKind;
  total: number;
  count: number;
}

/** Total por concepto, de mayor a menor. */
export function totalsByConcept(movements: MoneyMovement[], conceptsById: Map<number, MoneyConcept>): ConceptTotal[] {
  const groups = new Map<number, ConceptTotal>();
  for (const m of movements) {
    const g = groups.get(m.conceptId) ?? {
      conceptId: m.conceptId,
      name: conceptsById.get(m.conceptId)?.name ?? 'Concepto eliminado',
      kind: m.kind,
      total: 0,
      count: 0,
    };
    g.total += m.amount;
    g.count++;
    groups.set(m.conceptId, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
}

/* ------------------------------ Productos ------------------------------ */

export interface ProductStat {
  productId: number;
  name: string;
  active: boolean;
  boughtQty: number;
  boughtAmount: number;
  purchases: number;
  soldQty: number;
  soldAmount: number;
  sales: number;
  /** Sesiones en las que se usó (y lo que se cobró por él en esas sesiones). */
  usedInSessions: number;
  sessionAmount: number;
  lastMovement: string | null;
}

/**
 * Para cada producto: cuánto se compró, cuánto se vendió y en cuántas sesiones se usó.
 * Si en un movimiento no se anotó la cantidad, cuenta como 1.
 */
export function productStats(
  products: CatalogItem[],
  movements: MoneyMovement[],
  sessions: Session[],
  productsCatalogId: number | undefined,
): ProductStat[] {
  const stats = new Map<number, ProductStat>(
    products.map((p) => [
      p.id!,
      {
        productId: p.id!,
        name: p.name,
        active: p.active,
        boughtQty: 0,
        boughtAmount: 0,
        purchases: 0,
        soldQty: 0,
        soldAmount: 0,
        sales: 0,
        usedInSessions: 0,
        sessionAmount: 0,
        lastMovement: null,
      },
    ]),
  );
  for (const m of movements) {
    const s = m.productId ? stats.get(m.productId) : undefined;
    if (!s) continue;
    const qty = m.quantity && m.quantity > 0 ? m.quantity : 1;
    if (m.kind === 'ingreso') {
      s.soldQty += qty;
      s.soldAmount += m.amount;
      s.sales++;
    } else {
      s.boughtQty += qty;
      s.boughtAmount += m.amount;
      s.purchases++;
    }
    if (!s.lastMovement || m.date > s.lastMovement) s.lastMovement = m.date;
  }
  if (productsCatalogId !== undefined) {
    const key = String(productsCatalogId);
    for (const session of sessions) {
      for (const sel of session.selections?.[key] ?? []) {
        const s = stats.get(sel.itemId);
        if (!s) continue;
        s.usedInSessions++;
        if (typeof sel.price === 'number') s.sessionAmount += sel.price;
      }
    }
  }
  return [...stats.values()];
}
