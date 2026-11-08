import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, ChartColumn, ChevronRight, ClipboardList, Clock, UserPlus, Users } from 'lucide-react';
import { isAnamnesisComplete } from '../../lib/anamnesis';
import type { Client } from '../../db/types';
import { clientName, useData, useSkinTypeName } from '../../hooks/useData';
import { daysBetween, formatDate, relativeDays, todayISO } from '../../lib/dates';
import { matches } from '../../lib/text';
import { isInactive, nextSessionStatus, EMPTY_CLIENT_STAT } from '../../lib/stats';
import { plural } from '../../lib/format';
import { PageHeader, EmptyState, Badge } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/Button';
import { SearchInput, SelectField } from '../../components/ui/Fields';
import { Avatar } from '../../components/ClientPicker';
import { SectionTabs } from '../../components/SectionTabs';

export const PANEL_TABS = [
  { to: '/panel', label: 'Resumen', icon: ChartColumn, end: true },
  { to: '/clientas', label: 'Clientas', icon: Users },
];

type Filter = 'todas' | 'inactivas' | 'proximas' | 'sin-sesiones' | 'ficha-incompleta';
type Sort = 'ultima' | 'sesiones' | 'nombre' | 'alta' | 'proxima';

export function ClientsListPage() {
  const { clients, clientStats, settings } = useData();
  const skinName = useSkinTypeName();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const filter = (params.get('filtro') as Filter) || 'todas';
  const [sort, setSort] = useState<Sort>(filter === 'proximas' ? 'proxima' : 'ultima');
  const today = todayISO();
  const days = settings.inactiveDays;

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'todas') next.delete('filtro');
    else next.set('filtro', f);
    setParams(next, { replace: true });
    if (f === 'proximas') setSort('proxima');
  };

  const counts = useMemo(() => {
    let inactivas = 0;
    let proximas = 0;
    let sinSesiones = 0;
    let fichaIncompleta = 0;
    for (const c of clients) {
      const s = clientStats.get(c.id!);
      if (!s) sinSesiones++;
      if (!isAnamnesisComplete(c)) fichaIncompleta++;
      if (isInactive(s, days, today)) inactivas++;
      if (nextSessionStatus(s, today)) proximas++;
    }
    return {
      todas: clients.length,
      inactivas,
      proximas,
      'sin-sesiones': sinSesiones,
      'ficha-incompleta': fichaIncompleta,
    };
  }, [clients, clientStats, days, today]);

  const list = useMemo(() => {
    const filtered = clients.filter((c) => {
      if (!matches(`${c.firstName} ${c.lastName} ${c.phone} ${c.email}`, query)) return false;
      const s = clientStats.get(c.id!);
      if (filter === 'inactivas') return isInactive(s, days, today);
      if (filter === 'proximas') return nextSessionStatus(s, today) !== null;
      if (filter === 'sin-sesiones') return !s;
      if (filter === 'ficha-incompleta') return !isAnamnesisComplete(c);
      return true;
    });
    const stat = (c: Client) => clientStats.get(c.id!) ?? EMPTY_CLIENT_STAT;
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'sesiones':
          return stat(b).count - stat(a).count || clientName(a).localeCompare(clientName(b), 'es');
        case 'nombre':
          return clientName(a).localeCompare(clientName(b), 'es');
        case 'alta':
          return b.createdAt.localeCompare(a.createdAt);
        case 'proxima': {
          const na = stat(a).nextSessionDate ?? '9999';
          const nb = stat(b).nextSessionDate ?? '9999';
          return na.localeCompare(nb);
        }
        default: {
          const la = stat(a).lastDate ?? '';
          const lb = stat(b).lastDate ?? '';
          return lb.localeCompare(la) || clientName(a).localeCompare(clientName(b), 'es');
        }
      }
    });
  }, [clients, clientStats, query, filter, sort, days, today]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'inactivas', label: `Hace +${days} días que no vienen` },
    { key: 'proximas', label: 'Con próxima sesión' },
    { key: 'sin-sesiones', label: 'Sin sesiones' },
    { key: 'ficha-incompleta', label: 'Ficha incompleta' },
  ];

  return (
    <div>
      <PageHeader
        title="Clientas"
        subtitle={plural(clients.length, 'clienta cargada', 'clientas cargadas')}
        actions={
          <LinkButton to="/clientas/nueva" variant="success" icon={<UserPlus className="size-5" />}>
            Nueva clienta
          </LinkButton>
        }
      />
      <SectionTabs tabs={PANEL_TABS} />

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Todavía no cargaste clientas"
          action={
            <>
              <LinkButton to="/clientas/nueva" variant="success" icon={<UserPlus className="size-5" />}>
                Agregar la primera
              </LinkButton>
              <LinkButton to="/mis-datos/ajustes" variant="secondary">
                Cargar datos de ejemplo
              </LinkButton>
            </>
          }
        >
          También podés crearlas directamente al registrar una sesión.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar por nombre, teléfono o email…"
              label="Buscar clienta"
            />
            <SelectField
              label={<span className="sr-only">Ordenar por</span>}
              value={sort}
              onValueChange={(v) => setSort(v as Sort)}
              className="sm:w-60"
            >
              <option value="ultima">Orden: última visita</option>
              <option value="sesiones">Orden: más sesiones</option>
              <option value="nombre">Orden: nombre (A-Z)</option>
              <option value="alta">Orden: cargadas recientemente</option>
              <option value="proxima">Orden: próxima sesión</option>
            </SelectField>
          </div>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar clientas">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border-2 px-3.5 py-1 font-bold transition-colors ${
                  filter === f.key
                    ? 'border-rosa-600 bg-rosa-600 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-rosa-300'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-2 text-sm ${filter === f.key ? 'bg-white/25' : 'bg-stone-100 text-stone-600'}`}
                >
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState compact title="No hay clientas que coincidan">
              Probá con otra búsqueda o cambiá el filtro.
            </EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {list.map((c) => {
                const s = clientStats.get(c.id!);
                const inactive = isInactive(s, days, today);
                const next = nextSessionStatus(s, today);
                const incomplete = !isAnamnesisComplete(c);
                const skin = skinName(c);
                return (
                  <li key={c.id}>
                    <Link
                      to={`/clientas/${c.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-stone-200/80 transition-colors hover:bg-rosa-50/50 hover:ring-rosa-200 sm:p-4"
                    >
                      <Avatar name={clientName(c)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 text-lg font-extrabold text-stone-900">
                          {clientName(c)}
                          {skin && (
                            <span className="text-sm font-semibold text-stone-500">Piel {skin.toLowerCase()}</span>
                          )}
                        </p>
                        <p className="text-stone-600">
                          {s?.lastDate ? (
                            <>
                              Última visita: {formatDate(s.lastDate)}{' '}
                              <span className="text-stone-500">({relativeDays(s.lastDate, today)})</span> ·{' '}
                              {plural(s.count, 'sesión', 'sesiones')}
                            </>
                          ) : (
                            'Sin sesiones todavía'
                          )}
                        </p>
                        {(inactive || next || incomplete) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {incomplete && (
                              <Badge tone="amber" icon={<ClipboardList />}>
                                Ficha incompleta
                              </Badge>
                            )}
                            {inactive && s?.lastDate && (
                              <Badge tone="amber" icon={<Clock />}>
                                Hace {daysBetween(s.lastDate, today)} días que no viene
                              </Badge>
                            )}
                            {next === 'pendiente' && (
                              <Badge tone="salvia" icon={<CalendarClock />}>
                                Próxima sesión: {formatDate(s!.nextSessionDate)}
                              </Badge>
                            )}
                            {next === 'vencida' && (
                              <Badge tone="red" icon={<CalendarClock />}>
                                Tenía que volver el {formatDate(s!.nextSessionDate)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-6 shrink-0 text-stone-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
