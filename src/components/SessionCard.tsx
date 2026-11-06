import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Clock, House, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import type { Session } from '../db/types';
import { db } from '../db/db';
import { clientName, useData } from '../hooks/useData';
import { formatDate, relativeDays, weekdayName } from '../lib/dates';
import { formatMoney } from '../lib/format';
import { Badge } from './ui/Card';
import { buttonClasses } from './ui/Button';
import { PhotoStrip } from './Photos';

/** Lista de lo elegido en cada catálogo de una sesión. */
export function SessionSelections({ session, compact = false }: { session: Session; compact?: boolean }) {
  const { sessionCatalogs, itemsById, catalogsById } = useData();
  // Catálogos actuales + cualquiera que tenga datos en la sesión (aunque ya no se muestre en el formulario).
  const catalogIds = new Set(sessionCatalogs.map((c) => c.id!));
  for (const key of Object.keys(session.selections ?? {})) catalogIds.add(Number(key));
  const rows = [...catalogIds]
    .map((id) => ({ catalog: catalogsById.get(id), list: session.selections?.[String(id)] ?? [] }))
    .filter((r) => r.catalog && r.list.length > 0);

  if (rows.length === 0) return compact ? null : <p className="text-stone-500">Sin tratamientos cargados.</p>;

  return (
    <dl className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {rows.map(({ catalog, list }) => (
        <div key={catalog!.id} className={compact ? 'flex flex-wrap items-baseline gap-x-2 gap-y-1' : ''}>
          <dt className={`text-sm font-bold text-stone-500 ${compact ? '' : 'mb-1'}`}>
            {compact ? `${catalog!.name}:` : catalog!.sessionLabel}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {list.map((sel) => (
              <span
                key={sel.itemId}
                className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-semibold text-stone-800"
              >
                {itemsById.get(sel.itemId)?.name ?? 'Ítem eliminado'}
                {sel.detail && <span className="ml-1 font-normal text-stone-600">({sel.detail})</span>}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
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
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          {showClient && (
            <Link
              to={`/clientas/${session.clientId}`}
              className="text-lg font-extrabold text-stone-900 underline-offset-2 hover:text-rosa-700 hover:underline"
            >
              {clientName(client)}
            </Link>
          )}
          <p className={showClient ? 'text-stone-600' : 'text-lg font-extrabold text-stone-900'}>
            <span className="capitalize">{weekdayName(session.date)}</span> {formatDate(session.date)}
            {session.time && (
              <span className="ml-2 inline-flex items-center gap-1 text-base font-semibold text-stone-500">
                <Clock className="size-4" aria-hidden />
                {session.time}
              </span>
            )}
          </p>
          <p className="text-sm text-stone-500">{relativeDays(session.date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {typeof session.price === 'number' && (
            <Badge tone={session.paid ? 'salvia' : 'amber'}>
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
              className={buttonClasses('ghost', 'sm', 'text-red-700 hover:bg-red-50')}
              aria-label={`Eliminar sesión del ${formatDate(session.date)}`}
            >
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </button>
          )}
        </div>
      </header>

      <SessionSelections session={session} />

      {(session.homeRecommendations || session.observations || session.nextSessionDate) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {session.homeRecommendations && (
            <div className="rounded-xl bg-salvia-50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-salvia-800">
                <House className="size-4" aria-hidden /> Recomendaciones para casa
              </p>
              <p className="whitespace-pre-line text-stone-800">{session.homeRecommendations}</p>
            </div>
          )}
          {session.observations && (
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-stone-600">
                <NotebookPen className="size-4" aria-hidden /> Observaciones
              </p>
              <p className="whitespace-pre-line text-stone-800">{session.observations}</p>
            </div>
          )}
          {session.nextSessionDate && (
            <p className="flex items-center gap-1.5 text-stone-700 sm:col-span-2">
              <CalendarClock className="size-5 text-rosa-600" aria-hidden />
              Próxima sesión sugerida: <strong>{formatDate(session.nextSessionDate)}</strong>
              <span className="text-sm text-stone-500">({relativeDays(session.nextSessionDate)})</span>
            </p>
          )}
        </div>
      )}

      {photos && photos.length > 0 && (
        <div className="mt-4">
          <PhotoStrip photos={photos} />
        </div>
      )}
    </article>
  );
}
