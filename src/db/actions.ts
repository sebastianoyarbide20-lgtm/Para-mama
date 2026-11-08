import { db, nowISO } from './db';
import { ensureDefaults } from './defaults';
import type { AppSettings, Catalog, CatalogItem, Client, ClientField, Photo, Selections, Session } from './types';
import { normalize } from '../lib/text';

/* --------------------------------- Ajustes --------------------------------- */

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}

/* -------------------------------- Catálogos -------------------------------- */

export type CatalogInput = Pick<
  Catalog,
  'name' | 'sessionLabel' | 'description' | 'allowMultiple' | 'allowDetail' | 'showInSession' | 'icon'
>;

export async function createCatalog(input: CatalogInput): Promise<number> {
  const all = await db.catalogs.toArray();
  const order = all.reduce((max, c) => Math.max(max, c.order), 0) + 1;
  return db.catalogs.add({
    ...input,
    key: `custom-${Date.now().toString(36)}`,
    builtIn: false,
    extraFields: [],
    order,
    createdAt: nowISO(),
  });
}

export async function updateCatalog(id: number, changes: Partial<CatalogInput>) {
  await db.catalogs.update(id, changes);
}

/** Elimina una lista personalizada, sus ítems y las referencias en sesiones. */
export async function deleteCatalog(id: number) {
  await db.transaction('rw', db.catalogs, db.catalogItems, db.sessions, async () => {
    const catalog = await db.catalogs.get(id);
    if (!catalog || catalog.builtIn) throw new Error('No se puede eliminar una lista predefinida.');
    await db.catalogItems.where('catalogId').equals(id).delete();
    const key = String(id);
    await db.sessions.toCollection().modify((s) => {
      if (s.selections && key in s.selections) delete s.selections[key];
    });
    await db.catalogs.delete(id);
  });
}

export async function moveCatalog(id: number, direction: -1 | 1) {
  await db.transaction('rw', db.catalogs, async () => {
    const all = await db.catalogs.orderBy('order').toArray();
    const index = all.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= all.length) return;
    const a = all[index]!;
    const b = all[target]!;
    await db.catalogs.update(a.id!, { order: b.order });
    await db.catalogs.update(b.id!, { order: a.order });
  });
}

/* ------------------------------ Ítems de catálogo -------------------------- */

export type ItemInput = Pick<CatalogItem, 'name' | 'description' | 'extra'>;

export async function findItemByName(catalogId: number, name: string): Promise<CatalogItem | undefined> {
  const target = normalize(name);
  const items = await db.catalogItems.where('catalogId').equals(catalogId).toArray();
  return items.find((i) => normalize(i.name) === target);
}

export async function createItem(catalogId: number, input: ItemInput): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new Error('El nombre no puede estar vacío.');
  const existing = await findItemByName(catalogId, name);
  if (existing) {
    if (!existing.active) await db.catalogItems.update(existing.id!, { active: true });
    return existing.id!;
  }
  return db.catalogItems.add({
    catalogId,
    name,
    description: input.description?.trim() || '',
    extra: input.extra ?? {},
    active: true,
    createdAt: nowISO(),
  });
}

export async function updateItem(id: number, changes: Partial<ItemInput & { active: boolean }>) {
  await db.catalogItems.update(id, changes);
}

export async function countItemUsage(itemId: number, catalogId: number): Promise<number> {
  const key = String(catalogId);
  let count = 0;
  await db.sessions.each((s) => {
    if (s.selections?.[key]?.some((sel) => sel.itemId === itemId)) count++;
  });
  if (count === 0) {
    // Los tipos de piel se usan en las fichas.
    count += await db.clients.filter((c) => c.skinTypeId === itemId).count();
  }
  return count;
}

/** Elimina un ítem y lo saca de las sesiones/fichas donde se usó. */
export async function deleteItem(id: number) {
  await db.transaction('rw', db.catalogItems, db.sessions, db.clients, async () => {
    const item = await db.catalogItems.get(id);
    if (!item) return;
    const key = String(item.catalogId);
    await db.sessions.toCollection().modify((s) => {
      const list = s.selections?.[key];
      if (list?.some((sel) => sel.itemId === id)) {
        s.selections[key] = list.filter((sel) => sel.itemId !== id);
        if (s.selections[key].length === 0) delete s.selections[key];
      }
    });
    await db.clients.toCollection().modify((c) => {
      if (c.skinTypeId === id) c.skinTypeId = null;
    });
    await db.catalogItems.delete(id);
  });
}

/* --------------------------------- Clientas -------------------------------- */

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'sample'>;

export function emptyClient(): ClientInput {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    birthDate: '',
    gender: '',
    lastTreatmentDate: '',
    noPreviousTreatment: false,
    allergies: '',
    noAllergies: false,
    habits: [],
    homeCare: [],
    medication: '',
    exercises: '',
    exerciseFrequency: '',
    history: '',
    skinTypeId: null,
    fitzpatrick: '',
    facial: { capilares: [], sebaceas: [], pigmentacion: [], lineas: [] },
    conditions: [],
    notes: '',
    customFields: {},
  };
}

