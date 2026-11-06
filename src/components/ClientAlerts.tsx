import { Baby, Cigarette, Pill, TriangleAlert, Flower2 } from 'lucide-react';
import type { Client } from '../db/types';
import { useSkinTypeName } from '../hooks/useData';
import { labelOf, PREGNANCY_OPTIONS, SMOKES_OPTIONS } from './ClientForm';

/** Datos críticos de la ficha (alergias, medicación, embarazo, piel) destacados. */
export function ClientAlerts({ client, showEmpty = true }: { client: Client; showEmpty?: boolean }) {
  const skinName = useSkinTypeName();
  const skin = skinName(client);
  const pregnancy =
    client.pregnancy === 'embarazada' || client.pregnancy === 'lactancia'
      ? labelOf(PREGNANCY_OPTIONS, client.pregnancy)
      : '';

  const rows: { icon: React.ReactNode; label: string; value: string; tone: 'red' | 'amber' | 'neutral' }[] = [];
  if (client.allergies) rows.push({ icon: <TriangleAlert />, label: 'Alergias', value: client.allergies, tone: 'red' });
  if (pregnancy) rows.push({ icon: <Baby />, label: 'Embarazo / lactancia', value: pregnancy, tone: 'red' });
  if (client.medication) rows.push({ icon: <Pill />, label: 'Medicación', value: client.medication, tone: 'amber' });
  if (skin) rows.push({ icon: <Flower2 />, label: 'Tipo de piel', value: skin, tone: 'neutral' });
  if (client.smokes === 'si' || client.smokes === 'ocasionalmente')
    rows.push({ icon: <Cigarette />, label: 'Fuma', value: labelOf(SMOKES_OPTIONS, client.smokes), tone: 'neutral' });

  if (rows.length === 0) {
    return showEmpty ? (
      <p className="text-sm text-stone-500">Sin alergias, medicación ni datos de piel cargados en la ficha.</p>
    ) : null;
  }

  const tones = {
    red: 'bg-red-50 text-red-900 ring-red-200 [&_svg]:text-red-600',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200 [&_svg]:text-amber-600',
    neutral: 'bg-stone-50 text-stone-800 ring-stone-200 [&_svg]:text-stone-500',
  };

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className={`flex gap-2.5 rounded-xl p-2.5 ring-1 ring-inset ${tones[r.tone]}`}>
          <span className="mt-0.5 shrink-0 [&>svg]:size-5" aria-hidden>
            {r.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">{r.label}</span>
            <span className="block break-words whitespace-pre-line">{r.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
