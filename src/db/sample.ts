import { db, nowISO } from './db';
import { ensureDefaults } from './defaults';
import {
  BUILTIN_KEYS,
  type Client,
  type FacialAnalysis,
  type MoneyKind,
  type MoneyMovement,
  type Selections,
  type Session,
} from './types';
import { HOME_CARE, NONE } from '../lib/anamnesis';
import { computeSessionTotal } from '../lib/finance';
import { addDays, addMonths, startOfMonth, todayISO } from '../lib/dates';
import { normalize } from '../lib/text';

/* Datos de ejemplo para probar la app. Todo lo que se crea queda marcado con `sample: true`
   para poder borrarlo después sin tocar los datos reales. */

function prng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface TreatmentSpec {
  devices: string[];
  products: [string, string?][];
  zones: string[];
  price: number;
}

const TREATMENTS: Record<string, TreatmentSpec> = {
  'Limpieza facial profunda': {
    devices: ['Vapor ozono', 'Espátula ultrasónica', 'Alta frecuencia'],
    products: [['Ácido salicílico', '15%'], ['Máscara de arcilla'], ['Niacinamida']],
    zones: ['Rostro'],
    price: 22000,
  },
  'Peeling químico': {
    devices: [],
    products: [
      ['Ácido glicólico', '30%'],
      ['Ácido mandélico', '20%'],
      ['Ácido salicílico', '20%'],
    ],
    zones: ['Rostro', 'Cuello'],
    price: 28000,
  },
  Dermaplaning: {
    devices: [],
    products: [['Sérum de ácido hialurónico'], ['Vitamina C', '15%']],
    zones: ['Rostro'],
    price: 25000,
  },
  'Radiofrecuencia facial': {
    devices: ['Radiofrecuencia'],
    products: [['Ampolla de colágeno', '1 ampolla'], ['Sérum de ácido hialurónico']],
    zones: ['Rostro', 'Cuello', 'Escote'],
    price: 30000,
  },
  Microdermoabrasión: {
    devices: ['Punta de diamante'],
    products: [['Vitamina C', '10%'], ['Sérum de ácido hialurónico']],
    zones: ['Rostro'],
    price: 26000,
  },
  'Hidratación profunda': {
    devices: ['Ultrasonido', 'Máscara LED'],
    products: [['Sérum de ácido hialurónico'], ['Ampolla de colágeno', '1 ampolla']],
    zones: ['Rostro', 'Cuello'],
    price: 24000,
  },
  Microneedling: {
    devices: ['Dermapen'],
    products: [['Vitamina C', '20%'], ['Ampolla de colágeno', '2 ampollas'], ['Niacinamida']],
    zones: ['Rostro'],
    price: 38000,
  },
  'Drenaje linfático': {
    devices: ['Radiofrecuencia'],
    products: [],
    zones: ['Piernas', 'Abdomen', 'Glúteos'],
    price: 20000,
  },
};

const BY_SKIN: Record<string, string[]> = {
  Grasa: ['Limpieza facial profunda', 'Peeling químico', 'Microdermoabrasión'],
  Seca: ['Hidratación profunda', 'Dermaplaning', 'Radiofrecuencia facial'],
  Mixta: ['Limpieza facial profunda', 'Peeling químico', 'Hidratación profunda'],
  Sensible: ['Hidratación profunda', 'Dermaplaning', 'Limpieza facial profunda'],
  Normal: ['Microneedling', 'Radiofrecuencia facial', 'Dermaplaning', 'Drenaje linfático'],
};

const RECOMMENDATIONS = [
  'Protector solar FPS 50 cada 3 horas. No exponerse al sol por 7 días.',
  'Limpieza suave mañana y noche. Hidratante con ácido hialurónico.',
  'No usar ácidos en casa por 5 días. Agua termal si hay ardor.',
  'Evitar maquillaje por 24 hs. Protector solar todos los días.',
  'Tomar 2 litros de agua por día. Crema reafirmante por la noche.',
  'Sérum de vitamina C a la mañana y protector solar. Exfoliar suave 1 vez por semana.',
];

