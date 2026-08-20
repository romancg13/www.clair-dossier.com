/**
 * Palette de commandes (§5.3) — un raccourci unique, tout au clavier.
 *
 * Ctrl+K (ou Cmd+K) ouvre ; flèches pour naviguer, Entrée pour exécuter,
 * Échap pour fermer. Ouvrir un dossier, changer de vue, chercher dans le
 * corpus local : les trois gestes les plus fréquents, sans souris.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { NAVIGATION, type Vue } from './navigation';

export type Commande = {
  id: string;
  categorie: 'vue' | 'dossier' | 'recherche' | 'action';
  intitule: string;
  executer: () => void;
};

export function PaletteCommandes({
  dossiers,
  onVue,
  onActif,
  onRecherche,
  actions = [],
}: {
  dossiers: string[];
  onVue: (vue: Vue) => void;
  onActif: (reference: string) => void;
  /** Bascule vers la vue Documents avec la requête pré-remplie. */
  onRecherche: (requete: string) => void;
  actions?: Commande[];
}) {
  const [ouverte, setOuverte] = useState(false);
  const [requete, setRequete] = useState('');
  const [curseur, setCurseur] = useState(0);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOuverte((o) => !o);
        setRequete('');
        setCurseur(0);
      }
      if (e.key === 'Escape') setOuverte(false);
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  useEffect(() => {
    if (ouverte) champ.current?.focus();
  }, [ouverte]);

  const commandes = useMemo<Commande[]>(() => {
    const vues: Commande[] = NAVIGATION.flatMap((s) => s.entrees).map((e) => ({
      id: `vue-${e.vue}`,
      categorie: 'vue',
      intitule: `Aller à : ${e.intitule}`,
      executer: () => onVue(e.vue),
    }));
    const ouvertures: Commande[] = dossiers.map((r) => ({
      id: `dossier-${r}`,
      categorie: 'dossier',
      intitule: `Ouvrir le dossier ${r}`,
      executer: () => onActif(r),
    }));
    const recherche: Commande[] = requete.trim()
      ? [{
          id: 'recherche',
          categorie: 'recherche',
          intitule: `Chercher « ${requete.trim()} » dans les pièces`,
          executer: () => onRecherche(requete.trim()),
        }]
      : [];
    const toutes = [...recherche, ...vues, ...ouvertures, ...actions];
    const filtre = requete.trim().toLowerCase();
    return filtre
      ? toutes.filter((c) => c.categorie === 'recherche' || c.intitule.toLowerCase().includes(filtre))
      : toutes;
  }, [dossiers, requete, onVue, onActif, onRecherche, actions]);

  if (!ouverte) return null;

  function executer(index: number) {
    const commande = commandes[index];
    if (!commande) return;
    commande.executer();
    setOuverte(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]"
      onClick={() => setOuverte(false)}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border hairline-strong bg-surface shadow-card" onClick={(e) => e.stopPropagation()}>
        <input
          ref={champ}
          value={requete}
          onChange={(e) => { setRequete(e.target.value); setCurseur(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCurseur((c) => Math.min(c + 1, commandes.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCurseur((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); executer(curseur); }
          }}
          placeholder="Vue, dossier, ou texte à chercher…"
          className="w-full border-b hairline bg-surface px-4 py-3 text-sm text-encre focus:outline-none"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {commandes.length === 0 && <li className="px-4 py-3 text-sm text-encre-2">Rien ne correspond.</li>}
          {commandes.slice(0, 12).map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => executer(i)}
                onMouseEnter={() => setCurseur(i)}
                className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left text-sm ${i === curseur ? 'bg-laiton/10 text-encre' : 'text-encre-2'}`}
              >
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-encre-3">{c.categorie}</span>
                {c.intitule}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
