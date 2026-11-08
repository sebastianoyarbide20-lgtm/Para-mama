import { describe, expect, it } from 'vitest';
import { anamnesisMissing, isAnamnesisComplete, labelsOf, CONDITIONS, NONE, normalizeClient } from './anamnesis';
import { emptyClient } from '../db/actions';

describe('ficha inicial', () => {
  it('una ficha vacía tiene los 13 puntos pendientes', () => {
    const missing = anamnesisMissing(emptyClient());
    expect(missing).toHaveLength(13);
    expect(missing.map((m) => m.label)).toContain('Escala de Fitzpatrick');
    expect(missing.map((m) => m.label)).toContain('Líneas / Surcos');
  });

  it('se completa respondiendo cada punto, aunque sea con "ninguno"', () => {
    const client = {
      ...emptyClient(),
      birthDate: '1990-01-01',
      gender: 'femenino' as const,
      noPreviousTreatment: true,
      noAllergies: true,
      habits: [NONE],
      homeCare: ['proteccion-solar'],
      skinTypeId: 3,
      fitzpatrick: 'III' as const,
      facial: { capilares: [NONE], sebaceas: ['comedones'], pigmentacion: [NONE], lineas: [NONE] },
      conditions: ['marcapasos'],
    };
    expect(isAnamnesisComplete(client)).toBe(true);
    expect(anamnesisMissing({ ...client, fitzpatrick: '' }).map((m) => m.label)).toEqual(['Escala de Fitzpatrick']);
    expect(labelsOf(CONDITIONS, client.conditions)).toEqual(['Marcapasos']);
    expect(labelsOf(CONDITIONS, [NONE])).toEqual([]);
  });

  it('migra clientas cargadas antes de la ficha inicial', () => {
    const old = {
      id: 7,
      firstName: 'Ana',
      lastName: 'Paz',
      smokes: 'ocasionalmente',
      pregnancy: 'lactancia',
      allergies: 'Látex',
      createdAt: '2026-01-01T10:00:00.000Z',
    };
    const c = normalizeClient(old);
    expect(c.id).toBe(7);
    expect(c.habits).toEqual(['cigarrillo']);
    expect(c.conditions).toEqual(['lactancia']);
    expect(c.facial).toEqual({ capilares: [], sebaceas: [], pigmentacion: [], lineas: [] });
    expect(c.allergies).toBe('Látex');
    expect('smokes' in c).toBe(false);
    expect('pregnancy' in c).toBe(false);
  });
});
