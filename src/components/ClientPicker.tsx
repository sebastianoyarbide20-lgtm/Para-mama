import { useMemo, useState } from 'react';
import { RefreshCw, UserPlus } from 'lucide-react';
import { clientName, useData, useSkinTypeName } from '../hooks/useData';
import { createClient, emptyClient } from '../db/actions';
import { matches, initials } from '../lib/text';
import { formatDate, relativeDays } from '../lib/dates';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { SearchInput } from './ui/Fields';
import { useToast } from './ui/Feedback';
import { ClientForm } from './ClientForm';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-16 text-2xl' };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-rosa-100 font-extrabold text-rosa-800 ${sizes[size]}`}
    >
      {initials(name) || '?'}
    </span>
  );
}

/** Buscador de clientas con autocompletado y alta rápida. */
export function ClientPicker({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (clientId: number | null) => void;
  error?: string | null;
}) {
  const { clients, clientsById, clientStats } = useData();
  const skinName = useSkinTypeName();
  const [query, setQuery] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  const selected = value ? clientsById.get(value) : undefined;

  const results = useMemo(() => {
    const list = clients.filter((c) => matches(`${c.firstName} ${c.lastName} ${c.phone}`, query));
    // Sin búsqueda: las que vinieron más recientemente primero.
    return list
      .sort((a, b) => {
        if (query) return clientName(a).localeCompare(clientName(b), 'es');
        const la = clientStats.get(a.id!)?.lastDate ?? a.createdAt.slice(0, 10);
        const lb = clientStats.get(b.id!)?.lastDate ?? b.createdAt.slice(0, 10);
        return lb.localeCompare(la);
      })
      .slice(0, query ? 12 : 6);
  }, [clients, clientStats, query]);

  if (selected) {
    const stat = clientStats.get(selected.id!);
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-rosa-50 p-3 ring-1 ring-rosa-200">
        <Avatar name={clientName(selected)} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-stone-900">{clientName(selected)}</p>
          <p className="text-sm text-stone-600">
            {[skinName(selected) && `Piel ${skinName(selected).toLowerCase()}`, selected.phone]
              .filter(Boolean)
              .join(' · ')}
            {stat?.lastDate ? ` · Última visita ${relativeDays(stat.lastDate)}` : ' · Primera visita'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="size-4" />}
          onClick={() => onChange(null)}
          aria-label="Cambiar clienta"
          className="self-start"
        >
          <span className="hidden sm:inline">Cambiar</span>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Buscar clienta"
          placeholder="Buscá por nombre o teléfono…"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (results.length === 1) onChange(results[0]!.id!);
            }
          }}
        />
        <Button variant="success" icon={<UserPlus className="size-5" />} onClick={() => setQuickOpen(true)}>
          Nueva clienta
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-red-700">
          {error}
        </p>
      )}

      {clients.length === 0 ? (
        <p className="mt-3 text-stone-600">
          Todavía no cargaste clientas. Tocá <strong>Nueva clienta</strong> para agregar la primera.
        </p>
      ) : (
        <>
          <p className="mt-3 mb-1.5 text-sm font-semibold text-stone-500">
            {query ? `Resultados (${results.length})` : 'Clientas recientes'}
          </p>
          {results.length === 0 ? (
            <div className="rounded-xl bg-stone-50 p-3 text-stone-600">
              No encontramos «{query}».{' '}
              <button
                type="button"
                className="font-bold text-salvia-700 underline underline-offset-2"
                onClick={() => setQuickOpen(true)}
              >
                Crear como nueva clienta
              </button>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((c) => {
                const stat = clientStats.get(c.id!);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c.id!);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-xl bg-white p-2.5 text-left ring-1 ring-stone-200 transition-colors hover:bg-rosa-50 hover:ring-rosa-300"
                    >
                      <Avatar name={clientName(c)} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-stone-900">{clientName(c)}</span>
                        <span className="block truncate text-sm text-stone-500">
                          {stat?.lastDate ? `Última visita: ${formatDate(stat.lastDate)}` : 'Sin sesiones todavía'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <NewClientModal
        open={quickOpen}
        initialName={query}
        onClose={() => setQuickOpen(false)}
        onCreated={(id) => {
          setQuickOpen(false);
          setQuery('');
          onChange(id);
        }}
      />
    </div>
  );
}

/** Alta de clienta desde la sesión: se completa la ficha inicial y queda elegida. */
export function NewClientModal({
  open,
  onClose,
  onCreated,
  initialName = '',
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  initialName?: string;
}) {
  const toast = useToast();
  const [firstGuess, ...rest] = initialName.trim().split(/\s+/);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva clienta · Ficha inicial"
      description="Completá la ficha y guardala: la clienta queda elegida para la sesión."
      size="xl"
    >
      <ClientForm
        inModal
        initial={{ ...emptyClient(), firstName: firstGuess ?? '', lastName: rest.join(' ') }}
        submitLabel="Guardar y elegir"
        onCancel={onClose}
        onSubmit={async (input) => {
          try {
            const id = await createClient(input);
            toast.success(`¡Listo! ${`${input.firstName} ${input.lastName}`.trim()} ya está cargada`);
            onCreated(id);
          } catch {
            toast.error('No se pudo guardar la clienta. Probá de nuevo.');
          }
        }}
      />
    </Modal>
  );
}
