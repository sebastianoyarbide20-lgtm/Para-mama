import Dexie, { type Table } from 'dexie';
import type { Catalog, CatalogItem, Client, ClientField, Photo, Session, SettingRow } from './types';
import { normalizeClient } from '../lib/anamnesis';

/**
 * Base de datos local (IndexedDB) del navegador.
 * Los datos quedan guardados en este dispositivo: no hay servidor ni cuenta.
 */
export class CabinaDB extends Dexie {
  catalogs!: Table<Catalog, number>;
  catalogItems!: Table<CatalogItem, number>;
  clients!: Table<Client, number>;
  clientFields!: Table<ClientField, number>;
  sessions!: Table<Session, number>;
  photos!: Table<Photo, number>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('mi-cabina');
    this.version(1).stores({
      catalogs: '++id, &key, order',
      catalogItems: '++id, catalogId, name',
      clients: '++id, lastName, firstName, createdAt',
      clientFields: '++id, order',
      sessions: '++id, clientId, date, nextSessionDate, createdAt',
      photos: '++id, sessionId, clientId',
      settings: '&key',
    });
    // v2: ficha inicial (anamnesis). Se completan los campos nuevos de las clientas existentes.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('clients')
          .toCollection()
          .modify((client: Record<string, unknown>) => {
            const normalized = normalizeClient(client) as unknown as Record<string, unknown>;
            for (const key of Object.keys(client)) if (!(key in normalized)) delete client[key];
            Object.assign(client, normalized);
          }),
      );
  }
}

export const db = new CabinaDB();

export const ALL_TABLES = [
  'catalogs',
  'catalogItems',
  'clients',
  'clientFields',
  'sessions',
  'photos',
  'settings',
] as const;

export type TableName = (typeof ALL_TABLES)[number];

export function nowISO(): string {
  return new Date().toISOString();
}

/** Pide al navegador que no borre los datos automáticamente cuando falta espacio. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
