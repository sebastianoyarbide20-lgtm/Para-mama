import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Ventana modal accesible basada en <dialog>: atrapa el foco, se cierra con Esc
 * o tocando afuera.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

  // Se monta en <body> para no quedar dentro de otro formulario.
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Los eventos de React atraviesan portales: evitamos que un formulario de la modal
      // dispare el submit de un formulario "padre".
      onSubmit={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCloseRef.current();
      }}
      className={`m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl bg-white p-0 text-stone-800 shadow-2xl ${widths[size]} open:flex open:flex-col`}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 pt-4 pb-3">
            <div>
              <h2 id={titleId} className="text-xl font-bold text-stone-900">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-stone-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label="Cerrar"
              className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap-reverse justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>,
    document.body,
  );
}
