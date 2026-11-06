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

/** Filtro de período con atajos grandes. */
export function DateRangeFilter({
  preset,
  custom,
  onPreset,
  onCustom,
}: {
  preset: PresetKey;
  custom: DateRange;
  onPreset: (key: PresetKey) => void;
  onCustom: (range: DateRange) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/80 sm:p-4">
      <p className="mb-2 font-bold text-stone-800" id="periodo-label">
        Período
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="periodo-label">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => onPreset(p.key)}
            className={`min-h-10 rounded-full border-2 px-3.5 py-1 font-bold transition-colors ${
              preset === p.key
                ? 'border-rosa-600 bg-rosa-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-rosa-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-2">
          <TextField
            label="Desde"
            type="date"
            value={custom.from ?? ''}
            onValueChange={(v) => onCustom({ ...custom, from: v || null })}
          />
          <TextField
            label="Hasta"
            type="date"
            value={custom.to ?? ''}
            onValueChange={(v) => onCustom({ ...custom, to: v || null })}
          />
        </div>
      )}
    </div>
  );
}
