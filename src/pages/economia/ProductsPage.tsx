import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Package, PackagePlus, Pencil, ShoppingBag, Store } from 'lucide-react';
import { useBuiltinCatalogs, useData } from '../../hooks/useData';
import type { CatalogItem } from '../../db/types';
import { formatDate, isBetween } from '../../lib/dates';
import { formatMoney, formatNumber } from '../../lib/format';
import { matches } from '../../lib/text';
import { movementsInRange, productStats, type ProductStat } from '../../lib/economy';
import { Card, EmptyState, IconChip, PageHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchInput, SelectField } from '../../components/ui/Fields';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { SectionTabs } from '../../components/SectionTabs';
import { ItemModal } from '../../components/CatalogModals';
import { MovementModal } from '../../components/economy/MovementModal';
import { ECONOMY_TABS, useMovementModal, usePeriod } from './shared';

type Sort = 'nombre' | 'vendido' | 'comprado' | 'sesiones';

const GRID = 'grid grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_auto] gap-4';

/** Economía → Productos: la lista de cremas y productos, con lo comprado, vendido y usado en sesiones. */
export function ProductsPage() {
  const { itemsByCatalog, itemsById, movements, sessions } = useData();
  const { products: catalog } = useBuiltinCatalogs();
  const { preset, custom, range, setPreset, updateCustom, periodText } = usePeriod('todo');
  const modal = useMovementModal();
  const [itemModal, setItemModal] = useState<{ open: boolean; item: CatalogItem | null }>({ open: false, item: null });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('nombre');
  const [showHidden, setShowHidden] = useState(false);

  const products = useMemo(() => (catalog ? (itemsByCatalog.get(catalog.id!) ?? []) : []), [catalog, itemsByCatalog]);
  const stats = useMemo(() => {
    const ms = movementsInRange(movements, range.from, range.to);
    const ss = sessions.filter((s) => isBetween(s.date, range.from, range.to));
    return productStats(products, ms, ss, catalog?.id);
  }, [products, movements, sessions, range.from, range.to, catalog]);

  const hiddenCount = stats.filter((s) => !s.active).length;
  const rows = useMemo(() => {
    const list = stats.filter((s) => (showHidden || s.active) && (!query || matches(s.name, query)));
    if (sort === 'vendido') list.sort((a, b) => b.soldAmount - a.soldAmount);
    if (sort === 'comprado') list.sort((a, b) => b.boughtAmount - a.boughtAmount);
    if (sort === 'sesiones') list.sort((a, b) => b.usedInSessions - a.usedInSessions);
    return list;
  }, [stats, showHidden, query, sort]);

  const sold = stats.reduce((a, s) => a + s.soldAmount, 0);
  const bought = stats.reduce((a, s) => a + s.boughtAmount, 0);
  const soldUnits = stats.reduce((a, s) => a + s.soldQty, 0);
  const best = [...stats].sort((a, b) => b.soldAmount - a.soldAmount)[0];

  if (!catalog) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Economía"
        title="Productos"
        subtitle="Tus cremas y productos: lo que compraste, lo que vendiste y lo que usaste en las sesiones."
        actions={
          <>
            <Button variant="ghost" icon={<ArrowUpRight className="size-4" />} onClick={() => modal.add('gasto')}>
              Registrar compra
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowDownLeft className="size-4" />}
              onClick={() => modal.add('ingreso')}
            >
              Registrar venta
            </Button>
            <Button icon={<PackagePlus className="size-4" />} onClick={() => setItemModal({ open: true, item: null })}>
              Agregar producto
            </Button>
          </>
        }
      />
      <SectionTabs tabs={ECONOMY_TABS} />

      {products.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Todavía no hay productos"
          action={
            <Button icon={<PackagePlus className="size-4" />} onClick={() => setItemModal({ open: true, item: null })}>
              Agregar producto
            </Button>
          }
        >
          Agregá las cremas y productos que usás o vendés. Es la misma lista de «{catalog.name}» que aparece al
          registrar una sesión.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <DateRangeFilter preset={preset} custom={custom} onPreset={setPreset} onCustom={updateCustom} />

          <section aria-label="Totales de productos" className="stagger grid gap-4 md:grid-cols-3">
            <SummaryTile
              icon={<Store />}
              tone="sky"
              label="Vendiste en productos"
              value={formatMoney(sold)}
              hint={`${formatNumber(soldUnits)} unidades · ${periodText}`}
            />
            <SummaryTile
              icon={<ShoppingBag />}
              tone="rosa"
              label="Compraste productos"
              value={formatMoney(bought)}
              hint="Para vender y para usar en la cabina"
            />
            <SummaryTile
              icon={<Package />}
              tone="violet"
              label="El que más se vende"
              value={best && best.soldAmount > 0 ? best.name : '–'}
              hint={best && best.soldAmount > 0 ? `${formatMoney(best.soldAmount)} vendidos` : 'Todavía sin ventas'}
              small
            />
          </section>

          <Card
            padded={false}
            title={`Lista de ${catalog.name.toLowerCase()}`}
            subtitle={
              <>
                Es la misma lista que usás al registrar una sesión (también está en{' '}
                <Link to={`/mis-datos/lista/${catalog.id}`} className="font-semibold text-rosa-700 hover:underline">
                  Mis datos
                </Link>
                ).
              </>
            }
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar producto" className="w-60" />
                <SelectField
                  label={<span className="sr-only">Ordenar</span>}
                  value={sort}
                  onValueChange={(v) => setSort(v as Sort)}
                  className="h-11 text-sm"
                >
                  <option value="nombre">Por nombre</option>
                  <option value="vendido">Más vendidos</option>
                  <option value="comprado">Más comprados</option>
                  <option value="sesiones">Más usados en sesiones</option>
                </SelectField>
              </div>
            }
          >
            <div
              aria-hidden
              className={`${GRID} border-y border-stone-100 bg-stone-50/70 px-6 py-2.5 text-xs font-bold tracking-wide text-stone-400 uppercase`}
            >
              <span>Producto</span>
              <span className="text-right">Compraste</span>
              <span className="text-right">Vendiste</span>
              <span className="text-right">En sesiones</span>
              <span className="w-[13.5rem]" />
            </div>
            {rows.length === 0 ? (
              <p className="px-6 py-6 text-stone-500">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              <ul aria-label="Productos" className="divide-y divide-stone-100">
                {rows.map((s) => (
                  <ProductRow
                    key={s.productId}
                    stat={s}
                    onSell={() => modal.add('ingreso', s.productId)}
                    onBuy={() => modal.add('gasto', s.productId)}
                    onEdit={() => setItemModal({ open: true, item: itemsById.get(s.productId) ?? null })}
                  />
                ))}
              </ul>
            )}
            {hiddenCount > 0 && (
              <p className="border-t border-stone-100 px-6 py-3 text-sm">
                <button
                  type="button"
                  onClick={() => setShowHidden((v) => !v)}
                  className="font-semibold text-rosa-700 hover:text-rosa-800"
                >
                  {showHidden ? 'Ocultar los desactivados' : `Ver también los desactivados (${hiddenCount})`}
                </button>
              </p>
            )}
          </Card>
        </div>
      )}

      <MovementModal {...modal.props} />
      <ItemModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, item: null })}
        catalog={catalog}
        item={itemModal.item}
      />
    </div>
  );
}

