# Réception d'e-mails entrants — proposition de recette (2026-11-18)

> Statut : **implémenté, NON VÉRIFIÉ de bout en bout** (aucun compte/domaine Resend de
> réception disponible sur cette machine). Sans les trois mises en service ci-dessous,
> rien ne change pour personne : triple garde (build, migration, fonction).

## Flux

```
e-mail transféré à d-<32 hex>@<sous-domaine>  ──►  webhook Resend `email.received` (signé Svix)
  ──►  fonction email-inbound : signature ±5 min, routage par DESTINATAIRE enregistré,
       idempotence (email_id unique), débit 30/h/adresse
  ──►  contenu réel via l'API Resend (GET /emails/receiving/{id}) : SPF/DKIM/DMARC conservés
  ──►  pièces jointes acceptées (mêmes règles que le dépôt manuel : pdf/jpg/jpeg/png/webp/
       doc/docx/txt, 25 Mo, 10 max/e-mail) stockées comme pièces du dossier ;
       sans pièce jointe : le texte du message devient une pièce .txt
  ──►  déclencheur documents_ai_enqueue existant : analyse automatique si le dossier est activé
       (review_mode=auto ⇒ publication sans clic admin), navigateur fermé.
```

## Fichiers

| Rôle | Fichier |
|---|---|
| Schéma (adresses, journal, inclusion par offre, RPC) | `supabase/migrations/20261118130000_reception_email_entrante.sql` |
| Retour arrière niveau 1 (sans perte) | `supabase/rollback/20261118130000_reception_email_entrante.down.sql` |
| Webhook (signature, routage, stockage réel) | `supabase/functions/email-inbound/index.ts` |
| Logique pure testée (signature Svix, routage, acceptation) | `supabase/functions/_shared/inbound-email.ts` |
| Interface (3 étapes, « Connecté » après réception réelle) | `src/components/dossier/EmailInbox.tsx` (onglet Pièces) |
| Tests | `tests/email-inbound.test.ts` (signature, routage, règles) · `tests/sql/migrations.pglite.mjs` (« E-mail entrant ») |

## Décisions intégrées (mission 2026-11-18)

- Adresse **par dossier**, générée côté base (`d-` + 32 hex), jamais choisie, révocable ;
  une seule active par dossier ; une adresse révoquée n'est jamais réutilisée.
- Incluse à partir de l'offre **Entrepreneur** (`plan_entitlements.email_inbound`,
  réglable ; dérogation par compte via `entitlement_overrides`). Essentiel : refus
  expliqué dans l'interface.
- Routage par destinataire (`received_for`/`to`), **jamais** par expéditeur ; expéditeur,
  sujet et verdicts SPF/DKIM/DMARC conservés à titre de provenance (`inbound_emails`).
- Pas d'aspiration générale, pas de suppression de l'e-mail original, aucun lien du
  message suivi (seules les URL de téléchargement de pièces jointes de l'API Resend).
- « Connecté » affiché **uniquement** après une réception réellement enregistrée.

## Mise en service (actions propriétaire, dans l'ordre)

1. **Resend** : vérifier un **sous-domaine dédié** (ex. `recoit.clair-dossier.com`) et
   activer « Receiving » (le MX se pose sur ce sous-domaine — les MX du domaine
   principal ne sont jamais touchés). Créer le webhook `email.received` vers
   `https://<projet>.supabase.co/functions/v1/email-inbound` et copier son secret.
2. **Supabase** : appliquer la migration (comprise dans `mise-en-service-supabase.mjs`),
   déployer `supabase functions deploy email-inbound --no-verify-jwt`, poser les secrets
   `RESEND_INBOUND_WEBHOOK_SECRET`, `RESEND_API_KEY`, `INBOUND_EMAIL_DOMAIN`.
3. **Build** : ajouter `VITE_INBOUND_EMAIL_DOMAIN: '<sous-domaine>'` au workflow de
   déploiement — avant cela, l'interface n'affiche rien.

## À confirmer au premier essai réel

- Chemin REST exact de la liste des pièces jointes (`/emails/receiving/{id}/attachments`,
  d'après la page « list-received-email-attachments » de la doc Resend) — l'échec est
  journalisé proprement dans `inbound_emails.error`.
- Limites Resend (taille max d'un e-mail entrant, rétention) — non publiées dans les
  pages lues ; `download_url` valable 1 h (traitement immédiat dans le webhook).
- Texte CGV/confidentialité si exposé aux clients (dépôt par e-mail = dépôt volontaire
  du client ; à faire relire — indépendant de l'art. 6 sur l'analyse automatique).
