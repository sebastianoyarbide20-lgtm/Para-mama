import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { createClient, emptyClient, updateClient, type ClientInput } from '../../db/actions';
import { clientName, useData } from '../../hooks/useData';
import { PageHeader, EmptyState } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Feedback';
import { ClientForm } from '../../components/ClientForm';

/** Alta o edición de la ficha completa de una clienta. */
export function ClientEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { clientsById } = useData();
  const editingId = id ? Number(id) : null;
  const client = editingId ? clientsById.get(editingId) : undefined;

  if (editingId && !client) {
    return (
      <EmptyState title="No encontramos esa clienta" action={<LinkButton to="/clientas">Ver clientas</LinkButton>}>
        Puede que se haya eliminado.
      </EmptyState>
    );
  }

  const initial: ClientInput = client
    ? {
        ...emptyClient(),
        ...Object.fromEntries(
          Object.entries(client).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'sample'].includes(k)),
        ),
        customFields: { ...(client.customFields ?? {}) },
      }
    : emptyClient();

  const afterSave = params.get('volver');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link
            to={editingId ? `/clientas/${editingId}` : '/clientas'}
            className="inline-flex items-center gap-1 font-semibold text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-5" aria-hidden /> Volver
          </Link>
        }
        title={client ? `Ficha de ${clientName(client)}` : 'Nueva clienta'}
        subtitle={
          client ? 'Modificá lo que necesites y guardá.' : 'Completá lo que sepas. Solo el nombre es obligatorio.'
        }
      />
      <ClientForm
        key={editingId ?? 'new'}
        initial={initial}
        submitLabel={client ? 'Guardar cambios' : 'Guardar clienta'}
        onCancel={() => navigate(-1)}
        onSubmit={async (input) => {
          try {
            if (editingId) {
              await updateClient(editingId, input);
              toast.success('Ficha actualizada');
              navigate(`/clientas/${editingId}`, { replace: true });
            } else {
              const newId = await createClient(input);
              toast.success(`¡${`${input.firstName} ${input.lastName}`.trim()} ya está cargada!`);
              navigate(afterSave === 'sesion' ? `/sesion/nueva?clienta=${newId}` : `/clientas/${newId}`, {
                replace: true,
              });
            }
          } catch (e) {
            console.error(e);
            toast.error('No se pudo guardar la ficha. Probá de nuevo.');
          }
        }}
      />
    </div>
  );
}
