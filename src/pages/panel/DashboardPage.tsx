import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock,
  Database,
  FileSpreadsheet,
  Repeat,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { clientName, useBuiltinCatalogs, useData } from '../../hooks/useData';
import { useExport } from '../../hooks/useExport';
import { formatDate, monthLabel, relativeDays, shortDayLabel, todayISO, addDays } from '../../lib/dates';
import { formatMoney, formatNumber, plural } from '../../lib/format';
import {
  computeKpis,
  crossBySkinType,
  crossCatalogs,
  filterSessionsByRange,
  isInactive,
  ranking,
  suggestGranularity,
  timeSeries,
  type CrossRow,
  type Granularity,
} from '../../lib/stats';
import { PageHeader, EmptyState, Card } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { Segmented, SelectField } from '../../components/ui/Fields';
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

export function DashboardPage() {
  const data = useData();
  const { sessions, clients, clientsById, itemsById, sessionCatalogs, clientStats, settings } = data;
  const { treatments, devices, products } = useBuiltinCatalogs();
  const { exportSessions, exportBackup } = useExport();
  const [params, setParams] = useSearchParams();

  const preset = (PRESETS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : '90') as PresetKey;
  const [custom, setCustom] = useState<DateRange>({
    from: params.get('desde'),
    to: params.get('hasta'),
  });
  const range = rangeForPreset(preset, custom);
  const setPreset = (key: PresetKey) => {
    const next = new URLSearchParams(params);
    next.set('periodo', key);
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

  const inRange = useMemo(
    () => filterSessionsByRange(sessions, range.from, range.to),
    [sessions, range.from, range.to],
  );
  const kpis = useMemo(() => computeKpis(sessions, range.from, range.to), [sessions, range.from, range.to]);

  const suggested = suggestGranularity(range.from, range.to, sessions);
  const [granularityChoice, setGranularity] = useState<Granularity | null>(null);
  const granularity = granularityChoice ?? suggested;
  const series = useMemo(
    () => timeSeries(sessions, range.from, range.to, granularity),
    [sessions, range.from, range.to, granularity],
  );
  const bucketLabel = (key: string) =>
    granularity === 'week' ? `Semana del ${shortDayLabel(key)} al ${shortDayLabel(addDays(key, 6))}` : monthLabel(key);

  const rank = (catalogId: number | undefined, limit = 8) =>
    catalogId ? ranking(inRange, catalogId, itemsById, limit) : [];
  const topTreatments = rank(treatments?.id);
  const topDevices = rank(devices?.id);
  const topProducts = rank(products?.id);

  const customCatalogs = sessionCatalogs.filter((c) => !c.builtIn);
  const [customId, setCustomId] = useState<number | null>(null);
  const customCatalog = customCatalogs.find((c) => c.id === customId) ?? customCatalogs[0];
  const topCustom = rank(customCatalog?.id);

  const activeClientIds = useMemo(() => new Set(inRange.map((s) => s.clientId)), [inRange]);
  const skinRows = useMemo(() => {
    const counts = new Map<number | null, number>();
    for (const id of activeClientIds) {
      const skin = clientsById.get(id)?.skinTypeId ?? null;
      counts.set(skin, (counts.get(skin) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id: id ?? -1,
        name: id === null ? 'Sin cargar' : (itemsById.get(id)?.name ?? 'Sin cargar'),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [activeClientIds, clientsById, itemsById]);

  // Análisis cruzado
  const crossSkin = treatments ? crossBySkinType(inRange, clientsById, treatments.id!, itemsById) : [];
  const [crossBId, setCrossBId] = useState<number | null>(null);
  const crossTargets = sessionCatalogs.filter((c) => c.id !== treatments?.id);
  const crossB =
    crossTargets.find((c) => c.id === crossBId) ?? crossTargets.find((c) => c.id === products?.id) ?? crossTargets[0];
  const crossTreat = treatments && crossB ? crossCatalogs(inRange, treatments.id!, crossB.id!, itemsById) : [];

  // Alertas (no dependen del período)
  const today = todayISO();
  const upcoming = clients
    .map((c) => ({ c, s: clientStats.get(c.id!) }))
    .filter(
      ({ s }) =>
        s?.nextSessionDate && s.nextSessionDate >= addDays(today, -30) && s.nextSessionDate <= addDays(today, 14),
    )
    .sort((a, b) => a.s!.nextSessionDate!.localeCompare(b.s!.nextSessionDate!));
  const inactiveCount = clients.filter((c) => isInactive(clientStats.get(c.id!), settings.inactiveDays, today)).length;

  if (sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Panel y análisis" />
        <SectionTabs tabs={PANEL_TABS} />
        <EmptyState
          icon={<CalendarPlus />}
          title="Todavía no hay sesiones para analizar"
          action={
            <>
              <LinkButton to="/sesion/nueva" icon={<CalendarPlus className="size-5" />}>
                Registrar una sesión
              </LinkButton>
              <LinkButton to="/mis-datos/ajustes" variant="secondary">
                Probar con datos de ejemplo
              </LinkButton>
            </>
          }
        >
          Cuando registres sesiones, acá vas a ver gráficos, rankings y alertas de tus clientas.
        </EmptyState>
      </div>
    );
  }

  const periodText =
    range.from || range.to
      ? `${range.from ? formatDate(range.from) : 'el inicio'} al ${range.to ? formatDate(range.to) : 'hoy'}`
      : 'Todo el historial';

  return (
    <div>
      <PageHeader
        title="Panel y análisis"
        subtitle={periodText}
        actions={
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-5" />}
            onClick={() => void exportSessions(range.from, range.to)}
          >
            Exportar a Excel (CSV)
          </Button>
        }
      />
      <SectionTabs tabs={PANEL_TABS} />

      <div className="space-y-5">
        <DateRangeFilter preset={preset} custom={custom} onPreset={setPreset} onCustom={updateCustom} />

        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <StatTile icon={<CalendarCheck />} label="Sesiones" value={String(kpis.totalSessions)} />
          <StatTile icon={<Users />} label="Clientas atendidas" value={String(kpis.activeClients)} />
          <StatTile
            icon={<UserPlus />}
            label="Clientas nuevas"
            value={String(kpis.newClients)}
            hint="Primera sesión en el período"
          />
          <StatTile
            icon={<Repeat />}
            label="Sesiones por clienta"
            value={kpis.avgSessionsPerClient !== null ? formatNumber(kpis.avgSessionsPerClient) : '–'}
            hint="Promedio"
          />
          <div className="col-span-2 md:col-span-4 xl:col-span-2">
            <StatTile
              icon={<Wallet />}
              label="Ingresos"
              value={kpis.sessionsWithPrice ? formatMoney(kpis.income) : '–'}
              hint={
                kpis.sessionsWithPrice ? (
                  kpis.pending > 0 ? (
                    <>
                      Cobrado {formatMoney(kpis.collected)} ·{' '}
                      <span className="font-bold text-amber-800">falta {formatMoney(kpis.pending)}</span>
                    </>
                  ) : (
                    'Todo cobrado'
                  )
                ) : (
                  'Cargá montos en las sesiones'
                )
              }
            />
          </div>
        </section>

        {(upcoming.length > 0 || inactiveCount > 0) && (
          <Card title="Para tener en cuenta">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-2 font-bold text-stone-700">
                  <CalendarClock className="size-5 text-rosa-600" aria-hidden /> Próximas sesiones sugeridas
                </p>
                {upcoming.length === 0 ? (
                  <p className="text-stone-500">No hay sesiones sugeridas para los próximos días.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
                    {upcoming.slice(0, 6).map(({ c, s }) => {
                      const overdue = s!.nextSessionDate! < today;
                      return (
                        <li key={c.id}>
                          <Link
                            to={`/clientas/${c.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-rosa-50/60"
                          >
                            <span className="font-semibold text-stone-900">{clientName(c)}</span>
                            <span className={`text-sm font-semibold ${overdue ? 'text-red-700' : 'text-salvia-700'}`}>
                              {formatDate(s!.nextSessionDate)} ·{' '}
                              {overdue
                                ? `vencida ${relativeDays(s!.nextSessionDate!, today)}`
                                : relativeDays(s!.nextSessionDate!, today)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link
                  to="/clientas?filtro=proximas"
                  className="mt-2 inline-block text-sm font-bold text-rosa-700 underline underline-offset-2"
                >
                  Ver todas
                </Link>
              </div>
              <Link
                to="/clientas?filtro=inactivas"
                className="flex items-center gap-3 self-start rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                <Clock className="size-8 shrink-0 text-amber-700" aria-hidden />
                <span className="flex-1">
                  <span className="block text-2xl font-extrabold text-amber-950">{inactiveCount}</span>
                  <span className="block font-semibold text-amber-900">
                    {inactiveCount === 1 ? 'clienta hace' : 'clientas hace'} más de {settings.inactiveDays} días que no{' '}
                    {inactiveCount === 1 ? 'viene' : 'vienen'}
                  </span>
                </span>
                <ChevronRight className="size-6 text-amber-700" aria-hidden />
              </Link>
            </div>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title={granularity === 'week' ? 'Sesiones por semana' : 'Sesiones por mes'}
            empty={inRange.length === 0}
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
              columns: [granularity === 'week' ? 'Semana' : 'Mes', 'Sesiones'],
              rows: series.map((p) => [granularity === 'week' ? `Desde ${formatDate(p.key)}` : p.label, p.sesiones]),
            }}
          >
            <TimeBarChart
              data={series}
              dataKey="sesiones"
              format={(v) => plural(v, 'sesión', 'sesiones')}
              tooltipLabel={(row) => bucketLabel(row.key)}
            />
          </ChartCard>

          <ChartCard
            title={granularity === 'week' ? 'Ingresos por semana' : 'Ingresos por mes'}
            subtitle="Suma de los montos cargados en las sesiones"
            empty={kpis.sessionsWithPrice === 0}
            table={{
              columns: [granularity === 'week' ? 'Semana' : 'Mes', 'Ingresos', 'Cobrado'],
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

          <RankingCard title="Tratamientos más realizados" rows={topTreatments} />
          <RankingCard title="Aparatología más usada" rows={topDevices} />
          <RankingCard title="Líquidos y productos más usados" rows={topProducts} />
          <RankingCard
            title="Clientas por tipo de piel"
            subtitle="Clientas atendidas en el período"
            rows={skinRows}
            unit={['clienta', 'clientas']}
          />
          {customCatalog && (
            <RankingCard
              title={`${customCatalog.name}: lo más elegido`}
              rows={topCustom}
              actions={
                customCatalogs.length > 1 ? (
                  <SelectField
                    label={<span className="sr-only">Lista</span>}
                    value={String(customCatalog.id)}
                    onValueChange={(v) => setCustomId(Number(v))}
                    className="py-1.5 text-sm"
                  >
                    {customCatalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                ) : undefined
              }
            />
          )}
        </div>

        <section aria-labelledby="cruces" className="space-y-3">
          <h2 id="cruces" className="text-xl font-extrabold text-stone-900">
            Análisis cruzado
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Tratamientos según tipo de piel" subtitle="Qué tratamientos hacés más en cada tipo de piel">
              <CrossList rows={crossSkin} empty="Todavía no hay datos suficientes en este período." />
            </Card>
            <Card
              title="Qué se combina con cada tratamiento"
              subtitle={crossB ? `${crossB.name} que más usás junto a cada tratamiento` : undefined}
              actions={
                crossTargets.length > 1 ? (
                  <SelectField
                    label={<span className="sr-only">Comparar con</span>}
                    value={String(crossB?.id ?? '')}
                    onValueChange={(v) => setCrossBId(Number(v))}
                    className="py-1.5 text-sm"
                  >
                    {crossTargets.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                ) : undefined
              }
            >
              <CrossList rows={crossTreat} empty="Todavía no hay datos suficientes en este período." />
            </Card>
          </div>
        </section>

        <Card title="Exportar datos" subtitle="Para abrir en Excel o guardar una copia de todo.">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-5" />}
              onClick={() => void exportSessions(range.from, range.to)}
            >
              Sesiones del período (CSV)
            </Button>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-5" />}
              onClick={() => void exportSessions()}
            >
              Todas las sesiones (CSV)
            </Button>
            <Button
              variant="secondary"
              icon={<Database className="size-5" />}
              onClick={() => void exportBackup({ includePhotos: true })}
            >
              Copia completa (JSON)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RankingCard({
  title,
  subtitle,
  rows,
  unit,
  actions,
}: {
  title: string;
  subtitle?: string;
  rows: { name: string; count: number }[];
  unit?: [string, string];
  actions?: React.ReactNode;
}) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      actions={actions}
      empty={rows.length === 0}
      table={{ columns: ['Nombre', unit ? 'Clientas' : 'Veces'], rows: rows.map((r) => [r.name, r.count]) }}
    >
      <RankingChart rows={rows} unit={unit} />
    </ChartCard>
  );
}

function CrossList({ rows, empty }: { rows: CrossRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-stone-500">{empty}</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((r) => (
        <li key={r.id ?? 'none'} className="py-2.5">
          <p className="font-bold text-stone-900">
            {r.name}{' '}
            <span className="text-sm font-semibold text-stone-500">· {plural(r.sessions, 'sesión', 'sesiones')}</span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {r.top.map((t) => (
              <li key={t.id} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-semibold text-stone-800">
                {t.name} <span className="font-normal text-stone-500">×{t.count}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
