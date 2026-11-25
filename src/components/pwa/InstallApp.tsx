// « Installer l'application » : la même ClairDossier, ouverte depuis l'écran d'accueil. Gratuit, sans effet sur les droits.
import { useEffect, useState } from 'react';
import { appliquerMiseAJour, estInstallee, installer, plateforme, usePwa, type Plateforme } from '../../lib/pwa';

const CONSIGNES: Record<Plateforme, string[]> = {
  ios: ['Dans Safari, touchez le bouton Partager.', 'Choisissez « Sur l’écran d’accueil ».', 'Touchez « Ajouter » (laissez « Ouvrir comme app web » activé s’il est proposé).'],
  android: ['Ouvrez le menu ⋮ de votre navigateur.', 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».'],
  'mac-safari': ['Dans Safari, ouvrez le menu Fichier (ou le bouton Partager).', 'Choisissez « Ajouter au Dock ».'],
  ordinateur: ['Dans Chrome ou Edge, cliquez sur l’icône d’installation à droite de la barre d’adresse.', 'Ou ouvrez le menu ⋮ puis « Installer ClairDossier ».'],
  autre: ['Ouvrez le menu de votre navigateur.', 'Cherchez « Installer » ou « Ajouter à l’écran d’accueil ». Si rien n’est proposé, ClairDossier reste utilisable ici, dans le navigateur.'],
};

export function InstallApp({ discret = false }: { discret?: boolean }) {
  const { invitationDisponible, installeeMaintenant } = usePwa();
  const [deja, setDeja] = useState(false);
  const [p, setP] = useState<Plateforme>('autre');
  const [aide, setAide] = useState(false);
  useEffect(() => {
    setDeja(estInstallee());
    setP(plateforme());
  }, []);
  // Déjà ouverte comme application : aucune invitation répétée.
  if (deja) return discret ? null : <p className="mt-4 text-[13.5px] text-slate-500">Vous utilisez l’application ClairDossier installée sur cet appareil.</p>;
  const clic = async () => {
    if ((await installer()) === 'indisponible') setAide(true);
  };
  return (
    <section id="installer" aria-labelledby="installer-titre" className={discret ? 'mt-6 text-[14px]' : 'mt-4 rounded-2xl border border-cream-200 bg-white p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="installer-titre" className="text-[15px] font-medium text-navy-900">Installer l’application</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">ClairDossier sur votre écran d’accueil : mêmes dossiers, même compte. Gratuit.</p>
        </div>
        {installeeMaintenant ? (
          <span className="text-[13.5px] font-semibold text-emerald-800">Application installée</span>
        ) : (
          <button type="button" onClick={() => void clic()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-[14px] font-medium text-navy-900 transition hover:border-gold-500">
            {invitationDisponible ? 'Installer' : 'Comment installer'}
          </button>
        )}
      </div>
      {aide && !installeeMaintenant && (
        <ol className="mt-3 space-y-1 pl-5 text-[14px] text-slate-700" style={{ listStyleType: 'decimal' }}>
          {CONSIGNES[p].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Nouvelle version disponible : proposée, jamais imposée (aucun rechargement pendant un dépôt). */
export function MiseAJourDisponible() {
  const { miseAJourDisponible } = usePwa();
  if (!miseAJourDisponible) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-navy-900 px-4 py-2.5 text-[13.5px] text-cream-50" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}>
      Une nouvelle version de ClairDossier est prête.
      <button type="button" onClick={appliquerMiseAJour} className="rounded-full bg-gold-500 px-4 py-1.5 font-semibold text-navy-900">Actualiser</button>
    </div>
  );
}
