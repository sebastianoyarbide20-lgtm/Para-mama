import { describe, expect, it } from 'vitest';
import type { CatalogItem, MoneyConcept, MoneyMovement, Session } from '../db/types';
import type { ChargeLine } from './finance';
import {
  economySeries,
  economySummary,
  movementsInRange,
  productStats,
  suggestEconomyGranularity,
  totalsByConcept,
} from './economy';

function line(p: Partial<ChargeLine> & Pick<ChargeLine, 'sessionId' | 'date' | 'amount'>): ChargeLine {
  return {
    clientId: 1,
    catalogId: 1,
    itemId: 10,
    key: '1:10',
    name: 'Limpieza',
    catalogName: 'Tratamientos',
    paid: true,
    ...p,
  };
}

function movement(p: Partial<MoneyMovement> & Pick<MoneyMovement, 'kind' | 'date' | 'amount'>): MoneyMovement {
  return {
    conceptId: 1,
    description: '',
    productId: null,
    quantity: null,
    clientId: null,
    createdAt: '',
    updatedAt: '',
    ...p,
  };
}

const lines = [
  line({ sessionId: 1, date: '2026-01-10', amount: 20000 }),
  line({ sessionId: 1, date: '2026-01-10', amount: 5000, key: '2:20' }),
  line({ sessionId: 2, date: '2026-02-03', amount: 30000, paid: false }),
];
const movements = [
  movement({ kind: 'ingreso', date: '2026-01-15', amount: 15000, conceptId: 1 }),
  movement({ kind: 'gasto', date: '2026-01-05', amount: 10000, conceptId: 2 }),
  movement({ kind: 'gasto', date: '2026-02-05', amount: 12000, conceptId: 2 }),
  movement({ kind: 'gasto', date: '2026-02-20', amount: 3000, conceptId: 3 }),
  movement({ kind: 'inversion', date: '2026-02-10', amount: 60000, conceptId: 4 }),
];

describe('economySummary', () => {
  it('suma ingresos (sesiones + otros) y egresos (gastos + inversiones)', () => {
    const s = economySummary(lines, movements);
    expect(s.sessionsIncome).toBe(55000);
    expect(s.sessionsPending).toBe(30000);
    expect(s.sessions).toBe(2);
    expect(s.otherIncome).toBe(15000);
    expect(s.income).toBe(70000);
    expect(s.gastos).toBe(25000);
    expect(s.inversion).toBe(60000);
    expect(s.egresos).toBe(85000);
    expect(s.resultado).toBe(-15000);
    expect(s.resultadoSinInversion).toBe(45000);
    expect(s.keptPer100).toBeCloseTo((-15000 / 70000) * 100);
  });

  it('sin ingresos no calcula "de cada $100"', () => {
    const s = economySummary([], [movement({ kind: 'gasto', date: '2026-01-01', amount: 500 })]);
    expect(s.keptPer100).toBeNull();
    expect(s.resultado).toBe(-500);
  });
});

