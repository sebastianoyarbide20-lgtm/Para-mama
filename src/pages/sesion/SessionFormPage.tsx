import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarPlus, CircleCheck, Clock, History, House, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import type { Selections, Session } from '../../db/types';
import { deleteSession, saveSession, type SessionInput } from '../../db/actions';
import { clientName, useData } from '../../hooks/useData';
import { addDays, formatDate, formatDateLong, nowTime, todayISO } from '../../lib/dates';
import { formatMoney, parseMoneyInput } from '../../lib/format';
import { countSelections } from '../../lib/stats';
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Card';
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
  priceText: string;
  paid: boolean;
  photos: EditablePhoto[];
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
    priceText: '',
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
          priceText: typeof session.price === 'number' ? String(session.price) : '',
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
  const { sessionCatalogs, itemsByCatalog, sessions, clientsById } = useData();

  const [form, setForm] = useState<FormState>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<{ client?: string; date?: string; price?: string }>({});
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

  const duplicateFrom = (session: Session) => {
    setForm((f) => ({
      ...f,
      selections: structuredClone(session.selections ?? {}),
      homeRecommendations: session.homeRecommendations || f.homeRecommendations,
      priceText: typeof session.price === 'number' ? String(session.price) : f.priceText,
    }));
    toast.info('Copiamos la última sesión. Revisá y cambiá lo que haga falta.');
  };

  const resetForAnother = () => {
    const fresh = emptyForm(null, form.date);
    setForm(fresh);
    setBaseline(JSON.stringify(fresh));
    setErrors({});
    setSaved(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = async (mode: 'normal' | 'another') => {
    const nextErrors: typeof errors = {};
    if (!form.clientId) nextErrors.client = 'Elegí una clienta (o creá una nueva) para poder guardar.';
    if (!form.date) nextErrors.date = 'Poné la fecha de la sesión.';
    const price = parseMoneyInput(form.priceText);
    if (form.priceText.trim() && price === null) nextErrors.price = 'Escribí el monto solo con números. Ej: 25000';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstId = nextErrors.client ? 'paso-clienta' : nextErrors.date ? 'paso-fecha' : 'paso-extras';
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

    setSaving(true);
    try {
      const input: SessionInput = {
        clientId: form.clientId!,
        date: form.date,
        time: form.time,
        selections: form.selections,
        homeRecommendations: form.homeRecommendations,
        observations: form.observations,
        nextSessionDate: form.nextSessionDate,
        price,
        paid: price === null ? false : form.paid,
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

  const price = parseMoneyInput(form.priceText);

  return (
    <div ref={topRef} className="scroll-mt-20">
      <PageHeader
        title={editingId ? 'Editar sesión' : 'Sesión de hoy'}
        subtitle={
          editingId
            ? `Sesión de ${clientName(clientsById.get(form.clientId ?? -1))} del ${formatDate(original?.date)}`
            : 'Registrá lo que hiciste en pocos pasos.'
        }
      />
      {!editingId && <SectionTabs tabs={SESSION_TABS} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save('normal');
          }}
        >
          <Card id="paso-clienta" title={<StepTitle n={1}>¿A quién atendiste?</StepTitle>} className="scroll-mt-24">
            <ClientPicker
              value={form.clientId}
              onChange={(cid) => {
                set('clientId', cid);
                if (cid) setErrors((er) => ({ ...er, client: undefined }));
              }}
              error={errors.client}
            />
            {form.clientId && (
              <details className="group mt-4 rounded-2xl bg-crema p-3 lg:hidden" open>
                <summary className="cursor-pointer font-bold text-rosa-800">
                  Ver datos importantes y última sesión
                </summary>
                <div className="mt-3">
                  <ClientSummary clientId={form.clientId} excludeSessionId={editingId} onDuplicate={duplicateFrom} />
                </div>
              </details>
            )}
          </Card>

          <Card id="paso-fecha" title={<StepTitle n={2}>¿Cuándo?</StepTitle>} className="scroll-mt-24">
            <div className="grid gap-4 sm:grid-cols-2">
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
                />
                <div className="mt-2 flex gap-2">
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
                <TextField label="Hora" optional type="time" value={form.time} onValueChange={(v) => set('time', v)} />
                <div className="mt-2 flex gap-2">
                  <QuickChip onClick={() => set('time', nowTime())}>
                    <Clock className="size-4" aria-hidden /> Ahora
                  </QuickChip>
                  {form.time && <QuickChip onClick={() => set('time', '')}>Sin hora</QuickChip>}
                </div>
              </div>
            </div>
          </Card>

          <section aria-labelledby="paso-tratamientos" className="space-y-4">
            <h2 id="paso-tratamientos" className="px-1 text-lg font-bold text-stone-900">
              <StepTitle n={3}>¿Qué le hiciste?</StepTitle>
            </h2>
            {sessionCatalogs.map((catalog) => (
              <CatalogPicker
                key={catalog.id}
                catalog={catalog}
                items={itemsByCatalog.get(catalog.id!) ?? []}
                usage={usage.get(catalog.id!)}
                value={form.selections[String(catalog.id)] ?? []}
                onChange={(v) => setForm((f) => ({ ...f, selections: { ...f.selections, [String(catalog.id)]: v } }))}
              />
            ))}
            <p className="px-1 text-sm text-stone-500">
              ¿Te falta una lista (por ejemplo «Zonas tratadas»)? Creala en{' '}
              <Link to="/mis-datos" className="font-bold text-rosa-700 underline underline-offset-2">
                Mis datos
              </Link>{' '}
              y aparece acá automáticamente.
            </p>
          </section>

          <Card title={<StepTitle n={4}>Para la casa y notas</StepTitle>}>
            <div className="space-y-4">
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
                rows={5}
                placeholder="Cómo reaccionó la piel, qué notaste, qué hacer la próxima vez…"
              />
            </div>
          </Card>

          <Card
            id="paso-extras"
            title={<StepTitle n={5}>Extras</StepTitle>}
            subtitle="Todo esto es opcional."
            className="scroll-mt-24"
          >
            <div className="space-y-6">
              <div>
                <TextField
                  label="Próxima sesión sugerida"
                  type="date"
                  value={form.nextSessionDate}
                  min={form.date || undefined}
                  onValueChange={(v) => set('nextSessionDate', v)}
                  wrapperClassName="sm:max-w-xs"
                />
                <div className="mt-2 flex flex-wrap gap-2">
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

              <div className="grid items-start gap-4 sm:grid-cols-2">
                <TextField
                  label="Monto cobrado"
                  inputMode="decimal"
                  value={form.priceText}
                  onValueChange={(v) => {
                    set('priceText', v);
                    if (errors.price) setErrors((er) => ({ ...er, price: undefined }));
                  }}
                  placeholder="Ej: 25000"
                  error={errors.price}
                  hint={price !== null ? formatMoney(price) : undefined}
                />
                {form.priceText.trim() && (
                  <div className="sm:pt-8">
                    <Toggle
                      label={form.paid ? 'Pagado' : 'Falta pagar'}
                      description="Tocá para cambiar"
                      checked={form.paid}
                      onChange={(v) => set('paid', v)}
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 font-semibold text-stone-800">Fotos (antes / después)</p>
                <PhotoInput photos={form.photos} onChange={(photos) => set('photos', photos)} />
                <p className="mt-2 text-sm text-stone-500">Las fotos se guardan solo en este dispositivo.</p>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-stone-200 backdrop-blur sm:p-3 lg:bottom-4">
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
                <div className="flex-1" />
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
                  type="submit"
                  size="lg"
                  disabled={saving}
                  icon={<Save className="hidden size-6 sm:block" />}
                  className="flex-1 whitespace-nowrap"
                >
                  {saving ? 'Guardando…' : 'Guardar sesión'}
                </Button>
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
              </>
            )}
          </div>
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl bg-white/70 p-4 ring-1 ring-stone-200">
            {form.clientId ? (
              <ClientSummary clientId={form.clientId} excludeSessionId={editingId} onDuplicate={duplicateFrom} />
            ) : (
              <p className="text-stone-600">
                Cuando elijas una clienta, acá vas a ver sus <strong>alergias</strong>, <strong>medicación</strong>,{' '}
                <strong>tipo de piel</strong> y su <strong>última sesión</strong>.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-rosa-600 text-base font-extrabold text-white"
      >
        {n}
      </span>
      {children}
    </span>
  );
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
      className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold transition-colors ${
        active
          ? 'border-rosa-500 bg-rosa-50 text-rosa-800'
          : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
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
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200 sm:p-10" role="status">
        <CircleCheck className="animate-pop-in mx-auto size-20 text-salvia-600" aria-hidden />
        <h1 className="mt-4 text-3xl font-extrabold text-stone-900">¡Sesión guardada!</h1>
        <p className="mt-2 text-lg text-stone-700">
          {name}
          {session && <> · {formatDateLong(session.date)}</>}
        </p>
        {session && (
          <div className="mt-6 rounded-2xl bg-crema p-4 text-left">
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
