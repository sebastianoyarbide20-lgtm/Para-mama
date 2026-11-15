import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarPlus, CircleCheck, Clock, History, House, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { db } from '../../db/db';
import type { Selections, Session } from '../../db/types';
import { deleteSession, saveSession, type SessionInput } from '../../db/actions';
import { clientName, useData } from '../../hooks/useData';
import { addDays, formatDate, formatDateLong, nowTime, todayISO } from '../../lib/dates';
import { formatMoney, parseMoneyInput, plural } from '../../lib/format';
import { countSelections } from '../../lib/stats';
import { lastPriceForClient } from '../../lib/finance';
import { Spinner, EmptyState } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { TextArea, TextField, Toggle } from '../../components/ui/Fields';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { ClientPicker } from '../../components/ClientPicker';
import { ClientSummary } from '../../components/ClientSummary';
import { CatalogPicker } from '../../components/CatalogPicker';
import { PhotoInput, type EditablePhoto } from '../../components/Photos';
import { SectionTabs } from '../../components/SectionTabs';
import { SessionSelections } from '../../components/SessionCard';

interface FormState {
  clientId: number | null;
  date: string;
  time: string;
  selections: Selections;
  homeRecommendations: string;
  observations: string;
  nextSessionDate: string;
  /** Monto escrito para cada opción elegida, por "catálogo:ítem". */
  prices: Record<string, string>;
  /** Otros cobros que no son una opción de las listas. */
  extraText: string;
  extraNote: string;
  paid: boolean;
  photos: EditablePhoto[];
}

const priceKey = (catalogId: number | string, itemId: number) => `${catalogId}:${itemId}`;

/** Montos (texto) de las opciones de una sesión guardada. */
function pricesFromSelections(selections: Selections): Record<string, string> {
  const prices: Record<string, string> = {};
  for (const [catKey, list] of Object.entries(selections ?? {})) {
    for (const sel of list) if (typeof sel.price === 'number') prices[priceKey(catKey, sel.itemId)] = String(sel.price);
  }
  return prices;
}

function emptyForm(clientId: number | null, date = todayISO()): FormState {
  return {
    clientId,
    date,
    time: '',
    selections: {},
    homeRecommendations: '',
    observations: '',
    nextSessionDate: '',
    prices: {},
    extraText: '',
    extraNote: '',
    paid: true,
    photos: [],
  };
}

export const SESSION_TABS = [
  { to: '/sesion/nueva', label: 'Nueva sesión', icon: CalendarPlus },
  { to: '/sesion/historial', label: 'Sesiones cargadas', icon: History },
];

/** Pantalla "Sesión de hoy": alta y edición de sesiones. */
export function SessionFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editingId = id ? Number(id) : null;
  const preselectedClient = Number(params.get('clienta')) || null;

  if (!editingId) {
    return (
      <SessionForm
        key={`new-${preselectedClient ?? ''}`}
        editingId={null}
        initial={emptyForm(preselectedClient)}
        original={null}
      />
    );
  }
  return <EditSessionLoader key={editingId} sessionId={editingId} />;
}

