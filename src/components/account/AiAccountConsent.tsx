import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shouldAskAiConsent, useAiAccount } from '../../lib/ai-account';

const laterKey = (userId: string) => `cd-ia-plus-tard:${userId}`;

function readLater(userId: string): boolean {
  try {
    return sessionStorage.getItem(laterKey(userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Acceptation unique de l'analyse automatique, proposée à la connexion (nouveaux
 * comptes comme comptes existants). « Plus tard » ne redemande qu'à la session suivante.
 * N'apparaît que si l'interrupteur serveur autorise ce compte et qu'il est éligible.
 */
export function AiAccountConsent({ userId }: { userId: string }) {
  const { status, pending, error, accept } = useAiAccount(userId);
  const [later, setLater] = useState(() => readLater(userId));
  const [checked, setChecked] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const open = shouldAskAiConsent(status, later);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const postpone = () => {
    try {
      sessionStorage.setItem(laterKey(userId), '1');
    } catch {
      /* stockage indisponible : on ferme pour la session en cours seulement */
    }
    setLater(true);
  };

  if (!status) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) postpone();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border hairline bg-white p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/60"
    >
      <form
        method="dialog"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && checked) void accept();
        }}
        className="p-6 sm:p-7"
      >
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">ClairDossier Intelligence</p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900">
          Activer l'analyse automatique de vos pièces ?
        </h2>
        <div id={descId} className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            Une seule fois pour tout votre compte : chaque pièce que vous déposerez ensuite sera lue automatiquement pour préparer vos
            documents de travail (résumé, chronologie, dates, échéances, projets de relances).
          </p>
          <p>
            Les pièces déjà déposées ne sont pas relues : vous pourrez le demander dossier par dossier. Aucun message n'est envoyé à vos
            interlocuteurs : les relances restent des brouillons. Vous pouvez désactiver l'analyse à tout moment dans Mon compte.
          </p>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={pending} />
          <span>
            J'accepte que le contenu de mes pièces soit transmis à notre prestataire d'intelligence artificielle (Anthropic, sous-traitant, États-Unis) pour produire
            ces documents, générés automatiquement, à vérifier, et qui ne constituent pas un conseil juridique (
            <Link to="/cgv" className="underline underline-offset-2">
              CGV, art. 6
            </Link>
            ).
          </span>
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={postpone}
            disabled={pending}
            className="rounded-full border hairline px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-cream-50 disabled:opacity-60"
          >
            Plus tard
          </button>
          <button
            type="submit"
            disabled={!checked || pending}
            className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-50"
          >
            {pending ? 'Activation…' : 'Accepter et activer'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Réglage dans Mon compte : état, activation et désactivation. Masqué si l'analyse n'est pas ouverte pour ce compte. */
export function AiAccountPanel({ userId }: { userId: string }) {
  const { status, pending, error, accept, disable } = useAiAccount(userId);
  const [checked, setChecked] = useState(false);
  if (!status?.gateAllows) return null;
  const since = status.acceptedAt ? new Date(status.acceptedAt).toLocaleDateString('fr-FR') : null;

  return (
    <section aria-labelledby="ia-compte-titre" className="rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
      <h2 id="ia-compte-titre" className="font-display text-lg text-navy-900">
        Analyse automatique
      </h2>
      {status.enabled ? (
        <>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Active{since ? ` depuis le ${since}` : ''} (conditions {status.termsVersion}) : chaque nouvelle pièce est lue automatiquement.
          </p>
          <button
            type="button"
            onClick={() => void disable()}
            disabled={pending}
            className="mt-4 rounded-full border hairline px-4 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-cream-50 disabled:opacity-60"
          >
            {pending ? 'Désactivation…' : "Désactiver l'analyse automatique"}
          </button>
        </>
      ) : !status.eligible ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Un abonnement actif est nécessaire pour l'analyse automatique.</p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Désactivée. Une fois activée, chaque nouvelle pièce est lue automatiquement ; les pièces déjà déposées ne sont pas relues.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-slate-700">
            <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={pending} />
            <span>
              J'accepte la transmission du contenu de mes pièces à notre prestataire d'intelligence artificielle (Anthropic, sous-traitant, États-Unis) selon les{' '}
              <Link to="/cgv" className="underline underline-offset-2">
                CGV, art. 6
              </Link>
              .
            </span>
          </label>
          <button
            type="button"
            onClick={() => void accept()}
            disabled={!checked || pending}
            className="mt-4 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-50"
          >
            {pending ? 'Activation…' : "Activer l'analyse automatique"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
