---
name: clair-pdf
description: À utiliser pour produire, corriger ou relire tout document PDF ClairDossier — brochure, plaquette commerciale, proposition, devis, fiche produit, dossier de partenariat, export d'un dossier client, one-pager, annexe contractuelle. Fixe le format, la grille, les typographies de marque, les mentions légales obligatoires et les contrôles à passer avant diffusion. S'applique dès que l'utilisateur demande un PDF, une brochure, une plaquette, un document imprimable ou un export.
---

# clair-pdf — normes de rendu PDF ClairDossier

Un PDF ClairDossier circule sans contexte : il est transféré, imprimé, relu des
mois plus tard, parfois par un avocat ou un comptable. Il doit tenir seul.

## Format et grille

- **A4 portrait**, 210 × 297 mm (595,28 × 841,89 pt). C'est le format de la
  brochure existante — ne pas en changer sans raison.
- Marges : 20 mm à gauche et à droite, 18 mm en haut, 22 mm en bas.
- Grille : 12 colonnes, gouttière 5 mm. Le corps de texte n'excède jamais
  10 colonnes — au-delà, la ligne devient trop longue à lire.
- Pagination à partir de la page 2, en JetBrains Mono 8 pt, `slate-400`,
  en pied de page à droite.

## Typographies

| Élément | Police | Taille | Couleur |
|---|---|---|---|
| Titre de couverture | Cormorant Garamond 600 | 42-52 pt | `cream-50` sur navy |
| Titre de section | Cormorant Garamond 600 | 24-28 pt | `navy-900` |
| Sous-titre | Inter 600 | 13-15 pt | `navy-800` |
| Texte courant | Inter 400 | 10-11 pt, interligne 1,5 | `ink` |
| Légende, note | Inter 400 | 8-9 pt | `slate-500` |
| Surtitre, référence, statut | JetBrains Mono 500 | 8-9 pt, `letter-spacing` 0,12em, majuscules | `slate-500` ou `gold-700` |

**Les trois polices doivent être embarquées dans le PDF.** Un PDF qui se rabat
sur Helvetica, Times ou DejaVu n'est pas conforme : il ne ressemble plus à
ClairDossier chez le destinataire.

## Couleurs

Palette du skill `clair-marque`, sans exception. Rappels propres au PDF :

- L'or `#c4a456` ne s'utilise pas en texte sur fond clair — passer à
  `gold-700 #7a5f28`.
- Prévoir la lecture en noir et blanc : toute information portée uniquement par
  la couleur doit l'être aussi par un libellé ou une forme.
- Fonds pleins navy : les réserver à la couverture, aux intercalaires et à la
  dernière page. Une brochure entièrement sombre s'imprime mal et coûte cher.

## Structure type d'une plaquette

1. **Couverture** — fond `navy-900`, logo, titre Cormorant, surtitre mono,
   filet or fin, date en mono.
2. **Le problème** — une page, texte court, une illustration ou un schéma.
3. **La réponse** — le mécanisme, étape par étape.
4. **Les fonctionnalités** — uniquement celles de niveau 1 (voir `clair-produit`).
5. **Sécurité et conformité** — reprendre le texte de la page `/securite`
   publiée, jamais une version plus affirmative.
6. **Tarifs** — valeurs exactes de `src/data/pricing.ts`, mention « € HT / mois »
   et « −10 % en facturation annuelle ».
7. **Contact et mentions** — voir ci-dessous.

## Mentions obligatoires en dernière page

- Éditeur : Roman Gomes, entrepreneur individuel, SIREN 105 490 734,
  Château-Gombert, 13013 Marseille.
- Contact : contact.clairdossier@icloud.com — WhatsApp +33 7 82 98 36 44 —
  www.clair-dossier.com
- Mention de nature : « ClairDossier est une assistance technologique de
  structuration documentaire. Ce document ne constitue pas un conseil juridique. »
- Date de version du document, en JetBrains Mono. Un PDF non daté vieillit sans
  qu'on le sache.
- Mention TVA quand le document porte un prix : « TVA non applicable,
  article 293 B du CGI ».

## Contrôles avant diffusion

1. Ouvrir le PDF produit et le regarder — ne jamais livrer un PDF non ouvert.
2. Vérifier que les trois polices de marque sont bien embarquées et utilisées.
3. Vérifier le format A4 sur toutes les pages (pas de page orpheline en Letter).
4. Vérifier chaque prix et chaque nom de fonctionnalité contre le code.
5. Vérifier qu'aucune donnée de client ou de dossier réel n'apparaît.
6. Vérifier le poids : au-delà de 5 Mo, un PDF passe mal en pièce jointe.
7. Passer le protocole `clair-verif` niveau N3 — un PDF est un contenu public.

## Écart connu

`public/brochure-clairdossier.pdf` (8 pages, A4) embarque DejaVu Sans, Helvetica
et Times, et non les trois polices de marque. Le document est donc hors charte
typographique. À régénérer avec Cormorant Garamond, Inter et JetBrains Mono
embarquées lors de sa prochaine mise à jour.

## Note

Si un master prompt « qualité PDF ClairDossier » plus ancien existe côté Roman,
le fusionner avec ce document plutôt que de maintenir deux références
concurrentes. En cas de conflit, la source de vérité reste `clair-marque` et le
code du site.
