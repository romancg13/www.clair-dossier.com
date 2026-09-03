---
description: Lance un cycle de sourcing B2B conforme (sources officielles uniquement)
argument-hint: [ville] [segment] [nombre]
---

Lance un cycle d'acquisition ClairDossier en appliquant intégralement le skill
`clair-acquisition`.

Paramètres reçus : `$ARGUMENTS`
- Zone : `$1` (défaut : Marseille)
- Segment : `$2` (défaut : cabinets d'avocats 3-30 collaborateurs)
- Nombre de prospects visé : `$3` (défaut : 25)

Déroulé attendu :

1. **Cadrer** — confirmer en une ligne la zone, le segment et le volume retenus,
   puis la liste des sources que tu vas interroger.
2. **Sourcer** — Annuaire des Entreprises et API Sirene pour la base
   (SIREN, effectif, NAF, dirigeants), annuaires des ordres professionnels pour
   les cabinets, puis le site officiel de chaque entreprise pour le contact.
   Aucune autre source. Aucun réseau social.
3. **Vérifier** — pour chaque ligne : entreprise active, e-mail réellement lu sur
   une page consultée, URL de cette page conservée. Aucune adresse reconstruite.
4. **Dédupliquer** — écarter ce qui figure déjà au pipeline (registre 02) et tout
   contact inscrit au registre d'opposition (registre 10). Si ces registres ne
   sont pas accessibles depuis cette session, le dire explicitement et livrer la
   liste en signalant que la déduplication reste à faire.
5. **Scorer** — barème de `references/scoring.md`, sur 100. Écarter sous 45.
6. **Livrer** — le tableau markdown au format imposé par le skill, puis les trois
   blocs obligatoires : récapitulatif, ce qui n'a pas pu être vérifié, les cinq
   prospects prioritaires.
7. **Contrôler** — terminer par le bloc CONTRÔLE CLAIRDOSSIER (skill
   `clair-verif`, niveau N2).

Rappels bloquants : aucune donnée inventée, aucune ligne sans URL source, aucun
e-mail marqué ESTIMÉ dans la colonne e-mail.
