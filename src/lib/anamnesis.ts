import type { Client, FacialAnalysis, FitzpatrickValue, GenderValue } from '../db/types';

/*
 * Ficha inicial (anamnesis) de cada clienta, basada en la "Ficha de Tratamiento y Anamnesis":
 * datos personales, historia clínica y hábitos, tipo de piel, escala de Fitzpatrick,
 * análisis facial y condiciones del paciente.
 * (El "Tratamiento en Gabinete" de la ficha en papel ya lo cubren las sesiones.)
 */

export interface Option {
  key: string;
  label: string;
}

/** Valor que se guarda cuando se responde "ninguno/a" en una sección de casillas. */
export const NONE = 'ninguno';

export const GENDER_OPTIONS: { value: Exclude<GenderValue, ''>; label: string }[] = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
];

export const HABITS: Option[] = [
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'cigarrillo', label: 'Cigarrillo' },
  { key: 'drogas', label: 'Drogas' },
  { key: 'cafe', label: 'Café' },
];

export const HOME_CARE: Option[] = [
  { key: 'limpieza', label: 'Limpieza' },
  { key: 'exfoliacion', label: 'Exfoliación' },
  { key: 'humectantes', label: 'Humectantes' },
  { key: 'hidratantes', label: 'Hidratantes' },
  { key: 'proteccion-solar', label: 'Protección solar' },
];

export const FITZPATRICK: { value: Exclude<FitzpatrickValue, ''>; label: string; hint: string; color: string }[] = [
  { value: 'I', label: 'Tipo I', hint: 'Muy blanca. Siempre se quema, nunca se broncea.', color: '#f7e3d4' },
  { value: 'II', label: 'Tipo II', hint: 'Blanca. Se quema con facilidad, se broncea poco.', color: '#efcfb4' },
  {
    value: 'III',
    label: 'Tipo III',
    hint: 'Blanca a trigueña. A veces se quema, se broncea de a poco.',
    color: '#dcad86',
  },
  { value: 'IV', label: 'Tipo IV', hint: 'Trigueña. Rara vez se quema, se broncea con facilidad.', color: '#bb855b' },
  { value: 'V', label: 'Tipo V', hint: 'Morena. Muy rara vez se quema, se broncea mucho.', color: '#8c5b3b' },
  { value: 'VI', label: 'Tipo VI', hint: 'Negra. Nunca se quema.', color: '#5b3a27' },
];

export const FACIAL_GROUPS: { key: keyof FacialAnalysis; label: string; options: Option[] }[] = [
  {
    key: 'capilares',
    label: 'Capilares visibles',
    options: [
      { key: 'nariz', label: 'Nariz' },
      { key: 'mejillas', label: 'Mejillas' },
      { key: 'menton', label: 'Mentón' },
      { key: 'frente', label: 'Frente' },
      { key: 'eritema', label: 'Eritema' },
      { key: 'irritacion', label: 'Irritación' },
      { key: 'cuperosidad', label: 'Cuperosidad' },
    ],
  },
  {
    key: 'sebaceas',
    label: 'Glándulas sebáceas',
    options: [
      { key: 'pustulas', label: 'Pústulas' },
      { key: 'papulas', label: 'Pápulas' },
      { key: 'hiperplasia', label: 'Hiperplasia' },
      { key: 'comedones', label: 'Comedones' },
      { key: 'millium', label: 'Millium' },
    ],
  },
  {
    key: 'pigmentacion',
    label: 'Pigmentación',
    options: [
      { key: 'hiperpigmentacion', label: 'Hiperpigmentación' },
      { key: 'hipopigmentacion', label: 'Hipopigmentación' },
    ],
  },
  {
    key: 'lineas',
    label: 'Líneas / Surcos',
    options: [
      { key: 'superficiales', label: 'Superficiales' },
      { key: 'profundas', label: 'Profundas' },
      { key: 'frontales', label: 'Frontales' },
      { key: 'corrugador', label: 'Corrugador' },
      { key: 'orbicular-ojos', label: 'Orbicular ojos' },
      { key: 'cigomaticos', label: 'Cigomáticos' },
      { key: 'menton', label: 'Mentón' },
      { key: 'pomulos', label: 'Pómulos' },
      { key: 'nasogenianos', label: 'Nasogenianos' },
    ],
  },
];

export const CONDITIONS: Option[] = [
  { key: 'alergia-anestesia', label: 'Alergias a las anestesias' },
  { key: 'enf-cutaneas', label: 'Enfermedades cutáneas' },
  { key: 'enf-oncologicas', label: 'Enfermedades oncológicas' },
  { key: 'cardiacos', label: 'Problemas cardíacos' },
  { key: 'retencion-liquidos', label: 'Retención de líquidos' },
  { key: 'paralisis-cerebral', label: 'Parálisis cerebral' },
  { key: 'marcapasos', label: 'Marcapasos' },
  { key: 'tiroides', label: 'Problemas de tiroides' },
  { key: 'enf-respiratorias', label: 'Enfermedades respiratorias' },
  { key: 'presion-alta', label: 'Presión alta' },
  { key: 'lupus', label: 'Lupus' },
  { key: 'asma', label: 'Asma' },
  { key: 'alergias-psoriasis', label: 'Alergias / Psoriasis' },
  { key: 'embarazo', label: 'Embarazo' },
  { key: 'anemia', label: 'Anemia' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'lactancia', label: 'Lactancia' },
  { key: 'coagulacion', label: 'Problemas de coagulación' },
  { key: 'herpes-varicela', label: 'Herpes / Varicela' },
  { key: 'epilepsia', label: 'Epilepsia' },
  { key: 'implantes-metalicos', label: 'Implantes metálicos' },
];

