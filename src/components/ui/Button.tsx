import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none whitespace-nowrap ' +
  'transition-[background-color,box-shadow,transform,color] duration-150 active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-offset-2 text-center leading-tight';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-rosa-600 bg-linear-to-b from-rosa-500 to-rosa-600 text-white hover:from-rosa-600 hover:to-rosa-700 ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_24px_-12px_rgb(176_63_88/0.75)]',
  secondary:
    'bg-white text-stone-800 ring-1 ring-inset ring-stone-200 shadow-[0_1px_2px_rgb(61_21_34/0.05)] ' +
    'hover:bg-stone-50 hover:ring-stone-300',
  soft: 'bg-rosa-50 text-rosa-700 hover:bg-rosa-100 active:bg-rosa-200',
  ghost: 'text-stone-600 hover:bg-stone-900/[0.05] hover:text-stone-900',
  danger: 'bg-red-600 bg-linear-to-b from-red-500 to-red-600 text-white shadow-sm hover:from-red-600 hover:to-red-700',
  success:
    'bg-salvia-600 bg-linear-to-b from-salvia-500 to-salvia-600 text-white hover:from-salvia-600 hover:to-salvia-700 ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-12px_rgb(66_106_82/0.7)]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.95rem]',
  lg: 'h-12 px-5 text-base',
  xl: 'h-14 px-7 text-lg',
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
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
