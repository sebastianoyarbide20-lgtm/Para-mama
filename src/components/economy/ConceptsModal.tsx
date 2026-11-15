import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { createConcept, deleteConcept, updateConcept } from '../../db/actions';
import type { MoneyConcept, MoneyKind } from '../../db/types';
import { plural } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Fields';
import { useConfirm, useToast } from '../ui/Feedback';
import { KIND_STYLE } from './kinds';

/** Ver, agregar, renombrar, ocultar o eliminar conceptos de ingresos, gastos e inversiones. */
export function ConceptsModal({
  open,
  onClose,
  initialKind = 'gasto',
}: {
  open: boolean;
  onClose: () => void;
  initialKind?: MoneyKind;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conceptos"
      description="Las opciones para clasificar lo que entra y lo que sale."
      size="md"
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      {open && <ConceptsEditor initialKind={initialKind} />}
    </Modal>
  );
}

function ConceptsEditor({ initialKind }: { initialKind: MoneyKind }) {
  const { concepts, movements } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState<MoneyKind>(initialKind);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const usage = new Map<number, number>();
  for (const m of movements) usage.set(m.conceptId, (usage.get(m.conceptId) ?? 0) + 1);
  const list = concepts.filter((c) => c.kind === kind);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createConcept(kind, newName);
      toast.success(`Se agregó «${newName.trim()}»`);
      setNewName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar.');
    }
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    await updateConcept(editing.id, { name: editing.name });
    setEditing(null);
    toast.success('Nombre cambiado');
  };

  const remove = async (c: MoneyConcept) => {
    const ok = await confirm({
      title: `¿Eliminar «${c.name}»?`,
      message: 'No tiene movimientos cargados, así que no se pierde nada.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteConcept(c.id!);
      toast.success('Concepto eliminado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  };

  return (
    <div className="space-y-5">
      <Segmented
        label={<span className="sr-only">Tipo</span>}
        allowClear={false}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setEditing(null);
        }}
        options={[
          { value: 'ingreso', label: 'Ingresos' },
          { value: 'gasto', label: 'Gastos' },
          { value: 'inversion', label: 'Inversiones' },
        ]}
      />
      <p className="-mt-2 text-sm text-stone-500">{KIND_STYLE[kind].help}</p>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl ring-1 ring-stone-200/80">
        {list.length === 0 && <li className="px-4 py-3 text-stone-500">Todavía no hay conceptos.</li>}
        {list.map((c) => {
          const used = usage.get(c.id!) ?? 0;
          if (editing && editing.id === c.id) {
            return (
              <li key={c.id} className="px-3 py-2">
                <form onSubmit={saveName} className="flex items-center gap-2">
                  <input
                    autoFocus
                    aria-label="Nuevo nombre"
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id!, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditing(null);
                      }
                    }}
                    className="input-base h-10 min-w-0 flex-1 py-1.5"
                  />
                  <Button size="sm" type="submit" disabled={!editing.name.trim()}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </form>
              </li>
            );
          }
          return (
            <li key={c.id} className={`flex items-center gap-2 px-4 py-2.5 ${c.active ? '' : 'bg-stone-50/80'}`}>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${c.active ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
                  {c.name}
                </span>
                <span className="block text-xs text-stone-500">
                  {used ? plural(used, 'movimiento', 'movimientos') : 'Sin movimientos'}
                  {!c.active && ' · oculto al cargar'}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => void updateConcept(c.id!, { active: !c.active })}>
                {c.active ? 'Ocultar' : 'Mostrar'}
              </Button>
              <button
                type="button"
                onClick={() => setEditing({ id: c.id!, name: c.name })}
                aria-label={`Cambiar el nombre de ${c.name}`}
                className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                <Pencil className="size-4" />
              </button>
              {used === 0 && (
                <button
                  type="button"
                  onClick={() => void remove(c)}
                  aria-label={`Eliminar ${c.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={add} className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-semibold text-stone-700">
            Nuevo concepto de {KIND_STYLE[kind].plural.toLowerCase()}
          </span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej: Seguro, Peluquería, Monotributo…"
            className="input-base"
          />
        </label>
        <Button type="submit" variant="soft" icon={<Plus className="size-4" />} disabled={!newName.trim()}>
          Agregar
        </Button>
      </form>
      <p className="text-xs text-stone-500">
        Los conceptos con movimientos no se pueden eliminar: ocultalos y dejan de aparecer al cargar.
      </p>
    </div>
  );
}
