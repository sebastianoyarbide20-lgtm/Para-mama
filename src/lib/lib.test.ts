import { describe, expect, it } from 'vitest';
import { addDays, addMonths, ageFromBirthDate, daysBetween, formatDate, relativeDays, startOfWeek } from './dates';
import { parseMoneyInput } from './format';
import { toCSV } from './csv';
import { matches, normalize } from './text';
import {
  averageDaysBetweenVisits,
  computeClientStats,
  computeKpis,
  crossCatalogs,
  isInactive,
  nextSessionStatus,
  ranking,
  timeSeries,
} from './stats';
import type { CatalogItem, Session } from '../db/types';

function session(partial: Partial<Session> & Pick<Session, 'clientId' | 'date'>): Session {
  return {
    time: '',
    selections: {},
    homeRecommendations: '',
    observations: '',
    nextSessionDate: '',
    price: null,
    paid: false,
    createdAt: `${partial.date}T10:00:00.000Z`,
    updatedAt: `${partial.date}T10:00:00.000Z`,
    ...partial,
  };
}

describe('fechas', () => {
  it('formatea en dd/mm/aaaa', () => {
    expect(formatDate('2026-11-06')).toBe('06/11/2026');
    expect(formatDate('')).toBe('');
  });

  it('suma días y meses sin corrimientos', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
  });

  it('calcula la edad y la semana', () => {
    expect(ageFromBirthDate('1988-04-12', '2026-04-11')).toBe(37);
    expect(ageFromBirthDate('1988-04-12', '2026-04-12')).toBe(38);
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02'); // domingo → lunes anterior
  });

  it('describe fechas relativas', () => {
    expect(relativeDays('2026-11-06', '2026-11-06')).toBe('hoy');
    expect(relativeDays('2026-11-05', '2026-11-06')).toBe('ayer');
    expect(relativeDays('2026-11-01', '2026-11-06')).toBe('hace 5 días');
    expect(relativeDays('2026-11-09', '2026-11-06')).toBe('en 3 días');
  });
});

describe('montos y texto', () => {
  it('entiende montos escritos a la argentina', () => {
    expect(parseMoneyInput('25000')).toBe(25000);
    expect(parseMoneyInput('25.000')).toBe(25000);
    expect(parseMoneyInput('$ 25.000,50')).toBe(25000.5);
    expect(parseMoneyInput('')).toBeNull();
  });

  it('busca sin importar tildes ni mayúsculas', () => {
    expect(normalize('Ácido Glicólico')).toBe('acido glicolico');
    expect(matches('Lucía Fernández', 'lucia fer')).toBe(true);
    expect(matches('Lucía Fernández', 'ana')).toBe(false);
  });

  it('arma CSV para Excel con ; y BOM', () => {
    const csv = toCSV([
      ['Nombre', 'Nota'],
      ['Ana', 'Dijo "hola"; chau'],
      ['Sol', true],
    ]);
    expect(csv.startsWith('﻿Nombre;Nota')).toBe(true);
    expect(csv).toContain('"Dijo ""hola""; chau"');
    expect(csv).toContain('Sol;Sí');
  });
});

describe('estadísticas', () => {
  const items = new Map<number, CatalogItem>(
    [
      [1, 'Limpieza'],
      [2, 'Peeling'],
      [10, 'Ácido salicílico'],
      [11, 'Vitamina C'],
    ].map(([id, name]) => [
      id as number,
      { id: id as number, catalogId: 0, name: name as string, active: true, createdAt: '' },
    ]),
  );
  const sessions: Session[] = [
    session({
      clientId: 1,
      date: '2026-09-01',
      price: 20000,
      paid: true,
      selections: { '100': [{ itemId: 1 }], '200': [{ itemId: 10 }] },
    }),
    session({
      clientId: 1,
      date: '2026-10-01',
      price: 25000,
      paid: false,
      selections: { '100': [{ itemId: 1 }, { itemId: 2 }], '200': [{ itemId: 10 }, { itemId: 11 }] },
    }),
    session({ clientId: 2, date: '2026-10-15', nextSessionDate: '2026-11-20', selections: { '100': [{ itemId: 2 }] } }),
  ];

  it('resume cada clienta', () => {
    const stats = computeClientStats(sessions);
    const c1 = stats.get(1)!;
    expect(c1.count).toBe(2);
    expect(c1.firstDate).toBe('2026-09-01');
    expect(c1.lastDate).toBe('2026-10-01');
    expect(c1.totalSpent).toBe(20000);
    expect(c1.unpaid).toBe(25000);
    expect(isInactive(c1, 30, '2026-11-06')).toBe(true);
    expect(isInactive(c1, 60, '2026-11-06')).toBe(false);
    expect(nextSessionStatus(stats.get(2), '2026-11-06')).toBe('pendiente');
    expect(nextSessionStatus(stats.get(2), '2026-11-21')).toBe('vencida');
    expect(averageDaysBetweenVisits(sessions.filter((s) => s.clientId === 1))).toBe(30);
  });

  it('calcula indicadores del período', () => {
    const k = computeKpis(sessions, '2026-10-01', '2026-10-31');
    expect(k.totalSessions).toBe(2);
    expect(k.activeClients).toBe(2);
    expect(k.newClients).toBe(1); // la clienta 1 empezó en septiembre
    expect(k.income).toBe(25000);
    expect(k.pending).toBe(25000);
  });

  it('arma rankings y cruces', () => {
    expect(ranking(sessions, 100, items).map((r) => [r.name, r.count])).toEqual([
      ['Limpieza', 2],
      ['Peeling', 2],
    ]);
    const cross = crossCatalogs(sessions, 100, 200, items);
    const limpieza = cross.find((r) => r.name === 'Limpieza')!;
    expect(limpieza.top[0]).toMatchObject({ name: 'Ácido salicílico', count: 2 });
  });

  it('completa los meses vacíos en la serie de tiempo', () => {
    const series = timeSeries(sessions, '2026-08-01', '2026-10-31', 'month');
    expect(series.map((p) => p.sesiones)).toEqual([0, 1, 2]);
    expect(series[2]!.ingresos).toBe(25000);
  });
});
