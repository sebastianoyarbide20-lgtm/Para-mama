import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, ListOrdered, Tags } from 'lucide-react';
import { clientName, useData } from '../../hooks/useData';
import { useExport } from '../../hooks/useExport';
import type { MoneyKind } from '../../db/types';
import { formatMoney, plural } from '../../lib/format';
import { monthLongLabel } from '../../lib/dates';
import { matches } from '../../lib/text';
import { movementsInRange } from '../../lib/economy';
import { Card, EmptyState, PageHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchInput, Segmented, SelectField } from '../../components/ui/Fields';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { SectionTabs } from '../../components/SectionTabs';
import { MovementModal } from '../../components/economy/MovementModal';
import { ConceptsModal } from '../../components/economy/ConceptsModal';
import { KIND_STYLE } from '../../components/economy/kinds';
import { ECONOMY_TABS, MovementRow, useMovementModal, usePeriod } from './shared';

type KindFilter = '' | MoneyKind;

/** Economía → Movimientos: todo lo cargado a mano (ingresos que no son de sesiones, gastos e inversiones). */
export function MovementsPage() {
  const { movements, concepts, conceptsById, itemsById, clientsById } = useData();
  const { exportMovements } = useExport();
  const { preset, custom, range, setPreset, updateCustom, periodText } = usePeriod('todo');
  const modal = useMovementModal();
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [kind, setKind] = useState<KindFilter>('');
  const [conceptId, setConceptId] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      movementsInRange(movements, range.from, range.to)
        .filter((m) => {
          if (kind && m.kind !== kind) return false;
          if (conceptId && String(m.conceptId) !== conceptId) return false;
          if (query) {
            const text = [
              conceptsById.get(m.conceptId)?.name,
              m.description,
              m.productId ? itemsById.get(m.productId)?.name : '',
              m.clientId ? clientName(clientsById.get(m.clientId)) : '',
            ].join(' ');
            if (!matches(text, query)) return false;
          }
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)),
    [movements, range.from, range.to, kind, conceptId, query, conceptsById, itemsById, clientsById],
  );

  // Agrupados por mes (la lista ya viene de más nuevo a más viejo).
  const months = useMemo(() => {
    const groups: { key: string; label: string; income: number; out: number; items: typeof filtered }[] = [];
    for (const m of filtered) {
      const key = m.date.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: monthLongLabel(`${key}-01`), income: 0, out: 0, items: [] };
        groups.push(g);
      }
      g.items.push(m);
      if (m.kind === 'ingreso') g.income += m.amount;
      else g.out += m.amount;
    }
    return groups;
  }, [filtered]);

  const totals = { ingreso: 0, gasto: 0, inversion: 0 } as Record<MoneyKind, number>;
  for (const m of filtered) totals[m.kind] += m.amount;
  const conceptOptions = concepts.filter((c) => !kind || c.kind === kind);

  return (
    <div>
      <PageHeader
        eyebrow="Economía"
        title="Movimientos"
        subtitle="Ingresos que no son de sesiones, gastos e inversiones. Tocá uno para cambiarlo o borrarlo."
        actions={
          <>
            <Button variant="ghost" icon={<Tags className="size-4" />} onClick={() => setConceptsOpen(true)}>
              Conceptos
            </Button>
            <Button
              variant="ghost"
              icon={<FileSpreadsheet className="size-4" />}
              onClick={() => void exportMovements(range.from, range.to)}
              disabled={movements.length === 0}
            >
              Exportar (CSV)
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowDownLeft className="size-4" />}
              onClick={() => modal.add('ingreso')}
            >
              Agregar ingreso
            </Button>
            <Button icon={<ArrowUpRight className="size-4" />} onClick={() => modal.add('gasto')}>
              Agregar gasto o inversión
            </Button>
          </>
        }
      />
      <SectionTabs tabs={ECONOMY_TABS} />

      {movements.length === 0 ? (
        <EmptyState
          icon={<ListOrdered />}
          title="Todavía no cargaste movimientos"
          action={
            <>
              <Button variant="secondary" onClick={() => modal.add('ingreso')}>
                Agregar ingreso
              </Button>
              <Button onClick={() => modal.add('gasto')}>Agregar gasto o inversión</Button>
            </>
          }
        >
          Anotá acá la venta de cremas, lo que gastás en productos, el alquiler, la luz o una compra grande como un
          aparato. Los cobros de las sesiones se suman solos.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <DateRangeFilter preset={preset} custom={custom} onPreset={setPreset} onCustom={updateCustom} />
          <div className="card flex flex-wrap items-end gap-4 p-4">
            <Segmented
              label="Tipo"
              allowClear={false}
              value={kind}
              onChange={(v) => {
                setKind(v);
                setConceptId('');
              }}
              options={[
                { value: '', label: 'Todos' },
                { value: 'ingreso', label: 'Ingresos' },
                { value: 'gasto', label: 'Gastos' },
                { value: 'inversion', label: 'Inversiones' },
              ]}
            />
            <SelectField label="Concepto" value={conceptId} onValueChange={setConceptId} wrapperClassName="w-64">
              <option value="">Todos</option>
              {conceptOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!kind ? ` (${KIND_STYLE[c.kind].label})` : ''}
                </option>
              ))}
            </SelectField>
            <div className="min-w-60 flex-1">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">Buscar</span>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Concepto, producto, clienta o detalle"
                label="Buscar movimiento"
              />
            </div>
          </div>

          <section aria-label="Totales" className="card grid grid-cols-2 divide-stone-100 md:grid-cols-4 md:divide-x">
            {(['ingreso', 'gasto', 'inversion'] as MoneyKind[]).map((k) => (
              <div key={k} className="px-5 py-4">
                <p className="text-sm font-semibold text-stone-500">{KIND_STYLE[k].plural}</p>
                <p className={`num mt-1 text-xl font-bold ${k === 'ingreso' ? 'text-sky-800' : 'text-stone-900'}`}>
                  {formatMoney(totals[k])}
                </p>
              </div>
            ))}
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-stone-500">Movimientos</p>
              <p className="num mt-1 text-xl font-bold text-stone-900">{filtered.length}</p>
              <p className="truncate text-xs text-stone-500">{periodText}</p>
            </div>
          </section>

          <Card padded={false} title="Mes por mes" subtitle={plural(filtered.length, 'movimiento', 'movimientos')}>
            {filtered.length === 0 ? (
              <p className="px-6 pb-6 text-stone-500">No hay movimientos con estos filtros.</p>
            ) : (
              months.map((month) => (
                <section key={month.key} aria-label={month.label}>
                  <h3 className="sticky top-16 z-10 flex flex-wrap items-baseline justify-between gap-x-4 border-y border-stone-100 bg-stone-50/95 px-6 py-2.5 backdrop-blur">
                    <span className="font-bold text-stone-800">{month.label}</span>
                    <span className="num text-sm text-stone-500">
                      {month.income > 0 && (
                        <span className="font-semibold text-sky-800">Entró {formatMoney(month.income)}</span>
                      )}
                      {month.income > 0 && month.out > 0 && ' · '}
                      {month.out > 0 && (
                        <span className="font-semibold text-stone-700">Salió {formatMoney(month.out)}</span>
                      )}
                    </span>
                  </h3>
                  <ul aria-label="Movimientos" className="divide-y divide-stone-100">
                    {month.items.map((m) => (
                      <li key={m.id}>
                        <MovementRow movement={m} onEdit={modal.edit} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </Card>
        </div>
      )}

      <MovementModal {...modal.props} />
      <ConceptsModal open={conceptsOpen} onClose={() => setConceptsOpen(false)} initialKind={kind || 'gasto'} />
    </div>
  );
}
