import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ChartPie, ListOrdered, Package } from 'lucide-react';
import { clientName, useData } from '../../hooks/useData';
import type { MoneyKind, MoneyMovement } from '../../db/types';
import { formatDate } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { PRESETS, rangeForPreset, type DateRange, type PresetKey } from '../../components/DateRangeFilter';
import { KIND_STYLE } from '../../components/economy/kinds';
import type { MovementModalProps } from '../../components/economy/MovementModal';

export const ECONOMY_TABS = [
  { to: '/economia', label: 'Resumen', icon: ChartPie, end: true },
  { to: '/economia/movimientos', label: 'Movimientos', icon: ListOrdered },
  { to: '/economia/productos', label: 'Productos', icon: Package },
];

/** Período elegido, guardado en la dirección (así se mantiene al volver a la pantalla). */
export function usePeriod(defaultPreset: PresetKey) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('periodo');
  const preset = (PRESETS.some((p) => p.key === raw) ? raw : defaultPreset) as PresetKey;
  const [custom, setCustom] = useState<DateRange>({ from: params.get('desde'), to: params.get('hasta') });
  const range = rangeForPreset(preset, custom);

  const setPreset = (key: PresetKey) => {
    const next = new URLSearchParams(params);
    next.set('periodo', key);
    setParams(next, { replace: true });
  };
  const updateCustom = (r: DateRange) => {
    setCustom(r);
    const next = new URLSearchParams(params);
    if (r.from) next.set('desde', r.from);
    else next.delete('desde');
    if (r.to) next.set('hasta', r.to);
    else next.delete('hasta');
    setParams(next, { replace: true });
  };
  const periodText =
    range.from || range.to
      ? `del ${range.from ? formatDate(range.from) : 'inicio'} al ${range.to ? formatDate(range.to) : 'hoy'}`
      : 'todo el historial';
  return { preset, custom, range, setPreset, updateCustom, periodText };
}

/** Estado de la ventana para cargar/editar movimientos. */
export function useMovementModal() {
  const [state, setState] = useState<Omit<MovementModalProps, 'onClose'>>({ open: false });
  return {
    props: { ...state, onClose: () => setState((s) => ({ ...s, open: false })) } as MovementModalProps,
    add: (initialKind: MoneyKind, initialProductId: number | null = null) =>
      setState({ open: true, movement: null, initialKind, initialProductId }),
    edit: (movement: MoneyMovement) => setState({ open: true, movement }),
  };
}

/** Monto con signo: + para ingresos, − para gastos e inversiones. */
export function SignedAmount({
  kind,
  amount,
  className = '',
}: {
  kind: MoneyKind;
  amount: number;
  className?: string;
}) {
  const income = kind === 'ingreso';
  return (
    <span className={`num font-bold whitespace-nowrap ${income ? 'text-sky-800' : 'text-stone-900'} ${className}`}>
      {income ? '+' : '−'} {formatMoney(amount)}
    </span>
  );
}

/** Una fila de movimiento (tocar para editar). */
export function MovementRow({
  movement: m,
  onEdit,
  compact = false,
}: {
  movement: MoneyMovement;
  onEdit: (m: MoneyMovement) => void;
  compact?: boolean;
}) {
  const { conceptsById, itemsById, clientsById } = useData();
  const style = KIND_STYLE[m.kind];
  const Icon = style.icon;
  const product = m.productId ? itemsById.get(m.productId) : undefined;
  const client = m.clientId ? clientsById.get(m.clientId) : undefined;
  const extra = [
    product ? `${product.name}${m.quantity && m.quantity !== 1 ? ` × ${m.quantity}` : ''}` : '',
    client ? clientName(client) : '',
    m.description,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onEdit(m)}
      className={`group flex w-full items-center gap-3 text-left transition-colors hover:bg-rosa-50/40 ${
        compact ? 'rounded-xl px-2 py-2' : 'px-6 py-3'
      }`}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.chip}`} aria-hidden>
        <Icon className="size-[1.1rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-stone-900 group-hover:text-rosa-700">
          {conceptsById.get(m.conceptId)?.name ?? 'Concepto eliminado'}
        </span>
        <span className="block truncate text-sm text-stone-500">
          {formatDate(m.date)}
          {!compact && ` · ${style.label}`}
          {extra.length > 0 && ` · ${extra.join(' · ')}`}
        </span>
      </span>
      <SignedAmount kind={m.kind} amount={m.amount} />
    </button>
  );
}

export function SeeAllLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm font-semibold text-rosa-700 hover:text-rosa-800">
      {children}
    </Link>
  );
}