function EditSessionLoader({ sessionId }: { sessionId: number }) {
  const [loaded, setLoaded] = useState<{ form: FormState; session: Session } | 'missing' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) {
        if (!cancelled) setLoaded('missing');
        return;
      }
      const photos = await db.photos.where('sessionId').equals(sessionId).toArray();
      if (cancelled) return;
      setLoaded({
        session,
        form: {
          clientId: session.clientId,
          date: session.date,
          time: session.time ?? '',
          selections: structuredClone(session.selections ?? {}),
          homeRecommendations: session.homeRecommendations ?? '',
          observations: session.observations ?? '',
          nextSessionDate: session.nextSessionDate ?? '',
          prices: pricesFromSelections(session.selections),
          extraText: typeof session.extraCharge === 'number' ? String(session.extraCharge) : '',
          extraNote: session.extraChargeNote ?? '',
          paid: session.paid ?? false,
          photos: photos.map((p) => ({ id: p.id, key: `db-${p.id}`, kind: p.kind, dataUrl: p.dataUrl })),
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loaded === null) return <Spinner />;
  if (loaded === 'missing') {
    return (
      <EmptyState
        title="No encontramos esa sesión"
        action={<LinkButton to="/sesion/historial">Ver sesiones cargadas</LinkButton>}
      >
        Puede que se haya eliminado.
      </EmptyState>
    );
  }
  return <SessionForm editingId={sessionId} initial={loaded.form} original={loaded.session} />;
}

function SessionForm({
  editingId,
  initial,
  original,
}: {
  editingId: number | null;
  initial: FormState;
  original: Session | null;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { sessionCatalogs, itemsByCatalog, itemsById, sessions, clientsById } = useData();

  const [form, setForm] = useState<FormState>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<{ client?: string; date?: string; price?: string }>({});
  const [showMissingPrices, setShowMissingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ sessionId: number; clientId: number } | null>(null);
  const skipBlockRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(form) !== baseline;

  // Avisar si se va de la pantalla con datos sin guardar.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipBlockRef.current || !dirty || saved) return false;
    return currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search;
  });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: '¿Salir sin guardar?',
      message: 'Tenés una sesión a medio cargar. Si salís ahora, se pierde lo que completaste.',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir cargando',
      danger: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty || saved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saved]);

  const usage = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    for (const c of sessionCatalogs) map.set(c.id!, countSelections(sessions, c.id!));
    return map;
  }, [sessionCatalogs, sessions]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Cobro: cada opción elegida (de las listas que piden monto) con lo que se escribió.
  const charges = useMemo(() => {
    const rows: { key: string; catalogName: string; name: string; text: string; amount: number | null }[] = [];
    for (const catalog of sessionCatalogs) {
      if (!catalog.allowPrice) continue;
      for (const sel of form.selections[String(catalog.id)] ?? []) {
        const key = priceKey(catalog.id!, sel.itemId);
        const text = form.prices[key] ?? '';
        rows.push({
          key,
          catalogName: catalog.name,
          name: itemsById.get(sel.itemId)?.name ?? 'Ítem eliminado',
          text,
          amount: parseMoneyInput(text),
        });
      }
    }
    return rows;
  }, [sessionCatalogs, form.selections, form.prices, itemsById]);
  const extraAmount = parseMoneyInput(form.extraText);
  const total =
    charges.some((c) => c.amount !== null) || extraAmount !== null
      ? charges.reduce((a, c) => a + (c.amount ?? 0), 0) + (extraAmount ?? 0)
      : null;
  const missingCharges = charges.filter((c) => !c.text.trim());
  const selectedCount = Object.values(form.selections).reduce((a, l) => a + l.length, 0);
  const invalidCharges = charges.filter((c) => c.text.trim() && c.amount === null);

  const duplicateFrom = (session: Session) => {
    setForm((f) => ({
      ...f,
      selections: structuredClone(session.selections ?? {}),
      homeRecommendations: session.homeRecommendations || f.homeRecommendations,
      prices: pricesFromSelections(session.selections),
      extraText: typeof session.extraCharge === 'number' ? String(session.extraCharge) : '',
      extraNote: session.extraChargeNote ?? '',
    }));
    toast.info('Copiamos la última sesión. Revisá y cambiá lo que haga falta.');
  };

  const resetForAnother = () => {
    const fresh = emptyForm(null, form.date);
    setForm(fresh);
    setBaseline(JSON.stringify(fresh));
    setErrors({});
    setShowMissingPrices(false);
    setSaved(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = async (mode: 'normal' | 'another') => {
    const nextErrors: typeof errors = {};
    if (!form.clientId) nextErrors.client = 'Elegí una clienta (o creá una nueva) para poder guardar.';
    if (!form.date) nextErrors.date = 'Poné la fecha de la sesión.';
    if (invalidCharges.length || (form.extraText.trim() && extraAmount === null))
      nextErrors.price = 'Hay montos mal escritos. Usá solo números, por ejemplo 25000.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstId = nextErrors.client ? 'paso-clienta' : nextErrors.date ? 'paso-fecha' : 'paso-cobro';
      document.getElementById(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('Falta completar algo. Revisá lo marcado en rojo.');
      return;
    }

    const hasSomething =
      Object.values(form.selections).some((l) => l.length > 0) || form.observations.trim() || form.photos.length;
    if (!hasSomething) {
      const ok = await confirm({
        title: '¿Guardar sin tratamientos?',
        message: 'No elegiste ningún tratamiento ni escribiste observaciones. ¿Querés guardarla igual?',
        confirmLabel: 'Guardar igual',
        cancelLabel: 'Volver',
      });
      if (!ok) return;
    }

    // No hay precios fijos: se pregunta cuánto se cobró por cada opción elegida.
    if (missingCharges.length) {
      setShowMissingPrices(true);
      const ok = await confirm({
        title: '¿Cuánto cobraste?',
        message: (
          <>
            <p>Falta anotar el monto de:</p>
            <ul className="mt-2 list-inside list-disc font-semibold">
              {missingCharges.map((c) => (
                <li key={c.key}>
                  {c.name} <span className="font-normal text-stone-500">({c.catalogName})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Si no se cobró aparte, poné 0. ¿Querés guardar igual? Esas opciones quedan sin monto y no suman en los
              ingresos.
            </p>
          </>
        ),
        confirmLabel: 'Guardar sin esos montos',
        cancelLabel: 'Completar montos',
      });
      if (!ok) {
        document.getElementById('paso-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    setSaving(true);
    try {
      const input: SessionInput = {
        clientId: form.clientId!,
        date: form.date,
        time: form.time,
        selections: Object.fromEntries(
          Object.entries(form.selections).map(([catKey, list]) => [
            catKey,
            list.map((sel) => ({ ...sel, price: parseMoneyInput(form.prices[priceKey(catKey, sel.itemId)] ?? '') })),
          ]),
        ),
        homeRecommendations: form.homeRecommendations,
        observations: form.observations,
        nextSessionDate: form.nextSessionDate,
        price: total,
        extraCharge: extraAmount,
        extraChargeNote: extraAmount === null ? '' : form.extraNote,
        paid: total === null ? false : form.paid,
      };
      const initialPhotoIds = initial.photos.filter((p) => p.id).map((p) => p.id!);
      const keptIds = new Set(form.photos.filter((p) => p.id).map((p) => p.id!));
      const kindChanges: Record<number, EditablePhoto['kind']> = {};
      for (const p of form.photos) {
        const before = initial.photos.find((x) => x.id === p.id);
        if (p.id && before && before.kind !== p.kind) kindChanges[p.id] = p.kind;
      }
      const sessionId = await saveSession(editingId, input, {
        added: form.photos.filter((p) => !p.id).map((p) => ({ kind: p.kind, dataUrl: p.dataUrl })),
        removedIds: initialPhotoIds.filter((pid) => !keptIds.has(pid)),
        kindChanges,
      });
      const name = clientName(clientsById.get(form.clientId!));

      if (editingId) {
        skipBlockRef.current = true;
        toast.success('¡Cambios guardados!');
        navigate(`/clientas/${form.clientId}`);
      } else if (mode === 'another') {
        toast.success(`Sesión de ${name} guardada. Ya podés cargar la siguiente.`);
        resetForAnother();
      } else {
        setSaved({ sessionId, clientId: form.clientId! });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la sesión. Probá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      message: 'Se borra la sesión con sus fotos. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(editingId);
    skipBlockRef.current = true;
    toast.success('Sesión eliminada');
    navigate(original ? `/clientas/${original.clientId}` : '/sesion/historial');
  };

  if (saved) {
    return <SavedView saved={saved} onAnother={resetForAnother} />;
  }

  return (
    <div ref={topRef} className="scroll-mt-20">
      {/* Encabezado mínimo: el resto de la pantalla es el panel para completar. */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-[1.6rem] leading-tight font-semibold text-stone-900">
          {editingId ? 'Editar sesión' : 'Sesión de hoy'}
        </h1>
        {editingId && (
          <p className="text-sm text-stone-500">
            {clientName(clientsById.get(form.clientId ?? -1))} · {formatDate(original?.date)}
          </p>
        )}
      </div>
      {!editingId && <SectionTabs tabs={SESSION_TABS} />}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save('normal');
        }}
      >
        <div className="grid items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* ---------- Columna principal ---------- */}
          <div className="min-w-0 space-y-4">
            {/* Clienta y cuándo */}
            <div className="card grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div id="paso-clienta" className="min-w-0 scroll-mt-24">
                <PanelLabel>Clienta</PanelLabel>
                <ClientPicker
                  value={form.clientId}
                  onChange={(cid) => {
                    set('clientId', cid);
                    if (cid) setErrors((er) => ({ ...er, client: undefined }));
                  }}
                  error={errors.client}
                />
                {form.clientId && (
                  <details className="group mt-3 rounded-2xl bg-crema p-3 min-[1400px]:hidden" open>
                    <summary className="cursor-pointer font-bold text-rosa-800">
                      Ver datos importantes y última sesión
                    </summary>
                    <aside aria-label="Ficha de la clienta" className="mt-3">
                      <ClientSummary
                        clientId={form.clientId}
                        excludeSessionId={editingId}
                        onDuplicate={duplicateFrom}
                      />
                    </aside>
                  </details>
                )}
              </div>

              <div
                id="paso-fecha"
                className="grid scroll-mt-24 grid-cols-2 gap-3 md:w-[19rem] md:border-l md:border-stone-100 md:pl-4"
              >
                <div>
                  <TextField
                    label="Fecha"
                    type="date"
                    required
                    value={form.date}
                    max={addDays(todayISO(), 365)}
                    onValueChange={(v) => {
                      set('date', v);
                      if (v) setErrors((er) => ({ ...er, date: undefined }));
                    }}
                    error={errors.date}
                    className="h-10 px-2.5"
                  />
                  <div className="mt-1.5 flex gap-1.5">
                    <QuickChip active={form.date === todayISO()} onClick={() => set('date', todayISO())}>
                      Hoy
                    </QuickChip>
                    <QuickChip
                      active={form.date === addDays(todayISO(), -1)}
                      onClick={() => set('date', addDays(todayISO(), -1))}
                    >
                      Ayer
                    </QuickChip>
                  </div>
                </div>
                <div>
                  <TextField
                    label="Hora"
                    optional
                    type="time"
                    value={form.time}
                    onValueChange={(v) => set('time', v)}
                    className="h-10 px-2.5"
                  />
                  <div className="mt-1.5 flex gap-1.5">
                    <QuickChip onClick={() => set('time', nowTime())}>
                      <Clock className="size-3.5" aria-hidden /> Ahora
                    </QuickChip>
                    {form.time && <QuickChip onClick={() => set('time', '')}>Sin hora</QuickChip>}
                  </div>
                </div>
              </div>
            </div>

            {/* Qué se hizo: todas las listas a la vista, en dos columnas */}
            <section id="paso-3" aria-labelledby="paso-tratamientos" className="scroll-mt-24">
              <h2 id="paso-tratamientos" className="sr-only">
                ¿Qué le hiciste?
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {sessionCatalogs.map((catalog) => (
                  <CatalogPicker
                    key={catalog.id}
                    compact
                    catalog={catalog}
                    items={itemsByCatalog.get(catalog.id!) ?? []}
                    usage={usage.get(catalog.id!)}
                    value={form.selections[String(catalog.id)] ?? []}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, selections: { ...f.selections, [String(catalog.id)]: v } }))
                    }
                    prices={Object.fromEntries(
                      (form.selections[String(catalog.id)] ?? []).map((sel) => [
                        sel.itemId,
                        form.prices[priceKey(catalog.id!, sel.itemId)] ?? '',
                      ]),
                    )}
                    onPriceChange={(itemId, text) =>
                      setForm((f) => ({ ...f, prices: { ...f.prices, [priceKey(catalog.id!, itemId)]: text } }))
                    }
                    priceHint={(itemId) =>
                      form.clientId ? lastPriceForClient(sessions, form.clientId, catalog.id!, itemId, editingId) : null
                    }
                    showMissingPrices={showMissingPrices}
                  />
                ))}
              </div>
              <p className="mt-2 px-1 text-xs text-stone-500">
                ¿Te falta una lista (por ejemplo «Zonas tratadas»)? Creala en{' '}
                <Link to="/mis-datos" className="font-bold text-rosa-700 underline underline-offset-2">
                  Mis datos
                </Link>{' '}
                y aparece acá automáticamente.
              </p>
            </section>

            {/* Notas */}
            <div id="paso-notas" className="card grid scroll-mt-24 gap-4 p-4 md:grid-cols-2">
              <TextArea
                label="Recomendaciones para hacer en casa"
                value={form.homeRecommendations}
                onValueChange={(v) => set('homeRecommendations', v)}
                rows={3}
                placeholder="Ej: protector solar cada 3 horas, no usar ácidos por 5 días…"
              />
              <TextArea
                label="Observaciones de la sesión"
                value={form.observations}
                onValueChange={(v) => set('observations', v)}
                rows={3}
                placeholder="Cómo reaccionó la piel, qué notaste, qué hacer la próxima vez…"
              />
            </div>
          </div>

          {/* ---------- Columna lateral: ficha, cobro y extras ---------- */}
          <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 min-[1400px]:grid-cols-1">
            <aside aria-label="Ficha de la clienta" className="card hidden overflow-hidden min-[1400px]:block">
              <div aria-hidden className="h-1 bg-linear-to-r from-rosa-400 via-rosa-300 to-salvia-300" />
              <div className="max-h-[24rem] overflow-y-auto p-4">
                {form.clientId ? (
                  <ClientSummary clientId={form.clientId} excludeSessionId={editingId} onDuplicate={duplicateFrom} />
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rosa-50 text-rosa-500">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                    <p className="text-sm text-stone-500">
                      Al elegir la clienta, acá ves sus <strong className="text-stone-700">alergias</strong>,{' '}
                      <strong className="text-stone-700">medicación</strong>,{' '}
                      <strong className="text-stone-700">tipo de piel</strong> y su{' '}
                      <strong className="text-stone-700">última sesión</strong>.
                    </p>
                  </div>
                )}
              </div>
            </aside>

            <div id="paso-cobro" className="card scroll-mt-24 p-4">
              <PanelLabel>Cobro</PanelLabel>
              {charges.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Al elegir tratamientos, aparatos o productos, acá se suma lo que anotaste en cada uno.
                </p>
              ) : (
                <ul className="max-h-44 divide-y divide-stone-100 overflow-y-auto rounded-xl ring-1 ring-stone-200">
                  {charges.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-800">{c.name}</span>
                        <span className="block text-xs text-stone-500">{c.catalogName}</span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          c.amount !== null ? 'text-stone-900' : c.text.trim() ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {c.amount !== null ? formatMoney(c.amount) : c.text.trim() ? 'Revisar' : 'Sin monto'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
                <TextField
                  label="Otros cobros"
                  inputMode="decimal"
                  value={form.extraText}
                  onValueChange={(v) => {
                    set('extraText', v);
                    if (errors.price) setErrors((er) => ({ ...er, price: undefined }));
                  }}
                  placeholder="Ej: 5000"
                  error={form.extraText.trim() && extraAmount === null ? 'Solo números' : null}
                  className="h-10"
                />
                <TextField
                  label="¿Qué fue?"
                  value={form.extraNote}
                  onValueChange={(v) => set('extraNote', v)}
                  placeholder="Seña, recargo…"
                  className="h-10"
                />
              </div>

              {errors.price && (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
                  {errors.price}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema p-3">
                <div>
                  <p className="text-xs font-bold text-stone-500">Total de la sesión</p>
                  <p className="text-2xl font-extrabold text-stone-900 tabular-nums">
                    {total !== null ? formatMoney(total) : '–'}
                  </p>
                  {missingCharges.length > 0 && (
                    <p className="text-xs font-semibold text-amber-800">
                      Falta el monto de {missingCharges.length} {missingCharges.length === 1 ? 'opción' : 'opciones'}
                    </p>
                  )}
                </div>
                {total !== null && (
                  <Toggle
                    label={form.paid ? 'Pagado' : 'Falta pagar'}
                    description="Tocá para cambiar"
                    checked={form.paid}
                    onChange={(v) => set('paid', v)}
                  />
                )}
              </div>
            </div>

            <div id="paso-extras" className="card scroll-mt-24 space-y-4 p-4">
              <div>
                <TextField
                  label="Próxima sesión sugerida"
                  optional
                  type="date"
                  value={form.nextSessionDate}
                  min={form.date || undefined}
                  onValueChange={(v) => set('nextSessionDate', v)}
                  className="h-10"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[7, 15, 21, 30].map((d) => {
                    const target = addDays(form.date || todayISO(), d);
                    return (
                      <QuickChip
                        key={d}
                        active={form.nextSessionDate === target}
                        onClick={() => set('nextSessionDate', target)}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        {d} días
                      </QuickChip>
                    );
                  })}
                  {form.nextSessionDate && <QuickChip onClick={() => set('nextSessionDate', '')}>Quitar</QuickChip>}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-stone-700">
                  Fotos <span className="font-normal text-stone-500">(antes / después, quedan en esta PC)</span>
                </p>
                <PhotoInput photos={form.photos} onChange={(photos) => set('photos', photos)} />
              </div>
            </div>
          </div>
        </div>

        {/* Barra para guardar, siempre a la vista */}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 flex items-center gap-2 rounded-2xl bg-white/90 p-2.5 shadow-pop ring-1 ring-stone-900/5 backdrop-blur-xl lg:bottom-4">
          <p className="hidden min-w-0 flex-1 truncate pl-2 text-sm text-stone-600 lg:block">
            {form.clientId ? (
              <>
                <strong className="text-stone-900">{clientName(clientsById.get(form.clientId))}</strong>
                {' · '}
                {form.date ? formatDate(form.date) : 'sin fecha'}
                {selectedCount > 0 && ` · ${plural(selectedCount, 'opción elegida', 'opciones elegidas')}`}
                {total !== null && ` · Total ${formatMoney(total)}`}
              </>
            ) : (
              'Elegí la clienta para empezar.'
            )}
          </p>
          {editingId ? (
            <>
              <Button
                variant="ghost"
                className="text-red-700 hover:bg-red-50"
                icon={<Trash2 className="size-5" />}
                onClick={() => void remove()}
                aria-label="Eliminar sesión"
              >
                <span className="hidden sm:inline">Eliminar</span>
              </Button>
              <div className="flex-1 lg:hidden" />
              <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={saving} icon={<Save className="size-5" />}>
                {saving ? (
                  'Guardando…'
                ) : (
                  <span>
                    Guardar<span className="hidden sm:inline"> cambios</span>
                  </span>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="lg"
                disabled={saving}
                onClick={() => void save('another')}
                aria-label="Guardar y cargar otra sesión"
              >
                <span className="sm:hidden">Guardar y otra</span>
                <span className="hidden sm:inline">Guardar y cargar otra</span>
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                icon={<Save className="hidden size-6 sm:block" />}
                className="flex-1 whitespace-nowrap lg:flex-none lg:px-8"
              >
                {saving ? 'Guardando…' : 'Guardar sesión'}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

/** Título chico de cada bloque del panel. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold tracking-wide text-stone-400 uppercase">{children}</p>;
}

function QuickChip({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold ring-1 transition-colors ring-inset ${
        active
          ? 'bg-rosa-50 text-rosa-700 ring-rosa-200'
          : 'bg-white text-stone-600 ring-stone-200 hover:bg-stone-50 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}

function SavedView({ saved, onAnother }: { saved: { sessionId: number; clientId: number }; onAnother: () => void }) {
  const { sessions, clientsById } = useData();
  const session = sessions.find((s) => s.id === saved.sessionId);
  const name = clientName(clientsById.get(saved.clientId));
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card relative overflow-hidden p-6 text-center sm:p-10" role="status">
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-salvia-50 to-transparent" />
        <span className="animate-pop-in relative mx-auto flex size-24 items-center justify-center rounded-full bg-linear-to-br from-salvia-400 to-salvia-600 text-white shadow-[0_18px_40px_-16px_rgb(66_106_82/0.9)]">
          <CircleCheck className="size-12" aria-hidden />
        </span>
        <h1 className="relative mt-5 font-display text-[2.2rem] font-semibold text-stone-900">¡Sesión guardada!</h1>
        <p className="mt-2 text-lg text-stone-700">
          {name}
          {session && <> · {formatDateLong(session.date)}</>}
        </p>
        {session && (
          <div className="mt-6 rounded-2xl bg-stone-50 p-4 text-left ring-1 ring-stone-900/[0.03]">
            <SessionSelections session={session} compact />
          </div>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button size="lg" icon={<CalendarPlus className="size-5" />} onClick={onAnother}>
            Registrar otra sesión
          </Button>
          <LinkButton
            to={`/clientas/${saved.clientId}`}
            variant="secondary"
            size="lg"
            icon={<History className="size-5" />}
          >
            Ver historial de {clientsById.get(saved.clientId)?.firstName ?? 'la clienta'}
          </LinkButton>
          <LinkButton to="/" variant="ghost" size="lg" icon={<House className="size-5" />} className="sm:col-span-2">
            Ir al inicio
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
