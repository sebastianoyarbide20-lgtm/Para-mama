import { db, nowISO } from './db';
import { ensureDefaults } from './defaults';
import { BUILTIN_KEYS, type Client, type Selections, type Session } from './types';
import { addDays, todayISO } from '../lib/dates';
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
  smokes?: Client['smokes'];
  exercises?: Client['exercises'];
  exerciseFrequency?: string;
  pregnancy?: Client['pregnancy'];
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

const SAMPLE_ZONES_KEY = 'custom-zonas-ejemplo';

export async function hasSampleData(): Promise<boolean> {
  return (await db.clients.filter((c) => c.sample === true).count()) > 0;
}

export async function loadSampleData(): Promise<{ clients: number; sessions: number }> {
  await ensureDefaults();
  if (await hasSampleData()) await clearSampleData();

  const rand = prng(20240611);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;
  const today = todayISO();
  const now = nowISO();

  const created = { clients: 0, sessions: 0 };

  await db.transaction('rw', [db.catalogs, db.catalogItems, db.clients, db.sessions], async () => {
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
      const lastDay = sc.stoppedDaysAgo ? addDays(today, -sc.stoppedDaysAgo) : addDays(today, -Math.floor(rand() * 12));
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
        smokes: sc.smokes ?? '',
        exercises: sc.exercises ?? '',
        exerciseFrequency: sc.exerciseFrequency ?? '',
        allergies: sc.allergies ?? '',
        pregnancy: sc.pregnancy ?? '',
        history: sc.history ?? '',
        notes: sc.notes ?? '',
        customFields: {},
        createdAt: `${dates[0]}T10:00:00.000Z`,
        updatedAt: now,
        sample: true,
      });
      created.clients++;

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
        let price = 0;
        for (const t of treatmentNames) {
          const spec = TREATMENTS[t]!;
          spec.devices.forEach((d) => rand() < 0.75 && deviceNames.add(d));
          spec.products.forEach(([p, detail]) => rand() < 0.7 && productPairs.set(p, detail));
          zoneNames.add(spec.zones[0]!);
          spec.zones.slice(1).forEach((z) => rand() < 0.35 && zoneNames.add(z));
          price += spec.price;
        }
        selections[String(treatmentsCat.id)] = await Promise.all(
          treatmentNames.map(async (n) => ({ itemId: await itemId(treatmentsCat.id!, n) })),
        );
        if (deviceNames.size) {
          selections[String(devicesCat.id)] = await Promise.all(
            [...deviceNames].map(async (n) => ({ itemId: await itemId(devicesCat.id!, n) })),
          );
        }
        if (productPairs.size) {
          selections[String(productsCat.id)] = await Promise.all(
            [...productPairs].map(async ([n, detail]) =>
              detail
                ? { itemId: await itemId(productsCat.id!, n), detail }
                : { itemId: await itemId(productsCat.id!, n) },
            ),
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
          price: rand() < 0.92 ? Math.round((price * (0.9 + rand() * 0.25)) / 500) * 500 : null,
          paid: isLast ? rand() < 0.6 : rand() < 0.95,
          createdAt: `${dates[i]}T${String(hour).padStart(2, '0')}:00:00.000Z`,
          updatedAt: now,
          sample: true,
        });
      }
      await db.sessions.bulkAdd(sessions);
      created.sessions += sessions.length;
    }
  });
  return created;
}

/** Borra solo los datos de ejemplo. Lo que la usuaria cargó (aunque use ítems de ejemplo) se conserva. */
export async function clearSampleData(): Promise<void> {
  await db.transaction('rw', [db.catalogs, db.catalogItems, db.clients, db.sessions, db.photos], async () => {
    const sampleSessions = await db.sessions.filter((s) => s.sample === true).primaryKeys();
    await db.photos.where('sessionId').anyOf(sampleSessions).delete();
    await db.sessions.bulkDelete(sampleSessions);

    const remaining = await db.sessions.toArray();
    const clientsWithSessions = new Set(remaining.map((s) => s.clientId));
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
  });
}
