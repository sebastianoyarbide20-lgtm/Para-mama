import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ClipboardList, ListPlus, Pencil, Trash2 } from 'lucide-react';
import type { ClientField } from '../../db/types';
import { deleteClientField, moveClientField } from '../../db/actions';
import { useData } from '../../hooks/useData';
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { ClientFieldModal, FIELD_TYPE_LABELS } from '../../components/ClientFieldModal';

const FIXED_FIELDS = [
  'Nombre y apellido',
  'Fecha de nacimiento y edad',
  'Género',
  'Teléfono y email',
  'Fecha del último tratamiento',
  'Alergias',
  'Hábitos',
  'Cuidados domiciliarios',
  'Medicación',
  'Antecedentes',
  'Ejercicio',
  'Tipo de piel',
  'Escala de Fitzpatrick',
  'Análisis facial',
  'Condiciones del paciente',
  'Notas generales',
];

/** Campos personalizados de la ficha de clienta. */
export function ClientFieldsPage() {
  const { clientFields, clients } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<ClientField | null | 'new'>(null);

  const remove = async (field: ClientField) => {
    const used = clients.filter((c) => {
      const v = c.customFields?.[String(field.id)];
      return v !== undefined && v !== '';
    }).length;
    const ok = await confirm({
      title: `¿Eliminar el campo «${field.label}»?`,
      message:
        used > 0
          ? `Hay ${used} ${used === 1 ? 'clienta' : 'clientas'} con este dato cargado. Se va a borrar de sus fichas.`
          : 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar campo',
      danger: true,
    });
    if (!ok) return;
    await deleteClientField(field.id!);
    toast.success('Campo eliminado');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link
            to="/mis-datos"
            className="inline-flex items-center gap-1 font-semibold text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-5" aria-hidden /> Mis datos
          </Link>
        }
        title="Campos de la ficha"
        subtitle="Agregá los datos que quieras guardar de cada clienta."
        actions={
          <Button size="lg" icon={<ListPlus className="size-5" />} onClick={() => setEditing('new')}>
            Agregar campo
          </Button>
        }
      />

      <Card title="Tus campos" className="mb-5">
        {clientFields.length === 0 ? (
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="Todavía no agregaste campos propios"
            action={
              <Button icon={<ListPlus className="size-5" />} onClick={() => setEditing('new')}>
                Agregar el primero
              </Button>
            }
          >
            Por ejemplo: «Usa protector solar», «Grupo sanguíneo», «Cómo nos conoció».
          </EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {clientFields.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-stone-900">{f.label}</p>
                  <Badge>{FIELD_TYPE_LABELS[f.type]}</Badge>
                </div>
                <IconButton label="Subir" disabled={i === 0} onClick={() => void moveClientField(f.id!, -1)}>
                  <ArrowUp className="size-5" />
                </IconButton>
                <IconButton
                  label="Bajar"
                  disabled={i === clientFields.length - 1}
                  onClick={() => void moveClientField(f.id!, 1)}
                >
                  <ArrowDown className="size-5" />
                </IconButton>
                <Button variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing(f)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50"
                  icon={<Trash2 className="size-4" />}
                  onClick={() => void remove(f)}
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Lo que ya trae la ficha inicial" subtitle="Estos puntos están siempre.">
        <ul className="flex flex-wrap gap-2">
          {FIXED_FIELDS.map((f) => (
            <li key={f} className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <ClientFieldModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        field={editing === 'new' ? null : editing}
      />
    </div>
  );
}
