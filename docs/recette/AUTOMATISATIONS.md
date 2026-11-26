# Automatisations de la recette — ce qui s'exécute réellement

Code : `recette/server/automations.ts` · Tests : `tests/recette-automatisations.test.ts` (13 tests, magasin en mémoire, horloge injectée).

## Ce qui est réel (branché dans `api.ts` : création, liste, pause, annulation, exécution par `/api/cron`)

- **Enregistrement** : une demande confirmée (« Chaque vendredi, … ») devient une fiche `auto/<compte>/<id>.json` avec une planification vérifiable (`hebdo` / `quotidien` / `mensuel`, heure de Paris, changements d'heure gérés par `Intl`).
- **Exécution navigateur fermé** : `tickAutomations(store)` est appelé par la tâche planifiée du serveur (`/api/cron`). Il exécute ce qui est dû, laisse une preuve par exécution (`auto-runs/<id>/<échéance>.json` : date, échéance, statut, résumé, durée, compteurs) et calcule la prochaine échéance.
- **Deux actions, sans modèle (coût API nul)** :
  - `bilan_dossiers` : pour chaque dossier non clos, nombre de pièces reçues depuis le dernier bilan, situation, prochaine action, prochaine date ; remis dans la boîte de recette avec un lien vers l'espace.
  - `prevenir_echeances` : échéances confirmées à 30, 7 et 1 jour(s) ; une seule alerte par échéance et par palier pour tout le compte.
- **Droits** : abonnement actif exigé à la création, à la reprise et à chaque exécution. Abonnement terminé → automatisation arrêtée avec un motif lisible, sans exécution.
- **Garde-fous** : 10 automatisations actives par compte ; plafond mensuel d'exécutions (hebdo 6, quotidien 35, mensuel 2) ; 3 échecs de suite → suspension + alerte d'exploitation ; 20 exécutions par passage, 2 par compte, à tour de rôle entre comptes ; durée d'un passage bornée (40 s).
- **Une seule exécution par échéance** : la preuve est créée par écriture conditionnelle AVANT l'action ; un second passage simultané ne refait rien. Échéances manquées : un seul rattrapage (marqué `rattrapage`), pas un par période.
- **Isolement** : la clé de stockage porte le compte ; l'automatisation d'un autre titulaire répond « introuvable », comme un identifiant inexistant. L'identité vient de la session, jamais du corps de la requête.

## Limites et points à connaître

- **Déclencheur « à chaque pièce reçue »** : le dépôt appelle `onPieceRecue` ; l'automatisation devient due, mais elle s'exécute au passage suivant du planificateur, pas à la seconde.
- **Heure d'exécution** : la tâche planifiée de la recette passe UNE fois par jour (`5 7 * * *` UTC, soit 8 h 05 à Paris en hiver, 9 h 05 en été — limite de l'offre d'hébergement gratuite). Une échéance « 8 h » est donc exécutée au passage du jour. Pour respecter l'heure annoncée, il faut un passage toutes les heures (offre payante : décision du propriétaire).
- **Preuve de passage** : chaque passage est daté dans `ops/planificateur.json` (30 derniers) et affiché sous la liste des automatisations (« Dernier passage automatique »). `source = planificateur` quand l'appel vient de l'hébergeur. Première exécution réelle constatée sur la recette hébergée : voir `ETAT_FONCTIONNALITES.md` (G).
- **Coupe-circuit** : l'exploitant peut suspendre toutes les automatisations (`/api/admin/coupe-circuit`) ; les fiches et les résultats sont conservés, le client en est informé.
- **« Analyser la pièce reçue »** : l'automatisation ne lance aucune analyse ; l'analyse est faite au dépôt par le moteur. Le bilan en rapporte le résultat.
- **Relances** : « préparer un projet de relance » n'est pas automatisable ; la demande est refusée clairement (400), jamais simulée.
- **Envoi par e-mail** : aucun. Les messages arrivent dans la boîte de recette (`/api/boite`).
- **Heure choisie par le client** : l'assistant propose toujours 8 h ; une autre heure n'est pas proposée.

## Limites connues

- Le bilan reprend la « situation » du tableau de bord (texte produit par l'analyse) et le titre du dossier ; il ne contient ni nom de fichier, ni extrait de pièce.
- Après un arrêt brutal du serveur en pleine exécution, celle-ci est reprise 10 minutes plus tard ; le message n'est remis qu'une fois (au pire, il n'est pas remis ; le bilan reste dans le journal).
- Deux automatisations d'alerte d'un même compte exécutées au même instant par deux passages différents peuvent, très rarement, signaler deux fois la même échéance.
- Chaque passage lit les fiches de tous les comptes (200 comptes par passage, puis les suivants) : adapté au volume de la recette. En production, une table indexée par date d'échéance est nécessaire.
- Le journal d'exécution n'est pas purgé ; la consultation rend les 50 dernières exécutions.
- Plafond mensuel atteint : l'automatisation est arrêtée et doit être reprise par le client le mois suivant (pas de reprise automatique).
- Le droit « automatisations incluses dans l'offre » n'existe pas en recette : seule la règle « abonnement actif » s'applique.
- Aucune donnée de production touchée, aucune migration, aucun fichier de paiement modifié.
