# Kit documentaire ClairDossier — fiche produit

**Statut : prêt, NON commercialisé (validation de Roman requise).**

## Contenu (généré par `node --import tsx scripts/gen-kit.ts`)
1. Facture impayée · 2. Dossier administratif de l'entreprise · 3. Pièces comptables du mois ·
4. Dossier client · 5. Échéances — fiches à cocher, imprimables.
6. Modèle de chronologie (tableau) · 7. Registre d'échéances (CSV, ouvrable dans un tableur).

Source unique : `src/data/blog/kit-documentaire.ts` (l'article public gratuit et le kit ne divergent jamais).

## Positionnement et prix proposés
| Version | Contenu | Prix proposé | Rôle |
|---|---|---|---|
| Gratuite | Article `/blog/kit-documentaire-checklists` (5 listes) | 0 € | Acquisition SEO → inscription |
| Complète | 7 fichiers imprimables / tableur | 0 € **contre inscription** (recommandé) ou 19 € TTC | Conversion vers un abonnement (19–39 €/mois) |

Recommandation : offrir la version complète aux comptes inscrits plutôt que la vendre — un abonné
Essentiel rapporte 19 €/mois, un kit vendu 19 € une seule fois.

## Garde-fous
- Aide-mémoire d'organisation : aucune règle de droit, aucune durée légale, aucun conseil juridique.
- Pas de lecture automatique de documents, pas d'IA (engagement CGV inchangé).

## Livraison (si vente décidée)
Payment Link Stripe → retour `…?session_id={CHECKOUT_SESSION_ID}` → fonction serveur qui revérifie
la session auprès de Stripe (payée, < 30 jours, produit attendu) puis renvoie un lien signé de
60 s vers un bucket Supabase PRIVÉ. Le même schéma est implémenté et testé côté Roman Gomes
(`src/lib/delivery/verify.ts`, `src/pages/api/telechargement.ts`) ; à porter en Edge Function le jour J.

## Support
Questions d'utilisation par e-mail, réponse sous 2 jours ouvrés ; aucune question juridique traitée.
