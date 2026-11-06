import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  padded = true,
  ...props
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section
      className={`rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80 ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      {...props}
    >
      {(title || actions) && (
        <header
          className={`mb-3 flex flex-wrap items-start justify-between gap-2 ${padded ? '' : 'px-4 pt-4 sm:px-5'}`}
        >
          <div className="min-w-0">
            {title && <h2 className="text-lg font-bold text-stone-900">{title}</h2>}
            {subtitle && <p className="text-sm text-stone-600">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <div className="mb-1">{back}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-stone-600">{subtitle}</p>}
      </div>
      {actions && (
        // En el celular los botones ocupan todo el ancho (más fáciles de tocar).
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:grow sm:[&>*]:grow-0">{actions}</div>
      )}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 text-center ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}
    >
      {icon && <div className="mb-3 text-rosa-400 [&>svg]:size-10">{icon}</div>}
      <p className="text-lg font-bold text-stone-800">{title}</p>
      {children && <div className="mt-1 max-w-md text-stone-600">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'rosa' | 'salvia' | 'amber' | 'red' | 'blue';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  rosa: 'bg-rosa-50 text-rosa-800 ring-rosa-200',
  salvia: 'bg-salvia-50 text-salvia-800 ring-salvia-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-900 ring-sky-200',
};

export function Badge({
  tone = 'neutral',
  children,
  icon,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset [&>svg]:size-3.5 ${badgeTones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500">
      <span className="size-9 animate-spin rounded-full border-4 border-rosa-200 border-t-rosa-600" />
      <span>{label}</span>
    </div>
  );
}

/** Fila "Etiqueta: valor" para mostrar datos de la ficha. */
export function InfoRow({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      {icon && <span className="mt-0.5 text-stone-400 [&>svg]:size-5">{icon}</span>}
      <div className="min-w-0 flex-1">
        <dt className="text-sm font-semibold text-stone-500">{label}</dt>
        <dd className="whitespace-pre-line break-words text-stone-800">{children}</dd>
      </div>
    </div>
  );
}
