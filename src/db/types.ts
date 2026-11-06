/** Claves fijas de los catálogos que vienen con la app. */
export const BUILTIN_KEYS = {
  treatments: 'treatments',
  devices: 'devices',
  products: 'products',
  skinTypes: 'skinTypes',
} as const;

/** Campo extra que pueden tener los ítems de un catálogo (ej: "Marca" en líquidos). */
export interface ExtraFieldDef {
  key: string;
  label: string;
}

/** Un catálogo es una lista configurable (tratamientos, aparatología, zonas, etc.). */
export interface Catalog {
  id?: number;
  /** Identificador estable. Los predefinidos usan BUILTIN_KEYS; los personalizados "custom-…". */
  key: string;
  /** Nombre de la lista, ej: "Tratamientos". */
  name: string;
  /** Cómo se llama el campo en el formulario de sesión, ej: "Tratamientos realizados". */
  sessionLabel: string;
  description?: string;
  builtIn: boolean;
  /** ¿Se puede elegir más de un ítem en la sesión? */
  allowMultiple: boolean;
  /** ¿Cada ítem elegido puede llevar un detalle (ej: concentración, cantidad)? */
  allowDetail: boolean;
  /** ¿Aparece como campo en el formulario de sesión? (Tipos de piel no). */
  showInSession: boolean;
  /** Campos extra de cada ítem. */
  extraFields: ExtraFieldDef[];
  /** Emoji que identifica la lista. */
  icon: string;
  order: number;
  createdAt: string;
  sample?: boolean;
}

export interface CatalogItem {
  id?: number;
  catalogId: number;
  name: string;
  description?: string;
  extra?: Record<string, string>;
  active: boolean;
  createdAt: string;
  sample?: boolean;
}

export type SmokesValue = '' | 'no' | 'si' | 'ocasionalmente';
export type YesNoValue = '' | 'si' | 'no';
export type PregnancyValue = '' | 'no' | 'embarazada' | 'lactancia' | 'no-aplica';

export type CustomFieldValue = string | number | boolean;

export interface Client {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** yyyy-mm-dd */
  birthDate: string;
  skinTypeId: number | null;
  medication: string;
  smokes: SmokesValue;
  exercises: YesNoValue;
  exerciseFrequency: string;
  allergies: string;
  pregnancy: PregnancyValue;
  history: string;
  notes: string;
  customFields: Record<string, CustomFieldValue>;
  createdAt: string;
  updatedAt: string;
  sample?: boolean;
}

export type ClientFieldType = 'text' | 'longtext' | 'yesno' | 'number' | 'date';

/** Campo personalizado de la ficha de clienta, definido por la usuaria. */
export interface ClientField {
  id?: number;
  label: string;
  type: ClientFieldType;
  order: number;
  createdAt: string;
}

export interface SessionSelection {
  itemId: number;
  detail?: string;
}

/** Selecciones de la sesión, agrupadas por id de catálogo (como string). */
export type Selections = Record<string, SessionSelection[]>;

export interface Session {
  id?: number;
  clientId: number;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm (opcional) */
  time: string;
  selections: Selections;
  homeRecommendations: string;
  observations: string;
  /** yyyy-mm-dd (opcional) */
  nextSessionDate: string;
  price: number | null;
  paid: boolean;
  createdAt: string;
  updatedAt: string;
  sample?: boolean;
}

export type PhotoKind = 'antes' | 'despues' | 'otra';

export interface Photo {
  id?: number;
  sessionId: number;
  clientId: number;
  kind: PhotoKind;
  /** Imagen comprimida en formato data URL (JPEG). */
  dataUrl: string;
  createdAt: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface AppSettings {
  businessName: string;
  inactiveDays: number;
  lastBackupAt: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'Mi Cabina',
  inactiveDays: 60,
  lastBackupAt: null,
};
