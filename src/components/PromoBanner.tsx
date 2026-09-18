import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LB13_INTENT_PARAM, LB13_INTENT_VALUE, LB13_LIVE_VERIFIED, LB13_OFFER, lb13Phase } from "../data/promo";

// Promo LB13 (conditions : src/data/promo.ts). La barre disparaît d'elle-même
// à l'échéance (21/09/2026 00:00, heure de Paris). Tant que le code n'est pas
// vérifié en LIVE, elle le signale au lieu d'annoncer une offre utilisable.
const DISMISS_KEY = "clairdossier_promo_lb13_dismissed";
const OFFER_HREF = `/tarifs?${LB13_INTENT_PARAM}=${LB13_INTENT_VALUE}#offre-lb13`;

export function PromoBanner() {
  // Premier rendu client identique au HTML prérendu (pas d'écart d'hydratation) :
  // la fermeture mémorisée et la date limite ne sont évaluées qu'après montage.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let gone = false;
    try {
      gone = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      gone = false;
    }
    if (gone || lb13Phase(Date.now()) === "ended") setDismissed(true);
  }, []);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  }

  return (
    <div className="relative isolate overflow-hidden bg-navy-900 text-cream-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 120% at 85% 0%, rgba(196,164,86,0.20), transparent 60%)",
        }}
      />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-10 py-2.5 text-center sm:px-12">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-500">
          Offre de lancement
        </p>
        <p className="text-sm font-medium leading-tight">
          <span className="font-display text-base font-semibold text-gold-500">
            −20 %
          </span>{" "}
          pendant 4 mois sur tout abonnement mensuel
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-gold-500">
          CODE {LB13_OFFER.code}
        </span>
        <span className="text-xs text-cream-50/75">
          {LB13_LIVE_VERIFIED
            ? "à saisir au paiement avant le 21 septembre"
            : "mise en service du code en cours : il peut encore être refusé au paiement"}
        </span>
        <Link
          to={OFFER_HREF}
          className="rounded-full bg-gold-500 px-3.5 py-1 text-xs font-semibold text-navy-900 transition-transform hover:-translate-y-0.5"
        >
          {LB13_LIVE_VERIFIED ? "En profiter" : "Voir les conditions"}
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer l'annonce"
        className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
