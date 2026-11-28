# Analyse d'impact (AIPD) — analyse automatique et assistant — PROJET NON SIGNÉ

**Statut au 28/11/2026 : projet mis à jour d'après le produit réellement en service. Aucune validation ni
signature n'a été donnée : la conclusion (§ 7) appartient au responsable de traitement. Tant qu'elle n'est pas
signée, l'analyse automatique reste limitée aux essais sur pièces fictives (interrupteur serveur en mode
« pilote », § 6).**

Légende : **VÉRIFIÉ** = constaté dans le code, en base ou par essai réel · **SOURCE** = texte officiel consulté
le 28/11/2026 · **À CONFIRMER** = information ou décision qui manque · **HYPOTHÈSE** = estimation.

## 1. Nécessité de l'AIPD

SOURCE — RGPD, article 35 § 1 : lorsqu'un type de traitement, en particulier par le recours à de nouvelles
technologies, est susceptible d'engendrer un risque élevé pour les droits et libertés des personnes physiques,
le responsable du traitement effectue, avant le traitement, une analyse d'impact
([CNIL, RGPD chapitre IV](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4)).

Éléments présents ici :

- les pièces de dossiers administratifs ou juridiques peuvent contenir des données de santé, des données
  relatives à des infractions, ou des éléments couverts par un secret professionnel ;
- usage d'une technologie nouvelle : lecture des pièces par un modèle d'IA générative ;
- les pièces concernent souvent des tiers (cocontractants, salariés, parties adverses) qui ne sont pas clients
  et ne sont pas informés par ClairDossier.

Conclusion proposée : **AIPD requise avant tout traitement de dossiers réels.** À CONFIRMER par le responsable
de traitement. L'article 35 § 7 fixe le contenu minimal repris ci-dessous : description des opérations et des
finalités (§ 2), nécessité et proportionnalité (§ 3), risques (§ 4), mesures (§ 4 à § 6).

## 2. Description du traitement (VÉRIFIÉ)

**Finalité.** Préparer, pour le titulaire d'un dossier, des documents de travail à partir de ses pièces :
résumé, tableau de bord, chronologie, dates modifiables, échéances, projets de relance ; répondre à ses
questions sur son propre dossier.

**Déclenchement.**

- Acceptation expresse et unique par compte (`accept_ai_account`, version de conditions `ia-2026-11`,
  horodatée et journalisée), désactivable à tout moment dans « Mon compte » (`disable_ai_account`).
- Trois conditions cumulatives vérifiées par le serveur à chaque dépôt : interrupteur général
  (`ai_auto_gate`), acceptation du compte, abonnement actif. Essai réel du 28/11 : un compte ayant accepté
  mais sans abonnement dépose une pièce → aucun travail créé, aucune lecture.
- Seules les pièces déposées après l'acceptation sont lues ; les pièces antérieures ne le sont que sur demande
  expresse, dossier par dossier.

**Flux.** Pièce déposée (stockage privé) → file de travaux en base → fonction serveur `ai-worker` → API du
fournisseur (contenu de la pièce) → extraction structurée avec citations → synthèse du dossier → six documents
publiés automatiquement dans l'espace du titulaire. Pendant le traitement, le titulaire voit les premiers
résultats pièce par pièce.

**Assistant.** Fonction serveur `assistant` : le titulaire pose une question sur un dossier qui lui appartient ;
le modèle reçoit l'analyse déjà produite et dispose d'un registre fermé d'outils (lire le résumé, les
échéances, les démarches ; préparer un rappel). Toute action qui modifie le dossier demande une confirmation
explicite ; aucun envoi à un tiers n'est possible.

**Données transmises au fournisseur.** Contenu des pièces du dossier ; analyse et question pour l'assistant.
Aucune donnée de compte (nom, e-mail, moyen de paiement) n'est jointe par le produit — les pièces peuvent
elles-mêmes en contenir.

**Sous-traitant.** Anthropic PBC (États-Unis), API Claude, espace de travail « ClairDossier Production »,
géographie de traitement : États-Unis. Hébergement des données du produit : Supabase, région de Francfort.

**Mesures mesurées le 28/11/2026 (pièces fictives, compte de test).** 1 pièce : premier résultat 7 s,
documents publiés 15 s. 10 pièces : 30 s. 50 pièces : 87 s. Non mesuré : 250 pièces.

## 3. Nécessité et proportionnalité

- Base légale proposée : exécution du contrat pour l'analyse demandée par le client (acceptation expresse),
  **À CONFIRMER** ; pour les catégories particulières de données éventuellement présentes dans les pièces,
  la condition applicable de l'article 9 du RGPD reste **À CONFIRMER** par un juriste.
- Minimisation : seules les pièces du dossier sont transmises ; pas de pseudonymisation avant envoi
  (**non mise en œuvre** : elle dégraderait la lecture des parties, dates et montants — choix à confirmer).
- Le produit n'entraîne aucun modèle avec les pièces.
- Aucune décision n'est prise automatiquement à l'égard d'une personne : les documents sont des aides à la
  préparation, marqués « à vérifier », et ne constituent pas un conseil juridique.

## 4. Risques et mesures

