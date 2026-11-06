import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Cake,
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  Dumbbell,
  Mail,
  Pencil,
  Phone,
  Trash2,
  Cigarette,
  Pill,
  TriangleAlert,
  Baby,
  NotebookPen,
  Stethoscope,
  Flower2,
} from 'lucide-react';
import { deleteClient } from '../../db/actions';
import type { Session } from '../../db/types';
import { deleteSession } from '../../db/actions';
import { clientName, useBuiltinCatalogs, useData, useSkinTypeName } from '../../hooks/useData';
import { ageFromBirthDate, formatDate, formatDateTime, relativeDays, todayISO } from '../../lib/dates';
import { formatMoney, formatNumber, plural } from '../../lib/format';
import { averageDaysBetweenVisits, isInactive, nextSessionStatus, ranking, sortSessionsDesc } from '../../lib/stats';
import { Badge, Card, EmptyState, InfoRow, PageHeader } from '../../components/ui/Card';
import { Button, LinkButton } from '../../components/ui/Button';
import { useConfirm, useToast } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ClientPicker';
import { ClientAlerts } from '../../components/ClientAlerts';
import { SessionCard } from '../../components/SessionCard';
import { labelOf, PREGNANCY_OPTIONS, SMOKES_OPTIONS, YES_NO_OPTIONS } from '../../components/ClientForm';

