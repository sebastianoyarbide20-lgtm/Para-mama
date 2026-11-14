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
import { ChartCard, RankingChart, StatTile, TimeBarChart } from '../../components/Charts';
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
        <PageHeader title="Ingresos" />
        <SectionTabs tabs={PANEL_TABS} />
        <EmptyState
          icon={<Wallet />}
          title="Todavía no hay montos cargados"
          action={
            <LinkButton to="/sesion/nueva" icon={<CalendarPlus className="size-5" />}>
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
        title="Ingresos"
        subtitle="Cuánto cobraste: por período, por tratamiento y por clienta."
        actions={
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-5" />}
            onClick={() => void exportCharges(range.from, range.to)}
          >
            Exportar cobros (CSV)
          </Button>
        }
      />
      <SectionTabs tabs={PANEL_TABS} />

      <div className="space-y-5">
        <section aria-label="Resumen rápido" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickTile
            label="Últimos 7 días"
            s={last7}
            change={percentChange(last7.total, prev7.total)}
            vs="los 7 días anteriores"
          />
          <QuickTile
            label="Últimos 30 días"
            s={last30}
            change={percentChange(last30.total, prev30.total)}
            vs="los 30 días anteriores"
          />
          <QuickTile label="Este mes" s={thisMonth} />
          <QuickTile label="Este año" s={thisYear} />
        </section>
        {(clientFilter || catalogFilter !== 'todas' || query) && (
          <p className="-mt-2 text-sm text-stone-500">Los totales de arriba también respetan los filtros de abajo.</p>
        )}

        <div className="space-y-3">
          <DateRangeFilter
            preset={preset}
            custom={custom}
            onPreset={(k) => setParam('periodo', k)}
            onCustom={updateCustom}
          />
          <div className="grid gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/80 sm:grid-cols-3 sm:p-4">
            <SelectField label="Lista" value={catalogFilter} onValueChange={setCatalogFilter}>
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
            >
              <option value="">Todas</option>
              {clientsWithCharges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <div>
              <span className="mb-1.5 block font-semibold text-stone-800">Buscar tratamiento / producto</span>
              <SearchInput value={query} onChange={setQuery} placeholder="Ej: peeling" label="Buscar tratamiento" />
            </div>
          </div>
        </div>

        <section aria-label="Totales del período" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="col-span-2">
            <StatTile icon={<Wallet />} label={`Total · ${periodText}`} value={formatMoney(summary.total)} />
          </div>
          <StatTile icon={<CircleCheck />} label="Cobrado" value={formatMoney(summary.collected)} />
          <StatTile
            icon={<HandCoins />}
            label="Falta cobrar"
            value={formatMoney(summary.pending)}
            hint={summary.pending > 0 ? 'Sesiones marcadas «Falta pagar»' : undefined}
          />
          <StatTile
            icon={<Receipt />}
            label="Promedio por sesión"
            value={summary.sessions ? formatMoney(summary.total / summary.sessions) : '–'}
            hint={plural(summary.sessions, 'sesión', 'sesiones')}
          />
          <StatTile icon={<Users />} label="Clientas" value={String(summary.clients)} />
        </section>

        <ChartCard
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
            format={(v) => formatMoney(v)}
            tooltipLabel={(row) => bucketLabel(row.key)}
          />
        </ChartCard>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card
            title="Por tratamiento, aparato y producto"
            subtitle="Tocá una fila para ver cada cobro y cuánto le cobraste a cada clienta."
            actions={
              <SelectField
                label={<span className="sr-only">Ordenar</span>}
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
                className="py-1.5 text-sm"
              >
                <option value="total">Más ingresos</option>
                <option value="count">Más veces</option>
                <option value="avg">Mayor promedio</option>
                <option value="name">Nombre</option>
              </SelectField>
            }
          >
            {byItem.length === 0 ? (
              <p className="text-stone-500">Sin cobros en este período.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {byItem.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(r)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-rosa-50/60"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold text-stone-900">{r.name}</span>
                        <span className="block text-sm text-stone-500">
                          {r.catalogName} · {plural(r.count, 'vez', 'veces')} ·{' '}
                          {plural(r.clients, 'clienta', 'clientas')}
                        </span>
                        <span className="block text-sm text-stone-600">
                          Promedio {formatMoney(r.avg)}
                          {r.min !== r.max && (
                            <>
                              {' '}
                              · de {formatMoney(r.min)} a {formatMoney(r.max)}
                            </>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-extrabold text-stone-900 tabular-nums">
                          {formatMoney(r.total)}
                        </span>
                        {summary.total > 0 && (
                          <span className="block text-sm text-stone-500 tabular-nums">
                            {Math.round((r.total / summary.total) * 100)}%
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-5">
            <ChartCard
              title="Los que más ingresos dejan"
              empty={byItem.length === 0}
              table={{
                columns: ['Opción', 'Total'],
                rows: byItem.slice(0, 8).map((r) => [r.name, formatMoney(r.total)]),
              }}
            >
              <RankingChart
                money
                rows={[...byItem]
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8)
                  .map((r) => ({ name: r.name, count: r.total }))}
              />
            </ChartCard>

            <Card title="Por clienta">
              {byClient.length === 0 ? (
                <p className="text-stone-500">Sin cobros en este período.</p>
              ) : (
                <>
                  <ul className="divide-y divide-stone-100">
                    {(showAllClients ? byClient : byClient.slice(0, 8)).map((c) => (
                      <li key={c.clientId} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <Link
                            to={`/clientas/${c.clientId}`}
                            className="block truncate font-bold text-stone-900 hover:text-rosa-700 hover:underline"
                          >
                            {clientName(clientsById.get(c.clientId))}
                          </Link>
                          <span className="block text-sm text-stone-500">
                            {plural(c.sessions, 'sesión', 'sesiones')}
                            {c.pending > 0 && (
                              <span className="font-semibold text-amber-800"> · debe {formatMoney(c.pending)}</span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 font-extrabold text-stone-900 tabular-nums">
                          {formatMoney(c.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {byClient.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllClients((v) => !v)}
                      className="mt-2 text-sm font-bold text-rosa-700 underline underline-offset-2"
                    >
                      {showAllClients ? 'Ver menos' : `Ver todas (${byClient.length})`}
                    </button>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>

        <Card title="Falta cobrar" subtitle="Sesiones marcadas «Falta pagar», de cualquier fecha.">
          {pendingSessions.length === 0 ? (
            <p className="flex items-center gap-2 text-salvia-800">
              <CircleCheck className="size-5" aria-hidden /> No hay nada pendiente de cobro.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(showAllPending ? pendingSessions : pendingSessions.slice(0, 10)).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <Link
                      to={`/clientas/${s.clientId}`}
                      className="block font-bold text-stone-900 hover:text-rosa-700 hover:underline"
                    >
                      {clientName(clientsById.get(s.clientId))}
                    </Link>
                    <span className="block text-sm text-stone-500">Sesión del {formatDate(s.date)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-extrabold text-amber-900 tabular-nums">{formatMoney(s.price)}</span>
                    <Button variant="soft" size="sm" onClick={() => void markPaid(s.id!)}>
                      Marcar pagada
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pendingSessions.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllPending((v) => !v)}
              className="mt-2 text-sm font-bold text-rosa-700 underline underline-offset-2"
            >
              {showAllPending ? 'Ver menos' : `Ver todas (${pendingSessions.length})`}
            </button>
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

function QuickTile({
  label,
  s,
  change,
  vs,
}: {
  label: string;
  s: ReturnType<typeof summarize>;
  change?: number | null;
  vs?: string;
}) {
  let trend: ReactNode = null;
  if (change !== undefined && change !== null && vs) {
    const up = change >= 0;
    trend = (
      <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-salvia-700' : 'text-red-700'}`}>
        {up ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
        {up ? '+' : ''}
        {Math.round(change)}% <span className="font-normal text-stone-500">vs. {vs}</span>
      </span>
    );
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
      <p className="text-sm font-bold text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 tabular-nums">{formatMoney(s.total)}</p>
      <p className="text-sm text-stone-600">
        {plural(s.sessions, 'sesión', 'sesiones')}
        {s.pending > 0 && (
          <span className="font-semibold text-amber-800"> · falta cobrar {formatMoney(s.pending)}</span>
        )}
      </p>
      {trend}
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
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Total" value={formatMoney(item.total)} />
            <Mini label="Veces" value={String(item.count)} />
            <Mini label="Promedio" value={formatMoney(item.avg)} />
            <Mini label="Mín. – máx." value={`${formatMoney(item.min)} – ${formatMoney(item.max)}`} />
          </dl>
          <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
            {rows.map((l, i) => (
              <li key={`${l.sessionId}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <Link
                    to={`/clientas/${l.clientId}`}
                    onClick={onClose}
                    className="block truncate font-semibold text-stone-900 hover:text-rosa-700 hover:underline"
                  >
                    {clientName(clientsById.get(l.clientId))}
                  </Link>
                  <span className="block text-sm text-stone-500">{formatDate(l.date)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold text-stone-900 tabular-nums">{formatMoney(l.amount)}</span>
                  {!l.paid && <span className="block text-xs font-semibold text-amber-800">Falta pagar</span>}
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
    <div className="rounded-xl bg-crema p-2.5">
      <dt className="text-xs font-bold text-stone-500">{label}</dt>
      <dd className="font-extrabold text-stone-900 tabular-nums">{value}</dd>
    </div>
  );
}
