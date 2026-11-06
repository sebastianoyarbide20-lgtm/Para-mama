import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-offset-2 text-center leading-tight';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-rosa-600 text-white shadow-sm hover:bg-rosa-700 active:bg-rosa-800',
  secondary: 'bg-white text-stone-800 ring-1 ring-inset ring-stone-300 shadow-xs hover:bg-stone-50 active:bg-stone-100',
  soft: 'bg-rosa-50 text-rosa-800 ring-1 ring-inset ring-rosa-200 hover:bg-rosa-100 active:bg-rosa-200',
  ghost: 'text-stone-700 hover:bg-stone-100 active:bg-stone-200',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  success: 'bg-salvia-600 text-white shadow-sm hover:bg-salvia-700 active:bg-salvia-800',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-13 px-5 py-3 text-lg',
  xl: 'min-h-16 px-6 py-4 text-xl',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, block, className = '', children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, `${block ? 'w-full' : ''} ${className}`)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, `${block ? 'w-full' : ''} ${className}`)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** Botón chico solo con ícono. Siempre lleva una etiqueta accesible. */
export function IconButton({
  label,
  children,
  className = '',
  tone = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }) {
  const toneClass =
    tone === 'danger' ? 'text-red-700 hover:bg-red-50' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
