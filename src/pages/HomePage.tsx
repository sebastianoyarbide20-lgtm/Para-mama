import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CalendarPlus,
  ChartColumn,
  ChevronRight,
  DatabaseBackup,
  FlaskConical,
  FolderHeart,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { clientName, useData } from '../hooks/useData';
import { loadSampleData } from '../db/sample';
import { addDays, daysBetween, formatDate, formatDateLong, relativeDays, todayISO } from '../lib/dates';
import { matches } from '../lib/text';
import { plural } from '../lib/format';
import { isInactive, sortSessionsDesc } from '../lib/stats';
import { Card } from '../components/ui/Card';
import { Button, LinkButton, buttonClasses } from '../components/ui/Button';
import { SearchInput } from '../components/ui/Fields';
import { useToast } from '../components/ui/Feedback';
import { Avatar } from '../components/ClientPicker';
import { SessionSelections } from '../components/SessionCard';

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

  const todaySessions = sortSessionsDesc(sessions.filter((s) => s.date === today));
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
      <header>
        <p className="text-lg font-semibold text-rosa-700">{greeting()}</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 first-letter:uppercase sm:text-4xl">
          {formatDateLong(today)}
        </h1>
      </header>

      <LinkButton
        to="/sesion/nueva"
        size="xl"
        block
        icon={<CalendarPlus className="size-7" />}
        className="rounded-2xl py-6 text-2xl shadow-md sm:w-auto sm:px-10"
      >
        Registrar sesión de hoy
      </LinkButton>

      {backupDue && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:flex-row sm:items-center">
          <DatabaseBackup className="hidden size-7 shrink-0 text-amber-700 sm:block" aria-hidden />
          <p className="min-w-0 flex-1 text-amber-950">
            <strong>
              {settings.lastBackupAt
                ? `Tu última copia de seguridad fue ${relativeDays(settings.lastBackupAt.slice(0, 10))}.`
                : 'Todavía no hiciste una copia de seguridad.'}
            </strong>{' '}
            Tus datos están solo en este dispositivo: descargá una copia para no perderlos.
          </p>
          <LinkButton to="/mis-datos/ajustes" variant="secondary">
            Hacer copia ahora
          </LinkButton>
        </div>
      )}

      {isEmpty ? (
        <Card title="Para empezar">
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
                text: 'Cargá tu primera clienta (o hacelo directo al registrar la sesión).',
                to: '/clientas/nueva',
                cta: 'Nueva clienta',
              },
              {
                n: 3,
                text: 'Registrá la sesión: clienta, tratamiento, aparatos, productos y recomendaciones.',
                to: '/sesion/nueva',
                cta: 'Registrar sesión',
              },
            ].map((step) => (
              <li key={step.n} className="flex flex-wrap items-center gap-3 rounded-xl bg-crema p-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-rosa-600 font-extrabold text-white">
                  {step.n}
                </span>
                <span className="min-w-0 flex-1 text-stone-800">{step.text}</span>
                <Link to={step.to} className={buttonClasses('secondary', 'sm')}>
                  {step.cta}
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl border-2 border-dashed border-stone-200 p-4">
            <p className="font-bold text-stone-800">¿Querés ver cómo funciona antes de cargar tus datos?</p>
            <p className="text-stone-600">Cargamos clientas y sesiones inventadas. Después las borrás con un botón.</p>
            <Button
              variant="soft"
              className="mt-3"
              icon={<FlaskConical className="size-5" />}
              disabled={loadingSample}
              onClick={() => void tryExample()}
            >
              {loadingSample ? 'Cargando…' : 'Cargar datos de ejemplo'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Buscar clienta">
            <SearchInput value={query} onChange={setQuery} placeholder="Nombre o teléfono…" label="Buscar clienta" />
            {query && (
              <ul className="mt-3 space-y-2">
                {found.length === 0 && (
                  <li className="text-stone-600">
                    No encontramos «{query}».{' '}
                    <Link to="/clientas/nueva" className="font-bold text-salvia-700 underline underline-offset-2">
                      Crear clienta
                    </Link>
                  </li>
                )}
                {found.map((c) => {
                  const s = clientStats.get(c.id!);
                  return (
                    <li key={c.id} className="flex items-center gap-2 rounded-xl bg-crema p-2">
                      <Link to={`/clientas/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1">
                        <Avatar name={clientName(c)} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-stone-900">{clientName(c)}</span>
                          <span className="block text-sm text-stone-500">
                            {s?.lastDate ? `Última visita: ${formatDate(s.lastDate)}` : 'Sin sesiones'}
                          </span>
                        </span>
                      </Link>
                      <Link
                        to={`/sesion/nueva?clienta=${c.id}`}
                        className={buttonClasses('soft', 'sm')}
                        aria-label={`Registrar sesión para ${clientName(c)}`}
                      >
                        <CalendarPlus className="size-4" aria-hidden /> Sesión
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {!query && (
              <p className="mt-3 text-stone-600">
                Tenés {plural(clients.length, 'clienta cargada', 'clientas cargadas')}.{' '}
                <Link to="/clientas" className="font-bold text-rosa-700 underline underline-offset-2">
                  Ver todas
                </Link>
              </p>
            )}
          </Card>

          <Card
            title="Hoy"
            subtitle={
              todaySessions.length
                ? plural(todaySessions.length, 'sesión registrada', 'sesiones registradas')
                : undefined
            }
          >
            {todaySessions.length === 0 ? (
              <p className="text-stone-600">Todavía no registraste sesiones hoy.</p>
            ) : (
              <ul className="space-y-2">
                {todaySessions.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link to={`/clientas/${s.clientId}`} className="block rounded-xl bg-crema p-3 hover:bg-rosa-50">
                      <span className="font-bold text-stone-900">
                        {clientName(clientsById.get(s.clientId))}
                        {s.time && <span className="ml-2 font-semibold text-stone-500">{s.time}</span>}
                      </span>
                      <div className="mt-1">
                        <SessionSelections session={s} compact />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(upcoming.length > 0 || inactiveCount > 0) && (
              <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                {upcoming.length > 0 && (
                  <Link
                    to="/clientas?filtro=proximas"
                    className="flex items-center gap-2 rounded-xl p-2 hover:bg-salvia-50"
                  >
                    <CalendarClock className="size-5 text-salvia-600" aria-hidden />
                    <span className="flex-1 text-stone-800">
                      <strong>{upcoming.length}</strong>{' '}
                      {upcoming.length === 1 ? 'clienta debería volver' : 'clientas deberían volver'} esta semana
                    </span>
                    <ChevronRight className="size-5 text-stone-400" aria-hidden />
                  </Link>
                )}
                {inactiveCount > 0 && (
                  <Link
                    to="/clientas?filtro=inactivas"
                    className="flex items-center gap-2 rounded-xl p-2 hover:bg-amber-50"
                  >
                    <UserPlus className="size-5 text-amber-600" aria-hidden />
                    <span className="flex-1 text-stone-800">
                      <strong>{inactiveCount}</strong> {inactiveCount === 1 ? 'clienta no viene' : 'clientas no vienen'}{' '}
                      hace más de {settings.inactiveDays} días
                    </span>
                    <ChevronRight className="size-5 text-stone-400" aria-hidden />
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      <section aria-labelledby="sectores">
        <h2 id="sectores" className="mb-3 text-xl font-extrabold text-stone-900">
          ¿Adónde querés ir?
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          <SectorCard
            to="/sesion/nueva"
            icon={<CalendarPlus className="size-8" />}
            title="Sesión de hoy"
            text="Registrá lo que hiciste: tratamiento, aparatos, productos y recomendaciones."
          />
          <SectorCard
            to="/panel"
            icon={<ChartColumn className="size-8" />}
            title="Panel y clientas"
            text="Historial de cada clienta, gráficos y quiénes hace mucho no vienen."
          />
          <SectorCard
            to="/mis-datos"
            icon={<FolderHeart className="size-8" />}
            title="Mis datos"
            text="Tus listas de tratamientos, aparatos y productos. Copia de seguridad."
          />
        </ul>
      </section>

      <p className="flex items-center justify-center gap-2 pt-2 text-sm text-stone-400">
        <Sparkles className="size-4" aria-hidden /> Tus datos se guardan en este dispositivo.
      </p>
    </div>
  );
}

function SectorCard({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/80 transition-colors hover:bg-rosa-50/50 hover:ring-rosa-200"
      >
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-rosa-100 text-rosa-700"
          aria-hidden
        >
          {icon}
        </span>
        <span>
          <span className="block text-lg font-extrabold text-stone-900">{title}</span>
          <span className="block text-stone-600">{text}</span>
        </span>
      </Link>
    </li>
  );
}