const OBSERVATIONS = [
  'Buena tolerancia. Piel algo deshidratada en mejillas.',
  'Se notan menos comedones en zona T.',
  'Leve eritema al finalizar, desapareció a los 15 minutos.',
  'Muy conforme con los resultados.',
  'Manchas de la frente más claras que en la sesión anterior.',
  'Piel más luminosa. Seguir con el plan.',
  '',
];

interface SampleClient {
  firstName: string;
  lastName: string;
  phone: string;
  skin: string;
  birthDate: string;
  medication?: string;
  allergies?: string;
  smokes?: 'si' | 'no' | 'ocasionalmente';
  exercises?: Client['exercises'];
  exerciseFrequency?: string;
  pregnancy?: 'no' | 'embarazada' | 'lactancia';
  /** Condiciones del paciente (claves de CONDITIONS). */
  conditions?: string[];
  history?: string;
  notes?: string;
  /** Días desde la última visita (para simular clientas que hace mucho no vienen). */
  stoppedDaysAgo?: number;
}

const CLIENTS: SampleClient[] = [
  {
    firstName: 'Anabel',
    lastName: 'Gómez',
    phone: '11 5555-1234',
    skin: 'Mixta',
    birthDate: '1988-04-12',
    medication: 'Anticonceptivos',
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: '3 veces por semana',
    notes: 'Prefiere turnos a la tarde.',
  },
  {
    firstName: 'Lucía',
    lastName: 'Fernández',
    phone: '11 4444-9876',
    skin: 'Grasa',
    birthDate: '1996-09-02',
    allergies: 'Ácido salicílico',
    smokes: 'ocasionalmente',
    exercises: 'no',
    history: 'Acné en la adolescencia. Tomó isotretinoína (terminó hace 2 años).',
  },
  {
    firstName: 'Carolina',
    lastName: 'Pereyra',
    phone: '351 555-2211',
    skin: 'Seca',
    birthDate: '1975-01-23',
    medication: 'Levotiroxina 50 mg',
    conditions: ['tiroides'],
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: 'Camina todos los días',
  },
  {
    firstName: 'Valeria',
    lastName: 'Sosa',
    phone: '11 3333-4455',
    skin: 'Sensible',
    birthDate: '1990-11-30',
    allergies: 'Látex, perfumes fuertes',
    smokes: 'no',
    exercises: 'no',
    notes: 'Rosácea leve en mejillas.',
  },
  {
    firstName: 'Mariana',
    lastName: 'López',
    phone: '221 444-5566',
    skin: 'Normal',
    birthDate: '1982-06-18',
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: 'Pilates 2 veces por semana',
    stoppedDaysAgo: 95,
  },
  {
    firstName: 'Florencia',
    lastName: 'Díaz',
    phone: '11 2222-7788',
    skin: 'Grasa',
    birthDate: '2001-03-05',
    smokes: 'si',
    exercises: 'no',
  },
  {
    firstName: 'Romina',
    lastName: 'Acosta',
    phone: '341 333-9900',
    skin: 'Mixta',
    birthDate: '1986-08-14',
    pregnancy: 'lactancia',
    smokes: 'no',
    exercises: 'no',
    notes: 'En lactancia: evitar ácidos fuertes.',
    stoppedDaysAgo: 140,
  },
  {
    firstName: 'Julieta',
    lastName: 'Romero',
    phone: '11 6666-1122',
    skin: 'Seca',
    birthDate: '1969-12-01',
    medication: 'Enalapril (presión)',
    conditions: ['presion-alta'],
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: 'Natación',
    history: 'Hipertensión controlada.',
  },
  {
    firstName: 'Sofía',
    lastName: 'Benítez',
    phone: '11 7777-3344',
    skin: 'Normal',
    birthDate: '1993-07-22',
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: 'Gimnasio 4 veces por semana',
  },
  {
    firstName: 'Paula',
    lastName: 'Medina',
    phone: '261 222-4433',
    skin: 'Sensible',
    birthDate: '1979-05-09',
    allergies: 'Ácido glicólico',
    medication: 'Antihistamínicos en primavera',
    smokes: 'no',
    exercises: 'no',
    stoppedDaysAgo: 75,
  },
  {
    firstName: 'Gabriela',
    lastName: 'Ruiz',
    phone: '11 8888-5566',
    skin: 'Grasa',
    birthDate: '1998-10-17',
    smokes: 'no',
    exercises: 'si',
    exerciseFrequency: 'Corre los fines de semana',
  },
  {
    firstName: 'Natalia',
    lastName: 'Herrera',
    phone: '11 9999-7788',
    skin: 'Mixta',
    birthDate: '1984-02-28',
    smokes: 'ocasionalmente',
    exercises: 'si',
    exerciseFrequency: 'Yoga',
    pregnancy: 'no',
  },
];