function cleanClient(input: ClientInput): ClientInput {
  const trimmed = { ...input };
  for (const k of Object.keys(trimmed) as (keyof ClientInput)[]) {
    const v = trimmed[k];
    if (typeof v === 'string') (trimmed as Record<string, unknown>)[k] = v.trim();
  }
  return trimmed;
}

export async function createClient(input: ClientInput): Promise<number> {
  const now = nowISO();
  return db.clients.add({ ...cleanClient(input), createdAt: now, updatedAt: now });
}

export async function updateClient(id: number, input: ClientInput) {
  await db.clients.update(id, { ...cleanClient(input), updatedAt: nowISO() });
}

/** Elimina la clienta con todas sus sesiones y fotos. */
export async function deleteClient(id: number) {
  await db.transaction('rw', db.clients, db.sessions, db.photos, async () => {
    await db.photos.where('clientId').equals(id).delete();
    await db.sessions.where('clientId').equals(id).delete();
    await db.clients.delete(id);
  });
}

/* ---------------------------- Campos de la ficha --------------------------- */

export async function createClientField(input: Pick<ClientField, 'label' | 'type'>): Promise<number> {
  const all = await db.clientFields.toArray();
  const order = all.reduce((max, f) => Math.max(max, f.order), 0) + 1;
  return db.clientFields.add({ ...input, label: input.label.trim(), order, createdAt: nowISO() });
}

export async function updateClientField(id: number, changes: Partial<Pick<ClientField, 'label' | 'type'>>) {
  await db.clientFields.update(id, changes);
}

export async function deleteClientField(id: number) {
  await db.transaction('rw', db.clientFields, db.clients, async () => {
    const key = String(id);
    await db.clients.toCollection().modify((c) => {
      if (c.customFields && key in c.customFields) delete c.customFields[key];
    });
    await db.clientFields.delete(id);
  });
}

export async function moveClientField(id: number, direction: -1 | 1) {
  await db.transaction('rw', db.clientFields, async () => {
    const all = await db.clientFields.orderBy('order').toArray();
    const index = all.findIndex((f) => f.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= all.length) return;
    const a = all[index]!;
    const b = all[target]!;
    await db.clientFields.update(a.id!, { order: b.order });
    await db.clientFields.update(b.id!, { order: a.order });
  });
}

/* --------------------------------- Sesiones -------------------------------- */

export type SessionInput = Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'sample'>;

export interface NewPhoto {
  kind: Photo['kind'];
  dataUrl: string;
}

function cleanSelections(selections: Selections): Selections {
  const result: Selections = {};
  for (const [key, list] of Object.entries(selections)) {
    const cleaned = list
      .filter((s) => typeof s.itemId === 'number')
      .map((s) => (s.detail?.trim() ? { itemId: s.itemId, detail: s.detail.trim() } : { itemId: s.itemId }));
    if (cleaned.length) result[key] = cleaned;
  }
  return result;
}

export async function saveSession(
  id: number | null,
  input: SessionInput,
  photos: { added: NewPhoto[]; removedIds: number[]; kindChanges?: Record<number, Photo['kind']> },
): Promise<number> {
  const now = nowISO();
  const data = {
    ...input,
    selections: cleanSelections(input.selections),
    homeRecommendations: input.homeRecommendations.trim(),
    observations: input.observations.trim(),
  };
  return db.transaction('rw', db.sessions, db.photos, async () => {
    let sessionId: number;
    if (id) {
      await db.sessions.update(id, { ...data, updatedAt: now });
      sessionId = id;
    } else {
      sessionId = await db.sessions.add({ ...data, createdAt: now, updatedAt: now });
    }
    if (photos.removedIds.length) await db.photos.bulkDelete(photos.removedIds);
    for (const [photoId, kind] of Object.entries(photos.kindChanges ?? {})) {
      await db.photos.update(Number(photoId), { kind });
    }
    if (photos.added.length) {
      await db.photos.bulkAdd(
        photos.added.map((p) => ({
          sessionId,
          clientId: input.clientId,
          kind: p.kind,
          dataUrl: p.dataUrl,
          createdAt: now,
        })),
      );
    }
    // Si cambió la clienta de la sesión, las fotos la acompañan.
    await db.photos.where('sessionId').equals(sessionId).modify({ clientId: input.clientId });
    return sessionId;
  });
}

export async function deleteSession(id: number) {
  await db.transaction('rw', db.sessions, db.photos, async () => {
    await db.photos.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/* ------------------------------- Borrar todo ------------------------------- */

export async function deleteAllData() {
  await db.transaction(
    'rw',
    [db.catalogs, db.catalogItems, db.clients, db.clientFields, db.sessions, db.photos, db.settings],
    async () => {
      await Promise.all([
        db.catalogs.clear(),
        db.catalogItems.clear(),
        db.clients.clear(),
        db.clientFields.clear(),
        db.sessions.clear(),
        db.photos.clear(),
        db.settings.clear(),
      ]);
    },
  );
  await ensureDefaults();
}
