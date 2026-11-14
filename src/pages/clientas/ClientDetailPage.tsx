import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Pencil,
  Phone,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { fitzpatrickInfo } from '../../lib/anamnesis';
import { deleteClient } from '../../db/actions';
import type { Session } from '../../db/types';
import { deleteSession } from '../../db/actions';
import { clientName, useBuiltinCatalogs, useData, useSkinTypeName } from '../../hooks/useData';
import { ageFromBirthDate, formatDate, relativeDays, todayISO } from '../../lib/dates';
import { formatMoney, formatNumber, plural } from '../../lib/format';
import { averageDaysBetweenVisits, isInactive, nextSessionStatus, ranking, sortSessionsDesc } from '../../lib/stats';
import { Badge, Card, EmptyState } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ClientPicker';
import { ClientAlerts } from '../../components/ClientAlerts';
import { SessionCard } from '../../components/SessionCard';
import { AnamnesisSummary } from '../../components/AnamnesisSummary';

export function ClientDetailPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { clientsById, sessions, clientStats, itemsById, settings } = useData();
  const { treatments, products, devices } = useBuiltinCatalogs();
  const skinName = useSkinTypeName();
  const client = clientsById.get(clientId);

  const history = useMemo(
    () => sortSessionsDesc(sessions.filter((s) => s.clientId === clientId)),
    [sessions, clientId],
  );

  if (!client) {
    return (
      <EmptyState title="No encontramos esa clienta" action={<LinkButton to="/clientas">Ver clientas</LinkButton>}>
        Puede que se haya eliminado.
      </EmptyState>
    );
  }

  const today = todayISO();
  const stat = clientStats.get(clientId);
  const age = ageFromBirthDate(client.birthDate);
  const avgDays = averageDaysBetweenVisits(history);
  const topTreatments = treatments ? ranking(history, treatments.id!, itemsById, 3) : [];
  const topProducts = products ? ranking(history, products.id!, itemsById, 5) : [];
  const topDevices = devices ? ranking(history, devices.id!, itemsById, 3) : [];
  const next = nextSessionStatus(stat, today);
  const name = clientName(client);

  const removeClient = async () => {
    const ok = await confirm({
      title: `¿Eliminar a ${name}?`,
      message: (
        <>
          Se borra la ficha
          {history.length > 0 && (
            <>
              {' '}
              y <strong>{plural(history.length, 'sesión', 'sesiones')}</strong> con sus fotos
            </>
          )}
          . Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteClient(clientId);
    toast.success(`${name} fue eliminada`);
    navigate('/clientas', { replace: true });
  };

  const removeSession = async (s: Session) => {
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      message: `Sesión del ${formatDate(s.date)}. Se borra junto con sus fotos y no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(s.id!);
    toast.success('Sesión eliminada');
  };

  const fitz = fitzpatrickInfo(client.fitzpatrick);
  const inactive = isInactive(stat, settings.inactiveDays, today);

  return (
    <div className="space-y-6">
      <Link
        to="/clientas"
        className="inline-flex items-center gap-1 text-sm font-semibold text-stone-500 transition-colors hover:text-stone-900"
      >
        <ChevronLeft className="size-4" aria-hidden /> Clientas
      </Link>

      {/* Encabezado de la clienta */}
      <section className="card relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 bg-linear-to-r from-rosa-100 via-rosa-50 to-salvia-50"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5 px-6 pt-10 pb-5">
          <div className="flex min-w-0 items-end gap-5">
            <span className="rounded-full bg-white p-1 shadow-card">
              <Avatar name={name} size="lg" />
            </span>
            <div className="min-w-0 pb-1">
              <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-tight text-stone-900">
                {name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
                {age !== null && <span>{age} años</span>}
                {skinName(client) && (
                  <span className="flex items-center gap-1">
                    <Flower2 className="size-3.5" aria-hidden /> Piel {skinName(client).toLowerCase()}
                  </span>
                )}
                {fitz && (
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-full ring-1 ring-stone-300"
                      style={{ backgroundColor: fitz.color }}
                    />
                    Fitzpatrick {fitz.value}
                  </span>
                )}
                {client.phone && (
                  <a
                    href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1 hover:text-rosa-700"
                  >
                    <Phone className="size-3.5" aria-hidden /> {client.phone}
                  </a>
                )}
                <span>Clienta desde {formatDate(stat?.firstDate ?? client.createdAt.slice(0, 10))}</span>
              </p>
              {(next || inactive) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {inactive && stat?.lastDate && (
                    <Badge tone="amber">
                      Hace {relativeDays(stat.lastDate, today).replace('hace ', '')} que no viene
                    </Badge>
                  )}
                  {next === 'pendiente' && (
                    <Badge tone="salvia" icon={<CalendarClock />}>
                      Próxima sesión sugerida: {formatDate(stat!.nextSessionDate)} (
                      {relativeDays(stat!.nextSessionDate!, today)})
                    </Badge>
                  )}
                  {next === 'vencida' && (
                    <Badge tone="red" icon={<CalendarClock />}>
                      Tenía que volver el {formatDate(stat!.nextSessionDate)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/clientas/${clientId}/editar`} variant="secondary" icon={<Pencil className="size-4" />}>
              Editar ficha
            </LinkButton>
            <LinkButton to={`/sesion/nueva?clienta=${clientId}`} icon={<CalendarPlus className="size-4" />}>
              Registrar sesión
            </LinkButton>
          </div>
        </div>

        <dl className="relative grid grid-cols-2 border-t border-stone-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-stone-100">
          <Stat label="Sesiones" value={String(history.length)} />
          <Stat label="Última visita" value={stat?.lastDate ? formatDate(stat.lastDate) : '–'} />
          <Stat label="Primera visita" value={stat?.firstDate ? formatDate(stat.firstDate) : '–'} />
          <Stat
            label="Viene cada"
            value={avgDays !== null ? `${formatNumber(Math.round(avgDays))} días` : '–'}
            hint="promedio"
          />
          <Stat label="Total cobrado" value={(stat?.totalSpent ?? 0) > 0 ? formatMoney(stat!.totalSpent) : '–'} />
          <Stat
            label="Falta pagar"
            value={(stat?.unpaid ?? 0) > 0 ? formatMoney(stat!.unpaid) : '–'}
            warn={(stat?.unpaid ?? 0) > 0}
          />
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[25rem_minmax(0,1fr)]">
        {/* Columna ficha */}
        <div className="space-y-6">
          <Card title="Importante" icon={<ShieldAlert />} tone="rosa">
            <ClientAlerts client={client} />
          </Card>

          <AnamnesisSummary client={client} />

          {(topTreatments.length > 0 || topProducts.length > 0 || topDevices.length > 0) && (
            <Card title="Lo que más le hacés" icon={<Sparkles />} tone="violet">
              {topTreatments.length > 0 && <TopList title="Tratamiento más frecuente" rows={topTreatments} />}
              {topProducts.length > 0 && <TopList title="Productos más usados con ella" rows={topProducts} />}
              {topDevices.length > 0 && <TopList title="Aparatología más usada" rows={topDevices} />}
              {((stat?.totalSpent ?? 0) > 0 || (stat?.unpaid ?? 0) > 0) && (
                <Link
                  to={`/panel/ingresos?clienta=${clientId}&periodo=todo`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
                >
                  Ver lo que se le cobró por cada tratamiento <ChevronRight className="size-4" aria-hidden />
                </Link>
              )}
            </Card>
          )}

          <Button
            variant="ghost"
            block
            className="text-stone-400 hover:bg-red-50 hover:text-red-700"
            icon={<Trash2 className="size-4" />}
            onClick={() => void removeClient()}
          >
            Eliminar clienta
          </Button>
        </div>

        {/* Línea de tiempo */}
        <section aria-labelledby="historial-titulo">
          <div className="mb-4 flex items-end justify-between gap-2">
            <h2 id="historial-titulo" className="font-display text-[1.45rem] font-semibold text-stone-900">
              Historial de sesiones
            </h2>
            <span className="text-sm font-medium text-stone-500">{plural(history.length, 'sesión', 'sesiones')}</span>
          </div>
          {history.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus />}
              title="Todavía no tiene sesiones"
              action={
                <LinkButton to={`/sesion/nueva?clienta=${clientId}`} icon={<CalendarPlus className="size-4" />}>
                  Registrar la primera sesión
                </LinkButton>
              }
            />
          ) : (
            <ol className="stagger relative space-y-4 before:absolute before:top-4 before:bottom-4 before:left-[3.55rem] before:w-px before:bg-linear-to-b before:from-rosa-200 before:via-rosa-100 before:to-transparent">
              {history.map((s) => (
                <li key={s.id} className="relative">
                  <SessionCard session={s} onDelete={removeSession} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="px-6 py-4">
      <dt className="text-xs font-semibold text-stone-500">
        {label} {hint && <span className="font-normal text-stone-400">({hint})</span>}
      </dt>
      <dd className={`num mt-0.5 text-lg font-bold ${warn ? 'text-amber-700' : 'text-stone-900'}`}>{value}</dd>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { id: number; name: string; count: number }[] }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-xs font-bold tracking-wide text-stone-400 uppercase">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-rosa-50 py-0.5 pr-1 pl-2.5 text-sm font-medium text-rosa-900 ring-1 ring-rosa-100 ring-inset"
          >
            {r.name}
            <span className="num rounded-full bg-white px-1.5 text-xs font-bold text-rosa-600">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
