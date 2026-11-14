import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarPlus,
  CircleCheck,
  FileSpreadsheet,
  HandCoins,
  Receipt,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { clientName, useData } from '../../hooks/useData';
import { useExport } from '../../hooks/useExport';
import { addDays, formatDate, shortDayLabel, monthLabel, startOfMonth, startOfYear, todayISO } from '../../lib/dates';
import { formatMoney, plural } from '../../lib/format';
import { matches } from '../../lib/text';
import { sortSessionsDesc, suggestGranularity, type Granularity, type TimePoint } from '../../lib/stats';
import {
  chargeLines,
  incomeByClient,
  incomeByItem,
  linesInRange,
  moneySeries,
  OTHER_KEY,
  percentChange,
  summarize,
  type ChargeLine,
  type ItemIncome,
} from '../../lib/finance';
import { setSessionPaid } from '../../db/actions';
import { Card, EmptyState, PageHeader } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { Segmented, SearchInput, SelectField } from '../../components/ui/Fields';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Feedback';
import { AnimatedNumber, BarList, ChartCard, TimeBarChart } from '../../components/Charts';
import { Avatar } from '../../components/ClientPicker';
import {
  DateRangeFilter,
  PRESETS,
  rangeForPreset,
  type DateRange,
  type PresetKey,
} from '../../components/DateRangeFilter';
import { SectionTabs } from '../../components/SectionTabs';
import { PANEL_TABS } from '../clientas/ClientsListPage';

type SortKey = 'total' | 'count' | 'avg' | 'name';

