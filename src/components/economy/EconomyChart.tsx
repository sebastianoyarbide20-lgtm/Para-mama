import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EconomyRow } from '../../lib/economy';
import { formatMoney } from '../../lib/format';
import { EXPENSE_COLOR, INCOME_COLOR } from './kinds';

const GRID = '#efebe8';
const TICK = '#8a817c';
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

/** Leyenda de los dos colores (entra / sale). */
export function EconomyLegend() {
  return (
    <div className="flex items-center gap-4 text-sm font-semibold text-stone-600">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px]" style={{ background: INCOME_COLOR }} aria-hidden />
        Entró
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px]" style={{ background: EXPENSE_COLOR }} aria-hidden />
        Salió
      </span>
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

/** Barras lado a lado: lo que entró y lo que salió en cada mes (o semana). */
export function EconomyChart({
  data,
  labelOf,
  height = 320,
}: {
  data: EconomyRow[];
  labelOf: (row: EconomyRow) => string;
  height?: number;
}) {
  const Tip = ({ active, payload }: TipProps) => {
    const row = payload?.[0]?.payload as EconomyRow | undefined;
    if (!active || !row) return null;
    return (
      <div className="min-w-48 rounded-xl bg-stone-900/95 px-3.5 py-2.5 text-sm text-white shadow-pop ring-1 ring-white/10">
        <p className="mb-1.5 text-xs font-medium text-stone-300">{labelOf(row)}</p>
        <p className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: INCOME_COLOR }} aria-hidden /> Entró
          </span>
          <span className="num font-bold">{formatMoney(row.ingresos)}</span>
        </p>
        <p className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: EXPENSE_COLOR }} aria-hidden /> Salió
          </span>
          <span className="num font-bold">{formatMoney(row.egresos)}</span>
        </p>
        <p className="mt-1.5 flex items-center justify-between gap-4 border-t border-white/15 pt-1.5">
          <span className="text-stone-300">Quedó</span>
          <span className="num font-bold">{formatMoney(row.resultado)}</span>
        </p>
      </div>
    );
  };
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={3}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: TICK, fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={12}
            dy={6}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={60}
            tick={{ fill: TICK, fontSize: 12 }}
            tickFormatter={(v: number) => `$${compact.format(v)}`}
          />
          <Tooltip
            cursor={{ fill: 'rgb(47 111 176 / 0.06)', radius: 8 }}
            content={(p) => <Tip {...(p as TipProps)} />}
          />
          <Bar
            dataKey="ingresos"
            name="Entró"
            fill={INCOME_COLOR}
            radius={[6, 6, 2, 2]}
            maxBarSize={26}
            animationDuration={700}
          />
          <Bar
            dataKey="egresos"
            name="Salió"
            fill={EXPENSE_COLOR}
            radius={[6, 6, 2, 2]}
            maxBarSize={26}
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
