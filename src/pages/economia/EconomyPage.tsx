import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  ChartColumnBig,
  HandCoins,
  ListOrdered,
  PiggyBank,
  Receipt,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDate, shortDayLabel } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { chargeLines, linesInRange } from '../../lib/finance';
import {
  economySeries,
  economySummary,
  movementsInRange,
  suggestEconomyGranularity,
  totalsByConcept,
  type EconomyGranularity,
  type EconomyRow,
} from '../../lib/economy';
import { Card, EmptyState, IconChip, PageHeader, type Tone } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Fields';
import { AnimatedNumber, BarList, ChartCard } from '../../components/Charts';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { SectionTabs } from '../../components/SectionTabs';
import { MovementModal } from '../../components/economy/MovementModal';
import { EconomyChart, EconomyLegend } from '../../components/economy/EconomyChart';
import { KIND_STYLE } from '../../components/economy/kinds';
import { ECONOMY_TABS, MovementRow, SeeAllLink, useMovementModal, usePeriod } from './shared';

/** Economía → Resumen: cuánto entró, cuánto salió y cuánto quedó en el período elegido. */
export function EconomyPage() {
  const { sessions, catalogsById, itemsById, movements, conceptsById } = useData();
  const { preset, custom, range, setPreset, updateCustom, periodText } = usePeriod('mes');
  const modal = useMovementModal();

  const allLines = useMemo(() => chargeLines(sessions, catalogsById, itemsById), [sessions, catalogsById, itemsById]);
  const lines = useMemo(() => linesInRange(allLines, range.from, range.to), [allLines, range.from, range.to]);
  const periodMovements = useMemo(
    () => movementsInRange(movements, range.from, range.to),
    [movements, range.from, range.to],
  );
  const summary = economySummary(lines, periodMovements);

  const suggested = suggestEconomyGranularity(range.from, range.to, lines, periodMovements);
  const [granularityChoice, setGranularity] = useState<EconomyGranularity | null>(null);
  const granularity = granularityChoice ?? suggested;
  const rows = useMemo(
    () => economySeries(allLines, movements, range.from, range.to, granularity),
    [allLines, movements, range.from, range.to, granularity],
  );
  const unit = granularity === 'week' ? 'semana' : 'mes';
  const rowLabel = (r: EconomyRow) =>
    granularity === 'week' ? `Del ${shortDayLabel(r.start)} al ${shortDayLabel(r.end)}` : r.label;
  const average = (pick: (r: EconomyRow) => number) =>
    rows.length ? rows.reduce((a, r) => a + pick(r), 0) / rows.length : 0;

  const expenseConcepts = useMemo(
    () =>
      totalsByConcept(
        periodMovements.filter((m) => m.kind !== 'ingreso'),
        conceptsById,
      ),
    [periodMovements, conceptsById],
  );
  const incomeSources = useMemo(() => {
    const others = totalsByConcept(
      periodMovements.filter((m) => m.kind === 'ingreso'),
      conceptsById,
    ).map((c) => ({ key: c.conceptId, name: c.name, value: c.total, sub: 'Cargado a mano' as ReactNode }));
    const list = summary.sessionsIncome
      ? [
          { key: 'sesiones', name: 'Sesiones', value: summary.sessionsIncome, sub: 'Lo anotado en cada sesión' },
          ...others,
        ]
      : others;
    return list.sort((a, b) => b.value - a.value);
  }, [periodMovements, conceptsById, summary.sessionsIncome]);
  const recent = useMemo(
    () => [...periodMovements].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 6),
    [periodMovements],
  );

  const actions = (
    <>
      <Button variant="secondary" icon={<ArrowDownLeft className="size-4" />} onClick={() => modal.add('ingreso')}>
        Agregar ingreso
      </Button>
      <Button icon={<ArrowUpRight className="size-4" />} onClick={() => modal.add('gasto')}>
        Agregar gasto o inversión
      </Button>
    </>
  );

  const header = (
    <>
      <PageHeader
        eyebrow="Economía"
        title="Resumen económico"
        subtitle="Lo que entró, lo que salió y lo que te quedó."
        actions={actions}
      />
      <SectionTabs tabs={ECONOMY_TABS} />
    </>
  );

  if (allLines.length === 0 && movements.length === 0) {
    return (
      <div>
        {header}
        <EmptyState icon={<PiggyBank />} title="Todavía no hay números para mostrar" action={actions}>
          Acá vas a ver cuánto entró (las sesiones y lo que cargues, como la venta de cremas), cuánto salió (gastos e
          inversiones) y cuánto te quedó.
        </EmptyState>
        <MovementModal {...modal.props} />
      </div>
    );
  }

  const positive = summary.resultado >= 0;
  const empty = summary.income === 0 && summary.egresos === 0;
  let keptText: string;
  if (empty) keptText = 'Sin movimientos en este período.';
  else if (summary.keptPer100 !== null && positive)
    keptText = `De cada $100 que entraron, te quedaron $${Math.round(summary.keptPer100)}.`;
  else keptText = `Salió ${formatMoney(-summary.resultado)} más de lo que entró.`;

  return (
    <div>
      {header}
      <div className="space-y-6">
        <DateRangeFilter preset={preset} custom={custom} onPreset={setPreset} onCustom={updateCustom} />

        {/* Las tres cuentas principales */}
        <section aria-label="Resultado del período" className="stagger grid gap-4 lg:grid-cols-3">
          <BigTile
            label="Entró"
            hint="Ingresos"
            icon={<ArrowDownLeft />}
            tone="sky"
            value={summary.income}
            lines={[
              ['Sesiones', summary.sessionsIncome],
              ['Otros ingresos', summary.otherIncome],
            ]}
          />
          <BigTile
            label="Salió"
            hint="Egresos"
            icon={<ArrowUpRight />}
            tone="rosa"
            value={summary.egresos}
            lines={[
              ['Gastos', summary.gastos],
              ['Inversiones', summary.inversion],
            ]}
          />
          <div
            className={`relative overflow-hidden rounded-[1.25rem] p-6 text-white ${
              positive
                ? 'bg-linear-to-br from-salvia-700 to-salvia-500 shadow-[0_24px_44px_-24px_rgb(54_86_68/0.9)]'
                : 'bg-linear-to-br from-amber-700 to-amber-500 shadow-[0_24px_44px_-24px_rgb(146_64_14/0.8)]'
            }`}
          >
            <span aria-hidden className="absolute -top-12 -right-12 size-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <p className="text-base font-bold">Te quedó</p>
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/20" aria-hidden>
                <Scale className="size-5" />
              </span>
            </div>
            <p className="num relative mt-3 text-[2.4rem] leading-none font-bold tracking-tight">
              <AnimatedNumber value={summary.resultado} format={formatMoney} />
            </p>
            <p className="relative mt-1 text-sm text-white/80">Entró − salió · {periodText}</p>
            <p className="relative mt-4 rounded-xl bg-white/15 px-3.5 py-2.5 text-[0.95rem] font-semibold">
              {keptText}
            </p>
          </div>
        </section>

        {/* Métricas simples */}
        <section
          aria-label="Otros números"
          className="card grid grid-cols-2 divide-stone-100 md:grid-cols-4 md:divide-x"
        >
          <Figure
            icon={<Sparkles className="size-4 text-salvia-600" />}
            label="Sin contar inversiones"
            value={formatMoney(summary.resultadoSinInversion)}
            sub="Lo que deja el día a día"
          />
          <Figure
            icon={<HandCoins className="size-4 text-amber-600" />}
            label="Falta cobrar"
            value={formatMoney(summary.sessionsPending)}
            sub="Ya está sumado en «Entró»"
          />
          <Figure
            icon={<CalendarRange className="size-4 text-sky-600" />}
            label={`Promedio por ${unit}: entró`}
            value={formatMoney(average((r) => r.ingresos))}
            sub={`${rows.length} ${rows.length === 1 ? unit : granularity === 'week' ? 'semanas' : 'meses'}`}
          />
          <Figure
            icon={<CalendarRange className="size-4 text-rosa-600" />}
            label={`Promedio por ${unit}: salió`}
            value={formatMoney(average((r) => r.egresos))}
            sub={`Quedó ${formatMoney(average((r) => r.resultado))} por ${unit}`}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            icon={<ChartColumnBig />}
            tone="sky"
            title={granularity === 'week' ? 'Entró y salió, semana a semana' : 'Entró y salió, mes a mes'}
            empty={rows.length === 0 || empty}
            actions={
              <div className="flex flex-wrap items-center gap-4">
                <EconomyLegend />
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
              </div>
            }
            table={{
              columns: [granularity === 'week' ? 'Semana' : 'Mes', 'Entró', 'Salió', 'Quedó'],
              rows: rows.map((r) => [
                granularity === 'week' ? `Desde ${formatDate(r.start)}` : r.label,
                formatMoney(r.ingresos),
                formatMoney(r.egresos),
                formatMoney(r.resultado),
              ]),
            }}
          >
            <EconomyChart data={rows} labelOf={rowLabel} />
          </ChartCard>

          <ChartCard
            title="¿En qué se fue la plata?"
            subtitle="Gastos e inversiones, por concepto"
            icon={<Receipt />}
            tone="rosa"
            empty={expenseConcepts.length === 0}
          >
            <BarList
              tone="rosa"
              format={formatMoney}
              rows={expenseConcepts.slice(0, 8).map((c) => ({
                key: c.conceptId,
                name: c.name,
                value: c.total,
                sub: KIND_STYLE[c.kind].label,
              }))}
            />
          </ChartCard>
        </div>

        <Card
          padded={false}
          icon={<CalendarRange />}
          tone="violet"
          title={granularity === 'week' ? 'Acumulado semana a semana' : 'Acumulado mes a mes'}
          subtitle="«Acumulado» suma lo que fue quedando desde el principio del período."
        >
          {rows.length === 0 ? (
            <p className="px-6 pb-6 text-stone-500">Sin datos en este período.</p>
          ) : (
            <div className="max-h-[40rem] overflow-auto">
              <table className="w-full text-[0.95rem]">
                <thead className="sticky top-0 z-10 bg-stone-50 text-xs font-bold tracking-wide text-stone-400 uppercase">
                  <tr className="border-y border-stone-100">
                    <th scope="col" className="px-6 py-2.5 text-left">
                      {granularity === 'week' ? 'Semana' : 'Mes'}
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Sesiones
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Otros ingresos
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Gastos
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Inversiones
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Quedó
                    </th>
                    <th scope="col" className="px-6 py-2.5 text-right">
                      Acumulado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-stone-50/60">
                      <th scope="row" className="px-6 py-2.5 text-left font-semibold whitespace-nowrap text-stone-800">
                        {granularity === 'week' ? `Desde ${shortDayLabel(r.start)}` : r.label}
                      </th>
                      <Cell value={r.sesiones} />
                      <Cell value={r.otrosIngresos} />
                      <Cell value={r.gastos} />
                      <Cell value={r.inversion} />
                      <Cell value={r.resultado} strong signed />
                      <Cell value={r.acumulado} signed last />
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white">
                  <tr className="border-t-2 border-stone-200">
                    <th scope="row" className="px-6 py-3 text-left font-bold text-stone-900">
                      Total
                    </th>
                    <Cell value={summary.sessionsIncome} strong />
                    <Cell value={summary.otherIncome} strong />
                    <Cell value={summary.gastos} strong />
                    <Cell value={summary.inversion} strong />
                    <Cell value={summary.resultado} strong signed />
                    <td className="px-6 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="¿De dónde entró?" icon={<ArrowDownLeft />} tone="sky" empty={incomeSources.length === 0}>
            <BarList tone="sky" format={formatMoney} rows={incomeSources} />
          </ChartCard>
          <Card
            title="Últimos movimientos"
            icon={<ListOrdered />}
            tone="stone"
            actions={<SeeAllLink to="/economia/movimientos">Ver todos</SeeAllLink>}
          >
            {recent.length === 0 ? (
              <p className="text-stone-500">No cargaste ingresos, gastos ni inversiones en este período.</p>
            ) : (
              <ul className="-mx-2 -my-1 divide-y divide-stone-100">
                {recent.map((m) => (
                  <li key={m.id}>
                    <MovementRow movement={m} onEdit={modal.edit} compact />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <MovementModal {...modal.props} />
    </div>
  );
}

function BigTile({
  label,
  hint,
  icon,
  tone,
  value,
  lines,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  tone: Tone;
  value: number;
  lines: [string, number][];
}) {
  return (
    <div className="card card-hover p-6">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-stone-800">
          {label} <span className="text-sm font-medium text-stone-400">· {hint}</span>
        </p>
        <IconChip tone={tone}>{icon}</IconChip>
      </div>
      <p className="num mt-3 text-[2.4rem] leading-none font-bold tracking-tight text-stone-900">
        <AnimatedNumber value={value} format={formatMoney} />
      </p>
      <dl className="mt-5 space-y-1.5 border-t border-stone-100 pt-4 text-[0.95rem]">
        {lines.map(([name, amount]) => (
          <div key={name} className="flex items-center justify-between gap-3">
            <dt className="text-stone-500">{name}</dt>
            <dd className="num font-semibold text-stone-800">{formatMoney(amount)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Figure({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
        {icon}
        {label}
      </p>
      <p className="num mt-1 text-xl font-bold tracking-tight text-stone-900">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

function Cell({
  value,
  strong = false,
  signed = false,
  last = false,
}: {
  value: number;
  strong?: boolean;
  signed?: boolean;
  last?: boolean;
}) {
  const negative = signed && value < 0;
  return (
    <td
      className={`num py-2.5 text-right whitespace-nowrap ${last ? 'px-6' : 'px-3'} ${
        strong ? 'font-bold' : ''
      } ${negative ? 'text-red-700' : value === 0 ? 'text-stone-300' : strong ? 'text-stone-900' : 'text-stone-700'}`}
    >
      {formatMoney(value)}
    </td>
  );
}
