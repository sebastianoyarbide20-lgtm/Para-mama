import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/* --------------------------------- Avisos ---------------------------------- */

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

/* ---------------------------- Confirmaciones ------------------------------- */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ToastContext = createContext<ToastApi | null>(null);
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const toastApi = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const toneStyles: Record<ToastTone, string> = {
    success: 'bg-salvia-700 text-white',
    error: 'bg-red-700 text-white',
    info: 'bg-stone-800 text-white',
  };
  const toneIcons: Record<ToastTone, ReactNode> = {
    success: <CircleCheck className="size-6 shrink-0" />,
    error: <CircleAlert className="size-6 shrink-0" />,
    info: <Info className="size-6 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div
          aria-live="polite"
          role="status"
          className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3 lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:items-end"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`animate-toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 font-semibold shadow-lg ${toneStyles[t.tone]}`}
            >
              {toneIcons[t.tone]}
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar aviso"
                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-white/15"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Modal
          open={confirmState !== null}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title ?? ''}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => closeConfirm(false)}>
                {confirmState?.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant={confirmState?.danger ? 'danger' : 'primary'}
                onClick={() => closeConfirm(true)}
                autoFocus
              >
                {confirmState?.confirmLabel ?? 'Aceptar'}
              </Button>
            </>
          }
        >
          {confirmState?.message && <div className="text-stone-700">{confirmState.message}</div>}
        </Modal>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <FeedbackProvider>');
  return ctx;
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <FeedbackProvider>');
  return ctx;
}
