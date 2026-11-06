import { useMemo, useState } from 'react';
import { CalendarPlus, History } from 'lucide-react';
import type { Session } from '../../db/types';
import { deleteSession } from '../../db/actions';
import { clientName, useData } from '../../hooks/useData';
import { formatDate, isBetween } from '../../lib/dates';
import { matches } from '../../lib/text';
import { sortSessionsDesc } from '../../lib/stats';
import { plural } from '../../lib/format';
import { PageHeader, EmptyState } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { SearchInput, TextField } from '../../components/ui/Fields';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { SessionCard } from '../../components/SessionCard';
import { SectionTabs } from '../../components/SectionTabs';
import { SESSION_TABS } from './SessionFormPage';

const PAGE_SIZE = 20;

/** Todas las sesiones cargadas, con búsqueda y filtro por fechas. */
export function SessionListPage() {
  const { sessions, clientsById, itemsById } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return sortSessionsDesc(sessions).filter((s) => {
      if (!isBetween(s.date, from || null, to || null)) return false;
      if (!query) return true;
      const items = Object.values(s.selections ?? {})
        .flat()
        .map((sel) => itemsById.get(sel.itemId)?.name ?? '')
        .join(' ');
      const text = `${clientName(clientsById.get(s.clientId))} ${items} ${s.observations} ${s.homeRecommendations}`;
      return matches(text, query);
    });
  }, [sessions, clientsById, itemsById, query, from, to]);

  const remove = async (s: Session) => {
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      message: `Sesión de ${clientName(clientsById.get(s.clientId))} del ${formatDate(s.date)}. Se borra con sus fotos y no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(s.id!);
    toast.success('Sesión eliminada');
  };

  return (
    <div>
      <PageHeader title="Sesión de hoy" subtitle="Todas las sesiones que cargaste." />
      <SectionTabs tabs={SESSION_TABS} />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="Todavía no cargaste sesiones"
          action={
            <LinkButton to="/sesion/nueva" icon={<CalendarPlus className="size-5" />}>
              Registrar la primera
            </LinkButton>
          }
        >
          Cuando registres sesiones, las vas a ver acá.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <span className="mb-1.5 block font-semibold text-stone-800">Buscar</span>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Clienta, tratamiento, producto…"
                label="Buscar sesiones"
              />
            </div>
            <TextField label="Desde" type="date" value={from} onValueChange={setFrom} />
            <TextField label="Hasta" type="date" value={to} onValueChange={setTo} />
          </div>
          <p className="mb-3 text-stone-600">
            {plural(filtered.length, 'sesión', 'sesiones')}
            {(query || from || to) && (
              <button
                type="button"
                className="ml-2 font-bold text-rosa-700 underline underline-offset-2"
                onClick={() => {
                  setQuery('');
                  setFrom('');
                  setTo('');
                }}
              >
                Quitar filtros
              </button>
            )}
          </p>
          {filtered.length === 0 ? (
            <EmptyState compact title="No hay sesiones que coincidan">
              Probá con otra búsqueda o cambiá las fechas.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {filtered.slice(0, limit).map((s) => (
                <li key={s.id}>
                  <SessionCard session={s} showClient showPhotos={false} onDelete={remove} />
                </li>
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Ver más sesiones ({filtered.length - limit} más)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
