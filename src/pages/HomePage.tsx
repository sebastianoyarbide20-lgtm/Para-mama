import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  ChartColumn,
  ChevronRight,
  Clock,
  DatabaseBackup,
  FlaskConical,
  FolderHeart,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import { clientName, useData } from '../hooks/useData';
import { loadSampleData } from '../db/sample';
import {
  addDays,
  daysBetween,
  formatDate,
  formatDateLong,
  relativeDays,
  startOfMonth,
  startOfWeek,
  todayISO,
} from '../lib/dates';
import { matches } from '../lib/text';
import { formatMoney, plural } from '../lib/format';
import { isInactive, sortSessionsDesc } from '../lib/stats';
import { Card, IconChip, Stagger, type Tone } from '../components/ui/Card';
import { Button, LinkButton, buttonClasses } from '../components/ui/Button';
import { SearchInput } from '../components/ui/Fields';
import { useToast } from '../components/ui/Feedback';
import { Avatar } from '../components/ClientPicker';
import { SessionSelections } from '../components/SessionCard';
import { AnimatedNumber } from '../components/Charts';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 13) return '¡Buen día!';
  if (h < 20) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

export function HomePage() {
  const { clients, sessions, clientStats, clientsById, settings } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [loadingSample, setLoadingSample] = useState(false);
  const today = todayISO();

  const found = useMemo(
    () =>
      query
        ? clients
            .filter((c) => matches(`${c.firstName} ${c.lastName} ${c.phone}`, query))
            .sort((a, b) => clientName(a).localeCompare(clientName(b), 'es'))
            .slice(0, 6)
        : [],
    [clients, query],
  );

  // Sin búsqueda se muestran las que vinieron más recientemente.
  const recent = useMemo(
    () =>
      clients
        .filter((c) => clientStats.get(c.id!)?.lastDate)
        .sort((a, b) => (clientStats.get(b.id!)!.lastDate ?? '').localeCompare(clientStats.get(a.id!)!.lastDate ?? ''))
        .slice(0, 5),
    [clients, clientStats],
  );

  const todaySessions = sortSessionsDesc(sessions.filter((s) => s.date === today));
  const weekSessions = sessions.filter((s) => s.date >= startOfWeek(today) && s.date <= today).length;
  const monthIncome = sessions
    .filter((s) => s.date >= startOfMonth(today) && s.date <= today && typeof s.price === 'number')
    .reduce((a, s) => a + (s.price ?? 0), 0);
  const upcoming = clients
    .map((c) => ({ c, next: clientStats.get(c.id!)?.nextSessionDate }))
    .filter(
      (x): x is { c: (typeof clients)[number]; next: string } =>
        !!x.next && x.next >= today && x.next <= addDays(today, 7),
    )
    .sort((a, b) => a.next.localeCompare(b.next));
  const inactiveCount = clients.filter((c) => isInactive(clientStats.get(c.id!), settings.inactiveDays, today)).length;

  const isEmpty = clients.length === 0 && sessions.length === 0;
  const backupDue = !isEmpty && (!settings.lastBackupAt || daysBetween(settings.lastBackupAt.slice(0, 10), today) > 14);

  const tryExample = async () => {
    setLoadingSample(true);
    try {
      const r = await loadSampleData();
      toast.success(`Listo: ${r.clients} clientas y ${r.sessions} sesiones de ejemplo para probar.`);
    } catch {
      toast.error('No se pudieron cargar los datos de ejemplo.');
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-linear-to-br from-rosa-800 via-rosa-700 to-rosa-500 p-8 text-white shadow-[0_30px_60px_-30px_rgb(122_45_64/0.75)] xl:p-10">
        <div
          aria-hidden
          className="animate-float absolute -top-24 -right-16 size-80 rounded-full bg-rosa-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-float absolute -bottom-32 left-1/3 size-80 rounded-full bg-amber-200/20 blur-3xl [animation-delay:-4s]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.09)_1px,transparent_0)] bg-[length:22px_22px]"
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-rosa-100">
              <Sun className="size-4" aria-hidden /> {greeting()}
            </p>
            <h1 className="mt-2 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight first-letter:uppercase">
              {formatDateLong(today)}
            </h1>
            <p className="mt-3 text-rosa-100/90">
              {isEmpty
                ? 'Bienvenida a tu registro de tratamientos.'
                : todaySessions.length
                  ? `Hoy registraste ${plural(todaySessions.length, 'sesión', 'sesiones')}. ¡Seguimos!`
                  : 'Todavía no registraste sesiones hoy.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/sesion/nueva"
                className="group inline-flex h-13 items-center gap-2.5 rounded-2xl bg-white px-6 text-[1.02rem] font-bold text-rosa-700 shadow-[0_14px_30px_-14px_rgb(0_0_0/0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-14px_rgb(0_0_0/0.5)]"
              >
                <CalendarPlus className="size-5" aria-hidden />
                Registrar sesión de hoy
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              {!isEmpty && (
                <Link
                  to="/panel"
                  className="inline-flex h-13 items-center gap-2 rounded-2xl px-5 font-semibold text-white ring-1 ring-white/30 transition-colors ring-inset hover:bg-white/10"
                >
                  <ChartColumn className="size-5" aria-hidden /> Ver el panel
                </Link>
              )}
            </div>
          </div>

          {!isEmpty && (
            <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <HeroStat label="Sesiones hoy" value={todaySessions.length} />
              <HeroStat label="Esta semana" value={weekSessions} />
              <HeroStat label="Cobrado este mes" value={monthIncome} money />
            </dl>
          )}
        </div>
      </section>

      {backupDue && (
        <div className="card flex items-center gap-4 p-4 pl-5 ring-amber-200/80">
          <IconChip tone="amber">
            <DatabaseBackup />
          </IconChip>
          <p className="min-w-0 flex-1 text-stone-700">
            <strong className="text-stone-900">
              {settings.lastBackupAt
                ? `Tu última copia de seguridad fue ${relativeDays(settings.lastBackupAt.slice(0, 10))}.`
                : 'Todavía no hiciste una copia de seguridad.'}
            </strong>{' '}
            Tus datos están solo en esta computadora: descargá una copia para no perderlos.
          </p>
          <LinkButton to="/mis-datos/ajustes" variant="secondary">
            Hacer copia ahora
          </LinkButton>
        </div>
      )}

      {isEmpty ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Para empezar" icon={<Sparkles />} className="xl:col-span-2">
            <ol className="space-y-3">
              {[
                {
                  n: 1,
                  text: 'Revisá tus listas de tratamientos, aparatología y productos.',
                  to: '/mis-datos',
                  cta: 'Ir a Mis datos',
                },
                {
                  n: 2,
                  text: 'Cargá tu primera clienta con su ficha inicial (o hacelo directo al registrar la sesión).',
                  to: '/clientas/nueva',
                  cta: 'Nueva clienta',
                },
                {
                  n: 3,
                  text: 'Registrá la sesión: clienta, tratamiento, aparatos, productos, montos y recomendaciones.',
                  to: '/sesion/nueva',
                  cta: 'Registrar sesión',
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex items-center gap-4 rounded-2xl bg-stone-50/80 p-4 ring-1 ring-stone-900/[0.03]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-rosa-500 to-rosa-600 font-display text-lg font-semibold text-white shadow-[0_6px_14px_-6px_rgb(176_63_88/0.8)]">
                    {step.n}
                  </span>
                  <span className="min-w-0 flex-1 text-stone-700">{step.text}</span>
                  <Link to={step.to} className={buttonClasses('secondary', 'sm')}>
                    {step.cta}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="¿Querés probar primero?" icon={<FlaskConical />} tone="violet">
            <p className="text-stone-600">
              Cargamos clientas y sesiones inventadas para que veas cómo funciona todo. Después las borrás con un botón.
            </p>
            <Button
              variant="soft"
              className="mt-4"
              icon={<FlaskConical className="size-5" />}
              disabled={loadingSample}
              onClick={() => void tryExample()}
            >
              {loadingSample ? 'Cargando…' : 'Cargar datos de ejemplo'}
            </Button>
          </Card>
        </div>
      ) : (
        <Stagger className="grid gap-6 xl:grid-cols-3">
          <Card title="Buscar clienta" icon={<Search />} tone="violet">
            <SearchInput value={query} onChange={setQuery} placeholder="Nombre o teléfono…" label="Buscar clienta" />
            {query ? (
              <ul className="mt-3 space-y-1">
                {found.length === 0 && (
                  <li className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                    No encontramos «{query}».{' '}
                    <Link to="/clientas/nueva" className="font-semibold text-salvia-700 underline underline-offset-2">
                      Crear clienta
                    </Link>
                  </li>
                )}
                {found.map((c) => (
                  <ClientRow key={c.id} clientId={c.id!} />
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-4 mb-1 text-xs font-bold tracking-wide text-stone-400 uppercase">Vinieron hace poco</p>
                <ul className="space-y-1">
                  {recent.map((c) => (
                    <ClientRow key={c.id} clientId={c.id!} />
                  ))}
                </ul>
                <Link
                  to="/clientas"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
                >
                  Ver las {clients.length} clientas <ChevronRight className="size-4" aria-hidden />
                </Link>
              </>
            )}
          </Card>

          <Card
            title="Hoy"
            icon={<CalendarPlus />}
            subtitle={
              todaySessions.length
                ? plural(todaySessions.length, 'sesión registrada', 'sesiones registradas')
                : undefined
            }
          >
            {todaySessions.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl bg-stone-50/80 px-4 py-8 text-center">
                <p className="text-stone-500">Todavía no registraste sesiones hoy.</p>
                <LinkButton
                  to="/sesion/nueva"
                  variant="soft"
                  size="sm"
                  className="mt-3"
                  icon={<CalendarPlus className="size-4" />}
                >
                  Registrar la primera
                </LinkButton>
              </div>
            ) : (
              <ul className="space-y-2">
                {todaySessions.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/clientas/${s.clientId}`}
                      className="block rounded-2xl bg-stone-50/80 p-3 ring-1 ring-stone-900/[0.03] transition-colors hover:bg-rosa-50/60"
                    >
                      <span className="flex items-center justify-between gap-2 font-semibold text-stone-900">
                        {clientName(clientsById.get(s.clientId))}
                        {s.time && <span className="text-sm font-medium text-stone-500">{s.time}</span>}
                      </span>
                      <div className="mt-1.5">
                        <SessionSelections session={s} compact />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Próximas sesiones"
            icon={<CalendarClock />}
            tone="salvia"
            subtitle="Sugeridas para los próximos 7 días"
          >
            {upcoming.length === 0 ? (
              <p className="rounded-2xl bg-stone-50/80 p-4 text-sm text-stone-500">
                No hay sesiones sugeridas esta semana.
              </p>
            ) : (
              <ul className="space-y-1">
                {upcoming.slice(0, 5).map(({ c, next }) => (
                  <li key={c.id}>
                    <Link
                      to={`/clientas/${c.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-50"
                    >
                      <Avatar name={clientName(c)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-stone-900">{clientName(c)}</span>
                        <span className="block text-xs text-stone-500">{formatDate(next)}</span>
                      </span>
                      <span className="rounded-full bg-salvia-50 px-2.5 py-0.5 text-xs font-semibold text-salvia-700 ring-1 ring-salvia-200/70 ring-inset">
                        {relativeDays(next, today)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {inactiveCount > 0 && (
              <Link
                to="/clientas?filtro=inactivas"
                className="group mt-4 flex items-center gap-3 rounded-2xl bg-amber-50/80 p-3 ring-1 ring-amber-200/70 transition-colors hover:bg-amber-50"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                  <Clock className="size-4" aria-hidden />
                </span>
                <span className="flex-1 text-sm text-amber-950">
                  <strong>{inactiveCount}</strong> {inactiveCount === 1 ? 'clienta no viene' : 'clientas no vienen'}{' '}
                  hace más de {settings.inactiveDays} días
                </span>
                <ChevronRight
                  className="size-4 text-amber-700 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            )}
          </Card>
        </Stagger>
      )}

      <section aria-labelledby="sectores">
        <h2 id="sectores" className="mb-3 font-display text-xl font-semibold text-stone-900">
          ¿Adónde querés ir?
        </h2>
        <Stagger className="grid gap-4 md:grid-cols-3">
          <SectorCard
            to="/sesion/nueva"
            icon={<CalendarPlus />}
            tone="rosa"
            title="Sesión de hoy"
            text="Registrá lo que hiciste: tratamiento, aparatos, productos, montos y recomendaciones."
          />
          <SectorCard
            to="/panel"
            icon={<ChartColumn />}
            tone="violet"
            title="Panel y clientas"
            text="Historial de cada clienta, ingresos, gráficos y quiénes hace mucho no vienen."
          />
          <SectorCard
            to="/mis-datos"
            icon={<FolderHeart />}
            tone="salvia"
            title="Mis datos"
            text="Tus listas de tratamientos, aparatos y productos. Copia de seguridad."
          />
        </Stagger>
      </section>
    </div>
  );
}

function HeroStat({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
      <dt className="text-xs font-semibold text-rosa-100">{label}</dt>
      <dd className="num mt-1 text-2xl font-bold tracking-tight">
        <AnimatedNumber value={value} format={(n) => (money ? formatMoney(n) : String(n))} />
      </dd>
    </div>
  );
}

function ClientRow({ clientId }: { clientId: number }) {
  const { clientsById, clientStats } = useData();
  const c = clientsById.get(clientId);
  if (!c) return null;
  const s = clientStats.get(clientId);
  return (
    <li className="group flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-stone-50">
      <Link to={`/clientas/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1">
        <Avatar name={clientName(c)} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-stone-900">{clientName(c)}</span>
          <span className="block text-xs text-stone-500">
            {s?.lastDate ? `Última visita: ${formatDate(s.lastDate)}` : 'Sin sesiones'}
          </span>
        </span>
      </Link>
      <Link
        to={`/sesion/nueva?clienta=${c.id}`}
        className={buttonClasses('soft', 'sm', 'opacity-80 group-hover:opacity-100')}
        aria-label={`Registrar sesión para ${clientName(c)}`}
      >
        <CalendarPlus className="size-4" aria-hidden /> Sesión
      </Link>
    </li>
  );
}

function SectorCard({
  to,
  icon,
  tone,
  title,
  text,
}: {
  to: string;
  icon: ReactNode;
  tone: Tone;
  title: string;
  text: string;
}) {
  return (
    <Link to={to} className="card card-hover group flex h-full items-start gap-4 p-5">
      <IconChip tone={tone} size="lg">
        {icon}
      </IconChip>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 font-display text-lg font-semibold text-stone-900">
          {title}
          <ArrowRight
            className="size-4 text-stone-300 transition-all group-hover:translate-x-1 group-hover:text-rosa-500"
            aria-hidden
          />
        </span>
        <span className="mt-1 block text-sm text-stone-500">{text}</span>
      </span>
    </Link>
  );
}
