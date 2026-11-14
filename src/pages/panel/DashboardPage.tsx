import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BellRing,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  Clock,
  Database,
  Droplet,
  FileSpreadsheet,
  Flower2,
  Layers,
  ListChecks,
  Repeat,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { Client } from '../../db/types';
import type { ClientStat } from '../../lib/stats';
import { Avatar } from '../../components/ClientPicker';
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
import { Badge, PageHeader, EmptyState, Card, type Tone } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { Segmented, SelectField } from '../../components/ui/Fields';
import { BarList, ChartCard, StatTile, TimeBarChart } from '../../components/Charts';
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
        <PageHeader eyebrow="Panel" title="Resumen" />
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
      ? `Del ${range.from ? formatDate(range.from) : 'inicio'} al ${range.to ? formatDate(range.to) : 'hoy'}`
      : 'Todo el historial';

  return (
    <div>
      <PageHeader
        eyebrow="Panel"
        title="Resumen"
        subtitle={periodText}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Database className="size-4" />}
              onClick={() => void exportBackup({ includePhotos: true })}
            >
              Copia completa
            </Button>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              onClick={() => void exportSessions(range.from, range.to)}
            >
              Exportar a Excel (CSV)
            </Button>
          </>
        }
      />
      <SectionTabs tabs={PANEL_TABS} />

      <div className="space-y-6">
        <DateRangeFilter preset={preset} custom={custom} onPreset={setPreset} onCustom={updateCustom} />

        <section aria-label="Indicadores" className="stagger grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            icon={<CalendarCheck />}
            tone="rosa"
            label="Sesiones"
            value={String(kpis.totalSessions)}
            amount={kpis.totalSessions}
            format={(n) => String(n)}
            spark={series.map((p) => p.sesiones)}
          />
          <StatTile
            icon={<Users />}
            tone="violet"
            label="Clientas atendidas"
            value={String(kpis.activeClients)}
            amount={kpis.activeClients}
            format={(n) => String(n)}
          />
          <StatTile
            icon={<UserPlus />}
            tone="sky"
            label="Clientas nuevas"
            value={String(kpis.newClients)}
            amount={kpis.newClients}
            format={(n) => String(n)}
            hint="Primera sesión en el período"
          />
          <StatTile
            icon={<Repeat />}
            tone="amber"
            label="Sesiones por clienta"
            value={kpis.avgSessionsPerClient !== null ? formatNumber(kpis.avgSessionsPerClient) : '–'}
            hint="Promedio del período"
          />
          <StatTile
            className="col-span-2"
            icon={<Wallet />}
            tone="salvia"
            label="Ingresos"
            value={kpis.sessionsWithPrice ? formatMoney(kpis.income) : '–'}
            amount={kpis.sessionsWithPrice ? kpis.income : undefined}
            format={formatMoney}
            spark={kpis.sessionsWithPrice ? series.map((p) => p.ingresos) : undefined}
            hint={
              kpis.sessionsWithPrice ? (
                kpis.pending > 0 ? (
                  <>
                    Cobrado {formatMoney(kpis.collected)} ·{' '}
                    <span className="font-semibold text-amber-700">falta {formatMoney(kpis.pending)}</span>
                  </>
                ) : (
                  'Todo cobrado'
                )
              ) : (
                'Cargá montos en las sesiones'
              )
            }
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            icon={<CalendarCheck />}
            title={granularity === 'week' ? 'Sesiones por semana' : 'Sesiones por mes'}
            subtitle={`${plural(kpis.totalSessions, 'sesión', 'sesiones')} en el período`}
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
              height={330}
            />
          </ChartCard>

          <AttentionCard
            upcoming={upcoming}
            inactiveCount={inactiveCount}
            inactiveDays={settings.inactiveDays}
            today={today}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            icon={<Wallet />}
            tone="salvia"
            title={granularity === 'week' ? 'Ingresos por semana' : 'Ingresos por mes'}
            subtitle="Suma de lo cobrado en las sesiones"
            empty={kpis.sessionsWithPrice === 0}
            actions={
              <Link
                to="/panel/ingresos"
                className="flex items-center gap-1 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
              >
                Ver ingresos <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
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
              variant="area"
              format={(v) => formatMoney(v)}
              tooltipLabel={(row) => bucketLabel(row.key)}
              height={260}
            />
          </ChartCard>
          <RankingCard
            title="Clientas por tipo de piel"
            subtitle="Clientas atendidas en el período"
            icon={<Flower2 />}
            tone="violet"
            rows={skinRows}
            unit={['clienta', 'clientas']}
          />
        </div>

        <section aria-labelledby="rankings" className="space-y-3">
          <h2 id="rankings" className="font-display text-xl font-semibold text-stone-900">
            Lo más elegido
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <RankingCard title="Tratamientos más realizados" icon={<Sparkles />} rows={topTreatments} />
            <RankingCard title="Aparatología más usada" icon={<Zap />} tone="sky" rows={topDevices} />
            <RankingCard title="Líquidos y productos más usados" icon={<Droplet />} tone="salvia" rows={topProducts} />
            {customCatalog && (
              <RankingCard
                title={`${customCatalog.name}: lo más elegido`}
                icon={<ListChecks />}
                tone="amber"
                rows={topCustom}
                actions={
                  customCatalogs.length > 1 ? (
                    <SelectField
                      label={<span className="sr-only">Lista</span>}
                      value={String(customCatalog.id)}
                      onValueChange={(v) => setCustomId(Number(v))}
                      className="h-9 text-sm"
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
        </section>

        <section aria-labelledby="cruces" className="space-y-3">
          <h2 id="cruces" className="font-display text-xl font-semibold text-stone-900">
            Análisis cruzado
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card
              icon={<Flower2 />}
              tone="violet"
              title="Tratamientos según tipo de piel"
              subtitle="Qué tratamientos hacés más en cada tipo de piel"
            >
              <CrossList rows={crossSkin} empty="Todavía no hay datos suficientes en este período." />
            </Card>
            <Card
              icon={<Layers />}
              title="Qué se combina con cada tratamiento"
              subtitle={crossB ? `${crossB.name} que más usás junto a cada tratamiento` : undefined}
              actions={
                crossTargets.length > 1 ? (
                  <SelectField
                    label={<span className="sr-only">Comparar con</span>}
                    value={String(crossB?.id ?? '')}
                    onValueChange={(v) => setCrossBId(Number(v))}
                    className="h-9 text-sm"
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

        <Card
          icon={<FileSpreadsheet />}
          tone="stone"
          title="Exportar datos"
          subtitle="Para abrir en Excel o guardar una copia de todo."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              onClick={() => void exportSessions(range.from, range.to)}
            >
              Sesiones del período (CSV)
            </Button>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              onClick={() => void exportSessions()}
            >
              Todas las sesiones (CSV)
            </Button>
            <Button
              variant="secondary"
              icon={<Database className="size-4" />}
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

/** "Para tener en cuenta": próximas sesiones sugeridas y clientas que hace mucho no vienen. */
function AttentionCard({
  upcoming,
  inactiveCount,
  inactiveDays,
  today,
}: {
  upcoming: { c: Client; s: ClientStat | undefined }[];
  inactiveCount: number;
  inactiveDays: number;
  today: string;
}) {
  return (
    <Card icon={<BellRing />} tone="amber" title="Para tener en cuenta" className="flex flex-col">
      <p className="mb-2 text-xs font-bold tracking-wide text-stone-400 uppercase">Próximas sesiones sugeridas</p>
      {upcoming.length === 0 ? (
        <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500">
          No hay sesiones sugeridas para los próximos días.
        </p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {upcoming.slice(0, 4).map(({ c, s }) => {
            const overdue = s!.nextSessionDate! < today;
            return (
              <li key={c.id}>
                <Link
                  to={`/clientas/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-50"
                >
                  <Avatar name={clientName(c)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">{clientName(c)}</span>
                    <span className="block text-xs text-stone-500">{formatDate(s!.nextSessionDate)}</span>
                  </span>
                  <Badge tone={overdue ? 'red' : 'salvia'}>
                    {overdue
                      ? `vencida ${relativeDays(s!.nextSessionDate!, today)}`
                      : relativeDays(s!.nextSessionDate!, today)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/clientas?filtro=proximas"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
      >
        Ver todas <ChevronRight className="size-4" aria-hidden />
      </Link>
      {inactiveCount > 0 && (
        <Link
          to="/clientas?filtro=inactivas"
          className="group mt-auto flex items-center gap-3 rounded-2xl bg-linear-to-br from-amber-50 to-orange-50 p-4 ring-1 ring-amber-200/70 transition-shadow hover:shadow-card-hover"
          style={{ marginTop: 'auto' }}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
            <Clock className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="num block font-display text-2xl font-semibold text-amber-950">{inactiveCount}</span>
            <span className="block text-sm font-medium text-amber-900">
              {inactiveCount === 1 ? 'clienta hace' : 'clientas hace'} más de {inactiveDays} días que no{' '}
              {inactiveCount === 1 ? 'viene' : 'vienen'}
            </span>
          </span>
          <ChevronRight
            className="size-5 text-amber-700 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </Card>
  );
}

function RankingCard({
  title,
  subtitle,
  rows,
  unit,
  actions,
  icon,
  tone,
}: {
  title: string;
  subtitle?: string;
  rows: { name: string; count: number }[];
  unit?: [string, string];
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const [one, many] = unit ?? ['vez', 'veces'];
  return (
    <ChartCard title={title} subtitle={subtitle} actions={actions} icon={icon} tone={tone} empty={rows.length === 0}>
      <BarList
        rows={rows.map((r, i) => ({ key: `${r.name}-${i}`, name: r.name, value: r.count }))}
        format={(v) => `${v} ${v === 1 ? one : many}`}
      />
    </ChartCard>
  );
}

function CrossList({ rows, empty }: { rows: CrossRow[]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id ?? 'none'} className="rounded-2xl bg-stone-50/70 p-3.5 ring-1 ring-stone-900/[0.03]">
          <p className="flex items-center justify-between gap-2">
            <span className="font-semibold text-stone-900">{r.name}</span>
            <span className="text-xs font-semibold text-stone-500">{plural(r.sessions, 'sesión', 'sesiones')}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.top.map((t) => (
              <li
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-1 pl-2.5 text-[0.8rem] font-medium text-stone-700 shadow-[0_1px_2px_rgb(61_21_34/0.06)] ring-1 ring-stone-900/5"
              >
                {t.name}
                <span className="num rounded-full bg-rosa-50 px-1.5 text-[0.7rem] font-bold text-rosa-700">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
