import { ArrowDownLeft, ArrowUpRight, Gem, type LucideIcon } from 'lucide-react';
import type { MoneyKind } from '../../db/types';
import type { BadgeTone, Tone } from '../ui/Card';

/** Colores de los gráficos: validados para daltonismo (azul = entra, rosa = sale). */
export const INCOME_COLOR = '#2f6fb0';
export const EXPENSE_COLOR = '#c9566d';

/** Cómo se ve cada tipo de movimiento. */
export const KIND_STYLE: Record<
  MoneyKind,
  {
    label: string;
    /** Con artículo, para frases: "el gasto", "la inversión". */
    the: string;
    plural: string;
    help: string;
    placeholder: string;
    icon: LucideIcon;
    tone: Tone;
    badge: BadgeTone;
    /** Fondo + borde de la opción elegida. */
    selected: string;
    chip: string;
    text: string;
  }
> = {
  ingreso: {
    label: 'Ingreso',
    the: 'el ingreso',
    plural: 'Otros ingresos',
    help: 'Plata que entró y no es de una sesión (ej: venta de cremas).',
    placeholder: 'Ej: le vendí un protector solar',
    icon: ArrowDownLeft,
    tone: 'sky',
    badge: 'blue',
    selected: 'bg-sky-50/80 ring-sky-500',
    chip: 'bg-sky-100 text-sky-700',
    text: 'text-sky-800',
  },
  gasto: {
    label: 'Gasto',
    the: 'el gasto',
    plural: 'Gastos',
    help: 'Lo del día a día: productos, alquiler, luz, publicidad…',
    placeholder: 'Ej: compra al distribuidor',
    icon: ArrowUpRight,
    tone: 'rosa',
    badge: 'rosa',
    selected: 'bg-rosa-50/80 ring-rosa-500',
    chip: 'bg-rosa-100 text-rosa-700',
    text: 'text-rosa-800',
  },
  inversion: {
    label: 'Inversión',
    the: 'la inversión',
    plural: 'Inversiones',
    help: 'Compras grandes que duran: aparatos, muebles, cursos.',
    placeholder: 'Ej: camilla nueva',
    icon: Gem,
    tone: 'violet',
    badge: 'neutral',
    selected: 'bg-violet-50/80 ring-violet-500',
    chip: 'bg-violet-100 text-violet-700',
    text: 'text-violet-800',
  },
};