| Risque | Mesures en place (VÉRIFIÉ) | Reste à décider ou confirmer |
|---|---|---|
| Accès aux pièces d'un autre compte | Règles d'accès par compte en base ; essai réel du 28/11 avec deux comptes et de vrais jetons : 0 ligne visible sur six tables, téléchargement refusé (400), écriture refusée (403), assistant refusé (404) | Revue périodique des comptes administrateurs |
| Transfert hors Union européenne (§ 5) | Clauses contractuelles types intégrées aux conditions du fournisseur | Analyse du transfert ; signature |
| Conservation chez le fournisseur | Suppression sous 30 jours par défaut, pas d'entraînement par défaut (pages publiques du fournisseur, lues le 28/11) | Demande de conservation nulle : **À CONFIRMER** (non demandée) |
| Secret professionnel (§ 5) | Texte d'acceptation nommant le sous-traitant et le pays ; interrupteur en « pilote » | Avis d'un avocat ; information du client avocat |
| Résultat erroné tenu pour fiable | Citations vérifiées contre la pièce (0 citation introuvable sur 15 pièces d'essai), mention « à vérifier », dates corrigeables par le titulaire, pièces non lues nommées | — |
| Publication sans relecture humaine | Choix du fondateur (publication automatique) ; relecture manuelle disponible par dossier | Confirmer ce choix dans la décision (§ 7) |
| Consigne cachée dans une pièce | Contenu traité comme donnée, schéma de sortie strict, registre fermé d'outils, aucune action externe | — |
| Fuite par les journaux | Journaux sans contenu de pièce ; détails réservés à l'administration | — |
| Dépense non maîtrisée | Plafonds mensuels par compte et global, réservation avant appel, pause automatique, plafond côté fournisseur | Niveau des plafonds par offre |
| Tiers non informés | Mention dans les CGV (art. 6) et la politique de confidentialité | Mention d'information des tiers : **À CONFIRMER** |

## 5. Sous-traitance, sécurité, transfert, secret professionnel

**Article 28 (sous-traitant) — SOURCE.** Le traitement par un sous-traitant est régi par un contrat qui prévoit
notamment : traitement sur instruction documentée, confidentialité, mesures de l'article 32, aide au
responsable, suppression ou restitution des données en fin de prestation, mise à disposition des informations
nécessaires aux audits. *Constat* : le fournisseur publie un accord de traitement des données intégré à ses
conditions commerciales (lu le 28/11). **À CONFIRMER** : que le compte « ClairDossier Production » est bien
soumis à ces conditions commerciales, et conserver une copie datée de l'accord.

**Article 32 (sécurité) — SOURCE.** Mesures techniques et organisationnelles adaptées au risque. *En place* :
chiffrement en transit, stockage privé avec liens signés de courte durée, isolation par compte testée, double
facteur pour l'administration, secrets côté serveur uniquement, plafonds et arrêt d'urgence.
**Non fait** : test de restauration d'une sauvegarde ; analyse de sécurité dynamique.

**Articles 44 à 49 (transferts) — SOURCE** ([CNIL, RGPD chapitre V](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre5)).
Un transfert vers un pays tiers n'est permis que dans les conditions du chapitre V (art. 44) : décision
d'adéquation (art. 45) ou garanties appropriées telles que des clauses types adoptées par la Commission
(art. 46) ; à défaut, dérogations limitées (art. 49). *Constat* : traitement aux États-Unis ; clauses types
intégrées aux conditions du fournisseur. **À CONFIRMER** : le fondement retenu (adéquation si le fournisseur
est certifié au titre du cadre UE–États-Unis, sinon clauses types) et l'analyse du transfert correspondante.

**Secret professionnel de l'avocat — SOURCE.** Loi n° 71-1130 du 31 décembre 1971, article 66-5, version en
vigueur ([Légifrance](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000023780802)) : en toutes
matières, conseil ou défense, les consultations, les correspondances entre le client et son avocat, les notes
d'entretien et plus généralement toutes les pièces du dossier sont couvertes par le secret professionnel.
*Conséquences pour ClairDossier* :

- l'acceptation des CGV par un client avocat ne vaut ni levée du secret ni consentement de ses propres clients ;
- le respect du secret est une obligation personnelle de l'avocat : c'est à lui de décider s'il peut confier
  des pièces couvertes à un sous-traitant situé hors de l'Union, selon ses règles professionnelles ;
- l'accord du fondateur de ClairDossier ne remplace aucune de ces obligations.

**À CONFIRMER** : avis d'un avocat sur ce point avant d'ouvrir l'analyse automatique à un cabinet ; information
écrite du client avocat actuellement abonné.

## 6. État de l'interrupteur et droits des personnes

- Interrupteur `ai_auto_gate` : **« pilote » depuis le 28/11/2026 au soir** — seuls les comptes
  administrateurs déclenchent l'analyse. Il a été « ouvert » quelques heures le 28/11 : deux acceptations
  enregistrées (compte du fondateur et compte de test, pièces fictives) ; aucun dossier client réel n'a été
  lu (vérifié en base : les seules lectures du mois appartiennent à ces deux comptes).
- Désactivation par le titulaire : arrêt immédiat des lectures à venir ; les documents déjà produits restent.
- Suppression d'un dossier : suppression en cascade des analyses et des documents produits.
- Effacement chez le fournisseur : selon sa politique de conservation (30 jours par défaut).

## 7. Décision — à compléter et signer par le responsable de traitement

| Point | Décision |
|---|---|
| Les risques résiduels du § 4 sont-ils acceptables ? | ☐ oui ☐ non |
| Fondement du transfert (§ 5) retenu | ……………… |
| Conservation nulle demandée au fournisseur | ☐ oui ☐ non |
| Avis d'avocat sur le secret professionnel obtenu le | ……………… |
| Consultation préalable de la CNIL (art. 36) si un risque élevé subsiste | ☐ nécessaire ☐ non nécessaire |
| Ouverture de l'analyse automatique aux clients | ☐ autorisée à compter du ……………… ☐ refusée |

Nom, qualité, date, signature : ………………

*Ce document n'est pas un avis juridique. Il prépare la décision du responsable de traitement et doit être relu
par un professionnel du droit avant signature.*