/** Ficha inicial completa y verosímil para una clienta de ejemplo. */
function sampleAnamnesis(sc: SampleClient, firstVisit: string, rand: () => number) {
  const subset = (keys: string[], max: number) => {
    const picked = keys.filter(() => rand() < 0.35).slice(0, max);
    return picked.length ? picked : [NONE];
  };
  const habits: string[] = [];
  if (sc.smokes === 'si' || sc.smokes === 'ocasionalmente') habits.push('cigarrillo');
  if (rand() < 0.6) habits.push('cafe');
  if (rand() < 0.25) habits.push('alcohol');

  const conditions = [...(sc.conditions ?? [])];
  if (sc.pregnancy === 'embarazada') conditions.push('embarazo');
  if (sc.pregnancy === 'lactancia') conditions.push('lactancia');

  const bySkin: Partial<Record<keyof FacialAnalysis, string[]>> =
    sc.skin === 'Grasa' || sc.skin === 'Mixta'
      ? { sebaceas: ['comedones', rand() < 0.5 ? 'pustulas' : 'papulas'] }
      : sc.skin === 'Sensible'
        ? { capilares: ['mejillas', 'eritema', 'cuperosidad'] }
        : {};
  const facial: FacialAnalysis = {
    capilares: bySkin.capilares ?? subset(['nariz', 'mejillas', 'eritema'], 2),
    sebaceas: bySkin.sebaceas ?? subset(['comedones', 'millium'], 1),
    pigmentacion: subset(['hiperpigmentacion'], 1),
    lineas: Number(sc.birthDate.slice(0, 4)) < 1990 ? ['superficiales', 'frontales', 'orbicular-ojos'] : [NONE],
  };
  const neverTreated = rand() < 0.3;
  return {
    gender: 'femenino' as const,
    lastTreatmentDate: neverTreated ? '' : addDays(firstVisit, -(60 + Math.floor(rand() * 300))),
    noPreviousTreatment: neverTreated,
    noAllergies: !sc.allergies,
    habits: habits.length ? habits : [NONE],
    homeCare:
      rand() < 0.15
        ? [NONE]
        : ['proteccion-solar', ...HOME_CARE.map((o) => o.key).filter((k) => k !== 'proteccion-solar' && rand() < 0.5)],
    fitzpatrick: (['II', 'III', 'III', 'IV', 'II', 'III'] as const)[Math.floor(rand() * 6)]!,
    facial,
    conditions: conditions.length ? conditions : [NONE],
  };
}

const SAMPLE_ZONES_KEY = 'custom-zonas-ejemplo';

export async function hasSampleData(): Promise<boolean> {
  return (await db.clients.filter((c) => c.sample === true).count()) > 0;
}

