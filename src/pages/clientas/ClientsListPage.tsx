import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Wallet, CalendarClock, ChartColumn, ChevronRight, ClipboardList, Clock, UserPlus, Users } from 'lucide-react';
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

/** Columnas de la tabla de clientas (escritorio). */
const ROW_GRID =
  'grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_4.5rem_minmax(0,1.5fr)_minmax(0,1.7fr)_1.25rem] gap-5';

export const PANEL_TABS = [
  { to: '/panel', label: 'Resumen', icon: ChartColumn, end: true },
  { to: '/panel/ingresos', label: 'Ingresos', icon: Wallet },
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
        eyebrow="Panel"
        title="Clientas"
        subtitle={plural(clients.length, 'clienta cargada', 'clientas cargadas')}
        actions={
          <LinkButton to="/clientas/nueva" variant="success" icon={<UserPlus className="size-4" />}>
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
              <LinkButton to="/clientas/nueva" variant="success" icon={<UserPlus className="size-4" />}>
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
        <div className="space-y-5">
          <div className="card space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar por nombre, teléfono o email…"
                label="Buscar clienta"
                className="min-w-72 flex-1"
              />
              <SelectField
                label={<span className="sr-only">Ordenar por</span>}
                value={sort}
                onValueChange={(v) => setSort(v as Sort)}
                className="w-64"
              >
                <option value="ultima">Orden: última visita</option>
                <option value="sesiones">Orden: más sesiones</option>
                <option value="nombre">Orden: nombre (A-Z)</option>
                <option value="alta">Orden: cargadas recientemente</option>
                <option value="proxima">Orden: próxima sesión</option>
              </SelectField>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar clientas">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all ${
                    filter === f.key
                      ? 'bg-rosa-600 text-white shadow-[0_6px_14px_-6px_rgb(176_63_88/0.8)]'
                      : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                  }`}
                >
                  {f.label}
                  <span
                    className={`num rounded-md px-1.5 text-xs font-bold ${
                      filter === f.key ? 'bg-white/25' : 'bg-white text-stone-500'
                    }`}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState compact title="No hay clientas que coincidan">
              Probá con otra búsqueda o cambiá el filtro.
            </EmptyState>
          ) : (
            <div className="card overflow-hidden">
              <div
                aria-hidden
                className={`${ROW_GRID} border-b border-stone-100 bg-stone-50/70 px-5 py-2.5 text-xs font-bold tracking-wide text-stone-400 uppercase`}
              >
                <span>Clienta</span>
                <span>Última visita</span>
                <span className="text-right">Sesiones</span>
                <span>Próxima sesión</span>
                <span>Estado</span>
                <span />
              </div>
              <ul aria-label="Clientas" className="stagger divide-y divide-stone-100">
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
                        className={`${ROW_GRID} group items-center px-5 py-3 transition-colors hover:bg-rosa-50/40`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar name={clientName(c)} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-stone-900 group-hover:text-rosa-700">
                              {clientName(c)}
                            </span>
                            <span className="block truncate text-sm text-stone-500">
                              {[skin && `Piel ${skin.toLowerCase()}`, c.phone].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </span>
                        </span>
                        <span className="min-w-0 text-sm">
                          {s?.lastDate ? (
                            <>
                              <span className="block font-medium text-stone-800">{formatDate(s.lastDate)}</span>
                              <span className="block text-stone-500">{relativeDays(s.lastDate, today)}</span>
                            </>
                          ) : (
                            <span className="text-stone-400">Sin sesiones todavía</span>
                          )}
                        </span>
                        <span className="num text-right font-semibold text-stone-800">{s?.count ?? 0}</span>
                        <span className="min-w-0 text-sm">
                          {next === 'pendiente' && (
                            <Badge tone="salvia" icon={<CalendarClock />}>
                              {formatDate(s!.nextSessionDate)} · {relativeDays(s!.nextSessionDate!, today)}
                            </Badge>
                          )}
                          {next === 'vencida' && (
                            <Badge tone="red" icon={<CalendarClock />}>
                              Tenía que volver el {formatDate(s!.nextSessionDate)}
                            </Badge>
                          )}
                          {!next && <span className="text-stone-300">—</span>}
                        </span>
                        <span className="flex min-w-0 flex-wrap gap-1.5">
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
                          {!incomplete && !inactive && <span className="text-sm text-stone-300">Al día</span>}
                        </span>
                        <ChevronRight
                          className="size-5 justify-self-end text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-rosa-500"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
