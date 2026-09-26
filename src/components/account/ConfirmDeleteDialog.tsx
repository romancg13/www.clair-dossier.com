import { useEffect, useId, useRef, useState } from 'react';
import type { OwnerIdentity } from '../../lib/admin';

/**
 * Confirmation de mise à la corbeille (vue administrateur de /compte).
 * <dialog> natif en mode modal : focus piégé, fond inerte, Échap = Annuler
 * (bloqué pendant l'appel serveur). Le focus initial va sur « Annuler ».
 * L'appelant ne ferme la fenêtre et ne retire la carte qu'après la
 * confirmation du serveur ; en cas d'échec l'erreur s'affiche ici.
 */
export function ConfirmDeleteDialog({
  open,
  dossierTitle,
  owner,
  meta,
  pending,
  error,
  onConfirm,
  onCancel,
  audience = 'admin',
}: {
  /** « client » : le propriétaire supprime son propre dossier (corbeille personnelle). */
  audience?: 'admin' | 'client';
  open: boolean;
  dossierTitle: string;
  owner: OwnerIdentity | null;
  /** Date de création et statut, déjà mis en forme. */
  meta: string;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState('');
  const titleId = useId();
  const descId = useId();
  const reasonId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setReason('');
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        // Échap : fermeture pilotée par l'état React (jamais pendant l'appel).
        e.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border hairline bg-white p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/60"
    >
      <form
        method="dialog"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) onConfirm(reason.trim());
        }}
        className="p-6 sm:p-7"
      >
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
          {audience === 'client' ? 'Corbeille' : 'Corbeille · super administrateur'}
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900">
          {audience === 'client' ? `Supprimer le dossier « ${dossierTitle} » ?` : 'Mettre ce dossier à la corbeille ?'}
        </h2>

        <dl className="mt-5 space-y-3 rounded-xl border hairline bg-cream-50 px-4 py-3.5 text-sm">
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Dossier</dt>
            <dd className="mt-0.5 break-words font-medium text-navy-900">{dossierTitle}</dd>
          </div>
          {audience === 'admin' && (
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Propriétaire</dt>
            <dd className="mt-0.5 break-words font-medium text-navy-900">
              {owner ? owner.label : '—'}
              {owner?.detail && <span className="block text-xs font-normal text-slate-500">{owner.detail}</span>}
            </dd>
          </div>
          )}
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Création · statut</dt>
            <dd className="mt-0.5 text-navy-900">{meta}</dd>
          </div>
        </dl>

        {audience === 'client' ? (
          <p id={descId} className="mt-4 text-sm leading-relaxed text-slate-500">
            Il sera déplacé dans votre corbeille et pourra être restauré. Ses pièces et échéances sont conservées ; un
            dossier déjà validé reste compté dans le quota de la période.
          </p>
        ) : (
        <p id={descId} className="mt-4 text-sm leading-relaxed text-slate-500">
          Le dossier quitte les listes. Ses pièces et échéances sont conservées et il reste restaurable depuis la
          corbeille de la console d'administration. Le quota déjà consommé par le client n'est pas recrédité. Aucune
          suppression définitive.
        </p>
        )}

        {audience === 'admin' && (
          <>
        <label htmlFor={reasonId} className="mt-5 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
          Motif — facultatif, conservé avec le dossier
        </label>
        <input
          id={reasonId}
          type="text"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
          placeholder="Ex. : créé par erreur"
          className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 placeholder:text-slate-500 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20 disabled:opacity-60"
        />
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-cream-100 px-5 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200 disabled:opacity-60"
          >
            Annuler
          </button>
          {/* aria-disabled (et non disabled) : le focus reste sur le bouton pendant l'appel. */}
          <button
            type="submit"
            aria-disabled={pending || undefined}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 aria-disabled:cursor-wait aria-disabled:opacity-60"
          >
            {pending ? 'Mise à la corbeille…' : 'Mettre à la corbeille'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
