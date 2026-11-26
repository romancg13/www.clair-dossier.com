# Un seul ClairDossier — unification sur Supabase (V11, 25/11/2026)

Décision du fondateur (25/11) : **tout sur Supabase**. Les pages client ORIGINALES (`src/pages/Account.tsx`, `src/pages/DossierDetail.tsx`,
connexion, inscription, tarifs) sont la seule interface ; Ultra-Tech s'y greffe. Vérification sur **Supabase local** (aucune dépense).

## Ce qui est unifié

| Élément | Où | Statut |
|---|---|---|
| ClairDossier IA à droite de « Vos résultats » (onglet Tableau de bord de la page dossier originale) | `src/components/intelligence/DossierIntelligence.tsx` | VÉRIFIÉ EN LOCAL sur Supabase (ordinateur + mobile) |
| Rappel confirmé → vraie échéance du dossier (RLS du titulaire) | idem | VÉRIFIÉ EN LOCAL (ligne créée en base) |
| Automatisation confirmée → `create_client_automation` (abonnement exigé) | migration `20261126120000` | VÉRIFIÉ EN LOCAL |
| Exécution navigateur fermé par la BASE : `pg_cron` → `run_client_automations()` chaque heure, preuve unique par échéance | idem | VÉRIFIÉ EN LOCAL : exécution autonome à 17:07:00 le 25/11, une seule malgré deux déclenchements simultanés |
| « Mon compte » : À décider maintenant, Depuis votre dernière visite, Ce que ClairDossier fait pour vous, préférences, installation | `src/components/intelligence/EspaceIntelligence.tsx` | VÉRIFIÉ EN LOCAL |
| Historique privé de l'assistant, préférences (12 au plus) | migration | VÉRIFIÉ EN LOCAL (SQL) |
| Isolation A/B (dossiers, échéances, automatisations, notifications, historique) | RLS + fonctions | VÉRIFIÉ EN LOCAL : 124 tests SQL + parcours navigateur (B : « introuvable ») |
| Accueil et tarifs ORIGINAUX sur la recette hébergée (fin des variantes « clarté » et « tarifs lisibles ») | `scripts/recette/vercel-build.mjs`, `src/recette/routes.tsx` | déployé |
| Paiement de recette depuis la page de tarifs originale (lien de la même formule) | `scripts/preview-neutralise.mjs` | déployé |
| Application installable = ce même site | `public/manifest.webmanifest`, `public/sw.js` | VÉRIFIÉ PAR ÉMULATION (V9) |

Activation : build `VITE_INTELLIGENCE=1` + migration `20261126120000_intelligence_espace_client.sql` (indépendante du moteur IA,
installable sur la production actuelle). Sans le drapeau, le build de production est inchangé (contrôlé : aucune trace dans `dist/`).

## Ce qui n'est pas encore unifié

- **Recette hébergée** : faute de Supabase de recette hébergé (choix « local seulement »), l'adresse Vercel de recette garde son espace
  client de second serveur. Elle n'est plus la référence ; la référence est la page originale vérifiée sur Supabase local.
- **Assistant avec modèle** : en mode règles sur l'analyse du dossier ; le transport serveur avec modèle (fonction Supabase) attend la clé d'API.
- **Notifications poussées, messagerie, Stripe bac à sable** : accès externes manquants.

## Reproduire

Supabase local (docker) avec les migrations ; garde réseau (hôte de production → 127.0.0.1 dans le conteneur de base) ; `pg_cron` activé ;
site lancé avec `VITE_SUPABASE_URL` local, `VITE_INTELLIGENCE=1`, `VITE_AI_ENGINE=1`. Captures : `captures/v11-*.png`.