export async function loadSampleData(): Promise<{ clients: number; sessions: number; movements: number }> {
  await ensureDefaults();
  if (await hasSampleData()) await clearSampleData();

  const rand = prng(20240611);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;
  const today = todayISO();
  const now = nowISO();

  const created = { clients: 0, sessions: 0, movements: 0 };
  const sampleClientIds: number[] = [];

  await db.transaction(
    'rw',
    [db.catalogs, db.catalogItems, db.clients, db.sessions, db.moneyConcepts, db.movements],
    async () => {
      const catalogs = await db.catalogs.toArray();
      const byKey = (key: string) => catalogs.find((c) => c.key === key)!;
      const treatmentsCat = byKey(BUILTIN_KEYS.treatments);
      const devicesCat = byKey(BUILTIN_KEYS.devices);
      const productsCat = byKey(BUILTIN_KEYS.products);
      const skinCat = byKey(BUILTIN_KEYS.skinTypes);

      // Lista personalizada de ejemplo: "Zonas tratadas".
      // Si ya existe una lista con ese nombre (por ejemplo creada por la usuaria), se reutiliza.
      let zonesCat =
        catalogs.find((c) => c.key === SAMPLE_ZONES_KEY) ??
        catalogs.find((c) => normalize(c.name) === normalize('Zonas tratadas'));
      if (!zonesCat) {
        const order = catalogs.reduce((m, c) => Math.max(m, c.order), 0) + 1;
        const id = await db.catalogs.add({
          key: SAMPLE_ZONES_KEY,
          name: 'Zonas tratadas',
          sessionLabel: 'Zonas tratadas',
          description: 'Lista personalizada de ejemplo.',
          builtIn: false,
          allowMultiple: true,
          allowDetail: false,
          allowPrice: false,
          showInSession: true,
          extraFields: [],
          icon: '📍',
          order,
          createdAt: now,
          sample: true,
        });
        zonesCat = (await db.catalogs.get(id))!;
      }

      const itemCache = new Map<string, number>();
      const itemId = async (catalogId: number, name: string): Promise<number> => {
        const cacheKey = `${catalogId}:${normalize(name)}`;
        const cached = itemCache.get(cacheKey);
        if (cached) return cached;
        const existing = (await db.catalogItems.where('catalogId').equals(catalogId).toArray()).find(
          (i) => normalize(i.name) === normalize(name),
        );
        const id =
          existing?.id ??
          (await db.catalogItems.add({ catalogId, name, active: true, createdAt: now, sample: true, extra: {} }));
        itemCache.set(cacheKey, id);
        return id;
      };

      for (const zone of ['Rostro', 'Cuello', 'Escote', 'Espalda', 'Abdomen', 'Piernas', 'Glúteos']) {
        await itemId(zonesCat.id!, zone);
      }

      for (const sc of CLIENTS) {
        const skinTypeId = await itemId(skinCat.id!, sc.skin);
        const plan = BY_SKIN[sc.skin] ?? BY_SKIN['Normal']!;

        // Fechas de las sesiones de esta clienta.
        const lastDay = sc.stoppedDaysAgo
          ? addDays(today, -sc.stoppedDaysAgo)
          : addDays(today, -Math.floor(rand() * 12));
        let date = addDays(today, -(180 + Math.floor(rand() * 120)));
        const dates: string[] = [];
        while (date <= lastDay) {
          dates.push(date);
          date = addDays(date, 14 + Math.floor(rand() * 30));
        }
        if (dates.length === 0) dates.push(lastDay);

        const clientId = await db.clients.add({
          firstName: sc.firstName,
          lastName: sc.lastName,
          phone: sc.phone,
          email: `${normalize(sc.firstName)}.${normalize(sc.lastName)}@ejemplo.com`,
          birthDate: sc.birthDate,
          skinTypeId,
          medication: sc.medication ?? '',
          exercises: sc.exercises ?? '',
          exerciseFrequency: sc.exerciseFrequency ?? '',
          allergies: sc.allergies ?? '',
          ...sampleAnamnesis(sc, dates[0]!, rand),
          history: sc.history ?? '',
          notes: sc.notes ?? '',
          customFields: {},
          createdAt: `${dates[0]}T10:00:00.000Z`,
          updatedAt: now,
          sample: true,
        });
        created.clients++;
        sampleClientIds.push(clientId);

        // Cada clienta paga distinto: no hay precios fijos.
        const factor = 0.85 + rand() * 0.35;
        const money = (base: number) => Math.round((base * factor * (0.95 + rand() * 0.15)) / 500) * 500;
        const sessions: Session[] = [];
        for (let i = 0; i < dates.length; i++) {
          const isLast = i === dates.length - 1;
          const treatmentNames = [pick(plan)];
          if (rand() < 0.3) {
            const second = pick(plan);
            if (!treatmentNames.includes(second)) treatmentNames.push(second);
          }
          const selections: Selections = {};
          const deviceNames = new Set<string>();
          const productPairs = new Map<string, string | undefined>();
          const zoneNames = new Set<string>();
          for (const t of treatmentNames) {
            const spec = TREATMENTS[t]!;
            spec.devices.forEach((d) => rand() < 0.75 && deviceNames.add(d));
            spec.products.forEach(([p, detail]) => rand() < 0.7 && productPairs.set(p, detail));
            zoneNames.add(spec.zones[0]!);
            spec.zones.slice(1).forEach((z) => rand() < 0.35 && zoneNames.add(z));
          }
          selections[String(treatmentsCat.id)] = await Promise.all(
            treatmentNames.map(async (n) => ({
              itemId: await itemId(treatmentsCat.id!, n),
              price: money(TREATMENTS[n]!.price),
            })),
          );
          if (deviceNames.size) {
            selections[String(devicesCat.id)] = await Promise.all(
              [...deviceNames].map(async (n) => ({
                itemId: await itemId(devicesCat.id!, n),
                price: rand() < 0.5 ? 0 : money(4000),
              })),
            );
          }
          if (productPairs.size) {
            selections[String(productsCat.id)] = await Promise.all(
              [...productPairs].map(async ([n, detail]) => ({
                itemId: await itemId(productsCat.id!, n),
                ...(detail ? { detail } : {}),
                price: rand() < 0.4 ? 0 : money(4500),
              })),
            );
          }
          selections[String(zonesCat.id)] = await Promise.all(
            [...zoneNames].map(async (n) => ({ itemId: await itemId(zonesCat!.id!, n) })),
          );

          let nextSessionDate = '';
          if (isLast) {
            if (sc.stoppedDaysAgo) nextSessionDate = rand() < 0.5 ? addDays(dates[i]!, 21) : '';
            else nextSessionDate = addDays(dates[i]!, 21 + Math.floor(rand() * 10));
          } else if (rand() < 0.4) {
            nextSessionDate = dates[i + 1]!;
          }
          const hour = 9 + Math.floor(rand() * 10);
          sessions.push({
            clientId,
            date: dates[i]!,
            time: rand() < 0.8 ? `${String(hour).padStart(2, '0')}:${rand() < 0.5 ? '00' : '30'}` : '',
            selections,
            homeRecommendations: pick(RECOMMENDATIONS),
            observations: pick(OBSERVATIONS),
            nextSessionDate,
            price: computeSessionTotal(selections, null),
            extraCharge: null,
            extraChargeNote: '',
            paid: isLast ? rand() < 0.6 : rand() < 0.95,
            createdAt: `${dates[i]}T${String(hour).padStart(2, '0')}:00:00.000Z`,
            updatedAt: now,
            sample: true,
          });
        }
        await db.sessions.bulkAdd(sessions);
        created.sessions += sessions.length;
      }

      // Economía: ventas de productos, gastos del mes e inversiones.
      const movements = await sampleMovements(today, now, rand, sampleClientIds, (name) =>
        itemId(productsCat.id!, name),
      );
      await db.movements.bulkAdd(movements);
      created.movements = movements.length;
    },
  );
  return created;
}

