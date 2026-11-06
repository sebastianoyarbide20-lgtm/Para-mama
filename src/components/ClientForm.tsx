import { useState } from 'react';
import { ListPlus, Save } from 'lucide-react';
import type { ClientField, CustomFieldValue, PregnancyValue, SmokesValue, YesNoValue } from '../db/types';
import type { ClientInput } from '../db/actions';
import { useBuiltinCatalogs, useData } from '../hooks/useData';
import { ageFromBirthDate, todayISO } from '../lib/dates';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Segmented, TextArea, TextField } from './ui/Fields';
import { CatalogPicker } from './CatalogPicker';
import { ClientFieldModal } from './ClientFieldModal';

export const SMOKES_OPTIONS: { value: SmokesValue; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
  { value: 'ocasionalmente', label: 'Ocasionalmente' },
];

export const YES_NO_OPTIONS: { value: YesNoValue; label: string }[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export const PREGNANCY_OPTIONS: { value: PregnancyValue; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'embarazada', label: 'Embarazada' },
  { value: 'lactancia', label: 'En lactancia' },
  { value: 'no-aplica', label: 'No aplica' },
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ficha completa de la clienta. */
export function ClientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar ficha',
}: {
  initial: ClientInput;
  onSubmit: (input: ClientInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const { clientFields, itemsByCatalog } = useData();
  const { skinTypes } = useBuiltinCatalogs();
  const [form, setForm] = useState<ClientInput>(initial);
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const setCustom = (fieldId: number, value: CustomFieldValue) =>
    setForm((f) => ({ ...f, customFields: { ...f.customFields, [String(fieldId)]: value } }));

  const age = form.birthDate ? ageFromBirthDate(form.birthDate) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'El nombre es obligatorio.';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim()))
      nextErrors.email = 'Revisá el email, parece incompleto.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(nextErrors.firstName ? 'client-firstName' : 'client-email')?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Card title="Datos personales">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="client-firstName"
              label="Nombre"
              required
              value={form.firstName}
              onValueChange={(v) => {
                set('firstName', v);
                if (errors.firstName) setErrors((er) => ({ ...er, firstName: undefined }));
              }}
              error={errors.firstName}
              autoComplete="off"
              autoFocus={!initial.firstName}
            />
            <TextField
              label="Apellido"
              value={form.lastName}
              onValueChange={(v) => set('lastName', v)}
              autoComplete="off"
            />
            <TextField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onValueChange={(v) => set('phone', v)}
              placeholder="Ej: 11 5555-1234"
            />
            <TextField
              id="client-email"
              label="Email"
              type="email"
              inputMode="email"
              value={form.email}
              onValueChange={(v) => {
                set('email', v);
                if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
              }}
              error={errors.email}
            />
            <TextField
              label="Fecha de nacimiento"
              type="date"
              value={form.birthDate}
              max={todayISO()}
              onValueChange={(v) => set('birthDate', v)}
              hint={age !== null ? `${age} años` : undefined}
            />
          </div>
        </Card>

        <Card title="Piel y salud" subtitle="Estos datos se muestran destacados cuando registrás una sesión.">
          <div className="space-y-5">
            {skinTypes && (
              <CatalogPicker
                bare
                catalog={skinTypes}
                label="Tipo de piel"
                items={itemsByCatalog.get(skinTypes.id!) ?? []}
                value={form.skinTypeId ? [{ itemId: form.skinTypeId }] : []}
                onChange={(v) => set('skinTypeId', v[0]?.itemId ?? null)}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea
                label="Medicación / pastillas que toma"
                value={form.medication}
                onValueChange={(v) => set('medication', v)}
                rows={2}
                placeholder="Ej: anticonceptivos, levotiroxina…"
              />
              <TextArea
                label="Alergias"
                value={form.allergies}
                onValueChange={(v) => set('allergies', v)}
                rows={2}
                placeholder="Ej: látex, ácido salicílico…"
              />
            </div>
            <Segmented
              label="Embarazo / lactancia"
              value={form.pregnancy}
              options={PREGNANCY_OPTIONS}
              onChange={(v) => set('pregnancy', v)}
            />
            <TextArea
              label="Antecedentes relevantes"
              value={form.history}
              onValueChange={(v) => set('history', v)}
              rows={2}
              placeholder="Ej: acné, rosácea, cirugías, tratamientos previos…"
            />
          </div>
        </Card>

        <Card title="Hábitos">
          <div className="space-y-5">
            <Segmented label="¿Fuma?" value={form.smokes} options={SMOKES_OPTIONS} onChange={(v) => set('smokes', v)} />
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <Segmented
                label="¿Hace ejercicio?"
                value={form.exercises}
                options={YES_NO_OPTIONS}
                onChange={(v) => set('exercises', v)}
              />
              {form.exercises === 'si' && (
                <TextField
                  label="¿Con qué frecuencia?"
                  value={form.exerciseFrequency}
                  onValueChange={(v) => set('exerciseFrequency', v)}
                  placeholder="Ej: 3 veces por semana"
                />
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Más datos"
          subtitle="Campos propios que agregaste a la ficha."
          actions={
            <Button variant="soft" size="sm" icon={<ListPlus className="size-4" />} onClick={() => setFieldModal(true)}>
              Agregar campo
            </Button>
          }
        >
          {clientFields.length === 0 ? (
            <p className="text-stone-600">
              Podés sumar campos a la ficha (por ejemplo «Usa protector solar» o «Grupo sanguíneo») con el botón{' '}
              <strong>Agregar campo</strong>.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {clientFields.map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={form.customFields[String(f.id)]}
                  onChange={(v) => setCustom(f.id!, v)}
                />
              ))}
            </div>
          )}
          <div className="mt-5">
            <TextArea
              label="Notas generales"
              value={form.notes}
              onValueChange={(v) => set('notes', v)}
              rows={3}
              placeholder="Preferencias, horarios, cómo la conociste…"
            />
          </div>
        </Card>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex justify-end gap-2 rounded-2xl bg-white/95 p-2.5 sm:p-3 shadow-lg ring-1 ring-stone-200 backdrop-blur lg:bottom-4">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={saving} icon={<Save className="size-5" />}>
            {saving ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      </form>
      <ClientFieldModal open={fieldModal} onClose={() => setFieldModal(false)} />
    </>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: ClientField;
  value: CustomFieldValue | undefined;
  onChange: (value: CustomFieldValue) => void;
}) {
  const text = value === undefined || value === null ? '' : String(value);
  switch (field.type) {
    case 'longtext':
      return (
        <TextArea label={field.label} value={text} onValueChange={onChange} rows={2} wrapperClassName="sm:col-span-2" />
      );
    case 'yesno':
      return (
        <Segmented
          label={field.label}
          value={(text === 'true' ? 'si' : text === 'false' ? 'no' : text) as YesNoValue}
          options={YES_NO_OPTIONS}
          onChange={onChange}
        />
      );
    case 'number':
      return <TextField label={field.label} type="number" inputMode="decimal" value={text} onValueChange={onChange} />;
    case 'date':
      return <TextField label={field.label} type="date" value={text} onValueChange={onChange} />;
    default:
      return <TextField label={field.label} value={text} onValueChange={onChange} />;
  }
}
