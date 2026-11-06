import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import type { PhotoKind } from '../db/types';
import { compressImage } from '../lib/images';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Feedback';

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  antes: 'Antes',
  despues: 'Después',
  otra: 'Otra',
};

export interface EditablePhoto {
  /** id en la base si ya estaba guardada; undefined si es nueva. */
  id?: number;
  /** clave local para React */
  key: string;
  kind: PhotoKind;
  dataUrl: string;
}

let photoKeySeq = 0;
export const newPhotoKey = () => `p${Date.now()}-${photoKeySeq++}`;

/** Carga de fotos antes/después. Las fotos se comprimen y se guardan en el dispositivo. */
export function PhotoInput({
  photos,
  onChange,
}: {
  photos: EditablePhoto[];
  onChange: (photos: EditablePhoto[]) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<EditablePhoto | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: EditablePhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await compressImage(file);
        const kind: PhotoKind = photos.length + added.length === 0 ? 'antes' : 'despues';
        added.push({ key: newPhotoKey(), kind, dataUrl });
      } catch {
        toast.error(`No se pudo cargar la foto «${file.name}».`);
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    if (added.length) onChange([...photos, ...added]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <figure key={p.key} className="w-36 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200">
            <button type="button" onClick={() => setViewing(p)} className="block w-full" aria-label="Ver foto grande">
              <img
                src={p.dataUrl}
                alt={`Foto ${PHOTO_KIND_LABELS[p.kind]}`}
                className="aspect-square w-full object-cover"
              />
            </button>
            <figcaption className="space-y-1.5 p-2">
              <select
                value={p.kind}
                aria-label="Tipo de foto"
                onChange={(e) =>
                  onChange(photos.map((x) => (x.key === p.key ? { ...x, kind: e.target.value as PhotoKind } : x)))
                }
                className="input-base py-1.5 text-sm"
              >
                {Object.entries(PHOTO_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x.key !== p.key))}
                className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden /> Quitar
              </button>
            </figcaption>
          </figure>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex aspect-square w-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-white font-semibold text-stone-600 hover:border-rosa-400 hover:text-rosa-700 disabled:opacity-60"
        >
          {busy ? (
            <span className="size-7 animate-spin rounded-full border-4 border-rosa-200 border-t-rosa-600" />
          ) : (
            <>
              <span className="flex gap-1">
                <Camera className="size-7" aria-hidden />
                <ImagePlus className="size-7" aria-hidden />
              </span>
              Agregar foto
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function PhotoViewer({
  photo,
  onClose,
}: {
  photo: { dataUrl: string; kind: PhotoKind } | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={photo !== null}
      onClose={onClose}
      title={photo ? `Foto: ${PHOTO_KIND_LABELS[photo.kind]}` : ''}
      size="lg"
    >
      {photo && (
        <img
          src={photo.dataUrl}
          alt={`Foto ${PHOTO_KIND_LABELS[photo.kind]}`}
          className="mx-auto max-h-[70dvh] rounded-xl"
        />
      )}
    </Modal>
  );
}

/** Miniaturas de solo lectura. */
export function PhotoStrip({ photos }: { photos: { id?: number; dataUrl: string; kind: PhotoKind }[] }) {
  const [viewing, setViewing] = useState<{ dataUrl: string; kind: PhotoKind } | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id ?? i}>
            <button
              type="button"
              onClick={() => setViewing(p)}
              className="group relative block overflow-hidden rounded-xl ring-1 ring-stone-200"
              aria-label={`Ver foto ${PHOTO_KIND_LABELS[p.kind]}`}
            >
              <img src={p.dataUrl} alt="" className="size-24 object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-stone-900/60 py-0.5 text-center text-xs font-bold text-white">
                {PHOTO_KIND_LABELS[p.kind]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
