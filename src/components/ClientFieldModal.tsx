import { useState } from 'react';
import type { ClientField, ClientFieldType } from '../db/types';
import { createClientField, updateClientField } from '../db/actions';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TextField, Segmented } from './ui/Fields';
import { useToast } from './ui/Feedback';

export const FIELD_TYPE_LABELS: Record<ClientFieldType, string> = {
  text: 'Texto corto',
  longtext: 'Texto largo',
  yesno: 'Sí / No',
  number: 'Número',
  date: 'Fecha',
};

/** Crear o editar un campo personalizado de la ficha de clienta. */
export function ClientFieldModal({
  open,
  onClose,
  field,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  field?: ClientField | null;
  onSaved?: (id: number) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={field ? 'Editar campo de la ficha' : 'Nuevo campo para la ficha'}
      description="Aparece en la ficha de todas las clientas."
      size="sm"
    >
      <FieldForm field={field ?? null} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function FieldForm({
  field,
  onClose,
  onSaved,
}: {
  field: ClientField | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState(field?.label ?? '');
  const [type, setType] = useState<ClientFieldType>(field?.type ?? 'text');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Escribí el nombre del campo.');
      return;
    }
    if (field?.id) {
      await updateClientField(field.id, { label: label.trim(), type });
      toast.success('Campo actualizado');
      onSaved?.(field.id);
    } else {
      const id = await createClientField({ label, type });
      toast.success(`Se agregó «${label.trim()}» a la ficha`);
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <TextField
        label="Nombre del campo"
        value={label}
        onValueChange={(v) => {
          setLabel(v);
          setError(null);
        }}
        placeholder="Ej: Usa protector solar, Grupo sanguíneo…"
        error={error}
        required
        autoFocus
      />
      <Segmented
        label="Tipo de dato"
        value={type}
        allowClear={false}
        onChange={setType}
        options={(Object.keys(FIELD_TYPE_LABELS) as ClientFieldType[]).map((t) => ({
          value: t,
          label: FIELD_TYPE_LABELS[t],
        }))}
      />
      <div className="flex flex-wrap-reverse justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{field ? 'Guardar cambios' : 'Agregar campo'}</Button>
      </div>
    </form>
  );
}
