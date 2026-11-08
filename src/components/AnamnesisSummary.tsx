import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Pencil } from 'lucide-react';
import type { Client } from '../db/types';
import { useData, useSkinTypeName } from '../hooks/useData';
import { ageFromBirthDate, formatDate, formatDateTime, relativeDays } from '../lib/dates';
import {
  anamnesisMissing,
  CONDITIONS,
  FACIAL_GROUPS,
  fitzpatrickInfo,
  genderLabel,
  HABITS,
  hasNone,
  HOME_CARE,
  labelsOf,
} from '../lib/anamnesis';
import { buttonClasses } from './ui/Button';
import { labelOf, YES_NO_OPTIONS } from './ClientForm';

/** Resumen de la ficha inicial de una clienta, ordenado como la ficha en papel. */
export function AnamnesisSummary({ client }: { client: Client }) {
  const { clientFields } = useData();
  const skinName = useSkinTypeName();
  const missing = anamnesisMissing(client);
  const age = ageFromBirthDate(client.birthDate);
  const fitz = fitzpatrickInfo(client.fitzpatrick);

  const customRows = clientFields
    .map((f) => {
      const v = client.customFields?.[String(f.id)];
      if (v === undefined || v === '') return null;
      let text = String(v);
      if (f.type === 'yesno') text = v === 'si' || v === true ? 'Sí' : 'No';
      if (f.type === 'date') text = formatDate(String(v));
      return { label: f.label, text };
    })
    .filter((r): r is { label: string; text: string } => r !== null);

  return (
    <section
      aria-labelledby="ficha-inicial-titulo"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 sm:p-5"
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ficha-inicial-titulo" className="text-lg font-bold text-stone-900">
            Ficha inicial
          </h2>
          {missing.length === 0 ? (
            <p className="flex items-center gap-1 text-sm font-semibold text-salvia-700">
              <CircleCheck className="size-4" aria-hidden /> Completa
            </p>
          ) : (
            <p className="flex items-center gap-1 text-sm font-semibold text-amber-800">
              <CircleAlert className="size-4" aria-hidden /> Incompleta
            </p>
          )}
        </div>
        <Link to={`/clientas/${client.id}/editar`} className={buttonClasses('ghost', 'sm')}>
          <Pencil className="size-4" aria-hidden /> Editar
        </Link>
      </header>

      {missing.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
          <p className="text-sm">
            <strong>Falta completar:</strong> {missing.map((m) => m.label).join(', ')}.
          </p>
          <Link to={`/clientas/${client.id}/editar`} className={buttonClasses('primary', 'sm', 'mt-2')}>
            Completar ficha
          </Link>
        </div>
      )}

      <Group title="Datos personales">
        <Row label="Fecha de nacimiento">
          {client.birthDate ? (
            <>
              {formatDate(client.birthDate)} {age !== null && <Muted>({age} años)</Muted>}
            </>
          ) : (
            <Empty />
          )}
        </Row>
        <Row label="Género">{genderLabel(client.gender) || <Empty />}</Row>
        <Row label="Último tratamiento">
          {client.noPreviousTreatment ? (
            'Nunca se hizo uno'
          ) : client.lastTreatmentDate ? (
            <>
              {formatDate(client.lastTreatmentDate)} <Muted>({relativeDays(client.lastTreatmentDate)})</Muted>
            </>
          ) : (
            <Empty />
          )}
        </Row>
        {client.phone && (
          <Row label="Teléfono">
            <a
              href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
              className="font-semibold text-rosa-700 underline underline-offset-2"
            >
              {client.phone}
            </a>
          </Row>
        )}
        {client.email && (
          <Row label="Email">
            <a href={`mailto:${client.email}`} className="break-all text-rosa-700 underline underline-offset-2">
              {client.email}
            </a>
          </Row>
        )}
      </Group>

      <Group title="Historia clínica y hábitos">
        <Row label="Alergias">
          {client.allergies ? (
            <span className="font-semibold text-red-800">{client.allergies}</span>
          ) : client.noAllergies ? (
            'No tiene'
          ) : (
            <Empty />
          )}
        </Row>
        <Row label="Hábitos">
          <Chips keys={client.habits} labels={labelsOf(HABITS, client.habits)} noneText="Ninguno" />
        </Row>
        <Row label="Cuidados domiciliarios">
          <Chips keys={client.homeCare} labels={labelsOf(HOME_CARE, client.homeCare)} noneText="Ninguno" />
        </Row>
        {client.medication && <Row label="Medicación">{client.medication}</Row>}
        {client.exercises && (
          <Row label="Ejercicio">
            {labelOf(YES_NO_OPTIONS, client.exercises)}
            {client.exercises === 'si' && client.exerciseFrequency && ` · ${client.exerciseFrequency}`}
          </Row>
        )}
        {client.history && <Row label="Antecedentes">{client.history}</Row>}
      </Group>

      <Group title="Piel">
        <Row label="Tipo de piel">{skinName(client) || <Empty />}</Row>
        <Row label="Fitzpatrick">
          {fitz ? (
            <span className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 size-5 shrink-0 rounded-full ring-1 ring-stone-300"
                style={{ backgroundColor: fitz.color }}
              />
              <span>
                <strong>{fitz.label}</strong> <Muted>{fitz.hint}</Muted>
              </span>
            </span>
          ) : (
            <Empty />
          )}
        </Row>
      </Group>

      <Group title="Análisis facial">
        {FACIAL_GROUPS.map((g) => (
          <Row key={g.key} label={g.label}>
            <Chips
              keys={client.facial?.[g.key]}
              labels={labelsOf(g.options, client.facial?.[g.key])}
              noneText="Sin hallazgos"
            />
          </Row>
        ))}
      </Group>

      <Group title="Condiciones del paciente">
        <Chips
          keys={client.conditions}
          labels={labelsOf(CONDITIONS, client.conditions)}
          noneText="Ninguna"
          tone="red"
        />
      </Group>

      {(customRows.length > 0 || client.notes) && (
        <Group title="Otros datos">
          {customRows.map((r) => (
            <Row key={r.label} label={r.label}>
              {r.text}
            </Row>
          ))}
          {client.notes && <Row label="Notas">{client.notes}</Row>}
        </Group>
      )}

      <p className="mt-4 text-xs text-stone-400">
        Cargada el {formatDateTime(client.createdAt)}
        {client.updatedAt &&
          client.updatedAt !== client.createdAt &&
          ` · actualizada el ${formatDateTime(client.updatedAt)}`}
      </p>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-stone-100 py-3 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="mb-1.5 text-sm font-extrabold tracking-wide text-rosa-700 uppercase">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-stone-500">{label}</dt>
      <dd className="break-words whitespace-pre-line text-stone-800">{children}</dd>
    </div>
  );
}

function Chips({
  keys,
  labels,
  noneText,
  tone = 'neutral',
}: {
  keys: string[] | undefined;
  labels: string[];
  noneText: string;
  tone?: 'neutral' | 'red';
}) {
  if (labels.length === 0) return hasNone(keys) ? <span className="text-stone-600">{noneText}</span> : <Empty />;
  const style = tone === 'red' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-stone-100 text-stone-800 ring-stone-200';
  return (
    <ul className="mt-0.5 flex flex-wrap gap-1.5">
      {labels.map((l) => (
        <li key={l} className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${style}`}>
          {l}
        </li>
      ))}
    </ul>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-sm text-stone-500">{children}</span>;
}

function Empty() {
  return <span className="text-stone-400">Sin completar</span>;
}
