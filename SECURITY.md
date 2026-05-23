# Politique de sécurité ClairDossier

## Périmètre

ClairDossier manipule des comptes, dossiers juridiques, documents, messages, paiements et journaux d’audit. Les secrets Stripe, Supabase service role et IA ne doivent jamais être placés dans le frontend, `public/`, `src/` ou le bundle Vite.

## Versions supportées

La branche de production et les dernières migrations Supabase sont maintenues pour les correctifs de sécurité.

## Signaler une vulnérabilité

Écrivez à `contact@clair-dossier.com` avec :

- la route ou le composant concerné ;
- les étapes de reproduction ;
- l’impact potentiel ;
- toute preuve utile sans exfiltrer de données réelles.

Ne publiez pas publiquement une faille exploitable avant correction.

## Exigences minimales avant production

- RLS Supabase activée et migrations appliquées.
- Bucket `case-documents` privé avec URLs signées.
- Webhook Stripe déployé avec `--no-verify-jwt` et signature Stripe vérifiée.
- Secrets uniquement dans Supabase Edge Functions ou GitHub Actions.
- Headers de sécurité servis par l’hébergeur ou le proxy frontal.
