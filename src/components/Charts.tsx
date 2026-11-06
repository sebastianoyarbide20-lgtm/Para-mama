import { useEffect, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from './ui/Card';
import type { TimePoint } from '../lib/stats';

/* Gráficos de una sola serie: un solo color (rosa de la marca), barras finas con punta
   redondeada, grilla horizontal suave, tooltip al tocar y tabla de datos accesible. */

const SERIES = '#b03f58'; // rosa-600 (contraste 5.7:1 sobre blanco)
const GRID = '#e7e5e4'; // stone-200
const TICK = '#78716c'; // stone-500

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard({
  title,
  subtitle,
  children,
  table,
  empty,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  table?: TableSpec;
  empty?: boolean;
  actions?: ReactNode;
}) {
  return (
    <Card title={title} subtitle={subtitle} actions={actions} className="min-w-0">
      {empty ? (
        <p className="rounded-xl bg-stone-50 px-4 py-8 text-center text-stone-500">Sin datos en este período.</p>
      ) : (
        <>
          {children}
          {table && table.rows.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-stone-500 hover:text-stone-800">
                Ver como tabla
              </summary>
              <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-stone-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-stone-50 text-left text-stone-600">
                    <tr>
                      {table.columns.map((c, i) => (
                        <th key={c} scope="col" className={`px-3 py-2 font-bold ${i > 0 ? 'text-right' : ''}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className={`px-3 py-1.5 ${ci > 0 ? 'text-right tabular-nums' : ''}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

interface TooltipRenderProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: unknown }>;
  label?: unknown;
}

function makeTooltip(format: (v: number) => string, labelOf?: (payload: unknown, label: unknown) => string) {
  return function ChartTooltip({ active, payload, label }: TooltipRenderProps) {
    if (!active || !payload?.length) return null;
    const first = payload[0]!;
    const value = Number(first.value ?? 0);
    const title = labelOf ? labelOf(first.payload, label) : String(label ?? '');
    return (
      <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-stone-200">
        <p className="font-bold text-stone-900">{title}</p>
        <p className="text-stone-700 tabular-nums">{format(value)}</p>
      </div>
    );
  };
}

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

/** Columnas a lo largo del tiempo (sesiones o ingresos por semana/mes). */
export function TimeBarChart({
  data,
  dataKey,
  format,
  money = false,
  tooltipLabel,
}: {
  data: TimePoint[];
  dataKey: 'sesiones' | 'ingresos' | 'cobrado';
  format: (v: number) => string;
  money?: boolean;
  tooltipLabel?: (row: TimePoint) => string;
}) {
  const Tip = makeTooltip(format, tooltipLabel ? (p) => tooltipLabel(p as TimePoint) : undefined);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: TICK, fontSize: 13 }}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={money ? 56 : 34}
            tick={{ fill: TICK, fontSize: 13 }}
            tickFormatter={(v: number) => (money ? `$${compact.format(v)}` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'rgb(176 63 88 / 0.08)' }}
            content={(props) => <Tip {...(props as TooltipRenderProps)} />}
          />
          <Bar dataKey={dataKey} fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** En pantallas chicas los nombres se acortan para dejar lugar a las barras. */
function useIsNarrow(breakpoint = 640): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

/** Barras horizontales ordenadas de mayor a menor (rankings). */
export function RankingChart({
  rows,
  unit = ['vez', 'veces'],
}: {
  rows: { name: string; count: number }[];
  /** [singular, plural] para el tooltip. */
  unit?: [string, string];
}) {
  const Tip = makeTooltip(
    (v) => `${v} ${v === 1 ? unit[0] : unit[1]}`,
    (p) => (p as { name: string }).name,
  );
  const narrow = useIsNarrow();
  const height = Math.max(120, rows.length * 38 + 32);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: TICK, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={narrow ? 128 : 178}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: '#44403c', fontSize: 13 }}
            tickFormatter={(v: string) => truncate(v, narrow ? 17 : 25)}
          />
          <Tooltip
            cursor={{ fill: 'rgb(176 63 88 / 0.08)' }}
            content={(props) => <Tip {...(props as TooltipRenderProps)} />}
          />
          <Bar dataKey="count" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Indicador grande (número protagonista). */
export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
      <p className="flex items-center gap-2 text-sm font-bold text-stone-500">
        {icon && <span className="text-rosa-500 [&>svg]:size-5">{icon}</span>}
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}
