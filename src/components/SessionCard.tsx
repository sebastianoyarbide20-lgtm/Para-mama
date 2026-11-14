import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Clock, House, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import type { Session } from '../db/types';
import { db } from '../db/db';
import { clientName, useData } from '../hooks/useData';
import { formatDate, parseISODate, relativeDays, weekdayName } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { Badge } from './ui/Card';
import { buttonClasses } from './ui/Button';
import { PhotoStrip } from './Photos';
import { Avatar } from './ClientPicker';

/** Lista de lo elegido en cada catálogo de una sesión. */
export function SessionSelections({ session, compact = false }: { session: Session; compact?: boolean }) {
  const { sessionCatalogs, itemsById, catalogsById } = useData();
  // Catálogos actuales + cualquiera que tenga datos en la sesión (aunque ya no se muestre en el formulario).
  const catalogIds = new Set(sessionCatalogs.map((c) => c.id!));
  for (const key of Object.keys(session.selections ?? {})) catalogIds.add(Number(key));
  const rows = [...catalogIds]
    .map((id) => ({ catalog: catalogsById.get(id), list: session.selections?.[String(id)] ?? [] }))
    .filter((r) => r.catalog && r.list.length > 0);

  if (rows.length === 0) return compact ? null : <p className="text-sm text-stone-500">Sin tratamientos cargados.</p>;

  return (
    <dl className={compact ? 'space-y-1' : 'grid gap-x-6 gap-y-3 sm:grid-cols-2'}>
      {rows.map(({ catalog, list }) => (
        <div key={catalog!.id} className={compact ? 'flex flex-wrap items-baseline gap-x-2 gap-y-1' : ''}>
          <dt
            className={
              compact
                ? 'text-xs font-semibold text-stone-500'
                : 'mb-1.5 text-[0.7rem] font-bold tracking-[0.12em] text-stone-400 uppercase'
            }
          >
            {compact ? `${catalog!.name}:` : catalog!.sessionLabel}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {list.map((sel) => (
              <span
                key={sel.itemId}
                className={`inline-flex items-center gap-1 rounded-lg bg-stone-50 font-medium text-stone-800 ring-1 ring-stone-200/70 ring-inset ${
                  compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
                }`}
              >
                {itemsById.get(sel.itemId)?.name ?? 'Ítem eliminado'}
                {sel.detail && <span className="font-normal text-stone-500">({sel.detail})</span>}
                {typeof sel.price === 'number' && (
                  <span className="num ml-0.5 rounded-md bg-salvia-50 px-1.5 font-semibold text-salvia-700">
                    {formatMoney(sel.price)}
                  </span>
                )}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Hoja de calendario" con la fecha de la sesión. */
function DateLeaf({ date, time }: { date: string; time: string }) {
  const d = parseISODate(date);
  return (
    <div
      aria-hidden
      className="flex w-[4.6rem] shrink-0 flex-col items-center self-start overflow-hidden rounded-2xl bg-white text-center ring-1 ring-rosa-100 shadow-[0_6px_16px_-10px_rgb(176_63_88/0.5)]"
    >
      <span className="w-full bg-linear-to-b from-rosa-500 to-rosa-600 py-0.5 text-[0.68rem] font-bold tracking-widest text-white uppercase">
        {MONTHS[d.getMonth()]}
      </span>
      <span className="font-display text-[1.9rem] leading-tight font-semibold text-stone-900">{d.getDate()}</span>
      <span className="pb-1.5 text-[0.7rem] font-medium text-stone-500">{time || d.getFullYear()}</span>
    </div>
  );
}

/** Tarjeta completa de una sesión (para el historial y la línea de tiempo). */
export function SessionCard({
  session,
  showClient = false,
  showPhotos = true,
  onDelete,
}: {
  session: Session;
  showClient?: boolean;
  showPhotos?: boolean;
  onDelete?: (session: Session) => void;
}) {
  const { clientsById } = useData();
  const client = clientsById.get(session.clientId);
  const photos = useLiveQuery(
    () => (showPhotos && session.id ? db.photos.where('sessionId').equals(session.id).toArray() : []),
    [session.id, showPhotos],
  );

  return (
    <article className="card group/card flex gap-5 p-5 transition-shadow hover:shadow-card-hover">
      <DateLeaf date={session.date} time={session.time} />
      <div className="min-w-0 flex-1">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {showClient && (
              <Link
                to={`/clientas/${session.clientId}`}
                className="mb-0.5 flex items-center gap-2 font-semibold text-stone-900 hover:text-rosa-700"
              >
                <Avatar name={clientName(client)} size="sm" />
                {clientName(client)}
              </Link>
            )}
            <p className="font-semibold text-stone-900">
              <span className="capitalize">{weekdayName(session.date)}</span> {formatDate(session.date)}
              {session.time && (
                <span className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-stone-500">
                  <Clock className="size-3.5" aria-hidden />
                  {session.time}
                </span>
              )}
            </p>
            <p className="text-sm text-stone-500">{relativeDays(session.date)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {typeof session.price === 'number' && (
              <Badge tone={session.paid ? 'salvia' : 'amber'} className="mr-1">
                {formatMoney(session.price)} · {session.paid ? 'Pagado' : 'Falta pagar'}
              </Badge>
            )}
            <Link
              to={`/sesion/${session.id}/editar`}
              className={buttonClasses('ghost', 'sm')}
              aria-label={`Editar sesión del ${formatDate(session.date)}`}
            >
              <Pencil className="size-4" aria-hidden /> Editar
            </Link>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(session)}
                className={buttonClasses('ghost', 'sm', 'text-stone-400 hover:bg-red-50 hover:text-red-700')}
                aria-label={`Eliminar sesión del ${formatDate(session.date)}`}
              >
                <Trash2 className="size-4" aria-hidden /> Eliminar
              </button>
            )}
          </div>
        </header>

        <SessionSelections session={session} />
        {typeof session.extraCharge === 'number' && (
          <p className="mt-3 text-sm text-stone-600">
            <span className="font-semibold text-stone-500">Otros cobros: </span>
            {session.extraChargeNote ? `${session.extraChargeNote} · ` : ''}
            <span className="num font-semibold text-salvia-700">{formatMoney(session.extraCharge)}</span>
          </p>
        )}

        {(session.homeRecommendations || session.observations) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {session.homeRecommendations && (
              <div className="rounded-2xl bg-salvia-50/70 p-3.5 ring-1 ring-salvia-100 ring-inset">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-salvia-700 uppercase">
                  <House className="size-3.5" aria-hidden /> Recomendaciones para casa
                </p>
                <p className="text-sm whitespace-pre-line text-stone-800">{session.homeRecommendations}</p>
              </div>
            )}
            {session.observations && (
              <div className="rounded-2xl bg-stone-50 p-3.5 ring-1 ring-stone-200/60 ring-inset">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-stone-500 uppercase">
                  <NotebookPen className="size-3.5" aria-hidden /> Observaciones
                </p>
                <p className="text-sm whitespace-pre-line text-stone-800">{session.observations}</p>
              </div>
            )}
          </div>
        )}
        {session.nextSessionDate && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-stone-600">
            <CalendarClock className="size-4 text-rosa-500" aria-hidden />
            Próxima sesión sugerida: <strong className="text-stone-800">{formatDate(session.nextSessionDate)}</strong>
            <span className="text-stone-400">({relativeDays(session.nextSessionDate)})</span>
          </p>
        )}

        {photos && photos.length > 0 && (
          <div className="mt-4">
            <PhotoStrip photos={photos} />
          </div>
        )}
      </div>
    </article>
  );
}