/** Panel → Ingresos: cuánto se cobró, por período, por tratamiento/opción y por clienta. */
export function IncomePage() {
  const { sessions, catalogs, catalogsById, itemsById, clientsById } = useData();
  const { exportCharges } = useExport();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const today = todayISO();

  const allLines = useMemo(() => chargeLines(sessions, catalogsById, itemsById), [sessions, catalogsById, itemsById]);

  /* ---------- filtros ---------- */
  const preset = (PRESETS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : '30') as PresetKey;
  const [custom, setCustom] = useState<DateRange>({ from: params.get('desde'), to: params.get('hasta') });
  const range = rangeForPreset(preset, custom);
  const clientFilter = Number(params.get('clienta')) || null;
  const [catalogFilter, setCatalogFilter] = useState<string>('todas');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('total');
  const [selectedItem, setSelectedItem] = useState<ItemIncome | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const updateCustom = (r: DateRange) => {
    setCustom(r);
    const next = new URLSearchParams(params);
    if (r.from) next.set('desde', r.from);
    else next.delete('desde');
    if (r.to) next.set('hasta', r.to);
    else next.delete('hasta');
    setParams(next, { replace: true });
  };

  // Filtros que no son de fecha (lista, clienta, búsqueda).
  const scoped = useMemo(
    () =>
      allLines.filter((l) => {
        if (clientFilter && l.clientId !== clientFilter) return false;
        if (catalogFilter === OTHER_KEY && l.catalogId !== null) return false;
        if (catalogFilter !== 'todas' && catalogFilter !== OTHER_KEY && String(l.catalogId) !== catalogFilter)
          return false;
        if (query && !matches(`${l.name} ${l.catalogName}`, query)) return false;
        return true;
      }),
    [allLines, clientFilter, catalogFilter, query],
  );
  const lines = useMemo(() => linesInRange(scoped, range.from, range.to), [scoped, range.from, range.to]);
  const summary = summarize(lines);

  const suggested = suggestGranularity(range.from, range.to, sessions);
  const [granularityChoice, setGranularity] = useState<Granularity | null>(null);
  const granularity = granularityChoice ?? suggested;
  const series: TimePoint[] = useMemo(
    () =>
      moneySeries(lines, range.from, range.to, granularity).map((p) => ({
        key: p.key,
        label: p.label,
        sesiones: 0,
        ingresos: p.total,
        cobrado: p.collected,
      })),
    [lines, range.from, range.to, granularity],
  );

  const byItem = useMemo(() => {
    const rows = incomeByItem(lines);
    if (sort === 'count') rows.sort((a, b) => b.count - a.count);
    if (sort === 'avg') rows.sort((a, b) => b.avg - a.avg);
    if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return rows;
  }, [lines, sort]);
  const byClient = useMemo(() => incomeByClient(lines), [lines]);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);

  // Pendientes de cobro: todas las fechas (una deuda vieja también importa).
  const pendingSessions = useMemo(
    () =>
      sortSessionsDesc(
        sessions.filter(
          (s) =>
            !s.paid && typeof s.price === 'number' && s.price > 0 && (!clientFilter || s.clientId === clientFilter),
        ),
      ),
    [sessions, clientFilter],
  );

  const pricedCatalogs = catalogs.filter((c) => c.allowPrice);
  const clientsWithCharges = useMemo(() => {
    const ids = new Set(allLines.map((l) => l.clientId));
    return [...ids]
      .map((id) => ({ id, name: clientName(clientsById.get(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [allLines, clientsById]);

  /* ---------- atajos (no dependen del período elegido) ---------- */
  const quick = (from: string, to: string) => summarize(linesInRange(scoped, from, to));
  const last7 = quick(addDays(today, -6), today);
  const prev7 = quick(addDays(today, -13), addDays(today, -7));
  const last30 = quick(addDays(today, -29), today);
  const prev30 = quick(addDays(today, -59), addDays(today, -30));
  const thisMonth = quick(startOfMonth(today), today);
  const thisYear = quick(startOfYear(today), today);

  const bucketLabel = (key: string) =>
    granularity === 'week' ? `Semana del ${shortDayLabel(key)} al ${shortDayLabel(addDays(key, 6))}` : monthLabel(key);

  const markPaid = async (sessionId: number) => {
    await setSessionPaid(sessionId, true);
    toast.success('Sesión marcada como pagada');
  };

  const periodText =
    range.from || range.to
      ? `${range.from ? formatDate(range.from) : 'el inicio'} al ${range.to ? formatDate(range.to) : 'hoy'}`
      : 'Todo el historial';

  if (allLines.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Panel" title="Ingresos" />
        <SectionTabs tabs={PANEL_TABS} />
        <EmptyState
          icon={<Wallet />}
          title="Todavía no hay montos cargados"
          action={
            <LinkButton to="/sesion/nueva" icon={<CalendarPlus className="size-4" />}>
              Registrar una sesión
            </LinkButton>
          }
        >
          Cuando registres una sesión, anotá cuánto cobraste por cada tratamiento, aparato o producto. Acá vas a ver
          cuánto cobraste por semana, por mes y por cada tratamiento.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Panel"
        title="Ingresos"
        subtitle="Cuánto cobraste: por período, por tratamiento y por clienta."
        actions={
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-4" />}
            onClick={() => void exportCharges(range.from, range.to)}
          >
            Exportar cobros (CSV)
          </Button>
        }
      />
      <SectionTabs tabs={PANEL_TABS} />

      <div className="space-y-6">
        <section aria-label="Resumen rápido" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickTile
            label="Últimos 7 días"
            s={last7}
            change={percentChange(last7.total, prev7.total)}
            vs="7 días anteriores"
          />
          <QuickTile
            label="Últimos 30 días"
            s={last30}
            change={percentChange(last30.total, prev30.total)}
            vs="30 días anteriores"
          />
          <QuickTile label="Este mes" s={thisMonth} highlight />
          <QuickTile label="Este año" s={thisYear} />
        </section>
        {(clientFilter || catalogFilter !== 'todas' || query) && (
          <p className="-mt-3 text-sm text-stone-500">Los totales de arriba también respetan los filtros de abajo.</p>
        )}

        <DateRangeFilter
          preset={preset}
          custom={custom}
          onPreset={(k) => setParam('periodo', k)}
          onCustom={updateCustom}
        />
        <div className="card flex flex-wrap items-end gap-4 p-4">
          <SelectField label="Lista" value={catalogFilter} onValueChange={setCatalogFilter} wrapperClassName="w-56">
            <option value="todas">Todas</option>
            {pricedCatalogs.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
            <option value={OTHER_KEY}>Otros cobros</option>
          </SelectField>
          <SelectField
            label="Clienta"
            value={clientFilter ? String(clientFilter) : ''}
            onValueChange={(v) => setParam('clienta', v || null)}
            wrapperClassName="w-64"
          >
            <option value="">Todas</option>
            {clientsWithCharges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <div className="min-w-64 flex-1">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">Buscar tratamiento / producto</span>
            <SearchInput value={query} onChange={setQuery} placeholder="Ej: peeling" label="Buscar tratamiento" />
          </div>
        </div>

        <section
          aria-label="Totales del período"
          className="card grid grid-cols-2 divide-stone-100 md:grid-cols-5 md:divide-x"
        >
          <Figure label="Total del período" sub={periodText} big>
            <AnimatedNumber value={summary.total} format={formatMoney} />
          </Figure>
          <Figure label="Cobrado" icon={<CircleCheck className="size-4 text-salvia-600" />}>
            {formatMoney(summary.collected)}
          </Figure>
          <Figure
            label="Falta cobrar"
            icon={<HandCoins className="size-4 text-amber-600" />}
            sub={summary.pending > 0 ? 'Sesiones «Falta pagar»' : undefined}
          >
            {formatMoney(summary.pending)}
          </Figure>
          <Figure label="Promedio por sesión" sub={plural(summary.sessions, 'sesión', 'sesiones')}>
            {summary.sessions ? formatMoney(summary.total / summary.sessions) : '–'}
          </Figure>
          <Figure label="Clientas">{String(summary.clients)}</Figure>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            icon={<TrendingUp />}
            tone="salvia"
            title={granularity === 'week' ? 'Ingresos por semana' : 'Ingresos por mes'}
            empty={lines.length === 0}
            actions={
              <Segmented
                label={<span className="sr-only">Agrupar por</span>}
                size="sm"
                allowClear={false}
                value={granularity}
                onChange={(v) => setGranularity(v)}
                options={[
                  { value: 'week', label: 'Semanas' },
                  { value: 'month', label: 'Meses' },
                ]}
              />
            }
            table={{
              columns: [granularity === 'week' ? 'Semana' : 'Mes', 'Total', 'Cobrado'],
              rows: series.map((p) => [
                granularity === 'week' ? `Desde ${formatDate(p.key)}` : p.label,
                formatMoney(p.ingresos),
                formatMoney(p.cobrado),
              ]),
            }}
          >
            <TimeBarChart
              data={series}
              dataKey="ingresos"
              money
              variant="area"
              format={(v) => formatMoney(v)}
              tooltipLabel={(row) => bucketLabel(row.key)}
              height={350}
            />
          </ChartCard>

          <ChartCard title="Los que más ingresos dejan" icon={<Trophy />} tone="amber" empty={byItem.length === 0}>
            <BarList
              tone="salvia"
              format={formatMoney}
              rows={[...byItem]
                .sort((a, b) => b.total - a.total)
                .slice(0, 7)
                .map((r) => ({ key: r.key, name: r.name, value: r.total, sub: r.catalogName }))}
            />
          </ChartCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            padded={false}
            icon={<Receipt />}
            title="Por tratamiento, aparato y producto"
            subtitle="Tocá una fila para ver cada cobro y cuánto le cobraste a cada clienta."
            actions={
              <SelectField
                label={<span className="sr-only">Ordenar</span>}
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
                className="h-9 text-sm"
              >
                <option value="total">Más ingresos</option>
                <option value="count">Más veces</option>
                <option value="avg">Mayor promedio</option>
                <option value="name">Nombre</option>
              </SelectField>
            }
          >
            {byItem.length === 0 ? (
              <p className="px-6 pb-6 text-stone-500">Sin cobros en este período.</p>
            ) : (
              <>
                <div
                  aria-hidden
                  className={`${ITEM_GRID} border-y border-stone-100 bg-stone-50/70 px-6 py-2.5 text-xs font-bold tracking-wide text-stone-400 uppercase`}
                >
                  <span>Opción</span>
                  <span className="text-right">Veces</span>
                  <span className="text-right">Promedio</span>
                  <span>Rango cobrado</span>
                  <span className="text-right">Total</span>
                </div>
                <ul className="max-h-[34rem] divide-y divide-stone-100 overflow-y-auto">
                  {byItem.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(r)}
                        className={`${ITEM_GRID} group w-full items-center px-6 py-3 text-left transition-colors hover:bg-rosa-50/40`}
                      >
                        <span className="min-w-0">
                          <span className="block leading-snug font-semibold text-stone-900 group-hover:text-rosa-700">
                            {r.name}
                          </span>
                          <span className="block truncate text-xs text-stone-500">
                            {r.catalogName} · {plural(r.clients, 'clienta', 'clientas')}
                          </span>
                        </span>
                        <span className="num text-right text-stone-700">{r.count}</span>
                        <span className="num text-right text-stone-700">{formatMoney(r.avg)}</span>
                        <span className="num text-sm whitespace-nowrap text-stone-500">
                          {r.min !== r.max ? (
                            <>
                              de {formatMoney(r.min)} a {formatMoney(r.max)}
                            </>
                          ) : (
                            'Siempre igual'
                          )}
                        </span>
                        <span className="text-right">
                          <span className="num block font-bold text-stone-900">{formatMoney(r.total)}</span>
                          {summary.total > 0 && (
                            <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-stone-100">
                              <span
                                className="block h-full rounded-full bg-linear-to-r from-rosa-400 to-rosa-600"
                                style={{ width: `${Math.max(3, (r.total / summary.total) * 100)}%` }}
                              />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title="Por clienta" icon={<Users />} tone="violet">
            {byClient.length === 0 ? (
              <p className="text-stone-500">Sin cobros en este período.</p>
            ) : (
              <>
                <ul className="-mx-2 space-y-0.5">
                  {(showAllClients ? byClient : byClient.slice(0, 8)).map((c) => (
                    <li key={c.clientId}>
                      <Link
                        to={`/clientas/${c.clientId}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-50"
                      >
                        <Avatar name={clientName(clientsById.get(c.clientId))} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-900">
                            {clientName(clientsById.get(c.clientId))}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {plural(c.sessions, 'sesión', 'sesiones')}
                            {c.pending > 0 && (
                              <span className="font-semibold text-amber-700"> · debe {formatMoney(c.pending)}</span>
                            )}
                          </span>
                        </span>
                        <span className="num shrink-0 text-sm font-bold text-stone-900">{formatMoney(c.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {byClient.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllClients((v) => !v)}
                    className="mt-2 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
                  >
                    {showAllClients ? 'Ver menos' : `Ver todas (${byClient.length})`}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>

        <Card
          icon={<HandCoins />}
          tone="amber"
          title="Falta cobrar"
          subtitle="Sesiones marcadas «Falta pagar», de cualquier fecha."
        >
          {pendingSessions.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-salvia-50/70 p-4 font-medium text-salvia-800">
              <CircleCheck className="size-5" aria-hidden /> No hay nada pendiente de cobro.
            </p>
          ) : (
            <>
              <ul className="grid gap-2 lg:grid-cols-2">
                {(showAllPending ? pendingSessions : pendingSessions.slice(0, 10)).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-2xl bg-stone-50/80 p-3 ring-1 ring-stone-900/[0.03]"
                  >
                    <Avatar name={clientName(clientsById.get(s.clientId))} size="sm" />
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/clientas/${s.clientId}`}
                        className="block truncate text-sm font-semibold text-stone-900 hover:text-rosa-700"
                      >
                        {clientName(clientsById.get(s.clientId))}
                      </Link>
                      <span className="block text-xs text-stone-500">Sesión del {formatDate(s.date)}</span>
                    </span>
                    <span className="num font-bold text-amber-800">{formatMoney(s.price)}</span>
                    <Button variant="soft" size="sm" onClick={() => void markPaid(s.id!)}>
                      Marcar pagada
                    </Button>
                  </li>
                ))}
              </ul>
              {pendingSessions.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllPending((v) => !v)}
                  className="mt-3 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
                >
                  {showAllPending ? 'Ver menos' : `Ver todas (${pendingSessions.length})`}
                </button>
              )}
            </>
          )}
        </Card>
      </div>

      <ItemChargesModal
        item={selectedItem}
        lines={lines}
        onClose={() => setSelectedItem(null)}
        periodText={periodText}
      />
    </div>
  );
}

const ITEM_GRID = 'grid grid-cols-[minmax(0,2.2fr)_4rem_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.1fr)] gap-4';

function QuickTile({
  label,
  s,
  change,
  vs,
  highlight = false,
}: {
  label: string;
  s: ReturnType<typeof summarize>;
  change?: number | null;
  vs?: string;
  highlight?: boolean;
}) {
  let trend: ReactNode = null;
  if (change !== undefined && change !== null && vs) {
    const up = change >= 0;
    trend = (
      <span className="mt-3 flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold ${
            up ? 'bg-salvia-50 text-salvia-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
          {up ? '+' : ''}
          {Math.round(change)}%
        </span>
        <span className="text-stone-500">vs. {vs}</span>
      </span>
    );
  }
  return (
    <div
      className={
        highlight
          ? 'relative overflow-hidden rounded-[1.25rem] bg-linear-to-br from-rosa-700 to-rosa-500 p-5 text-white shadow-[0_24px_44px_-24px_rgb(122_45_64/0.8)]'
          : 'card card-hover p-5'
      }
    >
      {highlight && (
        <span aria-hidden className="absolute -top-10 -right-10 size-36 rounded-full bg-white/15 blur-2xl" />
      )}
      <p className={`relative text-sm font-semibold ${highlight ? 'text-rosa-100' : 'text-stone-500'}`}>{label}</p>
      <p
        className={`num relative mt-2 text-[1.85rem] leading-none font-bold tracking-tight ${highlight ? '' : 'text-stone-900'}`}
      >
        <AnimatedNumber value={s.total} format={formatMoney} />
      </p>
      <p className={`relative mt-2 text-[0.8rem] ${highlight ? 'text-rosa-100' : 'text-stone-500'}`}>
        {plural(s.sessions, 'sesión', 'sesiones')}
        {s.pending > 0 && (
          <span className={`font-semibold ${highlight ? 'text-white' : 'text-amber-700'}`}>
            {' '}
            · falta cobrar {formatMoney(s.pending)}
          </span>
        )}
      </p>
      {trend}
    </div>
  );
}

/** Celda de la franja de totales. */
function Figure({
  label,
  children,
  sub,
  icon,
  big = false,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${big ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
        {icon}
        {label}
      </p>
      <p
        className={`num mt-1 font-bold tracking-tight text-stone-900 ${big ? 'text-[1.7rem] text-rosa-700' : 'text-xl'}`}
      >
        {children}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

/** Cada cobro de una opción en el período: fecha, clienta y monto. */
function ItemChargesModal({
  item,
  lines,
  onClose,
  periodText,
}: {
  item: ItemIncome | null;
  lines: ChargeLine[];
  onClose: () => void;
  periodText: string;
}) {
  const { clientsById } = useData();
  const rows = item ? lines.filter((l) => l.key === item.key).sort((a, b) => b.date.localeCompare(a.date)) : [];
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={item?.name ?? ''}
      description={item ? `${item.catalogName} · ${periodText}` : undefined}
      size="lg"
    >
      {item && (
        <>
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Total" value={formatMoney(item.total)} />
            <Mini label="Veces" value={String(item.count)} />
            <Mini label="Promedio" value={formatMoney(item.avg)} />
            <Mini label="Mín. – máx." value={`${formatMoney(item.min)} – ${formatMoney(item.max)}`} />
          </dl>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl ring-1 ring-stone-200/80">
            {rows.map((l, i) => (
              <li key={`${l.sessionId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={clientName(clientsById.get(l.clientId))} size="sm" />
                  <span className="min-w-0">
                    <Link
                      to={`/clientas/${l.clientId}`}
                      onClick={onClose}
                      className="block truncate font-semibold text-stone-900 hover:text-rosa-700"
                    >
                      {clientName(clientsById.get(l.clientId))}
                    </Link>
                    <span className="block text-sm text-stone-500">{formatDate(l.date)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block font-bold text-stone-900">{formatMoney(l.amount)}</span>
                  {!l.paid && <span className="block text-xs font-semibold text-amber-700">Falta pagar</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-900/[0.03]">
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="num mt-0.5 font-bold text-stone-900">{value}</dd>
    </div>
  );
}