describe('economySeries', () => {
  it('agrupa por mes y lleva el acumulado', () => {
    const rows = economySeries(lines, movements, '2026-01-01', '2026-03-31', 'month');
    expect(rows.map((r) => r.key)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    const [jan, feb, mar] = rows;
    expect(jan).toMatchObject({
      sesiones: 25000,
      otrosIngresos: 15000,
      ingresos: 40000,
      gastos: 10000,
      resultado: 30000,
    });
    expect(feb).toMatchObject({ sesiones: 30000, gastos: 15000, inversion: 60000, egresos: 75000, resultado: -45000 });
    expect(jan!.acumulado).toBe(30000);
    expect(feb!.acumulado).toBe(-15000);
    expect(mar).toMatchObject({ ingresos: 0, egresos: 0, resultado: 0, acumulado: -15000 });
  });

  it('sin fechas usa desde el primer hasta el último movimiento', () => {
    const rows = economySeries(lines, movements, null, null, 'month');
    expect(rows.map((r) => r.key)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('cada fila dice desde y hasta qué día cuenta (respetando el filtro)', () => {
    // El 1/11/2026 es domingo: su semana empieza el lunes 26/10, pero se cuenta desde el 1/11.
    const rows = economySeries([], [], '2026-11-01', '2026-11-15', 'week');
    expect(rows[0]).toMatchObject({ key: '2026-10-26', start: '2026-11-01', end: '2026-11-01' });
    expect(rows[rows.length - 1]).toMatchObject({ key: '2026-11-09', start: '2026-11-09', end: '2026-11-15' });
    const months = economySeries(lines, movements, null, null, 'month');
    expect(months[1]).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('respeta el período (deja afuera lo de otras fechas)', () => {
    const rows = economySeries(lines, movements, '2026-02-01', '2026-02-28', 'week');
    expect(rows.reduce((a, r) => a + r.ingresos, 0)).toBe(30000);
    expect(rows.reduce((a, r) => a + r.egresos, 0)).toBe(75000);
  });

  it('sin datos no devuelve filas', () => {
    expect(economySeries([], [], null, null, 'month')).toEqual([]);
  });
});

describe('suggestEconomyGranularity', () => {
  it('semanas para rangos cortos y meses para largos', () => {
    expect(suggestEconomyGranularity('2026-01-01', '2026-01-31', [], [])).toBe('week');
    expect(suggestEconomyGranularity('2026-01-01', '2026-12-31', [], [])).toBe('month');
    expect(suggestEconomyGranularity(null, null, lines, movements)).toBe('week');
  });
});

describe('totalsByConcept', () => {
  it('total por concepto de mayor a menor', () => {
    const concepts = new Map<number, MoneyConcept>([
      [2, { id: 2, kind: 'gasto', name: 'Alquiler', active: true, order: 1, createdAt: '' }],
      [3, { id: 3, kind: 'gasto', name: 'Publicidad', active: true, order: 2, createdAt: '' }],
    ]);
    const rows = totalsByConcept(
      movements.filter((m) => m.kind === 'gasto'),
      concepts,
    );
    expect(rows).toEqual([
      { conceptId: 2, name: 'Alquiler', kind: 'gasto', total: 22000, count: 2 },
      { conceptId: 3, name: 'Publicidad', kind: 'gasto', total: 3000, count: 1 },
    ]);
  });
});

describe('productStats', () => {
  it('compras, ventas y uso en sesiones de cada producto', () => {
    const products: CatalogItem[] = [
      { id: 30, catalogId: 3, name: 'Protector solar', active: true, createdAt: '' },
      { id: 31, catalogId: 3, name: 'Vitamina C', active: true, createdAt: '' },
    ];
    const ms = [
      movement({ kind: 'gasto', date: '2026-01-02', amount: 27000, productId: 30, quantity: 3 }),
      movement({ kind: 'ingreso', date: '2026-01-20', amount: 16000, productId: 30, quantity: 1 }),
      movement({ kind: 'ingreso', date: '2026-02-01', amount: 32000, productId: 30, quantity: null }),
      movement({ kind: 'gasto', date: '2026-02-01', amount: 999, productId: 99, quantity: 1 }),
    ];
    const sessions = [
      { id: 1, selections: { '3': [{ itemId: 31, price: 4000 }, { itemId: 30 }] } },
      { id: 2, selections: { '3': [{ itemId: 31, price: 0 }] } },
    ] as unknown as Session[];
    const [sun, vitC] = productStats(products, ms, sessions, 3);
    expect(sun).toMatchObject({
      boughtQty: 3,
      boughtAmount: 27000,
      purchases: 1,
      soldQty: 2,
      soldAmount: 48000,
      sales: 2,
      usedInSessions: 1,
      lastMovement: '2026-02-01',
    });
    expect(vitC).toMatchObject({
      boughtQty: 0,
      soldQty: 0,
      usedInSessions: 2,
      sessionAmount: 4000,
      lastMovement: null,
    });
  });
});

describe('movementsInRange', () => {
  it('filtra por fecha incluyendo los extremos', () => {
    expect(movementsInRange(movements, '2026-02-05', '2026-02-10')).toHaveLength(2);
  });
});