interface ProductSpec {
  name: string;
  cost: number;
  sale: number;
}

/** Productos que se compran para la cabina y, algunos, se revenden a las clientas. */
const SALE_PRODUCTS: ProductSpec[] = [
  { name: 'Protector solar FPS 50', cost: 9000, sale: 16000 },
  { name: 'Crema hidratante de día', cost: 11000, sale: 19000 },
  { name: 'Sérum de ácido hialurónico', cost: 12000, sale: 21000 },
  { name: 'Vitamina C', cost: 13000, sale: 23000 },
];
const CABIN_SUPPLIES = ['Ácido glicólico', 'Ácido salicílico', 'Ampolla de colágeno', 'Máscara de arcilla'];

async function sampleMovements(
  today: string,
  now: string,
  rand: () => number,
  clientIds: number[],
  productId: (name: string) => Promise<number>,
): Promise<MoneyMovement[]> {
  const concepts = await db.moneyConcepts.toArray();
  const concept = (kind: MoneyKind, name: string): number => {
    const ofKind = concepts.filter((c) => c.kind === kind);
    return (ofKind.find((c) => normalize(c.name) === normalize(name)) ?? ofKind[0])!.id!;
  };
  const round = (n: number) => Math.round(n / 500) * 500;
  const list: MoneyMovement[] = [];
  const add = (
    m: Omit<MoneyMovement, 'createdAt' | 'updatedAt' | 'sample' | 'productId' | 'quantity' | 'clientId'> &
      Partial<Pick<MoneyMovement, 'productId' | 'quantity' | 'clientId'>>,
  ) => {
    if (m.date > today) return;
    list.push({
      productId: null,
      quantity: null,
      clientId: null,
      ...m,
      createdAt: `${m.date}T12:00:00.000Z`,
      updatedAt: now,
      sample: true,
    });
  };

  const firstMonth = startOfMonth(addMonths(today, -9));
  for (let month = firstMonth; month <= today; month = addMonths(month, 1)) {
    const day = (d: number) => `${month.slice(0, 8)}${String(d).padStart(2, '0')}`;
    add({
      kind: 'gasto',
      date: day(5),
      conceptId: concept('gasto', 'Alquiler'),
      amount: 120000,
      description: 'Alquiler del local',
    });
    add({
      kind: 'gasto',
      date: day(12),
      conceptId: concept('gasto', 'Servicios (luz, agua, internet)'),
      amount: round(24000 + rand() * 12000),
      description: 'Luz e internet',
    });
    // Compra de productos para revender e insumos de cabina.
    for (const spec of SALE_PRODUCTS) {
      if (rand() < 0.45) continue;
      const quantity = 2 + Math.floor(rand() * 4);
      add({
        kind: 'gasto',
        date: day(3 + Math.floor(rand() * 6)),
        conceptId: concept('gasto', 'Compra de productos e insumos'),
        amount: round(spec.cost * quantity),
        description: 'Compra al distribuidor',
        productId: await productId(spec.name),
        quantity,
      });
    }
    const supply = CABIN_SUPPLIES[Math.floor(rand() * CABIN_SUPPLIES.length)]!;
    add({
      kind: 'gasto',
      date: day(15 + Math.floor(rand() * 8)),
      conceptId: concept('gasto', 'Compra de productos e insumos'),
      amount: round(18000 + rand() * 20000),
      description: 'Insumos para la cabina',
      productId: await productId(supply),
      quantity: 1 + Math.floor(rand() * 3),
    });
    if (rand() < 0.5) {
      add({
        kind: 'gasto',
        date: day(20),
        conceptId: concept('gasto', 'Publicidad'),
        amount: 15000,
        description: 'Publicidad en redes',
      });
    }
    // Ventas de cremas a las clientas.
    const sales = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < sales; i++) {
      const spec = SALE_PRODUCTS[Math.floor(rand() * SALE_PRODUCTS.length)]!;
      const quantity = rand() < 0.8 ? 1 : 2;
      add({
        kind: 'ingreso',
        date: day(1 + Math.floor(rand() * 27)),
        conceptId: concept('ingreso', 'Venta de cremas y productos'),
        amount: round(spec.sale * quantity),
        description: '',
        productId: await productId(spec.name),
        quantity,
        clientId: clientIds.length ? clientIds[Math.floor(rand() * clientIds.length)]! : null,
      });
    }
  }
  add({
    kind: 'inversion',
    date: addDays(startOfMonth(addMonths(today, -7)), 9),
    conceptId: concept('inversion', 'Aparatología'),
    amount: 480000,
    description: 'Equipo de radiofrecuencia nuevo',
  });
  add({
    kind: 'inversion',
    date: addDays(startOfMonth(addMonths(today, -4)), 17),
    conceptId: concept('inversion', 'Muebles y equipamiento'),
    amount: 185000,
    description: 'Camilla nueva',
  });
  add({
    kind: 'inversion',
    date: addDays(startOfMonth(addMonths(today, -2)), 6),
    conceptId: concept('inversion', 'Cursos y capacitación'),
    amount: 95000,
    description: 'Curso de dermaplaning',
  });
  add({
    kind: 'ingreso',
    date: addDays(startOfMonth(addMonths(today, -1)), 21),
    conceptId: concept('ingreso', 'Otros ingresos'),
    amount: 40000,
    description: 'Gift card de regalo',
  });
  return list;
}

