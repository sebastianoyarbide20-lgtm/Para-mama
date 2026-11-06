import { useId, useMemo, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Catalog, CatalogItem, SessionSelection } from '../db/types';
import { createItem } from '../db/actions';
import { normalize, compareEs } from '../lib/text';
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
}) {
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
    <fieldset className={bare ? '' : 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 sm:p-5'}>
      <legend className="sr-only">{label ?? catalog.sessionLabel}</legend>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          className={`flex items-center gap-2 font-bold text-stone-900 ${bare ? 'text-base' : 'text-lg'}`}
          aria-hidden
        >
          {!bare && <span>{catalog.icon}</span>}
          {label ?? catalog.sessionLabel}
        </h3>
        {value.length > 0 && (
          <span className="rounded-full bg-rosa-100 px-2.5 py-0.5 text-sm font-bold text-rosa-800">
            {value.length} {value.length === 1 ? 'elegido' : 'elegidos'}
          </span>
        )}
      </div>

      {/* Ítems elegidos (con detalle opcional) */}
      {value.length > 0 && catalog.allowDetail && (
        <ul className="mb-3 space-y-2" aria-label="Elegidos">
          {value.map((sel) => {
            const item = itemsById.get(sel.itemId);
            return (
              <li
                key={sel.itemId}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-rosa-50 p-2 sm:flex-nowrap"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 pl-1 font-semibold text-rosa-900">
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item?.name ?? 'Ítem eliminado'}</span>
                </span>
                <input
                  type="text"
                  value={sel.detail ?? ''}
                  onChange={(e) => setDetail(sel.itemId, e.target.value)}
                  placeholder="Detalle (ej: 20%, 2 ml)"
                  aria-label={`Detalle de ${item?.name ?? 'ítem'}`}
                  className="input-base order-3 w-full py-2 sm:order-none sm:w-56"
                />
                <button
                  type="button"
                  onClick={() => toggle(sel.itemId)}
                  aria-label={`Quitar ${item?.name ?? 'ítem'}`}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-rosa-800 hover:bg-rosa-100"
                >
                  <X className="size-5" />
                </button>
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

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Opciones de ${catalog.name}`}>
        {visible.map((item) => {
          const selected = selectedIds.has(item.id!);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(item.id!)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-left font-semibold transition-colors ${
                selected
                  ? 'border-rosa-600 bg-rosa-600 text-white shadow-sm'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-rosa-300 hover:bg-rosa-50'
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-salvia-500 bg-salvia-50 px-4 py-1.5 font-bold text-salvia-800 hover:bg-salvia-100"
          >
            <Plus className="size-4" aria-hidden />
            Agregar «{query.trim()}»
          </button>
        )}

        {!q && (
          <button
            type="button"
            onClick={focusSearch}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-stone-300 px-4 py-1.5 font-semibold text-stone-600 hover:border-salvia-500 hover:text-salvia-800"
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
