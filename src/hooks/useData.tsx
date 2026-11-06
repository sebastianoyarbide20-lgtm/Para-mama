import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  BUILTIN_KEYS,
  DEFAULT_SETTINGS,
  type AppSettings,
  type Catalog,
  type CatalogItem,
  type Client,
  type ClientField,
  type Session,
} from '../db/types';
import { computeClientStats, type ClientStat } from '../lib/stats';
import { compareEs } from '../lib/text';

export interface AppData {
  catalogs: Catalog[];
  /** Catálogos que aparecen en el formulario de sesión, en orden. */
  sessionCatalogs: Catalog[];
  catalogsById: Map<number, Catalog>;
  catalogByKey: (key: string) => Catalog | undefined;
  items: CatalogItem[];
  itemsById: Map<number, CatalogItem>;
  itemsByCatalog: Map<number, CatalogItem[]>;
  clients: Client[];
  clientsById: Map<number, Client>;
  clientFields: ClientField[];
  sessions: Session[];
  clientStats: Map<number, ClientStat>;
  settings: AppSettings;
}

const DataContext = createContext<AppData | null>(null);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const catalogs = useLiveQuery(() => db.catalogs.orderBy('order').toArray(), []);
  const items = useLiveQuery(() => db.catalogItems.toArray(), []);
  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const clientFields = useLiveQuery(() => db.clientFields.orderBy('order').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const settingRows = useLiveQuery(() => db.settings.toArray(), []);

  const value = useMemo<AppData | null>(() => {
    if (!catalogs || !items || !clients || !clientFields || !sessions || !settingRows) return null;
    const catalogsById = new Map(catalogs.map((c) => [c.id!, c]));
    const itemsById = new Map(items.map((i) => [i.id!, i]));
    const itemsByCatalog = new Map<number, CatalogItem[]>();
    for (const item of [...items].sort((a, b) => compareEs(a.name, b.name))) {
      const list = itemsByCatalog.get(item.catalogId);
      if (list) list.push(item);
      else itemsByCatalog.set(item.catalogId, [item]);
    }
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    for (const row of settingRows) {
      if (row.key in settings) (settings as unknown as Record<string, unknown>)[row.key] = row.value;
    }
    return {
      catalogs,
      sessionCatalogs: catalogs.filter((c) => c.showInSession),
      catalogsById,
      catalogByKey: (key: string) => catalogs.find((c) => c.key === key),
      items,
      itemsById,
      itemsByCatalog,
      clients,
      clientsById: new Map(clients.map((c) => [c.id!, c])),
      clientFields,
      sessions,
      clientStats: computeClientStats(sessions),
      settings,
    };
  }, [catalogs, items, clients, clientFields, sessions, settingRows]);

  if (!value) return <>{fallback}</>;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}

/* Helpers de presentación que dependen de los datos. */

export function clientName(client: Pick<Client, 'firstName' | 'lastName'> | undefined | null): string {
  if (!client) return 'Clienta eliminada';
  return `${client.firstName} ${client.lastName}`.trim();
}

export function useSkinTypeName() {
  const { itemsById } = useData();
  return (client: Client | undefined) => (client?.skinTypeId ? (itemsById.get(client.skinTypeId)?.name ?? '') : '');
}

export function useBuiltinCatalogs() {
  const { catalogByKey } = useData();
  return {
    treatments: catalogByKey(BUILTIN_KEYS.treatments),
    devices: catalogByKey(BUILTIN_KEYS.devices),
    products: catalogByKey(BUILTIN_KEYS.products),
    skinTypes: catalogByKey(BUILTIN_KEYS.skinTypes),
  };
}
