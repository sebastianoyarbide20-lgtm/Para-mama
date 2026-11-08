import { useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, ListPlus, Save } from 'lucide-react';
import type { ClientField, CustomFieldValue, FacialAnalysis, YesNoValue } from '../db/types';
import type { ClientInput } from '../db/actions';
import { useBuiltinCatalogs, useData } from '../hooks/useData';
import { ageFromBirthDate, todayISO } from '../lib/dates';
import {
  anamnesisMissing,
  CONDITIONS,
  FACIAL_GROUPS,
  FITZPATRICK,
  GENDER_OPTIONS,
  HABITS,
  HOME_CARE,
} from '../lib/anamnesis';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Segmented, TextArea, TextField } from './ui/Fields';
import { Checklist, NoneToggle } from './ui/Checklist';
import { useConfirm, useToast } from './ui/Feedback';
import { CatalogPicker } from './CatalogPicker';
import { ClientFieldModal } from './ClientFieldModal';

export const YES_NO_OPTIONS: { value: YesNoValue; label: string }[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOTAL_POINTS = anamnesisMissing({
  birthDate: '',
  gender: '',
  lastTreatmentDate: '',
  noPreviousTreatment: false,
  allergies: '',
  noAllergies: false,
  habits: [],
  homeCare: [],
  skinTypeId: null,
  fitzpatrick: '',
  facial: { capilares: [], sebaceas: [], pigmentacion: [], lineas: [] },
  conditions: [],
}).length;

/** Lleva la pantalla hasta un punto de la ficha y lo enfoca. */
export function goToField(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = el.matches('input, textarea, button')
    ? el
    : el.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), button');
  setTimeout(() => focusable?.focus({ preventScroll: true }), 350);
}

/**
 * Ficha inicial de la clienta (anamnesis): datos personales, historia clínica y hábitos,
 * tipo de piel y Fitzpatrick, análisis facial y condiciones del paciente.
 * Al crear una clienta todos los puntos son obligatorios.
 */
