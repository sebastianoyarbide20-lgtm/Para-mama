import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { clientName, useBuiltinCatalogs, useData } from '../../hooks/useData';
import { createConcept, createItem, deleteMovement, saveMovement } from '../../db/actions';
import type { MoneyKind, MoneyMovement } from '../../db/types';
import { todayISO } from '../../lib/dates';
import { formatMoney, parseMoneyInput } from '../../lib/format';
import { compareEs, normalize } from '../../lib/text';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Fields';
import { useConfirm, useToast } from '../ui/Feedback';
import { KIND_STYLE } from './kinds';

export interface MovementModalProps {
  open: boolean;
  onClose: () => void;
  /** Movimiento a editar. Si no se pasa, se carga uno nuevo. */
  movement?: MoneyMovement | null;
  /** Tipo con el que arranca un movimiento nuevo. */
  initialKind?: MoneyKind;
  /** Producto ya elegido (ej: desde la pantalla de productos). */
  initialProductId?: number | null;
}

/** Cargar o editar un ingreso, un gasto o una inversión. */
export function MovementModal(props: MovementModalProps) {
  // El formulario se crea al abrir (arranca limpio cada vez) y lleva la ventana adentro,
  // así los botones quedan siempre a la vista en el pie.
  return props.open ? <MovementForm {...props} /> : null;
}

interface FormState {
  kind: MoneyKind;
  date: string;
  conceptId: number | null;
  amountText: string;
  description: string;
  productId: number | null;
  quantityText: string;
  clientId: number | null;
}

