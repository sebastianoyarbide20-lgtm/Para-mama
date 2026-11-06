import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, Eye, EyeOff, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import type { CatalogItem } from '../../db/types';
import { countItemUsage, deleteCatalog, deleteItem, moveCatalog, updateItem } from '../../db/actions';
import { useData } from '../../hooks/useData';
import { matches } from '../../lib/text';
import { countSelections } from '../../lib/stats';
import { plural } from '../../lib/format';
import { Badge, EmptyState, PageHeader } from '../../components/ui/Card';
import { Button, IconButton, LinkButton } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/Fields';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { CatalogModal, ItemModal } from '../../components/CatalogModals';

type StatusFilter = 'activos' | 'desactivados' | 'todos';

/** Administración de una lista: agregar, editar, desactivar y eliminar opciones. */
export function CatalogPage() {
  const { id } = useParams();
  const catalogId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { catalogsById, itemsByCatalog, sessions, clients } = useData();
  const catalog = catalogsById.get(catalogId);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('activos');
  const [editingItem, setEditingItem] = useState<CatalogItem | null | 'new'>(null);
  const [editingCatalog, setEditingCatalog] = useState(false);

  const items = itemsByCatalog.get(catalogId) ?? [];
  const usage = useMemo(() => {
    if (catalog?.key === 'skinTypes') {
      const map = new Map<number, number>();
      for (const c of clients) if (c.skinTypeId) map.set(c.skinTypeId, (map.get(c.skinTypeId) ?? 0) + 1);
      return map;
    }
    return countSelections(sessions, catalogId);
  }, [sessions, clients, catalogId, catalog?.key]);

  if (!catalog) {
    return (
      <EmptyState title="No encontramos esa lista" action={<LinkButton to="/mis-datos">Volver a Mis datos</LinkButton>}>
        Puede que se haya eliminado.
      </EmptyState>
    );
  }

  const isSkin = catalog.key === 'skinTypes';
  const usageWord = isSkin ? ['clienta', 'clientas'] : ['sesión', 'sesiones'];
  const activeCount = items.filter((i) => i.active).length;
  const filtered = items.filter((i) => {
    if (status === 'activos' && !i.active) return false;
    if (status === 'desactivados' && i.active) return false;
    return matches(`${i.name} ${i.description ?? ''} ${Object.values(i.extra ?? {}).join(' ')}`, query);
  });

  const toggleActive = async (item: CatalogItem) => {
    await updateItem(item.id!, { active: !item.active });
    toast.success(
      item.active ? `«${item.name}» desactivado: ya no aparece para elegir` : `«${item.name}» activado de nuevo`,
    );
  };

  const remove = async (item: CatalogItem) => {
    const used = await countItemUsage(item.id!, catalogId);
    const ok = await confirm({
      title: `¿Eliminar «${item.name}»?`,
      message:
        used > 0 ? (
          <>
            <p>
              Está usado en <strong>{plural(used, usageWord[0]!, usageWord[1]!)}</strong>. Si lo eliminás, va a
              desaparecer de {used === 1 ? 'ella' : 'ellas'}.
            </p>
            <p className="mt-2 rounded-xl bg-salvia-50 p-3 text-salvia-900">
              Consejo: si solo no querés verlo más en las opciones, usá <strong>Desactivar</strong>. Así se conserva el
              historial.
            </p>
          </>
        ) : (
          'Esta acción no se puede deshacer.'
        ),
      confirmLabel: used > 0 ? 'Eliminar igual' : 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteItem(item.id!);
    toast.success(`«${item.name}» eliminado`);
  };

  const removeCatalog = async () => {
    const used = sessions.filter((s) => (s.selections?.[String(catalogId)]?.length ?? 0) > 0).length;
    const ok = await confirm({
      title: `¿Eliminar la lista «${catalog.name}»?`,
      message: (
        <>
          Se borran sus {plural(items.length, 'opción', 'opciones')}
          {used > 0 && (
            <>
              {' '}
              y lo que elegiste de esta lista en <strong>{plural(used, 'sesión', 'sesiones')}</strong>
            </>
          )}
          . Las sesiones en sí no se borran. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Eliminar lista',
      danger: true,
    });
    if (!ok) return;
    await deleteCatalog(catalogId);
    toast.success('Lista eliminada');
    navigate('/mis-datos', { replace: true });
  };

  return (
    <div>
      <PageHeader
        back={
          <Link
            to="/mis-datos"
            className="inline-flex items-center gap-1 font-semibold text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-5" aria-hidden /> Mis datos
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>{catalog.icon}</span> {catalog.name}
          </span>
        }
        subtitle={catalog.description || (isSkin ? 'Se usa en la ficha de cada clienta.' : undefined)}
        actions={
          <>
            <Button size="lg" icon={<Plus className="size-5" />} onClick={() => setEditingItem('new')}>
              Agregar
            </Button>
            <Button variant="secondary" icon={<Settings2 className="size-5" />} onClick={() => setEditingCatalog(true)}>
              Configurar lista
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {catalog.builtIn ? <Badge>Lista predefinida</Badge> : <Badge tone="salvia">Lista propia</Badge>}
        {!isSkin && (
          <>
            <Badge tone={catalog.showInSession ? 'rosa' : 'neutral'}>
              {catalog.showInSession ? 'Aparece en «Sesión de hoy»' : 'Oculta en «Sesión de hoy»'}
            </Badge>
            <Badge>{catalog.allowMultiple ? 'Se pueden elegir varias' : 'Se elige una sola'}</Badge>
            {catalog.allowDetail && <Badge>Con detalle por opción</Badge>}
          </>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <SearchInput value={query} onChange={setQuery} placeholder={`Buscar en ${catalog.name.toLowerCase()}…`} />
        <div className="flex gap-1 rounded-xl bg-stone-200/60 p-1" role="group" aria-label="Mostrar">
          {(
            [
              ['activos', `Activos (${activeCount})`],
              ['desactivados', `Desactivados (${items.length - activeCount})`],
              ['todos', 'Todos'],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold whitespace-nowrap ${
                status === key ? 'bg-white text-rosa-700 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Esta lista está vacía"
          action={
            <Button icon={<Plus className="size-5" />} onClick={() => setEditingItem('new')}>
              Agregar la primera opción
            </Button>
          }
        >
          También podés agregar opciones directamente mientras registrás una sesión.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState compact title="No hay opciones que coincidan">
          Probá con otra búsqueda o cambiá el filtro.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80">
          {filtered.map((item) => {
            const used = usage.get(item.id!) ?? 0;
            const brand = item.extra?.brand;
            const notes = item.extra?.notes;
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4 ${item.active ? '' : 'bg-stone-50'}`}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`flex flex-wrap items-center gap-2 text-lg font-bold ${item.active ? 'text-stone-900' : 'text-stone-500'}`}
                  >
                    {item.name}
                    {brand && <span className="text-sm font-semibold text-stone-500">· {brand}</span>}
                    {!item.active && <Badge>Desactivado</Badge>}
                  </p>
                  {(item.description || notes) && (
                    <p className="text-stone-600">{[item.description, notes].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="text-sm text-stone-500">
                    {used > 0 ? `Usado en ${plural(used, usageWord[0]!, usageWord[1]!)}` : 'Todavía sin usar'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="size-4" />}
                    onClick={() => setEditingItem(item)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={item.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    onClick={() => void toggleActive(item)}
                  >
                    {item.active ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => void remove(item)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-5">
        {catalog.showInSession && (
          <span className="flex items-center gap-1 text-stone-600">
            Orden en el formulario:
            <IconButton label="Subir en el formulario" onClick={() => void moveCatalog(catalogId, -1)}>
              <ArrowUp className="size-5" />
            </IconButton>
            <IconButton label="Bajar en el formulario" onClick={() => void moveCatalog(catalogId, 1)}>
              <ArrowDown className="size-5" />
            </IconButton>
          </span>
        )}
        <div className="flex-1" />
        {!catalog.builtIn && (
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            icon={<Trash2 className="size-5" />}
            onClick={() => void removeCatalog()}
          >
            Eliminar esta lista
          </Button>
        )}
      </div>

      <ItemModal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        catalog={catalog}
        item={editingItem === 'new' ? null : editingItem}
      />
      <CatalogModal open={editingCatalog} onClose={() => setEditingCatalog(false)} catalog={catalog} />
    </div>
  );
}
