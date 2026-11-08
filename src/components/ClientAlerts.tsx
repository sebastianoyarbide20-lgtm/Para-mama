import { Flower2, HeartPulse, Pill, TriangleAlert, Wine } from 'lucide-react';
import type { Client } from '../db/types';
import { useSkinTypeName } from '../hooks/useData';
import { CONDITIONS, fitzpatrickInfo, HABITS, labelsOf } from '../lib/anamnesis';

/** Datos críticos de la ficha (alergias, condiciones, medicación, piel, hábitos) destacados. */
export function ClientAlerts({ client, showEmpty = true }: { client: Client; showEmpty?: boolean }) {
  const skinName = useSkinTypeName();
  const skin = skinName(client);
  const fitz = fitzpatrickInfo(client.fitzpatrick);
  const conditions = labelsOf(CONDITIONS, client.conditions);
  const habits = labelsOf(HABITS, client.habits);

  const rows: { icon: React.ReactNode; label: string; value: string; tone: 'red' | 'amber' | 'neutral' }[] = [];
  if (client.allergies) rows.push({ icon: <TriangleAlert />, label: 'Alergias', value: client.allergies, tone: 'red' });
  if (conditions.length)
    rows.push({ icon: <HeartPulse />, label: 'Condiciones', value: conditions.join(', '), tone: 'red' });
  if (client.medication) rows.push({ icon: <Pill />, label: 'Medicación', value: client.medication, tone: 'amber' });
  if (skin || fitz)
    rows.push({
      icon: <Flower2 />,
      label: 'Piel',
      value: [skin, fitz ? `Fitzpatrick ${fitz.value}` : ''].filter(Boolean).join(' · '),
      tone: 'neutral',
    });
  if (habits.length) rows.push({ icon: <Wine />, label: 'Hábitos', value: habits.join(', '), tone: 'neutral' });

  if (rows.length === 0) {
    return showEmpty ? (
      <p className="text-sm text-stone-500">Sin alergias, condiciones ni medicación cargadas en la ficha.</p>
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
