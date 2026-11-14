import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogItem, Session } from '../db/types';
import {
  chargeLines,
  computeSessionTotal,
  incomeByClient,
  incomeByItem,
  lastPriceForClient,
  linesInRange,
  moneySeries,
  normalizeSession,
  percentChange,
  summarize,
} from './finance';

const catalogs = new Map<number, Catalog>([
  [1, { id: 1, name: 'Tratamientos', allowPrice: true } as Catalog],
  [2, { id: 2, name: 'Aparatología', allowPrice: true } as Catalog],
]);
const items = new Map<number, CatalogItem>(
  [
    [10, 'Limpieza'],
    [11, 'Peeling'],
    [20, 'Radiofrecuencia'],
  ].map(([id, name]) => [
    id as number,
    { id: id as number, catalogId: 0, name: name as string, active: true, createdAt: '' },
  ]),
);

function session(p: Partial<Session> & Pick<Session, 'id' | 'clientId' | 'date'>): Session {
  return {
    time: '',
    selections: {},
    homeRecommendations: '',
    observations: '',
    nextSessionDate: '',
    price: null,
    extraCharge: null,
    extraChargeNote: '',
    paid: true,
    createdAt: '',
    updatedAt: '',
    ...p,
  };
}

// La misma "Limpieza" se cobra distinto a cada clienta.
const sessions: Session[] = [
  session({
    id: 1,
    clientId: 1,
    date: '2026-10-01',
    selections: { '1': [{ itemId: 10, price: 20000 }], '2': [{ itemId: 20, price: 0 }] },
  }),
  session({
    id: 2,
    clientId: 2,
    date: '2026-10-20',
    selections: {
      '1': [
        { itemId: 10, price: 26000 },
        { itemId: 11, price: 30000 },
      ],
    },
    paid: false,
  }),
  session({
    id: 3,
    clientId: 1,
    date: '2026-11-05',
    selections: { '1': [{ itemId: 10, price: 22000 }] },
    extraCharge: 5000,
    extraChargeNote: 'Crema',
  }),
];

describe('ingresos', () => {
  it('el total de la sesión es la suma de los montos de cada opción más otros cobros', () => {
    expect(computeSessionTotal(sessions[0]!.selections, null)).toBe(20000);
    expect(computeSessionTotal(sessions[2]!.selections, 5000)).toBe(27000);
    expect(computeSessionTotal({ '1': [{ itemId: 10 }] }, null)).toBeNull();
  });

  it('agrupa por opción con promedio, mínimo y máximo (precios distintos por clienta)', () => {
    const lines = chargeLines(sessions, catalogs, items);
    const limpieza = incomeByItem(lines).find((r) => r.name === 'Limpieza')!;
    expect(limpieza).toMatchObject({ count: 3, total: 68000, min: 20000, max: 26000, clients: 2 });
    expect(incomeByItem(lines).find((r) => r.name === 'Otros cobros')?.total).toBe(5000);
  });

  it('separa lo cobrado de lo pendiente, por período y por clienta', () => {
    const lines = chargeLines(sessions, catalogs, items);
    const oct = summarize(linesInRange(lines, '2026-10-01', '2026-10-31'));
    expect(oct).toMatchObject({ total: 76000, collected: 20000, pending: 56000, sessions: 2, clients: 2 });
    expect(incomeByClient(lines)[0]).toMatchObject({ clientId: 2, total: 56000, pending: 56000 });
    expect(moneySeries(lines, '2026-10-01', '2026-11-30', 'month').map((p) => p.total)).toEqual([76000, 27000]);
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
  });

  it('sugiere el último monto cobrado a esa misma clienta', () => {
    expect(lastPriceForClient(sessions, 1, 1, 10)).toEqual({ price: 22000, date: '2026-11-05' });
    expect(lastPriceForClient(sessions, 1, 1, 10, 3)).toEqual({ price: 20000, date: '2026-10-01' });
    expect(lastPriceForClient(sessions, 3, 1, 10)).toBeNull();
  });

  it('las sesiones viejas pasan su monto total a "otros cobros"', () => {
    const old = {
      id: 9,
      clientId: 1,
      date: '2026-01-01',
      selections: { '1': [{ itemId: 10 }] },
      price: 30000,
      paid: true,
    };
    const s = normalizeSession(old);
    expect(s.extraCharge).toBe(30000);
    expect(s.extraChargeNote).toContain('sin detallar');
    expect(computeSessionTotal(s.selections, s.extraCharge)).toBe(30000);
  });
});