function MovementForm({ onClose, movement, initialKind = 'ingreso', initialProductId = null }: MovementModalProps) {
  const { concepts, itemsByCatalog, itemsById, clients } = useData();
  const { products: productsCatalog } = useBuiltinCatalogs();
  const toast = useToast();
  const confirm = useConfirm();
  // Con un producto elegido, el concepto más lógico: "Venta…" en ingresos, "Compra…" en gastos.
  const suggestConcept = (kind: MoneyKind): number | null => {
    const hint = kind === 'ingreso' ? 'venta' : kind === 'gasto' ? 'compra' : null;
    const match = hint && concepts.find((c) => c.kind === kind && c.active && normalize(c.name).includes(hint));
    return match ? match.id! : null;
  };
  const [form, setForm] = useState<FormState>(() =>
    movement
      ? {
          kind: movement.kind,
          date: movement.date,
          conceptId: movement.conceptId,
          amountText: String(movement.amount),
          description: movement.description,
          productId: movement.productId,
          quantityText: movement.quantity ? String(movement.quantity) : '',
          clientId: movement.clientId,
        }
      : {
          kind: initialKind,
          date: todayISO(),
          conceptId: initialProductId ? suggestConcept(initialKind) : null,
          amountText: '',
          description: '',
          productId: initialKind === 'inversion' ? null : initialProductId,
          quantityText: initialProductId ? '1' : '',
          clientId: null,
        },
  );
  const [errors, setErrors] = useState<{ concept?: string; amount?: string; date?: string }>({});
  const [newConcept, setNewConcept] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kindConcepts = concepts.filter((c) => c.kind === form.kind && (c.active || c.id === form.conceptId));

  /** Elige un producto (y, si todavía no hay concepto, sugiere uno). */
  const chooseProduct = (id: number | null) =>
    setForm((f) => ({
      ...f,
      productId: id,
      quantityText: id ? f.quantityText || '1' : '',
      conceptId: f.conceptId ?? (id ? suggestConcept(f.kind) : null),
    }));

  const products = useMemo(() => {
    if (!productsCatalog) return [];
    return (itemsByCatalog.get(productsCatalog.id!) ?? []).filter((i) => i.active || i.id === form.productId);
  }, [itemsByCatalog, productsCatalog, form.productId]);
  const sortedClients = useMemo(() => [...clients].sort((a, b) => compareEs(clientName(a), clientName(b))), [clients]);

  const amount = parseMoneyInput(form.amountText);
  const quantity = form.quantityText.trim() ? Number(form.quantityText.replace(',', '.')) : null;
  const style = KIND_STYLE[form.kind];

  const changeKind = (kind: MoneyKind) => {
    setForm((f) => ({
      ...f,
      kind,
      conceptId: null,
      productId: kind === 'inversion' ? null : f.productId,
      clientId: kind === 'ingreso' ? f.clientId : null,
    }));
    setErrors((e) => ({ ...e, concept: undefined }));
    setNewConcept(null);
  };

  const addConcept = async () => {
    if (!newConcept?.trim()) return;
    try {
      const id = await createConcept(form.kind, newConcept);
      set('conceptId', id);
      setErrors((e) => ({ ...e, concept: undefined }));
      setNewConcept(null);
      toast.success(`Concepto «${newConcept.trim()}» agregado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar el concepto.');
    }
  };

  const addProduct = async () => {
    if (!newProduct?.trim() || !productsCatalog) return;
    try {
      const id = await createItem(productsCatalog.id!, { name: newProduct });
      chooseProduct(id);
      setNewProduct(null);
      toast.success(`Producto «${newProduct.trim()}» agregado a tu lista`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar el producto.');
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.conceptId) nextErrors.concept = 'Elegí un concepto.';
    if (amount === null || amount <= 0) nextErrors.amount = 'Escribí el monto (solo números).';
    if (!form.date) nextErrors.date = 'Elegí la fecha.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.amount) amountRef.current?.focus();
      return;
    }
    await saveMovement(movement?.id ?? null, {
      kind: form.kind,
      date: form.date,
      conceptId: form.conceptId!,
      amount: amount!,
      description: form.description,
      productId: form.productId,
      quantity: quantity && quantity > 0 ? quantity : null,
      clientId: form.clientId,
    });
    toast.success(movement ? 'Cambios guardados' : `Se guardó ${style.the} de ${formatMoney(amount)}`);
    onClose();
  };

  const remove = async () => {
    if (!movement?.id) return;
    const ok = await confirm({
      title: '¿Eliminar este movimiento?',
      message: `${style.label} de ${formatMoney(movement.amount)}. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteMovement(movement.id);
    toast.success('Movimiento eliminado');
    onClose();
  };

  const formId = 'movement-form';
  return (
    <Modal
      open
      onClose={onClose}
      title={movement ? 'Editar movimiento' : 'Agregar a la economía'}
      description={movement ? undefined : 'Ingresos que no son de sesiones, gastos e inversiones.'}
      size="lg"
      footer={
        <>
          {movement?.id && (
            <Button
              variant="ghost"
              className="mr-auto text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={remove}
            >
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </Button>
          )}
          <span className="flex flex-wrap-reverse gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} icon={<Check className="size-4" strokeWidth={3} />}>
              {movement ? 'Guardar cambios' : `Guardar ${style.label.toLowerCase()}`}
            </Button>
          </span>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-6">
        {/* 1. Tipo */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-stone-700">¿Qué querés anotar?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_STYLE) as MoneyKind[]).map((kind) => {
              const k = KIND_STYLE[kind];
              const checked = form.kind === kind;
              const Icon = k.icon;
              return (
                <label
                  key={kind}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 ring-1 transition-all has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rosa-300 ${
                    checked ? `${k.selected} ring-2` : 'bg-white ring-stone-200 hover:bg-stone-50 hover:ring-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={kind}
                    checked={checked}
                    onChange={() => changeKind(kind)}
                    className="sr-only"
                  />
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${k.chip}`}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-stone-900">{k.label}</span>
                    <span className="block text-[0.8rem] leading-snug text-stone-500">{k.help}</span>
                  </span>
                  {checked && (
                    <Check className={`absolute top-2.5 right-2.5 size-4 ${k.text}`} strokeWidth={3} aria-hidden />
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Concepto */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-stone-700">
            Concepto <span className="text-rosa-600">*</span>
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Concepto">
            {kindConcepts.map((c) => {
              const checked = form.conceptId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    set('conceptId', c.id!);
                    setErrors((e) => ({ ...e, concept: undefined }));
                  }}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[0.95rem] font-semibold ring-1 transition-colors ${
                    checked
                      ? `${style.selected} ring-2 ${style.text}`
                      : 'bg-white text-stone-700 ring-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {checked && <Check className="size-4" strokeWidth={3} aria-hidden />}
                  {c.name}
                </button>
              );
            })}
            {newConcept === null ? (
              <button
                type="button"
                onClick={() => setNewConcept('')}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[0.95rem] font-semibold text-rosa-700 ring-1 ring-rosa-200 ring-dashed hover:bg-rosa-50"
              >
                <Plus className="size-4" aria-hidden /> Nuevo concepto
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <input
                  autoFocus
                  aria-label="Nombre del concepto nuevo"
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addConcept();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewConcept(null);
                    }
                  }}
                  placeholder="Ej: Peluquería, Seguro…"
                  className="input-base h-10 w-56 py-1.5"
                />
                <Button size="sm" variant="soft" onClick={() => void addConcept()} disabled={!newConcept.trim()}>
                  Agregar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewConcept(null)}>
                  Cancelar
                </Button>
              </span>
            )}
          </div>
          {errors.concept && (
            <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">
              {errors.concept}
            </p>
          )}
        </fieldset>

        {/* 3. Monto y fecha */}
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label htmlFor="mov-amount" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Monto <span className="text-rosa-600">*</span>
            </label>
            <span className="relative block">
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lg font-semibold text-stone-500"
              >
                $
              </span>
              <input
                ref={amountRef}
                id="mov-amount"
                type="text"
                inputMode="decimal"
                autoFocus={!movement}
                value={form.amountText}
                onChange={(e) => {
                  set('amountText', e.target.value);
                  setErrors((er) => ({ ...er, amount: undefined }));
                }}
                placeholder="Ej: 15000"
                aria-invalid={errors.amount ? true : undefined}
                aria-describedby={errors.amount ? 'mov-amount-error' : undefined}
                className={`input-base h-12 pl-8 text-lg font-semibold ${errors.amount ? 'input-error' : ''}`}
              />
            </span>
            {errors.amount ? (
              <p id="mov-amount-error" role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {errors.amount}
              </p>
            ) : (
              amount !== null &&
              amount > 0 && <p className="mt-1 text-sm text-stone-500">Se guarda como {formatMoney(amount)}</p>
            )}
          </div>
          <TextField
            label="Fecha"
            type="date"
            required
            value={form.date}
            max="9999-12-31"
            onValueChange={(v) => {
              set('date', v);
              setErrors((er) => ({ ...er, date: undefined }));
            }}
            error={errors.date}
            className="h-12"
          />
        </div>

        {/* 4. Producto (ventas y compras) */}
        {form.kind !== 'inversion' && productsCatalog && (
          <div className="rounded-2xl bg-stone-50/80 p-4 ring-1 ring-stone-900/[0.04]">
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <div>
                <SelectField
                  label={form.kind === 'ingreso' ? '¿Vendiste un producto?' : '¿Compraste un producto?'}
                  optional
                  value={form.productId ? String(form.productId) : ''}
                  onValueChange={(v) => chooseProduct(v ? Number(v) : null)}
                >
                  <option value="">— Ninguno —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
                {newProduct === null ? (
                  <button
                    type="button"
                    onClick={() => setNewProduct('')}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-rosa-700 hover:text-rosa-800"
                  >
                    <Plus className="size-4" aria-hidden /> Producto nuevo
                  </button>
                ) : (
                  <span className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      aria-label="Nombre del producto nuevo"
                      value={newProduct}
                      onChange={(e) => setNewProduct(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addProduct();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          setNewProduct(null);
                        }
                      }}
                      placeholder="Ej: Crema de noche"
                      className="input-base h-10 min-w-0 flex-1 py-1.5"
                    />
                    <Button size="sm" variant="soft" onClick={() => void addProduct()} disabled={!newProduct.trim()}>
                      Agregar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewProduct(null)}>
                      Cancelar
                    </Button>
                  </span>
                )}
              </div>
              {form.productId !== null && (
                <TextField
                  label="Cantidad"
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={form.quantityText}
                  onValueChange={(v) => set('quantityText', v)}
                />
              )}
            </div>
            {form.productId !== null && amount !== null && quantity !== null && quantity > 1 && (
              <p className="mt-2 text-sm text-stone-500">
                {formatMoney(amount / quantity)} cada uno ({itemsById.get(form.productId)?.name})
              </p>
            )}
          </div>
        )}

        {/* 5. Clienta y detalle */}
        <div className={`grid gap-4 ${form.kind === 'ingreso' ? 'sm:grid-cols-2' : ''}`}>
          {form.kind === 'ingreso' && (
            <SelectField
              label="Clienta"
              optional
              value={form.clientId ? String(form.clientId) : ''}
              onValueChange={(v) => set('clientId', v ? Number(v) : null)}
            >
              <option value="">— Ninguna —</option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientName(c)}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            label="Detalle"
            optional
            value={form.description}
            onValueChange={(v) => set('description', v)}
            placeholder={style.placeholder}
          />
        </div>
      </form>
    </Modal>
  );
}
