import { Link } from 'react-router-dom';
import { CalendarClock, Copy, PartyPopper } from 'lucide-react';
import type { Session } from '../db/types';
import { clientName, useData } from '../hooks/useData';
import { formatDate, relativeDays } from '../lib/dates';
import { sortSessionsDesc } from '../lib/stats';
import { plural } from '../lib/format';
import { ClientAlerts } from './ClientAlerts';
import { SessionSelections } from './SessionCard';
import { Button } from './ui/Button';

/** Resumen de la clienta que acompaña al formulario de sesión. */
export function ClientSummary({
  clientId,
  excludeSessionId,
  onDuplicate,
}: {
  clientId: number;
  excludeSessionId?: number | null;
  onDuplicate?: (session: Session) => void;
}) {
  const { clientsById, sessions } = useData();
  const client = clientsById.get(clientId);
  if (!client) return null;

  const history = sortSessionsDesc(sessions.filter((s) => s.clientId === clientId && s.id !== excludeSessionId));
  const last = history[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold tracking-wide text-rosa-700 uppercase">Ficha de la clienta</p>
          <p className="text-lg font-extrabold text-stone-900">{clientName(client)}</p>
          <p className="text-sm text-stone-500">{plural(history.length, 'sesión anterior', 'sesiones anteriores')}</p>
        </div>
        <Link
          to={`/clientas/${clientId}`}
          className="shrink-0 text-sm font-bold text-rosa-700 underline underline-offset-2"
        >
          Ver ficha
        </Link>
      </div>

      <ClientAlerts client={client} />

      <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
        {last ? (
          <>
            <p className="font-bold text-stone-900">Última sesión</p>
            <p className="mb-2 text-sm text-stone-600">
              {formatDate(last.date)} · {relativeDays(last.date)}
            </p>
            <SessionSelections session={last} compact />
            {last.homeRecommendations && (
              <p className="mt-2 text-sm text-stone-700">
                <span className="font-bold text-stone-500">Para casa: </span>
                {last.homeRecommendations}
              </p>
            )}
            {last.observations && (
              <p className="mt-1 text-sm text-stone-700">
                <span className="font-bold text-stone-500">Notas: </span>
                {last.observations}
              </p>
            )}
            {last.nextSessionDate && (
              <p className="mt-2 flex items-center gap-1 text-sm text-stone-700">
                <CalendarClock className="size-4 text-rosa-600" aria-hidden /> Se le sugirió volver el{' '}
                {formatDate(last.nextSessionDate)}
              </p>
            )}
            {onDuplicate && (
              <Button
                variant="soft"
                size="sm"
                block
                className="mt-3"
                icon={<Copy className="size-4" />}
                onClick={() => onDuplicate(last)}
              >
                Usar la última sesión como base
              </Button>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 text-stone-700">
            <PartyPopper className="size-5 text-rosa-500" aria-hidden /> Es su primera sesión.
          </p>
        )}
      </div>
    </div>
  );
}
