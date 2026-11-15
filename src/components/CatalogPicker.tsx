import { useId, useMemo, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Catalog, CatalogItem, SessionSelection } from '../db/types';
import { createItem } from '../db/actions';
import { normalize, compareEs } from '../lib/text';
import { formatMoney, parseMoneyInput } from '../lib/format';
import { formatDate } from '../lib/dates';
import { SearchInput } from './ui/Fields';
import { useToast } from './ui/Feedback';

const VISIBLE_LIMIT = 16;

/**
 * Selector de ítems de un catálogo pensado para tocar con el dedo:
 * chips grandes, buscador y botón para agregar uno nuevo sin salir del formulario.
 */
export function CatalogPicker({
  catalog,
  items,
  value,
  onChange,
  usage,
  label,
  bare = false,
  prices,
  onPriceChange,
  priceHint,
  showMissingPrices = false,
  compact = false,
}: {
  catalog: Catalog;
  items: CatalogItem[];
  value: SessionSelection[];
  onChange: (value: SessionSelection[]) => void;
  /** Cantidad de veces que se usó cada ítem (para mostrar primero los más usados). */
  usage?: Map<number, number>;
  label?: string;
  /** Sin tarjeta alrededor (para usar dentro de otro formulario). */
  bare?: boolean;
  /** Monto escrito para cada ítem elegido (texto, por id de ítem). Solo si el catálogo permite precio. */
  prices?: Record<number, string>;
  onPriceChange?: (itemId: number, text: string) => void;
  /** Último monto que se le cobró a esta clienta por el ítem (solo como sugerencia). */
  priceHint?: (itemId: number) => { price: number; date: string } | null;
  /** Resaltar los ítems elegidos que todavía no tienen monto. */
  showMissingPrices?: boolean;
  /** Versión más chica (para el panel de «Sesión de hoy», con varias listas a la vista). */
  compact?: boolean;
}) {
  const withPrice = catalog.allowPrice && !!onPriceChange;
  const chipSize = compact ? 'h-9 px-3 text-sm' : 'h-10 px-3.5 text-[0.92rem]';
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchId = useId();
  const searchRef = useRef<HTMLDivElement>(null);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.itemId)), [value]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id!, i])), [items]);

  // Más usados primero; el orden no cambia al tocar para que los botones no "salten".
  const options = useMemo(
    () =>
      items
        .filter((i) => i.active || selectedIds.has(i.id!))
        .sort((a, b) => {
          const ua = usage?.get(a.id!) ?? 0;
          const ub = usage?.get(b.id!) ?? 0;
          return ub - ua || compareEs(a.name, b.name);
        }),
    [items, usage, selectedIds],
  );

  const q = normalize(query);
  const filtered = q ? options.filter((i) => normalize(i.name).includes(q)) : options;
  const exactMatch = q ? options.find((i) => normalize(i.name) === q) : undefined;
  // Si la lista es larga se muestran los primeros, pero los elegidos siempre quedan a la vista.
  const visible =
    q || showAll ? filtered : filtered.filter((item, index) => index < VISIBLE_LIMIT || selectedIds.has(item.id!));
  const hiddenCount = filtered.length - visible.length;

  const toggle = (id: number) => {
    if (selectedIds.has(id)) onChange(value.filter((v) => v.itemId !== id));
    else if (catalog.allowMultiple) onChange([...value, { itemId: id }]);
    else onChange([{ itemId: id }]);
  };

  const addNew = async () => {
    const name = query.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const id = await createItem(catalog.id!, { name });
      if (!selectedIds.has(id)) {
        onChange(catalog.allowMultiple ? [...value, { itemId: id }] : [{ itemId: id }]);
      }
      setQuery('');
      toast.success(`Se agregó «${name}» a ${catalog.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setAdding(false);
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (exactMatch) {
      if (!selectedIds.has(exactMatch.id!)) toggle(exactMatch.id!);
      setQuery('');
    } else if (filtered.length === 1) {
      if (!selectedIds.has(filtered[0]!.id!)) toggle(filtered[0]!.id!);
      setQuery('');
    } else if (query.trim()) {
      void addNew();
    }
  };

  const setDetail = (itemId: number, detail: string) => {
    onChange(value.map((v) => (v.itemId === itemId ? { ...v, detail } : v)));
  };

  const focusSearch = () => {
    searchRef.current?.querySelector('input')?.focus();
  };

  return (
    <fieldset className={bare ? '' : compact ? 'card min-w-0 p-4' : 'card p-5 xl:p-6'}>
      <legend className="sr-only">{label ?? catalog.sessionLabel}</legend>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-2.5' : 'mb-3'}`}>
        <h3
          className={`flex items-center gap-2.5 font-bold ${bare ? 'text-sm text-stone-700' : compact ? 'text-[0.95rem] text-stone-900' : 'text-[1.05rem] text-stone-900'}`}
          aria-hidden
        >
          {!bare && (
            <span
              className={`flex items-center justify-center rounded-lg bg-stone-50 ring-1 ring-stone-200/60 ring-inset ${compact ? 'size-7 text-sm' : 'size-8 text-base'}`}
            >
              {catalog.icon}
            </span>
          )}
          {label ?? catalog.sessionLabel}
        </h3>
        {value.length > 0 && (
          <span className="rounded-full bg-rosa-50 px-2.5 py-0.5 text-xs font-bold text-rosa-700 ring-1 ring-rosa-200/70 ring-inset">
            {value.length} {value.length === 1 ? 'elegido' : 'elegidos'}
          </span>
        )}
      </div>

      {/* Ítems elegidos (con detalle y/o monto cobrado) */}
      {value.length > 0 && (catalog.allowDetail || withPrice) && (
        <ul className={compact ? 'mb-2.5 space-y-1.5' : 'mb-3 space-y-2'} aria-label="Elegidos">
          {value.map((sel) => {
            const item = itemsById.get(sel.itemId);
            const name = item?.name ?? 'Ítem eliminado';
            const priceText = prices?.[sel.itemId] ?? '';
            const parsed = parseMoneyInput(priceText);
            const invalid = priceText.trim() !== '' && parsed === null;
            const missing = withPrice && showMissingPrices && priceText.trim() === '';
            const hint = withPrice && priceText.trim() === '' ? priceHint?.(sel.itemId) : null;
            return (
              <li
                key={sel.itemId}
                className={`flex flex-wrap items-center rounded-xl bg-rosa-50/70 ring-1 ring-inset transition-shadow ${compact ? 'gap-1.5 p-1.5' : 'gap-2 p-2'} ${missing ? 'ring-2 ring-amber-400' : 'ring-rosa-100'}`}
              >
                <span
                  className={`flex min-w-0 flex-1 items-center gap-2 pl-1 font-semibold text-rosa-900 ${compact ? 'basis-28 text-sm' : 'basis-40'}`}
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{name}</span>
                </span>
                {catalog.allowDetail && (
                  <input
                    type="text"
                    value={sel.detail ?? ''}
                    onChange={(e) => setDetail(sel.itemId, e.target.value)}
                    placeholder="Detalle (ej: 20%, 2 ml)"
                    aria-label={`Detalle de ${name}`}
                    className={`input-base w-full py-2 ${compact ? 'h-9 text-sm sm:w-32' : 'sm:w-48'}`}
                  />
                )}
                {withPrice && (
                  <span
                    className={`relative ${compact ? 'w-[calc(100%-2.5rem)] sm:w-28' : 'w-[calc(100%-3rem)] sm:w-40'}`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-stone-500"
                    >
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceText}
                      onChange={(e) => onPriceChange!(sel.itemId, e.target.value)}
                      placeholder="¿Cuánto?"
                      aria-label={`Monto cobrado por ${name}`}
                      aria-invalid={invalid || undefined}
                      className={`input-base py-2 pl-7 ${compact ? 'h-9 text-sm' : ''} ${invalid ? 'input-error' : ''}`}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(sel.itemId)}
                  aria-label={`Quitar ${item?.name ?? 'ítem'}`}
                  className={`inline-flex shrink-0 items-center justify-center rounded-lg text-rosa-800 hover:bg-rosa-100 ${compact ? 'size-9' : 'size-10'}`}
                >
                  <X className="size-5" />
                </button>
                {(hint || invalid || missing) && (
                  <p className={`w-full pl-7 ${compact ? 'text-xs' : 'text-sm'}`}>
                    {invalid ? (
                      <span className="font-semibold text-red-700">Escribí solo números. Ej: 25000</span>
                    ) : hint ? (
                      <button
                        type="button"
                        onClick={() => onPriceChange!(sel.itemId, String(hint.price))}
                        className="font-semibold text-rosa-800 underline underline-offset-2"
                      >
                        La última vez le cobraste {formatMoney(hint.price)} ({formatDate(hint.date)}) · usar este monto
                      </button>
                    ) : (
                      <span className="font-semibold text-amber-800">
                        Falta el monto (poné 0 si no se cobró aparte)
                      </span>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div ref={searchRef}>
        <SearchInput
          id={searchId}
          value={query}
          onChange={setQuery}
          onKeyDown={onSearchKeyDown}
          label={`Buscar o agregar en ${catalog.name}`}
          placeholder="Buscar o escribir uno nuevo…"
        />
      </div>

      <div
        className={`flex flex-wrap ${compact ? 'mt-2.5 gap-1.5' : 'mt-3 gap-2'}`}
        role="group"
        aria-label={`Opciones de ${catalog.name}`}
      >
        {visible.map((item) => {
          const selected = selectedIds.has(item.id!);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(item.id!)}
              className={`inline-flex items-center gap-1.5 rounded-xl text-left font-medium transition-all duration-150 ${chipSize} ${
                selected
                  ? 'bg-linear-to-b from-rosa-500 to-rosa-600 text-white shadow-[0_6px_14px_-6px_rgb(176_63_88/0.8)]'
                  : 'bg-white text-stone-700 ring-1 ring-stone-200 ring-inset hover:-translate-y-px hover:text-rosa-700 hover:ring-rosa-300'
              }`}
            >
              {selected && <Check className="size-4 shrink-0" aria-hidden />}
              {item.name}
            </button>
          );
        })}

        {q && !exactMatch && (
          <button
            type="button"
            onClick={() => void addNew()}
            disabled={adding}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-salvia-400 bg-salvia-50 font-semibold text-salvia-800 hover:bg-salvia-100 ${chipSize}`}
          >
            <Plus className="size-4" aria-hidden />
            Agregar «{query.trim()}»
          </button>
        )}

        {!q && (
          <button
            type="button"
            onClick={focusSearch}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-stone-300 font-medium text-stone-500 hover:border-salvia-400 hover:text-salvia-700 ${chipSize}`}
          >
            <Plus className="size-4" aria-hidden />
            Agregar nuevo
          </button>
        )}
      </div>

      {q && filtered.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">
          No hay coincidencias. Tocá «Agregar» (o Enter) para sumarlo a la lista.
        </p>
      )}
      {!q && options.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">Todavía no hay opciones. Escribí arriba para agregar la primera.</p>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm font-bold text-rosa-700 underline underline-offset-2"
        >
          Ver todas las opciones ({hiddenCount} más)
        </button>
      )}
      {showAll && !q && options.length > VISIBLE_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 text-sm font-bold text-stone-600 underline underline-offset-2"
        >
          Ver menos
        </button>
      )}
    </fieldset>
  );
}
