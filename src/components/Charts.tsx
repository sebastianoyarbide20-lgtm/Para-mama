import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, IconChip, type Tone } from './ui/Card';
import type { TimePoint } from '../lib/stats';

/*
 * Gráficos de una sola serie con el rosa de la marca: barras con punta redondeada y un degradé suave,
 * área con línea de 2px para lo que es dinero en el tiempo, grilla horizontal tenue, tooltip oscuro
 * y "Ver como tabla" para leer los números exactos. Los rankings son listas con barras (se leen mejor).
 */

const SERIES = '#b03f58'; // rosa-600
const SERIES_LIGHT = '#c9566d'; // rosa-500
const GRID = '#efebe8';
const TICK = '#8a817c';

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

/* ------------------------------ Animación de números ------------------------------ */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Cuenta desde el valor anterior hasta el nuevo (efecto "contador"). */
export function useCountUp(target: number, duration = 750): number {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const from = useRef(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const initial = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = initial + (target - initial) * eased;
      setValue(current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);
  return value;
}

export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const current = useCountUp(value);
  // Para lectores de pantalla, siempre el valor final.
  return (
    <>
      <span aria-hidden>{format(Math.round(current))}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/* ------------------------------ Contenedor ------------------------------ */

export function ChartCard({
  title,
  subtitle,
  children,
  table,
  empty,
  actions,
  icon,
  tone,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  table?: TableSpec;
  empty?: boolean;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={actions}
      icon={icon}
      tone={tone}
      className={`min-w-0 ${className}`}
    >
      {empty ? (
        <p className="rounded-2xl bg-stone-50/80 px-4 py-10 text-center text-stone-500">Sin datos en este período.</p>
      ) : (
        <>
          {children}
          {table && table.rows.length > 0 && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-[0.8rem] font-semibold text-stone-400 transition-colors hover:text-stone-700">
                <span className="group-open:hidden">Ver como tabla</span>
                <span className="hidden group-open:inline">Ocultar tabla</span>
              </summary>
              <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-stone-200/80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-stone-50 text-left text-stone-500">
                    <tr>
                      {table.columns.map((c, i) => (
                        <th key={c} scope="col" className={`px-3 py-2 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className={`px-3 py-1.5 ${ci > 0 ? 'num text-right' : ''}`}>
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

/* ------------------------------ Tooltip ------------------------------ */

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
      <div className="rounded-xl bg-stone-900/95 px-3 py-2 text-sm text-white shadow-pop ring-1 ring-white/10">
        <p className="text-xs font-medium text-stone-300">{title}</p>
        <p className="num text-base font-bold">{format(value)}</p>
      </div>
    );
  };
}

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

/* ------------------------------ Series de tiempo ------------------------------ */

/** Sesiones o ingresos por semana/mes. "bar" para cantidades, "area" para dinero. */
export function TimeBarChart({
  data,
  dataKey,
  format,
  money = false,
  tooltipLabel,
  variant = 'bar',
  height = 260,
}: {
  data: TimePoint[];
  dataKey: 'sesiones' | 'ingresos' | 'cobrado';
  format: (v: number) => string;
  money?: boolean;
  tooltipLabel?: (row: TimePoint) => string;
  variant?: 'bar' | 'area';
  height?: number;
}) {
  const id = useId().replace(/:/g, '');
  const Tip = makeTooltip(format, tooltipLabel ? (p) => tooltipLabel(p as TimePoint) : undefined);
  const xAxis = (
    <XAxis
      dataKey="label"
      tickLine={false}
      axisLine={false}
      tick={{ fill: TICK, fontSize: 12 }}
      interval="preserveStartEnd"
      minTickGap={16}
      dy={6}
    />
  );
  const yAxis = (
    <YAxis
      allowDecimals={false}
      tickLine={false}
      axisLine={false}
      width={money ? 58 : 32}
      tick={{ fill: TICK, fontSize: 12 }}
      tickFormatter={(v: number) => (money ? `$${compact.format(v)}` : String(v))}
    />
  );
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'area' ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_LIGHT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES_LIGHT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            {xAxis}
            {yAxis}
            <Tooltip
              cursor={{ stroke: '#eca3b0', strokeWidth: 1.5, strokeDasharray: '0' }}
              content={(props) => <Tip {...(props as TooltipRenderProps)} />}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={SERIES}
              strokeWidth={2.25}
              fill={`url(#area-${id})`}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: SERIES }}
              animationDuration={800}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <defs>
              <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_LIGHT} />
                <stop offset="100%" stopColor={SERIES} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            {xAxis}
            {yAxis}
            <Tooltip
              cursor={{ fill: 'rgb(176 63 88 / 0.06)', radius: 8 }}
              content={(props) => <Tip {...(props as TooltipRenderProps)} />}
            />
            <Bar
              dataKey={dataKey}
              fill={`url(#bar-${id})`}
              radius={[7, 7, 2, 2]}
              maxBarSize={30}
              animationDuration={700}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Mini gráfico de tendencia, sin ejes (va dentro de los indicadores). */
export function Sparkline({ values, color = SERIES }: { values: number[]; color?: string }) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-11 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${id})`}
            dot={false}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------ Rankings ------------------------------ */

export interface BarListRow {
  key: string | number;
  name: string;
  value: number;
  /** Texto chico debajo del nombre (opcional). */
  sub?: ReactNode;
}

/** Ranking como lista: nombre completo, barra proporcional detrás y valor a la derecha. */
export function BarList({
  rows,
  format = (v) => String(v),
  onSelect,
  tone = 'rosa',
}: {
  rows: BarListRow[];
  format?: (v: number) => string;
  onSelect?: (row: BarListRow) => void;
  tone?: 'rosa' | 'salvia';
}) {
  const [grown, setGrown] = useState(prefersReducedMotion());
  useEffect(() => {
    const f = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(f);
  }, []);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bar =
    tone === 'rosa' ? 'bg-linear-to-r from-rosa-100 to-rosa-200/80' : 'bg-linear-to-r from-salvia-100 to-salvia-200/80';
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(2, (r.value / max) * 100);
        const inner = (
          <>
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 rounded-lg ${bar} transition-[width] duration-700 ease-out`}
              style={{ width: grown ? `${pct}%` : '0%' }}
            />
            <span className="relative min-w-0 flex-1 text-left">
              <span className="block truncate text-[0.92rem] font-medium text-stone-800">{r.name}</span>
              {r.sub && <span className="block truncate text-xs text-stone-500">{r.sub}</span>}
            </span>
            <span className="num relative shrink-0 text-[0.92rem] font-semibold text-stone-900">{format(r.value)}</span>
          </>
        );
        return (
          <li key={r.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 transition-colors hover:bg-stone-50"
              >
                {inner}
              </button>
            ) : (
              <div className="relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Compatibilidad: ranking simple (nombre + cantidad). */
export function RankingChart({
  rows,
  unit = ['vez', 'veces'],
  money = false,
}: {
  rows: { name: string; count: number }[];
  unit?: [string, string];
  money?: boolean;
}) {
  const money$ = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  return (
    <BarList
      rows={rows.map((r, i) => ({ key: `${r.name}-${i}`, name: r.name, value: r.count }))}
      format={(v) => (money ? money$.format(v) : `${v} ${v === 1 ? unit[0] : unit[1]}`)}
    />
  );
}

/* ------------------------------ Indicadores ------------------------------ */

/** Indicador: ícono, número protagonista (animado), aclaración y mini tendencia opcional. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'rosa',
  amount,
  format,
  spark,
  className = '',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Si se pasa, el número se anima contando hasta este valor. */
  amount?: number;
  format?: (n: number) => string;
  /** Valores para la mini tendencia. */
  spark?: number[];
  className?: string;
}) {
  return (
    <div className={`card card-hover flex flex-col p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-500">{label}</p>
        {icon && (
          <IconChip tone={tone} size="sm">
            {icon}
          </IconChip>
        )}
      </div>
      <p className="num mt-2 text-[1.9rem] leading-none font-bold tracking-tight text-stone-900">
        {amount !== undefined && format ? <AnimatedNumber value={amount} format={format} /> : value}
      </p>
      {hint && <p className="mt-2 text-[0.8rem] text-stone-500">{hint}</p>}
      {spark && spark.length > 1 && (
        <div className="-mx-1 mt-auto pt-3">
          <Sparkline values={spark} />
        </div>
      )}
    </div>
  );
}