export const EMPTY_FACIAL: FacialAnalysis = { capilares: [], sebaceas: [], pigmentacion: [], lineas: [] };

/** Etiquetas de las opciones elegidas (sin el valor "ninguno"). */
export function labelsOf(options: Option[], keys: string[] | undefined): string[] {
  return (keys ?? []).filter((k) => k !== NONE).map((k) => options.find((o) => o.key === k)?.label ?? k);
}

export function hasNone(keys: string[] | undefined): boolean {
  return (keys ?? []).includes(NONE);
}

export function genderLabel(value: GenderValue): string {
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? '';
}

export function fitzpatrickInfo(value: FitzpatrickValue) {
  return FITZPATRICK.find((f) => f.value === value);
}

/* ------------------------------ Completitud ------------------------------ */

/** Campos de la clienta que usa la ficha inicial. */
export type AnamnesisData = Pick<
  Client,
  | 'birthDate'
  | 'gender'
  | 'lastTreatmentDate'
  | 'noPreviousTreatment'
  | 'allergies'
  | 'noAllergies'
  | 'habits'
  | 'homeCare'
  | 'skinTypeId'
  | 'fitzpatrick'
  | 'facial'
  | 'conditions'
>;

export interface MissingItem {
  /** id del elemento del formulario al que hay que ir para completarlo */
  target: string;
  label: string;
}

/** Puntos de la ficha inicial que faltan responder. Vacío = ficha completa. */
export function anamnesisMissing(c: AnamnesisData): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!c.birthDate) missing.push({ target: 'ficha-nacimiento', label: 'Fecha de nacimiento' });
  if (!c.gender) missing.push({ target: 'ficha-genero', label: 'Género' });
  if (!c.lastTreatmentDate && !c.noPreviousTreatment)
    missing.push({ target: 'ficha-ultimo', label: 'Fecha del último tratamiento' });
  if (!c.allergies?.trim() && !c.noAllergies) missing.push({ target: 'ficha-alergias', label: 'Alergias' });
  if (!c.habits?.length) missing.push({ target: 'ficha-habitos', label: 'Hábitos' });
  if (!c.homeCare?.length) missing.push({ target: 'ficha-cuidados', label: 'Cuidados domiciliarios' });
  if (!c.skinTypeId) missing.push({ target: 'ficha-piel', label: 'Tipo de piel' });
  if (!c.fitzpatrick) missing.push({ target: 'ficha-fitzpatrick', label: 'Escala de Fitzpatrick' });
  for (const g of FACIAL_GROUPS) {
    if (!c.facial?.[g.key]?.length) missing.push({ target: `ficha-facial-${g.key}`, label: g.label });
  }
  if (!c.conditions?.length) missing.push({ target: 'ficha-condiciones', label: 'Condiciones del paciente' });
  return missing;
}

export function isAnamnesisComplete(c: AnamnesisData): boolean {
  return anamnesisMissing(c).length === 0;
}

/* ------------------------------ Migración ------------------------------ */

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Completa una clienta guardada con versiones anteriores (o de una copia de seguridad vieja)
 * con los campos nuevos de la ficha inicial. Los datos viejos se pasan a su lugar nuevo:
 * "¿Fuma?" → Hábitos (Cigarrillo) y "Embarazo / lactancia" → Condiciones del paciente.
 */
export function normalizeClient(raw: Record<string, unknown>): Client {
  const habits = asList(raw.habits);
  const conditions = asList(raw.conditions);
  if (raw.habits === undefined && (raw.smokes === 'si' || raw.smokes === 'ocasionalmente')) habits.push('cigarrillo');
  if (raw.conditions === undefined) {
    if (raw.pregnancy === 'embarazada') conditions.push('embarazo');
    if (raw.pregnancy === 'lactancia') conditions.push('lactancia');
  }
  const facialRaw = (raw.facial ?? {}) as Record<string, unknown>;
  const { smokes: _smokes, pregnancy: _pregnancy, ...rest } = raw;
  void _smokes;
  void _pregnancy;
  return {
    ...(rest as unknown as Client),
    firstName: asString(raw.firstName),
    lastName: asString(raw.lastName),
    phone: asString(raw.phone),
    email: asString(raw.email),
    birthDate: asString(raw.birthDate),
    gender: asString(raw.gender) as GenderValue,
    lastTreatmentDate: asString(raw.lastTreatmentDate),
    noPreviousTreatment: raw.noPreviousTreatment === true,
    skinTypeId: typeof raw.skinTypeId === 'number' ? raw.skinTypeId : null,
    fitzpatrick: asString(raw.fitzpatrick) as FitzpatrickValue,
    medication: asString(raw.medication),
    exercises: (asString(raw.exercises) as Client['exercises']) || '',
    exerciseFrequency: asString(raw.exerciseFrequency),
    allergies: asString(raw.allergies),
    noAllergies: raw.noAllergies === true,
    habits,
    homeCare: asList(raw.homeCare),
    facial: {
      capilares: asList(facialRaw.capilares),
      sebaceas: asList(facialRaw.sebaceas),
      pigmentacion: asList(facialRaw.pigmentacion),
      lineas: asList(facialRaw.lineas),
    },
    conditions,
    history: asString(raw.history),
    notes: asString(raw.notes),
    customFields: (raw.customFields as Client['customFields']) ?? {},
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
    updatedAt: asString(raw.updatedAt) || asString(raw.createdAt) || new Date().toISOString(),
  };
}
