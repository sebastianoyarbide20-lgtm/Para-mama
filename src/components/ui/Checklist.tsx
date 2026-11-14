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
      <legend id={legendId} className="mb-2 text-sm font-semibold text-stone-700">
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
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[0.92rem] font-medium transition-all duration-150 ${
                selected
                  ? 'bg-rosa-50 text-rosa-800 ring-2 ring-rosa-400 ring-inset'
                  : 'bg-white text-stone-700 ring-1 ring-stone-200 ring-inset hover:ring-rosa-300'
              }`}
            >
              <span
                aria-hidden
                className={`flex size-[1.1rem] shrink-0 items-center justify-center rounded-[0.35rem] transition-colors ${
                  selected ? 'bg-rosa-600 text-white' : 'ring-[1.5px] ring-stone-300 ring-inset'
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
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed px-3 py-1.5 text-[0.92rem] font-medium transition-colors ${
            noneSelected
              ? 'border-salvia-500 bg-salvia-50 text-salvia-800'
              : 'border-stone-300 bg-white text-stone-500 hover:border-salvia-400 hover:text-salvia-700'
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
      className={`mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-medium transition-colors ${
        checked
          ? 'border-salvia-500 bg-salvia-50 text-salvia-800'
          : 'border-stone-300 bg-white text-stone-500 hover:border-salvia-400 hover:text-salvia-700'
      }`}
    >
      {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}
