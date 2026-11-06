import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, DatabaseBackup, ListPlus, Users } from 'lucide-react';
import type { Catalog } from '../../db/types';
import { useData } from '../../hooks/useData';
import { plural } from '../../lib/format';
import { PageHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CatalogModal } from '../../components/CatalogModals';

/** Sector 1: listas propias, clientas y ajustes. */
export function MisDatosPage() {
  const { catalogs, itemsByCatalog, clients, clientFields } = useData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const sessionLists = catalogs.filter((c) => c.showInSession);
  const otherLists = catalogs.filter((c) => !c.showInSession);

  const count = (c: Catalog) => {
    const items = itemsByCatalog.get(c.id!) ?? [];
    const active = items.filter((i) => i.active).length;
    return active === items.length
      ? plural(items.length, 'opción', 'opciones')
      : `${active} activas de ${items.length}`;
  };

  return (
    <div>
      <PageHeader
        title="Mis datos"
        subtitle="Tus listas, tus clientas y la copia de seguridad."
        actions={
          <Button size="lg" icon={<ListPlus className="size-5" />} onClick={() => setCreating(true)}>
            Crear nueva lista
          </Button>
        }
      />

      <section aria-labelledby="listas-sesion" className="mb-8">
        <h2 id="listas-sesion" className="mb-1 text-xl font-extrabold text-stone-900">
          Listas para las sesiones
        </h2>
        <p className="mb-3 text-stone-600">Lo que elegís cuando registrás una sesión. Tocá una lista para editarla.</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessionLists.map((c) => (
            <li key={c.id}>
              <Tile
                to={`/mis-datos/lista/${c.id}`}
                icon={<span className="text-2xl">{c.icon}</span>}
                title={c.name}
                text={count(c)}
                badge={c.builtIn ? undefined : 'Propia'}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-full min-h-22 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 p-4 text-left font-bold text-stone-600 transition-colors hover:border-rosa-400 hover:bg-rosa-50/50 hover:text-rosa-800"
            >
              <ListPlus className="size-7 shrink-0" aria-hidden />
              <span>
                Crear nueva lista
                <span className="block text-sm font-normal">Ej: Zonas tratadas, Cremas para casa, Técnicas</span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="clientas-datos" className="mb-8">
        <h2 id="clientas-datos" className="mb-3 text-xl font-extrabold text-stone-900">
          Clientas y fichas
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Tile
              to="/clientas"
              icon={<Users className="size-7 text-rosa-600" />}
              title="Clientas"
              text={plural(clients.length, 'clienta cargada', 'clientas cargadas')}
            />
          </li>
          {otherLists.map((c) => (
            <li key={c.id}>
              <Tile
                to={`/mis-datos/lista/${c.id}`}
                icon={<span className="text-2xl">{c.icon}</span>}
                title={c.name}
                text={count(c)}
              />
            </li>
          ))}
          <li>
            <Tile
              to="/mis-datos/ficha"
              icon={<ClipboardList className="size-7 text-rosa-600" />}
              title="Campos de la ficha"
              text={
                clientFields.length
                  ? plural(clientFields.length, 'campo propio', 'campos propios')
                  : 'Agregá tus propios campos'
              }
            />
          </li>
        </ul>
      </section>

      <section aria-labelledby="seguridad">
        <h2 id="seguridad" className="mb-3 text-xl font-extrabold text-stone-900">
          Seguridad y ajustes
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Tile
              to="/mis-datos/ajustes"
              icon={<DatabaseBackup className="size-7 text-salvia-600" />}
              title="Copia de seguridad y ajustes"
              text="Exportar, importar, datos de ejemplo"
            />
          </li>
        </ul>
      </section>

      <CatalogModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate(`/mis-datos/lista/${id}`)}
      />
    </div>
  );
}

function Tile({
  to,
  icon,
  title,
  text,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="flex h-full min-h-22 items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80 transition-colors hover:bg-rosa-50/50 hover:ring-rosa-200"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-crema" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-lg font-bold text-stone-900">
          {title}
          {badge && (
            <span className="rounded-full bg-salvia-100 px-2 py-0.5 text-xs font-bold text-salvia-800">{badge}</span>
          )}
        </span>
        <span className="block text-stone-600">{text}</span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-stone-400" aria-hidden />
    </Link>
  );
}
