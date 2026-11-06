import { db, nowISO } from './db';
import { BUILTIN_KEYS, type Catalog } from './types';

interface DefaultCatalog {
  catalog: Omit<Catalog, 'id' | 'createdAt'>;
  items: string[];
}

/** Catálogos que vienen con la app. Los ítems son ejemplos que se pueden editar o borrar. */
export const DEFAULT_CATALOGS: DefaultCatalog[] = [
  {
    catalog: {
      key: BUILTIN_KEYS.treatments,
      name: 'Tratamientos',
      sessionLabel: 'Tratamientos realizados',
      description: 'Los tratamientos que realizás en cabina.',
      builtIn: true,
      allowMultiple: true,
      allowDetail: false,
      showInSession: true,
      extraFields: [],
      icon: '✨',
      order: 1,
    },
    items: [
      'Limpieza facial profunda',
      'Peeling químico',
      'Dermaplaning',
      'Radiofrecuencia facial',
      'Microdermoabrasión',
      'Hidratación profunda',
      'Microneedling',
      'Drenaje linfático',
    ],
  },
  {
    catalog: {
      key: BUILTIN_KEYS.devices,
      name: 'Aparatología',
      sessionLabel: 'Aparatología usada',
      description: 'Los aparatos que usás en las sesiones.',
      builtIn: true,
      allowMultiple: true,
      allowDetail: false,
      showInSession: true,
      extraFields: [],
      icon: '🔌',
      order: 2,
    },
    items: [
      'Radiofrecuencia',
      'Alta frecuencia',
      'Punta de diamante',
      'Espátula ultrasónica',
      'Vapor ozono',
      'Dermapen',
      'Máscara LED',
      'Ultrasonido',
    ],
  },
  {
    catalog: {
      key: BUILTIN_KEYS.products,
      name: 'Líquidos y productos',
      sessionLabel: 'Líquidos / productos usados',
      description: 'Ampollas, ácidos, sueros, máscaras y demás productos.',
      builtIn: true,
      allowMultiple: true,
      allowDetail: true,
      showInSession: true,
      extraFields: [
        { key: 'brand', label: 'Marca' },
        { key: 'notes', label: 'Observaciones' },
      ],
      icon: '🧴',
      order: 3,
    },
    items: [
      'Ácido glicólico',
      'Ácido salicílico',
      'Ácido mandélico',
      'Sérum de ácido hialurónico',
      'Vitamina C',
      'Niacinamida',
      'Ampolla de colágeno',
      'Máscara de arcilla',
    ],
  },
  {
    catalog: {
      key: BUILTIN_KEYS.skinTypes,
      name: 'Tipos de piel',
      sessionLabel: 'Tipo de piel',
      description: 'Se usa en la ficha de cada clienta.',
      builtIn: true,
      allowMultiple: false,
      allowDetail: false,
      showInSession: false,
      extraFields: [],
      icon: '🌸',
      order: 4,
    },
    items: ['Normal', 'Seca', 'Grasa', 'Mixta', 'Sensible'],
  },
];

/**
 * Se asegura de que existan los catálogos predefinidos.
 * Se ejecuta al abrir la app (y después de borrar o importar datos).
 */
export async function ensureDefaults(): Promise<void> {
  await db.transaction('rw', db.catalogs, db.catalogItems, async () => {
    for (const def of DEFAULT_CATALOGS) {
      const existing = await db.catalogs.where('key').equals(def.catalog.key).first();
      if (existing) continue;
      const createdAt = nowISO();
      const catalogId = await db.catalogs.add({ ...def.catalog, createdAt });
      await db.catalogItems.bulkAdd(def.items.map((name) => ({ catalogId, name, active: true, createdAt })));
    }
  });
}
