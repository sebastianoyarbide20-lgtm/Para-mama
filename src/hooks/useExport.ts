import { useCallback } from 'react';
import { backupFileName, buildBackup, clientsCSV, markBackupDone, sessionsCSV } from '../db/backup';
import { downloadFile } from '../lib/csv';
import { todayISO } from '../lib/dates';
import { useToast } from '../components/ui/Feedback';

export function canShareFiles(): boolean {
  try {
    const probe = new File(['x'], 'x.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Acciones de exportación con avisos amigables. */
export function useExport() {
  const toast = useToast();

  const exportBackup = useCallback(
    async (options: { includePhotos: boolean; share?: boolean }) => {
      try {
        const backup = await buildBackup(options.includePhotos);
        const json = JSON.stringify(backup);
        const name = backupFileName(options.includePhotos ? 'copia-mi-cabina' : 'copia-mi-cabina-sin-fotos');
        if (options.share && canShareFiles()) {
          const file = new File([json], name, { type: 'application/json' });
          try {
            await navigator.share({
              files: [file],
              title: 'Copia de seguridad',
              text: 'Copia de seguridad de Mi Cabina',
            });
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            throw e;
          }
        } else {
          downloadFile(name, json, 'application/json');
        }
        await markBackupDone();
        toast.success('Copia de seguridad lista. Guardala en un lugar seguro (Drive, mail, pendrive…).');
      } catch (e) {
        console.error(e);
        toast.error('No se pudo generar la copia de seguridad.');
      }
    },
    [toast],
  );

  const exportSessions = useCallback(
    async (from: string | null = null, to: string | null = null) => {
      try {
        const csv = await sessionsCSV(from, to);
        const suffix = from || to ? `${from ?? 'inicio'}_a_${to ?? todayISO()}` : todayISO();
        downloadFile(`sesiones-${suffix}.csv`, csv, 'text/csv;charset=utf-8');
        toast.success('Planilla de sesiones descargada (se abre con Excel).');
      } catch (e) {
        console.error(e);
        toast.error('No se pudo exportar.');
      }
    },
    [toast],
  );

  const exportClients = useCallback(async () => {
    try {
      const csv = await clientsCSV();
      downloadFile(`clientas-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
      toast.success('Planilla de clientas descargada (se abre con Excel).');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo exportar.');
    }
  }, [toast]);

  return { exportBackup, exportSessions, exportClients };
}