function ProductRow({
  stat: s,
  onSell,
  onBuy,
  onEdit,
}: {
  stat: ProductStat;
  onSell: () => void;
  onBuy: () => void;
  onEdit: () => void;
}) {
  return (
    <li className={`${GRID} items-center px-6 py-3 ${s.active ? '' : 'bg-stone-50/70'}`}>
      <span className="min-w-0">
        <span className={`block font-semibold ${s.active ? 'text-stone-900' : 'text-stone-400'}`}>{s.name}</span>
        <span className="block text-xs text-stone-500">
          {!s.active && 'Desactivado · '}
          {s.lastMovement ? `Último movimiento: ${formatDate(s.lastMovement)}` : 'Sin compras ni ventas'}
        </span>
      </span>
      <Amount qty={s.boughtQty} amount={s.boughtAmount} />
      <Amount qty={s.soldQty} amount={s.soldAmount} income />
      <span className="num text-right text-stone-700">
        {s.usedInSessions ? (
          <>
            {s.usedInSessions} {s.usedInSessions === 1 ? 'vez' : 'veces'}
            {s.sessionAmount > 0 && (
              <span className="block text-xs text-stone-500">cobrado {formatMoney(s.sessionAmount)}</span>
            )}
          </>
        ) : (
          <span className="text-stone-300">–</span>
        )}
      </span>
      <span className="flex w-[13.5rem] items-center justify-end gap-1.5">
        <Button size="sm" variant="secondary" onClick={onSell} aria-label={`Registrar venta de ${s.name}`}>
          Vendí
        </Button>
        <Button size="sm" variant="ghost" onClick={onBuy} aria-label={`Registrar compra de ${s.name}`}>
          Compré
        </Button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${s.name}`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <Pencil className="size-4" />
        </button>
      </span>
    </li>
  );
}

function Amount({ qty, amount, income = false }: { qty: number; amount: number; income?: boolean }) {
  if (!qty && !amount) return <span className="text-right text-stone-300">–</span>;
  return (
    <span className="text-right">
      <span className={`num block font-bold ${income ? 'text-sky-800' : 'text-stone-900'}`}>{formatMoney(amount)}</span>
      <span className="num block text-xs text-stone-500">
        {formatNumber(qty)} {qty === 1 ? 'unidad' : 'unidades'}
      </span>
    </span>
  );
}

function SummaryTile({
  icon,
  tone,
  label,
  value,
  hint,
  small = false,
}: {
  icon: React.ReactNode;
  tone: 'sky' | 'rosa' | 'violet';
  label: string;
  value: string;
  hint: string;
  small?: boolean;
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-500">{label}</p>
        <IconChip tone={tone} size="sm">
          {icon}
        </IconChip>
      </div>
      <p
        className={`num mt-2 leading-tight font-bold tracking-tight text-stone-900 ${small ? 'truncate text-xl' : 'text-[1.9rem]'}`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[0.8rem] text-stone-500">{hint}</p>
    </div>
  );
}
