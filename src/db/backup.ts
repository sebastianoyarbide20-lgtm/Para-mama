import { db, nowISO, ALL_TABLES } from './db';
import { ensureDefaults } from './defaults';
import { saveSetting } from './actions';
import type {
  Catalog,
  CatalogItem,
  Client,
  ClientField,
  MoneyConcept,
  MoneyMovement,
  Photo,
  Session,
  SettingRow,
} from './types';
import { BUILTIN_KEYS } from './types';
import { toCSV, type CSVCell } from '../lib/csv';
import { formatDate, todayISO } from '../lib/dates';
import { sortSessionsDesc } from '../lib/stats';
import { chargeLines, normalizeCatalog, normalizeSession } from '../lib/finance';
import {
  anamnesisMissing,
  CONDITIONS,
  FACIAL_GROUPS,
  fitzpatrickInfo,
  genderLabel,
  HABITS,
  hasNone,
  HOME_CARE,
  labelsOf,
  normalizeClient,
  type Option,
} from '../lib/anamnesis';

export const BACKUP_APP_ID = 'mi-cabina';
/**
 * v2: ficha inicial (anamnesis). v3: monto por opción en cada sesión. v4: economía (movimientos y conceptos).
 * Las copias viejas se adaptan al restaurar.
 */
export const BACKUP_VERSION = 4;

export interface BackupData {
  catalogs: Catalog[];
  catalogItems: CatalogItem[];
  clients: Client[];
  clientFields: ClientField[];
  sessions: Session[];
  photos: Photo[];
  settings: SettingRow[];
  moneyConcepts: MoneyConcept[];
  movements: MoneyMovement[];
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  includesPhotos: boolean;
  data: BackupData;
}

export async function buildBackup(includePhotos: boolean): Promise<BackupFile> {
  const [catalogs, catalogItems, clients, clientFields, sessions, photos, settings, moneyConcepts, movements] =
    await Promise.all([
      db.catalogs.toArray(),
      db.catalogItems.toArray(),
      db.clients.toArray(),
      db.clientFields.toArray(),
      db.sessions.toArray(),
      includePhotos ? db.photos.toArray() : Promise.resolve([] as Photo[]),
      db.settings.toArray(),
      db.moneyConcepts.toArray(),
      db.movements.toArray(),
    ]);
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    includesPhotos: includePhotos,
    data: {
      catalogs,
      catalogItems,
      clients,
      clientFields,
      sessions,
      photos,
      settings: settings.filter((s) => s.key !== 'lastBackupAt'),
      moneyConcepts,
      movements,
    },
  };
}

export function backupFileName(prefix = 'copia-mi-cabina'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${todayISO()}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export async function markBackupDone() {
  await saveSetting('lastBackupAt', nowISO());
}

export interface BackupSummary {
  clients: number;
  sessions: number;
  photos: number;
  catalogs: number;
  /** Ingresos, gastos e inversiones cargados en Economía. */
  movements: number;
  exportedAt: string;
  includesPhotos: boolean;
}

/** Valida el contenido de un archivo de copia. Tira un error con un mensaje amigable si no sirve. */
export function parseBackup(text: string): { backup: BackupFile; summary: BackupSummary } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida (no se pudo leer).');
  }
  const b = parsed as Partial<BackupFile>;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP_ID || !b.data) {
    throw new Error('Este archivo no es una copia de seguridad de esta aplicación.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('La copia fue hecha con una versión más nueva de la aplicación.');
  }
  const d = b.data as Partial<BackupData>;
  const required: (keyof BackupData)[] = ['catalogs', 'catalogItems', 'clients', 'sessions'];
  for (const key of required) {
    if (!Array.isArray(d[key])) throw new Error('La copia de seguridad está incompleta o dañada.');
  }
  const data: BackupData = {
    catalogs: d.catalogs ?? [],
    catalogItems: d.catalogItems ?? [],
    clients: d.clients ?? [],
    clientFields: Array.isArray(d.clientFields) ? d.clientFields : [],
    sessions: d.sessions ?? [],
    photos: Array.isArray(d.photos) ? d.photos : [],
    settings: Array.isArray(d.settings) ? d.settings : [],
    moneyConcepts: Array.isArray(d.moneyConcepts) ? d.moneyConcepts : [],
    movements: Array.isArray(d.movements) ? d.movements : [],
  };
  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    version: b.version,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    includesPhotos: Boolean(b.includesPhotos),
    data,
  };
  return {
    backup,
    summary: {
      clients: data.clients.length,
      sessions: data.sessions.length,
      photos: data.photos.length,
      catalogs: data.catalogs.length,
      movements: data.movements.length,
      exportedAt: backup.exportedAt,
      includesPhotos: backup.includesPhotos,
    },
  };
}

