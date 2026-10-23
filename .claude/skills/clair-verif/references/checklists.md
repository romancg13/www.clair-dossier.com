# CLAIR-VERIF — listes de contrôle par type de livrable

À utiliser en complément des 7 passes, pas à leur place.

## Code du site (React / TypeScript)

- [ ] `npm run typecheck` exécuté — 0 erreur. Coller la sortie, ne pas la résumer.
- [ ] `npm run build` exécuté — build réussi (il lance aussi `gen:md`).
- [ ] Aucune route existante supprimée ou renommée sans redirection.
- [ ] Un seul `h1` par page ; hiérarchie de titres continue.
- [ ] Focus visible conservé ; contrastes AA (voir `clair-marque`).
- [ ] `prefers-reduced-motion` respecté sur toute nouvelle animation.
- [ ] Pas de scroll horizontal à 360, 768 et 1280 px de large.
- [ ] Aucune clé, aucun secret côté client. `import.meta.env` uniquement pour
      les valeurs publiques (`VITE_*` est exposé au navigateur).
- [ ] Si un fichier `src/data/*` change : `public/*.md` et `public/llms.txt`
      restent cohérents.

## Base de données et Supabase

- [ ] Toute nouvelle table a une politique RLS explicite.
- [ ] Testé qu'un utilisateur A ne voit jamais les données d'un utilisateur B.
- [ ] Migration réversible, ou plan de retour arrière écrit.
- [ ] Aucune donnée personnelle ajoutée sans finalité et durée de conservation.
- [ ] Edge function : entrées validées, secrets en variables d'environnement.

## Contenu public (page, article, PDF, post)

- [ ] Chaque fonctionnalité citée existe au niveau 1 (`clair-produit`).
- [ ] Chaque prix vérifié contre `src/data/pricing.ts`.
- [ ] Chaque référence légale vérifiée sur une source officielle.
- [ ] Mention « assistance technologique, pas un conseil juridique » présente.
- [ ] Aucun emoji, aucune formule générique, aucun chiffre non sourcé.
- [ ] Typographie française : espaces insécables, guillemets « ».

## E-mail sortant / prospection

- [ ] Destinataire absent du registre d'opposition.
- [ ] Adresse professionnelle, réellement lue sur une source citée.
- [ ] Expéditeur identifié, objet professionnel, lien de désinscription testé.
- [ ] Envoi hors plage 20 h - 8 h (heure de Paris).
- [ ] Plafond quotidien respecté.
- [ ] Aucune affirmation produit de niveau 2 ou 3 présentée au présent.

## Tâche planifiée / automatisation

- [ ] L'action est réversible, ou une validation humaine est prévue avant effet.
- [ ] Le déclencheur, la fréquence et le registre alimenté sont écrits.
- [ ] Les erreurs sont journalisées et remontées, pas avalées.
- [ ] Aucune tâche existante supprimée ou modifiée sans demande explicite.
- [ ] Le coût (appels API, envois) est borné.

## Master prompt / skill

- [ ] La description dit **quand** l'utiliser, avec des déclencheurs réels.
- [ ] Moins de 500 lignes ; le détail est en `references/`.
- [ ] Aucune valeur inventée : chaque donnée chiffrée est traçable à une source.
- [ ] Les interdits sont explicites et vérifiables.
