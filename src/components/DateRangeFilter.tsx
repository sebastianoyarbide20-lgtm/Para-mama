import { addDays, addMonths, startOfMonth, startOfYear, todayISO } from '../lib/dates';
import { TextField } from './ui/Fields';

export type PresetKey = 'mes' | '30' | '90' | '365' | 'anio' | 'todo' | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'mes', label: 'Este mes' },
  { key: '30', label: 'Últimos 30 días' },
  { key: '90', label: 'Últimos 3 meses' },
  { key: '365', label: 'Últimos 12 meses' },
  { key: 'anio', label: 'Este año' },
  { key: 'todo', label: 'Todo' },
  { key: 'custom', label: 'Elegir fechas' },
];

export interface DateRange {
  from: string | null;
  to: string | null;
}

export function rangeForPreset(key: PresetKey, custom: DateRange = { from: null, to: null }): DateRange {
  const today = todayISO();
  switch (key) {
    case 'mes':
      return { from: startOfMonth(today), to: today };
    case '30':
      return { from: addDays(today, -29), to: today };
    case '90':
      return { from: addMonths(today, -3), to: today };
    case '365':
      return { from: addMonths(today, -12), to: today };
    case 'anio':
      return { from: startOfYear(today), to: today };
    case 'todo':
      return { from: null, to: null };
    case 'custom':
      return custom;
  }
}

/** Filtro de período: atajos en una "pastilla" y fechas a elección. */
export function DateRangeFilter({
  preset,
  custom,
  onPreset,
  onCustom,
  children,
}: {
  preset: PresetKey;
  custom: DateRange;
  onPreset: (key: PresetKey) => void;
  onCustom: (range: DateRange) => void;
  /** Filtros extra que van en la misma barra (a la derecha). */
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-2.5 pl-4">
      <span className="text-sm font-semibold text-stone-500" id="periodo-label">
        Período
      </span>
      <div className="flex flex-wrap gap-1" role="group" aria-labelledby="periodo-label">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => onPreset(p.key)}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition-all duration-150 ${
              preset === p.key
                ? 'bg-rosa-600 text-white shadow-[0_6px_14px_-6px_rgb(176_63_88/0.8)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-end gap-2">
          <TextField
            label="Desde"
            type="date"
            value={custom.from ?? ''}
            onValueChange={(v) => onCustom({ ...custom, from: v || null })}
            className="h-9"
          />
          <TextField
            label="Hasta"
            type="date"
            value={custom.to ?? ''}
            onValueChange={(v) => onCustom({ ...custom, to: v || null })}
            className="h-9"
          />
        </div>
      )}
      {children && <div className="ml-auto flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}