export function ClientDetailPage() {
  const { id } = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { clientsById, sessions, clientStats, clientFields, itemsById, settings } = useData();
  const { treatments, products, devices } = useBuiltinCatalogs();
  const skinName = useSkinTypeName();
  const client = clientsById.get(clientId);

  const history = useMemo(
    () => sortSessionsDesc(sessions.filter((s) => s.clientId === clientId)),
    [sessions, clientId],
  );

  if (!client) {
    return (
      <EmptyState title="No encontramos esa clienta" action={<LinkButton to="/clientas">Ver clientas</LinkButton>}>
        Puede que se haya eliminado.
      </EmptyState>
    );
  }

  const today = todayISO();
  const stat = clientStats.get(clientId);
  const age = ageFromBirthDate(client.birthDate);
  const avgDays = averageDaysBetweenVisits(history);
  const topTreatments = treatments ? ranking(history, treatments.id!, itemsById, 3) : [];
  const topProducts = products ? ranking(history, products.id!, itemsById, 5) : [];
  const topDevices = devices ? ranking(history, devices.id!, itemsById, 3) : [];
  const next = nextSessionStatus(stat, today);
  const name = clientName(client);

  const removeClient = async () => {
    const ok = await confirm({
      title: `¿Eliminar a ${name}?`,
      message: (
        <>
          Se borra la ficha
          {history.length > 0 && (
            <>
              {' '}
              y <strong>{plural(history.length, 'sesión', 'sesiones')}</strong> con sus fotos
            </>
          )}
          . Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteClient(clientId);
    toast.success(`${name} fue eliminada`);
    navigate('/clientas', { replace: true });
  };

  const removeSession = async (s: Session) => {
    const ok = await confirm({
      title: '¿Eliminar esta sesión?',
      message: `Sesión del ${formatDate(s.date)}. Se borra junto con sus fotos y no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
    });
    if (!ok) return;
    await deleteSession(s.id!);
    toast.success('Sesión eliminada');
  };

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
    <div>
      <PageHeader
        back={
          <Link
            to="/clientas"
            className="inline-flex items-center gap-1 font-semibold text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-5" aria-hidden /> Clientas
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} size="lg" />
            <span>
              {name}
              <span className="block text-base font-semibold text-stone-500">
                {[
                  age !== null ? `${age} años` : null,
                  skinName(client) ? `Piel ${skinName(client).toLowerCase()}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Ficha de clienta'}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton to={`/sesion/nueva?clienta=${clientId}`} size="lg" icon={<CalendarPlus className="size-5" />}>
              Registrar sesión
            </LinkButton>
            <LinkButton
              to={`/clientas/${clientId}/editar`}
              variant="secondary"
              size="lg"
              icon={<Pencil className="size-5" />}
            >
              Editar ficha
            </LinkButton>
          </>
        }
      />

      {(next || isInactive(stat, settings.inactiveDays, today)) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {isInactive(stat, settings.inactiveDays, today) && stat?.lastDate && (
            <Badge tone="amber">Hace {relativeDays(stat.lastDate, today).replace('hace ', '')} que no viene</Badge>
          )}
          {next === 'pendiente' && (
            <Badge tone="salvia" icon={<CalendarClock />}>
              Próxima sesión sugerida: {formatDate(stat!.nextSessionDate)} (
              {relativeDays(stat!.nextSessionDate!, today)})
            </Badge>
          )}
          {next === 'vencida' && (
            <Badge tone="red" icon={<CalendarClock />}>
              Tenía que volver el {formatDate(stat!.nextSessionDate)}
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Columna ficha */}
        <div className="space-y-5">
          <Card title="Importante">
            <ClientAlerts client={client} />
          </Card>

          <Card title="Resumen">
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Sesiones" value={String(history.length)} />
              <Stat label="Última visita" value={stat?.lastDate ? formatDate(stat.lastDate) : '–'} />
              <Stat label="Primera visita" value={stat?.firstDate ? formatDate(stat.firstDate) : '–'} />
              <Stat
                label="Viene cada"
                value={avgDays !== null ? `${formatNumber(Math.round(avgDays))} días` : '–'}
                hint="promedio"
              />
              {(stat?.totalSpent ?? 0) > 0 && <Stat label="Total cobrado" value={formatMoney(stat!.totalSpent)} />}
              {(stat?.unpaid ?? 0) > 0 && <Stat label="Falta pagar" value={formatMoney(stat!.unpaid)} warn />}
            </dl>
            {topTreatments.length > 0 && <TopList title="Tratamiento más frecuente" rows={topTreatments} />}
            {topProducts.length > 0 && <TopList title="Productos más usados con ella" rows={topProducts} />}
            {topDevices.length > 0 && <TopList title="Aparatología más usada" rows={topDevices} />}
          </Card>

          <Card title="Ficha">
            <dl className="divide-y divide-stone-100">
              {client.phone && (
                <InfoRow label="Teléfono" icon={<Phone />}>
                  <a
                    href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
                    className="font-semibold text-rosa-700 underline underline-offset-2"
                  >
                    {client.phone}
                  </a>
                </InfoRow>
              )}
              {client.email && (
                <InfoRow label="Email" icon={<Mail />}>
                  <a href={`mailto:${client.email}`} className="text-rosa-700 underline underline-offset-2">
                    {client.email}
                  </a>
                </InfoRow>
              )}
              {client.birthDate && (
                <InfoRow label="Fecha de nacimiento" icon={<Cake />}>
                  {formatDate(client.birthDate)} {age !== null && `(${age} años)`}
                </InfoRow>
              )}
              <InfoRow label="Tipo de piel" icon={<Flower2 />}>
                {skinName(client) || <Missing />}
              </InfoRow>
              <InfoRow label="Medicación / pastillas" icon={<Pill />}>
                {client.medication || <Missing text="No toma / sin cargar" />}
              </InfoRow>
              <InfoRow label="Alergias" icon={<TriangleAlert />}>
                {client.allergies || <Missing text="Ninguna / sin cargar" />}
              </InfoRow>
              <InfoRow label="¿Fuma?" icon={<Cigarette />}>
                {labelOf(SMOKES_OPTIONS, client.smokes) || <Missing />}
              </InfoRow>
              <InfoRow label="¿Hace ejercicio?" icon={<Dumbbell />}>
                {client.exercises ? (
                  <>
                    {labelOf(YES_NO_OPTIONS, client.exercises)}
                    {client.exercises === 'si' && client.exerciseFrequency && ` · ${client.exerciseFrequency}`}
                  </>
                ) : (
                  <Missing />
                )}
              </InfoRow>
              <InfoRow label="Embarazo / lactancia" icon={<Baby />}>
                {labelOf(PREGNANCY_OPTIONS, client.pregnancy) || <Missing />}
              </InfoRow>
              {client.history && (
                <InfoRow label="Antecedentes" icon={<Stethoscope />}>
                  {client.history}
                </InfoRow>
              )}
              {customRows.map((r) => (
                <InfoRow key={r.label} label={r.label}>
                  {r.text}
                </InfoRow>
              ))}
              {client.notes && (
                <InfoRow label="Notas" icon={<NotebookPen />}>
                  {client.notes}
                </InfoRow>
              )}
            </dl>
            <p className="mt-3 text-xs text-stone-400">Cargada el {formatDateTime(client.createdAt)}</p>
          </Card>

          <Button
            variant="ghost"
            block
            className="text-red-700 hover:bg-red-50"
            icon={<Trash2 className="size-5" />}
            onClick={() => void removeClient()}
          >
            Eliminar clienta
          </Button>
        </div>

        {/* Línea de tiempo */}
        <section aria-labelledby="historial-titulo">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="historial-titulo" className="text-xl font-extrabold text-stone-900">
              Historial de sesiones
            </h2>
            <span className="text-stone-500">{plural(history.length, 'sesión', 'sesiones')}</span>
          </div>
          {history.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus />}
              title="Todavía no tiene sesiones"
              action={
                <LinkButton to={`/sesion/nueva?clienta=${clientId}`} icon={<CalendarPlus className="size-5" />}>
                  Registrar la primera sesión
                </LinkButton>
              }
            />
          ) : (
            <ol className="relative space-y-4 border-l-2 border-rosa-200 pl-5 sm:pl-7">
              {history.map((s) => (
                <li key={s.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute top-6 -left-[1.69rem] size-4 rounded-full border-4 border-crema bg-rosa-500 sm:-left-[2.19rem]"
                  />
                  <SessionCard session={s} onDelete={removeSession} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${warn ? 'bg-amber-50' : 'bg-crema'}`}>
      <dt className="text-sm font-semibold text-stone-500">
        {label} {hint && <span className="font-normal">({hint})</span>}
      </dt>
      <dd className={`text-lg font-extrabold ${warn ? 'text-amber-900' : 'text-stone-900'}`}>{value}</dd>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { id: number; name: string; count: number }[] }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-sm font-bold text-stone-500">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-full bg-rosa-50 px-2.5 py-0.5 text-sm font-semibold text-rosa-900 ring-1 ring-rosa-200"
          >
            {r.name} <span className="font-normal text-rosa-700">×{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Missing({ text = 'Sin cargar' }: { text?: string }) {
  return <span className="text-stone-400">{text}</span>;
}