/** Borra solo los datos de ejemplo. Lo que la usuaria cargó (aunque use ítems de ejemplo) se conserva. */
export async function clearSampleData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.catalogs, db.catalogItems, db.clients, db.sessions, db.photos, db.movements],
    async () => {
      await db.movements.filter((m) => m.sample === true).delete();
      const remainingMovements = await db.movements.toArray();
      const sampleSessions = await db.sessions.filter((s) => s.sample === true).primaryKeys();
      await db.photos.where('sessionId').anyOf(sampleSessions).delete();
      await db.sessions.bulkDelete(sampleSessions);

      const remaining = await db.sessions.toArray();
      const clientsWithSessions = new Set(remaining.map((s) => s.clientId));
      for (const m of remainingMovements) if (m.clientId) clientsWithSessions.add(m.clientId);
      const sampleClients = await db.clients.filter((c) => c.sample === true).toArray();
      for (const c of sampleClients) {
        if (clientsWithSessions.has(c.id!)) await db.clients.update(c.id!, { sample: false });
        else {
          await db.photos.where('clientId').equals(c.id!).delete();
          await db.clients.delete(c.id!);
        }
      }

      const usedItems = new Set<number>();
      const usedCatalogs = new Set<string>();
      for (const s of remaining) {
        for (const [key, list] of Object.entries(s.selections ?? {})) {
          if (list.length) usedCatalogs.add(key);
          list.forEach((sel) => usedItems.add(sel.itemId));
        }
      }
      for (const c of await db.clients.toArray()) if (c.skinTypeId) usedItems.add(c.skinTypeId);
      for (const m of remainingMovements) if (m.productId) usedItems.add(m.productId);

      const sampleItems = await db.catalogItems.filter((i) => i.sample === true).toArray();
      for (const item of sampleItems) {
        if (usedItems.has(item.id!)) await db.catalogItems.update(item.id!, { sample: false });
        else await db.catalogItems.delete(item.id!);
      }

      const sampleCatalogs = await db.catalogs.filter((c) => c.sample === true).toArray();
      for (const cat of sampleCatalogs) {
        if (usedCatalogs.has(String(cat.id))) {
          await db.catalogs.update(cat.id!, { sample: false });
        } else {
          const remainingItems = await db.catalogItems.where('catalogId').equals(cat.id!).count();
          const sampleOnly = remainingItems === 0;
          if (sampleOnly) await db.catalogs.delete(cat.id!);
          else await db.catalogs.update(cat.id!, { sample: false });
        }
      }
    },
  );
}
