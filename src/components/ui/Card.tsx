import type { HTMLAttributes, ReactNode } from 'react';

export type Tone = 'rosa' | 'salvia' | 'amber' | 'sky' | 'violet' | 'stone';

/** Fondo y color de los "chips" de ícono por tono. */
export const toneChip: Record<Tone, string> = {
  rosa: 'bg-rosa-50 text-rosa-600 ring-rosa-100',
  salvia: 'bg-salvia-50 text-salvia-600 ring-salvia-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  stone: 'bg-stone-100 text-stone-600 ring-stone-200/60',
};

/** Ícono dentro de un cuadradito de color suave. */
export function IconChip({
  children,
  tone = 'rosa',
  size = 'md',
}: {
  children: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'size-8 rounded-lg [&>svg]:size-4',
    md: 'size-10 rounded-xl [&>svg]:size-5',
    lg: 'size-12 rounded-2xl [&>svg]:size-6',
  };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${sizes[size]} ${toneChip[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  icon,
  tone = 'rosa',
  children,
  className = '',
  padded = true,
  ...props
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Ícono opcional al lado del título. */
  icon?: ReactNode;
  tone?: Tone;
  padded?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={`card ${padded ? 'p-5 xl:p-6' : ''} ${className}`} {...props}>
      {(title || actions) && (
        <header
          className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${padded ? '' : 'px-5 pt-5 xl:px-6'}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <IconChip tone={tone} size="sm">
                {icon}
              </IconChip>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[1.05rem] font-bold tracking-tight text-stone-900">{title}</h2>}
              {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
            </div>
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
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  /** Texto chico arriba del título (por ejemplo, el sector). */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <div className="mb-2 text-sm">{back}</div>}
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[2.15rem] leading-[1.1] font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[0.95rem] text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
      className={`flex flex-col items-center rounded-[1.25rem] border border-dashed border-stone-300/80 bg-white/60 text-center backdrop-blur-sm ${compact ? 'px-6 py-8' : 'px-8 py-14'}`}
    >
      {icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-rosa-100 to-rosa-50 text-rosa-500 ring-1 ring-rosa-100 [&>svg]:size-8">
          {icon}
        </div>
      )}
      <p className="font-display text-xl font-semibold text-stone-900">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-stone-500">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'rosa' | 'salvia' | 'amber' | 'red' | 'blue';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200/70',
  rosa: 'bg-rosa-50 text-rosa-700 ring-rosa-200/70',
  salvia: 'bg-salvia-50 text-salvia-700 ring-salvia-200/70',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  red: 'bg-red-50 text-red-700 ring-red-200/70',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200/70',
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap ring-1 ring-inset [&>svg]:size-3.5 ${badgeTones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
      <span className="size-9 animate-spin rounded-full border-[3px] border-rosa-100 border-t-rosa-500" />
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
        <dd className="break-words whitespace-pre-line text-stone-800">{children}</dd>
      </div>
    </div>
  );
}

/** Contenedor que hace aparecer a sus hijos de a uno (suave). */
export function Stagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`stagger ${className}`}>{children}</div>;
}
