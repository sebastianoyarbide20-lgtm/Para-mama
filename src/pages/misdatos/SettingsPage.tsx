import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Database,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Save,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStoragePersisted, requestPersistentStorage } from '../../db/db';
import { parseBackup, restoreBackup, type BackupFile, type BackupSummary } from '../../db/backup';
import { clearSampleData, hasSampleData, loadSampleData } from '../../db/sample';
import { deleteAllData, saveSetting } from '../../db/actions';
import { useData } from '../../hooks/useData';
import { canShareFiles, useExport } from '../../hooks/useExport';
import { formatDateTime, relativeDays } from '../../lib/dates';
import { plural } from '../../lib/format';
import { Card, PageHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Fields';
import { Modal } from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../components/ui/Feedback';

export function SettingsPage() {
  const { settings, clients, sessions } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const { exportBackup, exportSessions, exportClients } = useExport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const photoCount = useLiveQuery(() => db.photos.count(), []) ?? 0;
  const sample = useLiveQuery(() => hasSampleData(), [clients]) ?? false;
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const shareable = canShareFiles();

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
    void navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`);
    });
  }, [sessions.length, photoCount]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setPending(parseBackup(text));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.backup);
      toast.success('¡Copia restaurada! Tus datos ya están cargados.');
      setPending(null);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo restaurar la copia. Tus datos actuales no se modificaron.');
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async () => {
    setBusy(true);
    try {
      const r = await loadSampleData();
      toast.success(`Se cargaron ${r.clients} clientas y ${r.sessions} sesiones de ejemplo.`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar los datos de ejemplo.');
    } finally {
      setBusy(false);
    }
  };

  const clearSample = async () => {
    const ok = await confirm({
      title: '¿Borrar los datos de ejemplo?',
      message: 'Se borran las clientas y sesiones de ejemplo. Lo que cargaste vos no se toca.',
      confirmLabel: 'Borrar ejemplos',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearSampleData();
      toast.success('Datos de ejemplo borrados');
    } finally {
      setBusy(false);
    }
  };

  const wipeAll = async () => {
    const ok = await confirm({
      title: '¿Borrar TODOS los datos?',
      message: (
        <>
          <p>
            Se borran <strong>todas</strong> las clientas, sesiones, fotos y listas de este dispositivo. No se puede
            deshacer.
          </p>
          <p className="mt-2 font-semibold">Si no hiciste una copia de seguridad, hacela antes.</p>
        </>
      ),
      confirmLabel: 'Sí, borrar todo',
      danger: true,
    });
    if (!ok) return;
    const sure = await confirm({
      title: 'Última confirmación',
      message: '¿Segura? Esta acción es definitiva.',
      confirmLabel: 'Borrar todo definitivamente',
      danger: true,
    });
    if (!sure) return;
    await deleteAllData();
    toast.success('Se borraron todos los datos.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        back={
          <Link
            to="/mis-datos"
            className="inline-flex items-center gap-1 font-semibold text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="size-5" aria-hidden /> Mis datos
          </Link>
        }
        title="Copia de seguridad y ajustes"
      />

      <Card
        title="Copia de seguridad"
        subtitle="Tus datos se guardan solo en este navegador. Descargá una copia seguido y guardala en otro lugar (Drive, mail, pendrive)."
      >
        <div
          className={`mb-4 rounded-xl p-3 ${settings.lastBackupAt ? 'bg-salvia-50 text-salvia-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {settings.lastBackupAt ? (
            <>
              Última copia: <strong>{formatDateTime(settings.lastBackupAt)}</strong> (
              {relativeDays(settings.lastBackupAt.slice(0, 10))})
            </>
          ) : (
            <strong>Todavía no hiciste ninguna copia de seguridad.</strong>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            icon={<Database className="size-5" />}
            onClick={() => void exportBackup({ includePhotos: true })}
          >
            Descargar copia completa
          </Button>
          {shareable && (
            <Button
              size="lg"
              variant="success"
              icon={<Share2 className="size-5" />}
              onClick={() => void exportBackup({ includePhotos: true, share: true })}
            >
              Enviar copia (WhatsApp, Drive, mail…)
            </Button>
          )}
          {photoCount > 0 && (
            <Button variant="secondary" onClick={() => void exportBackup({ includePhotos: false })}>
              Copia sin fotos (más liviana)
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-stone-500">
          Incluye {plural(clients.length, 'clienta', 'clientas')}, {plural(sessions.length, 'sesión', 'sesiones')} y{' '}
          {plural(photoCount, 'foto', 'fotos')}. Es un archivo .json.
        </p>
      </Card>

      <Card title="Restaurar una copia" subtitle="Para recuperar tus datos o pasarlos a otro celular o computadora.">
        <Button
          variant="secondary"
          size="lg"
          icon={<Upload className="size-5" />}
          onClick={() => fileRef.current?.click()}
        >
          Elegir archivo de copia…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <p className="mt-2 text-sm text-stone-500">
          Antes de reemplazar nada, te mostramos qué contiene y te pedimos confirmación.
        </p>
      </Card>

      <Card title="Planillas para Excel" subtitle="Archivos .csv que se abren con Excel o Google Sheets.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-5" />}
            onClick={() => void exportSessions()}
          >
            Todas las sesiones
          </Button>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-5" />}
            onClick={() => void exportClients()}
          >
            Fichas de clientas
          </Button>
        </div>
      </Card>

      <PreferencesCard />

      <Card title="Datos de ejemplo" subtitle="Para probar la app con clientas y sesiones inventadas.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="soft"
            icon={<FlaskConical className="size-5" />}
            disabled={busy}
            onClick={() => void loadSample()}
          >
            {sample ? 'Volver a cargar datos de ejemplo' : 'Cargar datos de ejemplo'}
          </Button>
          {sample && (
            <Button
              variant="secondary"
              icon={<Trash2 className="size-5" />}
              disabled={busy}
              onClick={() => void clearSample()}
            >
              Borrar datos de ejemplo
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-stone-500">
          Los datos de ejemplo se pueden borrar en cualquier momento sin afectar lo que cargues vos.
        </p>
      </Card>

      <Card title="Almacenamiento">
        <p className="flex items-start gap-2 text-stone-700">
          <HardDrive className="mt-0.5 size-5 shrink-0 text-stone-400" aria-hidden />
          <span>
            Espacio usado: <strong>{usage ?? 'no disponible'}</strong>.{' '}
            {persisted === true && (
              <span className="text-salvia-800">
                <ShieldCheck className="inline size-4" aria-hidden /> El navegador no va a borrar estos datos
                automáticamente.
              </span>
            )}
          </span>
        </p>
        {persisted === false && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const ok = await requestPersistentStorage();
                setPersisted(ok);
                if (ok) toast.success('Listo: el navegador va a conservar tus datos.');
                else toast.info('El navegador no lo permitió. Hacé copias de seguridad seguido.');
              }}
            >
              Pedir al navegador que conserve los datos
            </Button>
          </div>
        )}
      </Card>

      <Card title="Zona peligrosa" className="ring-red-200">
        <Button variant="danger" icon={<Trash2 className="size-5" />} onClick={() => void wipeAll()}>
          Borrar todos los datos
        </Button>
      </Card>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="¿Restaurar esta copia?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void doRestore()}>
              {busy ? 'Restaurando…' : 'Reemplazar mis datos'}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-stone-700">
            <p>
              Copia del{' '}
              <strong>
                {pending.summary.exportedAt ? formatDateTime(pending.summary.exportedAt) : 'fecha desconocida'}
              </strong>{' '}
              con:
            </p>
            <ul className="list-inside list-disc">
              <li>{plural(pending.summary.clients, 'clienta', 'clientas')}</li>
              <li>{plural(pending.summary.sessions, 'sesión', 'sesiones')}</li>
              <li>{pending.summary.includesPhotos ? plural(pending.summary.photos, 'foto', 'fotos') : 'sin fotos'}</li>
            </ul>
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
              <strong>Atención:</strong> se van a reemplazar todos los datos actuales de este dispositivo
              {!pending.summary.includesPhotos && photoCount > 0 && ', incluidas las fotos'}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PreferencesCard() {
  const { settings } = useData();
  const toast = useToast();
  const [name, setName] = useState(settings.businessName);
  const [days, setDays] = useState(String(settings.inactiveDays));
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 7 || n > 730) {
      setError('Poné un número de días entre 7 y 730.');
      return;
    }
    await saveSetting('businessName', name.trim() || 'Mi Cabina');
    await saveSetting('inactiveDays', n);
    toast.success('Preferencias guardadas');
  };

  return (
    <Card title="Preferencias">
      <form onSubmit={save} className="space-y-4" noValidate>
        <TextField
          label="Nombre de tu espacio"
          value={name}
          onValueChange={setName}
          hint="Aparece arriba en la pantalla."
        />
        <TextField
          label="Avisarme de clientas que no vienen hace más de… (días)"
          type="number"
          inputMode="numeric"
          min={7}
          max={730}
          value={days}
          onValueChange={(v) => {
            setDays(v);
            setError(null);
          }}
          error={error}
          wrapperClassName="sm:max-w-sm"
        />
        <Button type="submit" icon={<Save className="size-5" />}>
          Guardar preferencias
        </Button>
      </form>
    </Card>
  );
}
