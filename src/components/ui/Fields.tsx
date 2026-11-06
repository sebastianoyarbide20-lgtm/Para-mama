import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Search, X } from 'lucide-react';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  optional,
  htmlFor,
  children,
  className = '',
}: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block font-semibold text-stone-800">
        {label}
        {required && (
          <span className="text-rosa-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="ml-1 text-sm font-normal text-stone-500">(opcional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1 text-sm text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  onValueChange?: (value: string) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  wrapperClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, onValueChange, onChange, id, className = '', wrapperClassName, required, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      htmlFor={fieldId}
      className={wrapperClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`input-base ${error ? 'input-error' : ''} ${className}`}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        {...props}
      />
    </FieldShell>
  );
});

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  onValueChange?: (value: string) => void;
  wrapperClassName?: string;
};

export function TextArea({
  label,
  hint,
  error,
  optional,
  onValueChange,
  id,
  className = '',
  wrapperClassName,
  rows = 3,
  required,
  ...props
}: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      htmlFor={fieldId}
      className={wrapperClassName}
    >
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`input-base resize-y leading-relaxed ${error ? 'input-error' : ''} ${className}`}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  onValueChange?: (value: string) => void;
  wrapperClassName?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  hint,
  error,
  optional,
  onValueChange,
  id,
  className = '',
  wrapperClassName,
  children,
  required,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      htmlFor={fieldId}
      className={wrapperClassName}
    >
      <select
        id={fieldId}
        required={required}
        className={`input-base cursor-pointer pr-9 ${error ? 'input-error' : ''} ${className}`}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Grupo de botones grandes para elegir una opción (radio). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  optional,
  size = 'md',
  allowClear = true,
}: {
  label: ReactNode;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  optional?: boolean;
  size?: 'sm' | 'md';
  /** Si se toca la opción ya elegida, se des-selecciona (vuelve a ''). */
  allowClear?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 block font-semibold text-stone-800">
        {label}
        {optional && <span className="ml-1 text-sm font-normal text-stone-500">(opcional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`relative cursor-pointer rounded-xl border-2 font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rosa-400 ${
                size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'
              } ${
                checked
                  ? 'border-rosa-500 bg-rosa-50 text-rosa-800'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                onClick={() => {
                  if (checked && allowClear) onChange('' as T);
                }}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </fieldset>
  );
}

/** Interruptor sí/no. */
export function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-salvia-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold text-stone-800">{label}</span>
        {description && <span className="block text-sm text-stone-500">{description}</span>}
      </label>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  label = 'Buscar',
  className = '',
  autoFocus,
  onKeyDown,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: InputHTMLAttributes<HTMLInputElement>['onKeyDown'];
  id?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-400"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        className="input-base pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Borrar búsqueda"
          className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