export function ClientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar ficha',
  mode = 'create',
  inModal = false,
}: {
  initial: ClientInput;
  onSubmit: (input: ClientInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  mode?: 'create' | 'edit';
  inModal?: boolean;
}) {
  const { clientFields, itemsByCatalog } = useData();
  const { skinTypes } = useBuiltinCatalogs();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<ClientInput>(initial);
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setFacial = (key: keyof FacialAnalysis, value: string[]) =>
    setForm((f) => ({ ...f, facial: { ...f.facial, [key]: value } }));
  const setCustom = (fieldId: number, value: CustomFieldValue) =>
    setForm((f) => ({ ...f, customFields: { ...f.customFields, [String(fieldId)]: value } }));

  const missing = useMemo(() => anamnesisMissing(form), [form]);
  const isMissing = (target: string) => attempted && missing.some((m) => m.target === target);
  const age = form.birthDate ? ageFromBirthDate(form.birthDate) : null;
  const done = TOTAL_POINTS - missing.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'El nombre es obligatorio.';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim()))
      nextErrors.email = 'Revisá el email, parece incompleto.';
    setErrors(nextErrors);
    setAttempted(true);
    if (Object.keys(nextErrors).length) {
      goToField(nextErrors.firstName ? 'client-firstName' : 'client-email');
      return;
    }
    if (missing.length) {
      if (mode === 'create') {
        toast.error(
          `Falta completar ${missing.length} ${missing.length === 1 ? 'punto' : 'puntos'} de la ficha inicial.`,
        );
        goToField(missing[0]!.target);
        return;
      }
      const ok = await confirm({
        title: 'La ficha inicial está incompleta',
        message: `Faltan: ${missing.map((m) => m.label).join(', ')}. ¿Querés guardar igual y completarla más adelante?`,
        confirmLabel: 'Guardar igual',
        cancelLabel: 'Completar ahora',
      });
      if (!ok) {
        goToField(missing[0]!.target);
        return;
      }
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
        {attempted && missing.length > 0 && (
          <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
            <p className="flex items-center gap-2 font-bold">
              <CircleAlert className="size-5 shrink-0" aria-hidden />
              Para guardar, completá estos puntos de la ficha:
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <li key={m.target}>
                  <button
                    type="button"
                    onClick={() => goToField(m.target)}
                    className="rounded-full bg-white px-3 py-1 text-sm font-bold text-red-800 underline-offset-2 ring-1 ring-red-200 hover:underline"
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Section n={1} title="Datos personales">
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
              id="ficha-nacimiento"
              label="Fecha de nacimiento"
              required
              type="date"
              value={form.birthDate}
              max={todayISO()}
              onValueChange={(v) => set('birthDate', v)}
              hint={age !== null ? `Edad: ${age} años` : undefined}
              error={isMissing('ficha-nacimiento') ? 'Completá la fecha de nacimiento.' : null}
            />
            <div id="ficha-genero" className="scroll-mt-28">
              <Segmented
                label={<RequiredLabel>Género</RequiredLabel>}
                value={form.gender}
                options={GENDER_OPTIONS}
                onChange={(v) => set('gender', v)}
              />
              {isMissing('ficha-genero') && <FieldError>Elegí una opción.</FieldError>}
            </div>
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
            <div id="ficha-ultimo" className="scroll-mt-28 sm:col-span-2">
              <TextField
                label="Fecha del último tratamiento"
                required
                type="date"
                value={form.lastTreatmentDate}
                max={todayISO()}
                disabled={form.noPreviousTreatment}
                onValueChange={(v) => set('lastTreatmentDate', v)}
                hint="El último tratamiento estético que se hizo antes de venir."
                wrapperClassName="sm:max-w-xs"
                error={isMissing('ficha-ultimo') ? 'Poné la fecha o marcá que nunca se hizo uno.' : null}
              />
              <NoneToggle
                checked={form.noPreviousTreatment}
                onChange={(v) =>
                  setForm((f) => ({ ...f, noPreviousTreatment: v, lastTreatmentDate: v ? '' : f.lastTreatmentDate }))
                }
              >
                Nunca se hizo un tratamiento
              </NoneToggle>
            </div>
          </div>
        </Section>

        <Section n={2} title="Historia clínica y hábitos">
          <div className="space-y-6">
            <div id="ficha-alergias" className="scroll-mt-28">
              <TextArea
                label="Alergias: mencioná cuáles"
                required
                value={form.allergies}
                disabled={form.noAllergies}
                onValueChange={(v) => set('allergies', v)}
                rows={2}
                placeholder="Ej: látex, ácido salicílico, penicilina…"
                error={isMissing('ficha-alergias') ? 'Escribí cuáles o marcá «No tiene alergias».' : null}
              />
              <NoneToggle
                checked={form.noAllergies}
                onChange={(v) => setForm((f) => ({ ...f, noAllergies: v, allergies: v ? '' : f.allergies }))}
              >
                No tiene alergias
              </NoneToggle>
            </div>
            <Checklist
              id="ficha-habitos"
              label="Hábitos"
              options={HABITS}
              value={form.habits}
              onChange={(v) => set('habits', v)}
              noneLabel="Ninguno"
              error={isMissing('ficha-habitos')}
            />
            <Checklist
              id="ficha-cuidados"
              label="Cuidados domiciliarios"
              hint="Lo que ya usa en su casa."
              options={HOME_CARE}
              value={form.homeCare}
              onChange={(v) => set('homeCare', v)}
              noneLabel="Ninguna"
              error={isMissing('ficha-cuidados')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea
                label="Medicación / pastillas que toma"
                optional
                value={form.medication}
                onValueChange={(v) => set('medication', v)}
                rows={2}
                placeholder="Ej: anticonceptivos, levotiroxina…"
              />
              <TextArea
                label="Antecedentes relevantes"
                optional
                value={form.history}
                onValueChange={(v) => set('history', v)}
                rows={2}
                placeholder="Ej: acné, rosácea, cirugías…"
              />
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <Segmented
                label="¿Hace ejercicio?"
                optional
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
        </Section>

        <Section n={3} title="Tipo de piel y escala de Fitzpatrick">
          <div className="space-y-6">
            <div id="ficha-piel" className="scroll-mt-28">
              {skinTypes && (
                <CatalogPicker
                  bare
                  catalog={skinTypes}
                  label="Tipo de piel *"
                  items={itemsByCatalog.get(skinTypes.id!) ?? []}
                  value={form.skinTypeId ? [{ itemId: form.skinTypeId }] : []}
                  onChange={(v) => set('skinTypeId', v[0]?.itemId ?? null)}
                />
              )}
              {isMissing('ficha-piel') && <FieldError>Elegí el tipo de piel.</FieldError>}
            </div>
            <fieldset id="ficha-fitzpatrick" className="scroll-mt-28">
              <legend className="mb-1.5 font-semibold text-stone-800">
                <RequiredLabel>Escala de Fitzpatrick</RequiredLabel>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {FITZPATRICK.map((f) => {
                  const checked = form.fitzpatrick === f.value;
                  return (
                    <label
                      key={f.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rosa-400 ${
                        checked ? 'border-rosa-500 bg-rosa-50' : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="fitzpatrick"
                        value={f.value}
                        checked={checked}
                        onChange={() => set('fitzpatrick', f.value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className="mt-0.5 size-8 shrink-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-stone-200"
                        style={{ backgroundColor: f.color }}
                      />
                      <span>
                        <span className={`block font-bold ${checked ? 'text-rosa-800' : 'text-stone-900'}`}>
                          {f.label}
                        </span>
                        <span className="block text-sm text-stone-600">{f.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {isMissing('ficha-fitzpatrick') && <FieldError>Elegí un tipo de la escala.</FieldError>}
            </fieldset>
          </div>
        </Section>

        <Section n={4} title="Análisis facial" subtitle="Si no ves nada en un grupo, marcá «Sin hallazgos».">
          <div className="space-y-6">
            {FACIAL_GROUPS.map((g) => (
              <Checklist
                key={g.key}
                id={`ficha-facial-${g.key}`}
                label={g.label}
                options={g.options}
                value={form.facial[g.key]}
                onChange={(v) => setFacial(g.key, v)}
                noneLabel="Sin hallazgos"
                error={isMissing(`ficha-facial-${g.key}`)}
              />
            ))}
          </div>
        </Section>

        <Section
          n={5}
          title="Condiciones del paciente"
          subtitle="Importante para saber qué tratamientos y aparatos se pueden usar."
        >
          <Checklist
            id="ficha-condiciones"
            label="Marcá todas las que tenga"
            options={CONDITIONS}
            value={form.conditions}
            onChange={(v) => set('conditions', v)}
            noneLabel="Ninguna"
            columns
            error={isMissing('ficha-condiciones')}
          />
        </Section>

        <Section
          n={6}
          title="Otros datos"
          subtitle="Opcional."
          actions={
            <Button variant="soft" size="sm" icon={<ListPlus className="size-4" />} onClick={() => setFieldModal(true)}>
              Agregar campo
            </Button>
          }
        >
          {clientFields.length > 0 && (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
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
          <TextArea
            label="Notas generales"
            value={form.notes}
            onValueChange={(v) => set('notes', v)}
            rows={3}
            placeholder="Preferencias, horarios, cómo te conoció…"
          />
        </Section>

        <div
          className={`sticky z-20 flex items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-stone-200 backdrop-blur sm:p-3 ${
            inModal ? 'bottom-0' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4'
          }`}
        >
          <div className="min-w-0 flex-1" aria-live="polite">
            <p
              className={`text-sm font-bold whitespace-nowrap ${missing.length ? 'text-stone-600' : 'text-salvia-700'}`}
            >
              {missing.length ? `Ficha: ${done} de ${TOTAL_POINTS}` : 'Completa ✓'}
            </p>
            <div className="mt-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-stone-200" aria-hidden>
              <div
                className={`h-full rounded-full transition-all ${missing.length ? 'bg-rosa-500' : 'bg-salvia-600'}`}
                style={{ width: `${(done / TOTAL_POINTS) * 100}%` }}
              />
            </div>
          </div>
          {/* En el celular se cancela con «Volver» o la X de la ventana; así los botones entran en un renglón. */}
          <span className="hidden sm:block">
            <Button variant="secondary" size="lg" onClick={onCancel}>
              Cancelar
            </Button>
          </span>
          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="whitespace-nowrap"
            icon={<Save className="hidden size-5 sm:block" />}
          >
            {saving ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      </form>
      <ClientFieldModal open={fieldModal} onClose={() => setFieldModal(false)} />
    </>
  );
}

function Section({
  n,
  title,
  subtitle,
  actions,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-rosa-600 text-base font-extrabold text-white"
          >
            {n}
          </span>
          {title}
        </span>
      }
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </Card>
  );
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span className="text-rosa-600" aria-hidden="true">
        {' '}
        *
      </span>
    </>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm font-semibold text-red-700">{children}</p>;
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
