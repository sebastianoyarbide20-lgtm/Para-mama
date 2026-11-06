import { useRef, useState } from 'react';
import type { Catalog, CatalogItem } from '../db/types';
import { createCatalog, createItem, updateCatalog, updateItem, type CatalogInput } from '../db/actions';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TextArea, TextField, Toggle } from './ui/Fields';
import { useToast } from './ui/Feedback';

const ICONS = ['📋', '📍', '🧴', '💆‍♀️', '✨', '🌿', '💧', '🧪', '🩹', '💅', '🌸', '⭐', '🏠', '🕯️', '💄', '🫧'];

/** Crear o editar una lista (catálogo). */
export function CatalogModal({
  open,
  onClose,
  catalog,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  catalog?: Catalog | null;
  onSaved?: (id: number) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={catalog ? `Editar lista «${catalog.name}»` : 'Crear nueva lista'}
      description={
        catalog
          ? undefined
          : 'Por ejemplo «Zonas tratadas», «Cremas para casa» o «Técnicas». Va a aparecer como un campo más al registrar sesiones.'
      }
    >
      <CatalogForm catalog={catalog ?? null} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function CatalogForm({
  catalog,
  onClose,
  onSaved,
}: {
  catalog: Catalog | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<CatalogInput>({
    name: catalog?.name ?? '',
    sessionLabel: catalog?.sessionLabel ?? '',
    description: catalog?.description ?? '',
    allowMultiple: catalog?.allowMultiple ?? true,
    allowDetail: catalog?.allowDetail ?? false,
    showInSession: catalog?.showInSession ?? true,
    icon: catalog?.icon ?? '📋',
  });
  const [error, setError] = useState<string | null>(null);
  const isSkinTypes = catalog?.key === 'skinTypes';

  const set = <K extends keyof CatalogInput>(key: K, value: CatalogInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Ponele un nombre a la lista.');
      return;
    }
    const data = { ...form, name, sessionLabel: form.sessionLabel.trim() || name };
    try {
      if (catalog?.id) {
        await updateCatalog(catalog.id, data);
        toast.success('Lista actualizada');
        onSaved?.(catalog.id);
      } else {
        const id = await createCatalog(data);
        toast.success(`¡Lista «${name}» creada! Ya aparece en «Sesión de hoy».`);
        onSaved?.(id);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar la lista.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <TextField
        label="Nombre de la lista"
        required
        value={form.name}
        onValueChange={(v) => {
          set('name', v);
          setError(null);
        }}
        error={error}
        placeholder="Ej: Zonas tratadas"
        autoFocus
      />
      {!isSkinTypes && (
        <TextField
          label="Cómo se llama en el formulario de sesión"
          optional
          value={form.sessionLabel}
          onValueChange={(v) => set('sessionLabel', v)}
          placeholder={form.name || 'Ej: Zonas tratadas hoy'}
          hint="Si lo dejás vacío, se usa el nombre de la lista."
        />
      )}
      <TextArea
        label="Descripción"
        optional
        value={form.description ?? ''}
        onValueChange={(v) => set('description', v)}
        rows={2}
      />
      <fieldset>
        <legend className="mb-1.5 font-semibold text-stone-800">Ícono</legend>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-pressed={form.icon === icon}
              aria-label={`Ícono ${icon}`}
              onClick={() => set('icon', icon)}
              className={`size-11 rounded-xl text-xl ${form.icon === icon ? 'bg-rosa-100 ring-2 ring-rosa-500' : 'bg-stone-50 hover:bg-stone-100'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </fieldset>
      {!isSkinTypes && (
        <div className="space-y-4 rounded-2xl bg-stone-50 p-4">
          <Toggle
            label="Mostrar en «Sesión de hoy»"
            description="Aparece como un campo para elegir al registrar una sesión."
            checked={form.showInSession}
            onChange={(v) => set('showInSession', v)}
          />
          <Toggle
            label="Se puede elegir más de uno"
            description="Si lo apagás, en cada sesión se elige una sola opción."
            checked={form.allowMultiple}
            onChange={(v) => set('allowMultiple', v)}
          />
          <Toggle
            label="Agregar un detalle a cada opción elegida"
            description="Por ejemplo concentración, cantidad o tiempo."
            checked={form.allowDetail}
            onChange={(v) => set('allowDetail', v)}
          />
        </div>
      )}
      <div className="flex flex-wrap-reverse justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{catalog ? 'Guardar cambios' : 'Crear lista'}</Button>
      </div>
    </form>
  );
}

/** Crear o editar un ítem de una lista. */
export function ItemModal({
  open,
  onClose,
  catalog,
  item,
}: {
  open: boolean;
  onClose: () => void;
  catalog: Catalog;
  item?: CatalogItem | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={item ? `Editar «${item.name}»` : `Agregar a ${catalog.name}`} size="sm">
      <ItemForm catalog={catalog} item={item ?? null} onClose={onClose} />
    </Modal>
  );
}

function ItemForm({ catalog, item, onClose }: { catalog: Catalog; item: CatalogItem | null; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [extra, setExtra] = useState<Record<string, string>>(item?.extra ?? {});
  const [error, setError] = useState<string | null>(null);
  const [addMore, setAddMore] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const more = submitter?.dataset.mode === 'more';
    if (!name.trim()) {
      setError('Escribí un nombre.');
      return;
    }
    try {
      if (item?.id) {
        await updateItem(item.id, { name: name.trim(), description: description.trim(), extra });
        toast.success('Cambios guardados');
        onClose();
      } else {
        await createItem(catalog.id!, { name, description, extra });
        toast.success(`Se agregó «${name.trim()}»`);
        if (more) {
          setAddMore(true);
          setName('');
          setDescription('');
          setExtra({});
          nameRef.current?.focus();
        } else onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        ref={nameRef}
        label="Nombre"
        required
        value={name}
        onValueChange={(v) => {
          setName(v);
          setError(null);
        }}
        error={error}
        autoFocus
      />
      {catalog.extraFields.map((f) =>
        f.key === 'notes' ? (
          <TextArea
            key={f.key}
            label={f.label}
            optional
            rows={2}
            value={extra[f.key] ?? ''}
            onValueChange={(v) => setExtra((x) => ({ ...x, [f.key]: v }))}
          />
        ) : (
          <TextField
            key={f.key}
            label={f.label}
            optional
            value={extra[f.key] ?? ''}
            onValueChange={(v) => setExtra((x) => ({ ...x, [f.key]: v }))}
          />
        ),
      )}
      <TextArea label="Descripción o nota" optional rows={2} value={description} onValueChange={setDescription} />
      <div className="flex flex-wrap-reverse justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          {addMore ? 'Listo' : 'Cancelar'}
        </Button>
        {!item && (
          <Button type="submit" variant="soft" data-mode="more">
            Guardar y agregar otro
          </Button>
        )}
        <Button type="submit">{item ? 'Guardar cambios' : 'Agregar'}</Button>
      </div>
    </form>
  );
}
