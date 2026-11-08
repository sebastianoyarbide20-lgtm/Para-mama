import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { NONE, type Option } from '../../lib/anamnesis';

/**
 * Casillas grandes para marcar varias opciones, con una opción "Ninguno/a" que excluye a las demás.
 * Así cada punto de la ficha queda respondido explícitamente (aunque no haya nada que marcar).
 */
export function Checklist({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  noneLabel = 'Ninguno',
  error,
  columns = false,
}: {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  noneLabel?: string;
  error?: boolean;
  /** Muestra las opciones en columnas (para listas largas). */
  columns?: boolean;
}) {
  const legendId = useId();
  const noneSelected = value.includes(NONE);

  const toggle = (key: string) => {
    if (key === NONE) {
      onChange(noneSelected ? [] : [NONE]);
      return;
    }
    const without = value.filter((k) => k !== NONE);
    onChange(without.includes(key) ? without.filter((k) => k !== key) : [...without, key]);
  };

  return (
    <fieldset id={id} className="scroll-mt-28" aria-describedby={error ? `${legendId}-error` : undefined}>
      <legend id={legendId} className="mb-1.5 font-semibold text-stone-800">
        {label}
        <span className="text-rosa-600" aria-hidden="true">
          {' '}
          *
        </span>
      </legend>
      {hint && <p className="-mt-1 mb-2 text-sm text-stone-500">{hint}</p>}
      <div
        className={columns ? 'flex flex-wrap gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-wrap gap-2'}
        role="group"
        aria-labelledby={legendId}
      >
        {options.map((opt) => {
          const selected = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(opt.key)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3.5 py-1.5 text-left font-semibold transition-colors ${
                selected
                  ? 'border-rosa-600 bg-rosa-600 text-white shadow-sm'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-rosa-300 hover:bg-rosa-50'
              }`}
            >
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${
                  selected ? 'border-white bg-white text-rosa-700' : 'border-stone-300'
                }`}
              >
                {selected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              {opt.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={noneSelected}
          onClick={() => toggle(NONE)}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-dashed px-3.5 py-1.5 font-semibold transition-colors ${
            noneSelected
              ? 'border-salvia-600 bg-salvia-600 text-white'
              : 'border-stone-300 bg-white text-stone-600 hover:border-salvia-500 hover:text-salvia-800'
          }`}
        >
          {noneSelected && <Check className="size-4" strokeWidth={3} aria-hidden />}
          {noneLabel}
        </button>
      </div>
      {error && (
        <p id={`${legendId}-error`} className="mt-1.5 text-sm font-semibold text-red-700">
          Marcá al menos una opción o «{noneLabel}».
        </p>
      )}
    </fieldset>
  );
}

/** Botón de opción tipo "No tiene" / "Nunca", para respuestas que reemplazan a un texto o fecha. */
export function NoneToggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-1 text-sm font-bold transition-colors ${
        checked
          ? 'border-salvia-600 bg-salvia-600 text-white'
          : 'border-stone-300 bg-white text-stone-600 hover:border-salvia-500 hover:text-salvia-800'
      }`}
    >
      {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}