/** Reemplaza todos los datos actuales por los de la copia. */
export async function restoreBackup(backup: BackupFile, options: { keepCurrentPhotos?: boolean } = {}) {
  const tables = ALL_TABLES.map((t) => db.table(t));
  await db.transaction('rw', tables, async () => {
    const keepPhotos = options.keepCurrentPhotos && !backup.includesPhotos;
    for (const name of ALL_TABLES) {
      if (name === 'photos' && keepPhotos) continue;
      await db.table(name).clear();
    }
    const d = backup.data;
    await db.catalogs.bulkAdd(d.catalogs.map((c) => normalizeCatalog(c as unknown as Record<string, unknown>)));
    await db.catalogItems.bulkAdd(d.catalogItems);
    await db.clients.bulkAdd(d.clients.map((c) => normalizeClient(c as unknown as Record<string, unknown>)));
    await db.clientFields.bulkAdd(d.clientFields);
    await db.sessions.bulkAdd(d.sessions.map((x) => normalizeSession(x as unknown as Record<string, unknown>)));
    if (!keepPhotos) await db.photos.bulkAdd(d.photos);
    await db.settings.bulkPut(d.settings);
    await db.moneyConcepts.bulkAdd(d.moneyConcepts);
    await db.movements.bulkAdd(d.movements);
  });
  await ensureDefaults();
}

/* ----------------------------------- CSV ----------------------------------- */

async function loadLookups() {
  const [catalogs, items, clients] = await Promise.all([
    db.catalogs.orderBy('order').toArray(),
    db.catalogItems.toArray(),
    db.clients.toArray(),
  ]);
  return {
    catalogs,
    itemsById: new Map(items.map((i) => [i.id!, i])),
    clientsById: new Map(clients.map((c) => [c.id!, c])),
  };
}

/** Exporta las sesiones (opcionalmente filtradas por fecha) a CSV para abrir en Excel. */
export async function sessionsCSV(from: string | null = null, to: string | null = null): Promise<string> {
  const { catalogs, itemsById, clientsById } = await loadLookups();
  const sessionCatalogs = catalogs.filter((c) => c.showInSession);
  const skinCatalog = catalogs.find((c) => c.key === BUILTIN_KEYS.skinTypes);
  let sessions = await db.sessions.toArray();
  sessions = sortSessionsDesc(sessions).filter((s) => (!from || s.date >= from) && (!to || s.date <= to));

  const header: CSVCell[] = [
    'Fecha',
    'Hora',
    'Clienta',
    'Teléfono',
    skinCatalog?.name ?? 'Tipo de piel',
    ...sessionCatalogs.map((c) => c.sessionLabel || c.name),
    'Recomendaciones para casa',
    'Observaciones',
    'Próxima sesión',
    'Otros cobros',
    'Detalle otros cobros',
    'Monto total',
    'Pagado',
  ];
  const rows: CSVCell[][] = [header];
  for (const s of sessions) {
    const client = clientsById.get(s.clientId);
    rows.push([
      formatDate(s.date),
      s.time,
      client ? `${client.firstName} ${client.lastName}`.trim() : 'Clienta eliminada',
      client?.phone ?? '',
      client?.skinTypeId ? (itemsById.get(client.skinTypeId)?.name ?? '') : '',
      ...sessionCatalogs.map((c) =>
        (s.selections?.[String(c.id)] ?? [])
          .map((sel) => {
            const name = itemsById.get(sel.itemId)?.name ?? 'Ítem eliminado';
            const withDetail = sel.detail ? `${name} (${sel.detail})` : name;
            return typeof sel.price === 'number' ? `${withDetail} $${sel.price}` : withDetail;
          })
          .join(', '),
      ),
      s.homeRecommendations,
      s.observations,
      formatDate(s.nextSessionDate),
      typeof s.extraCharge === 'number' ? s.extraCharge : '',
      s.extraChargeNote ?? '',
      typeof s.price === 'number' ? s.price : '',
      typeof s.price === 'number' ? s.paid : '',
    ]);
  }
  return toCSV(rows);
}

export async function clientsCSV(): Promise<string> {
  const [{ itemsById }, clients, fields] = await Promise.all([
    loadLookups(),
    db.clients.toArray(),
    db.clientFields.orderBy('order').toArray(),
  ]);
  const yesNo: Record<string, string> = { si: 'Sí', no: 'No', '': '' };
  const list = (options: Option[], keys: string[] | undefined, none: string) => {
    const labels = labelsOf(options, keys);
    return labels.length ? labels.join(', ') : hasNone(keys) ? none : '';
  };
  const rows: CSVCell[][] = [
    [
      'Nombre',
      'Apellido',
      'Teléfono',
      'Email',
      'Fecha de nacimiento',
      'Género',
      'Último tratamiento',
      'Alergias',
      'Hábitos',
      'Cuidados domiciliarios',
      'Medicación',
      'Hace ejercicio',
      'Frecuencia de ejercicio',
      'Antecedentes',
      'Tipo de piel',
      'Fitzpatrick',
      ...FACIAL_GROUPS.map((g) => g.label),
      'Condiciones del paciente',
      'Ficha inicial',
      'Notas',
      ...fields.map((f) => f.label),
      'Fecha de alta',
    ],
  ];
  for (const c of [...clients].sort((a, b) => a.firstName.localeCompare(b.firstName, 'es'))) {
    const missing = anamnesisMissing(c);
    rows.push([
      c.firstName,
      c.lastName,
      c.phone,
      c.email,
      formatDate(c.birthDate),
      genderLabel(c.gender),
      c.noPreviousTreatment ? 'Nunca' : formatDate(c.lastTreatmentDate),
      c.allergies || (c.noAllergies ? 'No tiene' : ''),
      list(HABITS, c.habits, 'Ninguno'),
      list(HOME_CARE, c.homeCare, 'Ninguno'),
      c.medication,
      yesNo[c.exercises] ?? '',
      c.exerciseFrequency,
      c.history,
      c.skinTypeId ? (itemsById.get(c.skinTypeId)?.name ?? '') : '',
      fitzpatrickInfo(c.fitzpatrick)?.label ?? '',
      ...FACIAL_GROUPS.map((g) => list(g.options, c.facial?.[g.key], 'Sin hallazgos')),
      list(CONDITIONS, c.conditions, 'Ninguna'),
      missing.length ? `Incompleta (falta: ${missing.map((m) => m.label).join(', ')})` : 'Completa',
      c.notes,
      ...fields.map((f) => {
        const v = c.customFields?.[String(f.id)];
        if (v === undefined || v === '') return '';
        if (f.type === 'yesno') return v === true || v === 'si' ? 'Sí' : 'No';
        if (f.type === 'date' && typeof v === 'string') return formatDate(v);
        return v as CSVCell;
      }),
      formatDate(c.createdAt.slice(0, 10)),
    ]);
  }
  return toCSV(rows);
}

/** Cada monto cobrado como una fila (para analizar en Excel). */
export async function chargesCSV(from: string | null = null, to: string | null = null): Promise<string> {
  const { catalogs, itemsById, clientsById } = await loadLookups();
  const sessions = (await db.sessions.toArray()).filter((s) => (!from || s.date >= from) && (!to || s.date <= to));
  const lines = chargeLines(sortSessionsDesc(sessions), new Map(catalogs.map((c) => [c.id!, c])), itemsById);
  const byId = new Map(sessions.map((s) => [s.id!, s]));
  const rows: CSVCell[][] = [['Fecha', 'Clienta', 'Lista', 'Concepto', 'Monto', 'Pagado']];
  for (const l of lines) {
    const client = clientsById.get(l.clientId);
    const note = l.itemId === null ? byId.get(l.sessionId)?.extraChargeNote : '';
    rows.push([
      formatDate(l.date),
      client ? `${client.firstName} ${client.lastName}`.trim() : 'Clienta eliminada',
      l.catalogName,
      note ? `${l.name}: ${note}` : l.name,
      l.amount,
      l.paid,
    ]);
  }
  return toCSV(rows);
}

/** Movimientos de economía cargados a mano (ingresos que no son de sesiones, gastos e inversiones). */
export async function movementsCSV(from: string | null = null, to: string | null = null): Promise<string> {
  const [movements, concepts, items, clients] = await Promise.all([
    db.movements.toArray(),
    db.moneyConcepts.toArray(),
    db.catalogItems.toArray(),
    db.clients.toArray(),
  ]);
  const conceptsById = new Map(concepts.map((c) => [c.id!, c]));
  const itemsById = new Map(items.map((i) => [i.id!, i]));
  const clientsById = new Map(clients.map((c) => [c.id!, c]));
  const kinds: Record<string, string> = { ingreso: 'Ingreso', gasto: 'Gasto', inversion: 'Inversión' };
  const rows: CSVCell[][] = [['Fecha', 'Tipo', 'Concepto', 'Detalle', 'Producto', 'Cantidad', 'Clienta', 'Monto']];
  for (const m of movements
    .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date))) {
    const client = m.clientId ? clientsById.get(m.clientId) : undefined;
    rows.push([
      formatDate(m.date),
      kinds[m.kind] ?? m.kind,
      conceptsById.get(m.conceptId)?.name ?? 'Concepto eliminado',
      m.description,
      m.productId ? (itemsById.get(m.productId)?.name ?? '') : '',
      m.quantity ?? '',
      client ? `${client.firstName} ${client.lastName}`.trim() : '',
      m.kind === 'ingreso' ? m.amount : -m.amount,
    ]);
  }
  return toCSV(rows);
}
