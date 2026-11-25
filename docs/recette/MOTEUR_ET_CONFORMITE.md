# Veille documentée — moteur d'intelligence et conformité (ClairDossier)

**Statut : document de travail, non commité, non publié. Rien ici n'active le moteur ni ne modifie un texte public.**
Date de consultation de toutes les sources : **2026-11-25**. Convention : **[DROIT]** = texte lu sur source officielle ·
**[INTERPRÉTATION]** = lecture à faire confirmer par un avocat · **[RECO]** = recommandation · **non vérifié** = source
officielle non consultée (motif indiqué). Aucun avis juridique : la qualification finale appartient à un professionnel du droit.

---

## Partie A — Moteur d'intelligence

### A.1 Ce qui existe déjà (lu dans le dépôt)

`supabase/functions/ai-worker/index.ts` + `supabase/functions/_shared/ai-pipeline.ts` (code présent, **désactivé**) :

| Étage | État | Détail constaté |
|---|---|---|
| Extraction déterministe | Partiel | DOCX/XLSX/CSV/texte convertis sans IA ; comptage de pages (`pdf-lib`) ; chronologie calculée par fusion des dates extraites (pas demandée au modèle). PDF et images : envoyés tels quels au modèle (pas de couche texte ni d'OCR propre). |
| Modèle rapide | Absent | `AI_MODEL_EXTRACT` et `AI_MODEL_CONSOLIDATE` valent tous deux `claude-opus-5-5` par défaut (réglables par variable). |
| Raisonnement avancé | Présent | Consolidation sur corpus compact, sortie à schéma strict (Zod), aucun outil exposé, consigne « pièce = donnée non fiable ». |
| Vérification | Structurelle seulement | `checkEvidence` contrôle pièce connue, extrait non vide, page plausible. **Il ne vérifie pas que l'extrait cité figure réellement dans la pièce.** Relecture humaine par défaut (`review_mode = manual`). |
| Fournisseur de secours | Absent | Import direct du SDK Anthropic ; pas d'abstraction `AIProvider` (MASTER_PROMPT VIII.1). |
| Garde-fous | Présents | Budgets mensuels obligatoires (compte + global), quota de pages par offre, arrêt d'urgence, jeton worker, journal sans contenu. |

Point d'attention : la table de prix codée (`MODEL_PRICES_USD_PER_MTOK`) concorde avec la page tarifaire Anthropic lue ce
jour, sauf le palier Haiku 5.5 au-delà de 100 000 jetons de prompt (0,50 / 2,50 $), non pris en compte.

### A.2 Comparatif des options (pages officielles des fournisseurs)

| Option | API publique | Intégrable dans un SaaS tiers sans accord spécifique | Coût publié (indicatif) | Point bloquant |
|---|---|---|---|---|
| **Anthropic Claude API** | Oui | Oui : les conditions commerciales autorisent d'alimenter des produits mis à disposition de ses propres clients ; revente et produit concurrent interdits [1] | Opus 5.5 : 4 / 20 $ par M jetons ; Sonnet 5.5 : 2 / 10 $ ; Haiku 5.5 : 0,10 / 0,50 $ ; lots −50 % [2] | **Pas de résidence UE sur l'API directe** : inférence `global` ou `us`, stockage `us` uniquement [3]. Rétention nulle sur demande commerciale [4]. |
| **OpenAI API** | Oui | Oui : droit d'intégrer les services dans des « Customer Applications » ; revente d'accès interdite [5] | **non vérifié** (page tarifaire non consultée) ; +10 % avec résidence régionale [6] | Résidence Europe réservée aux organisations éligibles, via le service commercial [6]. Rétention nulle sur approbation préalable [7]. |
| **Harvey** | Non constatée | Non : accès par démonstration / service commercial, aucun tarif public [8] | Non publié | Produit fermé pour cabinets et directions juridiques ; contrat obligatoire. Traitement UE annoncé [9]. |
| **Doctrine** | Non constatée | Non : CGU interdisant l'automatisation de l'accès, la réutilisation sans autorisation écrite et la cession d'accès [10] | Non lu (page /tarifs non consultée) | Licence éditeur indispensable ; aucune offre d'intégration publiée. |
| **GenIA-L (Lefebvre Dalloz)** | Non constatée | Non : « Contactez-nous », aucun tarif ni API mentionnés [11] | Non publié | Fonds éditorial propriétaire ; contrat obligatoire. Lieu d'hébergement non précisé sur la page. |
| **LexisNexis (Lexis+ AI)** | **non vérifié** | **non vérifié** | **non vérifié** | Pages officielles inaccessibles depuis cet environnement (erreur / 404). |
| **Légifrance (API via PISTE)** | Oui, après création de compte PISTE [12] | Soumis aux CGU PISTE et aux CGU propres à chaque API [12] | Gratuité et licence : **non vérifié** (page Légifrance « open data et API » en 403) | Quotas fixés par le fournisseur d'API ; clés non partageables hors de l'organisation [12]. |
| **Judilibre (Cour de cassation)** | **non vérifié** | **non vérifié** | **non vérifié** | Page officielle protégée contre l'accès automatisé ; à lire manuellement. |
| **Justice administrative (open data)** | Fichiers XML en archives, pas d'API constatée [13] | Licence / CGU : **non vérifié** (page non trouvée) | Gratuit (téléchargement libre constaté) | Décisions depuis 2021-2022 seulement ; ingestion par lots à construire. |
| **EUR-Lex / Office des publications** | Oui : textes servis par l'interface Cellar (utilisée pour ce document) [14] | Conditions du webservice EUR-Lex : **non vérifié** (page vide) | Gratuit (accès constaté) | Le site EUR-Lex bloque les requêtes automatisées ; passer par Cellar. |
| **Azure Document Intelligence** | Oui (API REST documentée) [15] | Oui, sous abonnement Azure | **non vérifié** (prix chargés dynamiquement) | Compte cloud, région UE à choisir, nouveau sous-traitant. |
| **Google Document AI** | Oui | Oui, sous compte Google Cloud | OCR : 1,50 $ / 1 000 pages ; Form Parser et Custom Extractor : 30 $ ; Layout Parser : 10 $ [16] (unité à confirmer) | Multi-région `eu` disponible mais processeurs limités ; pas de garantie de résidence formulée sur la page [17]. |

**Données et entraînement (lu) :** Anthropic — pas d'entraînement sur le contenu client [1], suppression sous 30 jours
par défaut, jusqu'à 2 ans si contenu signalé [18], sous-traitance encadrée par un DPA avec clauses contractuelles types
(modules 2 et 3), entité contractante pour l'EEE : Anthropic Ireland, Limited [1][19]. OpenAI — pas d'entraînement par
défaut, journaux anti-abus jusqu'à 30 jours, entité EEE : OpenAI Ireland Ltd, DPA incorporé [5][7].
Les modèles Claude Fable / Mythos exigent une rétention de 30 jours et sont exclus de la rétention nulle ; les lots
(Batch API) et l'API Fichiers ne sont pas éligibles non plus [4]. Le moteur actuel (PDF en ligne + sortie structurée
sur Opus 5.5) n'utilise que des fonctions éligibles ; le schéma JSON est mis en cache jusqu'à 24 h [4].

### A.3 Architecture recommandée [RECO]

1. **Extraction déterministe (sans IA)** — conserver l'existant ; ajouter la lecture de la couche texte des PDF et des
   règles simples (dates, montants, références) pour pré-remplir et recouper. OCR dédié seulement si les scans dominent.
2. **Modèle rapide** — Haiku 5.5 pour type de pièce, langue, lisibilité, tri (`AI_MODEL_EXTRACT` le permet déjà).
3. **Raisonnement avancé** — Opus 5.5 pour l'extraction difficile et la consolidation (déjà en place).
4. **Seconde vérification conditionnelle** — d'abord un contrôle serveur que chaque extrait cité figure dans le texte
   de la pièce (manque actuel) ; puis second passage d'un autre modèle uniquement sur les éléments à risque :
   preuve invalide, contradiction, échéance « calculée », montant élevé, couverture partielle.
5. **Fournisseur de secours** — n'ajouter qu'après une abstraction `AIProvider` et les mêmes garanties contractuelles :
   Claude via une plateforme cloud à point d'accès européen (prime de 10 % indiquée par Anthropic [2] ; régions exactes
   **non vérifiées**) ou OpenAI en résidence Europe. Sans secours : file en pause, jamais d'échec silencieux.
6. **Sources juridiques ouvertes** — hors périmètre de la V1 (le moteur interdit d'inventer une référence juridique) ;
   à n'utiliser plus tard que pour vérifier une référence déjà présente dans une pièce.

### A.4 Ce qui exige un contrat ou une licence (action propriétaire)

| Action | Pourquoi |
|---|---|
| Accepter les conditions commerciales Anthropic et conserver le DPA daté | Preuve de l'article 28 RGPD ; entité : Anthropic Ireland, Limited |
| Demander la rétention nulle au service commercial Anthropic | Réduit la conservation chez le sous-traitant (sinon 30 jours) |
| Décider : API directe (traitement hors UE) ou point d'accès européen via un cloud | Transfert hors UE à documenter dans l'AIPD et la politique |
| Si secours OpenAI : contrat, DPA, éligibilité à la résidence Europe | Nouveau sous-traitant à publier avant usage |
| Compte PISTE et CGU de chaque API (Légifrance, Judilibre) | Seulement si une vérification de références est décidée |
| Harvey, Doctrine, GenIA-L, LexisNexis | Aucune intégration sans accord commercial écrit |
| Azure ou Google (OCR) | Abonnement cloud, DPA, région UE, mise à jour des sous-traitants |

---

## Partie B — Conformité

### B.1 RGPD — règlement (UE) 2016/679 [DROIT, texte lu via l'Office des publications, 20]

| Article | Ce que dit le texte | Portée pour ClairDossier |
|---|---|---|
| 6 | Le traitement n'est licite que sur l'une de six bases (consentement, contrat, obligation légale, intérêts vitaux, mission publique, intérêt légitime). | [INTERPRÉTATION] Analyse activée par le client : exécution du contrat (6.1.b) défendable pour ses propres données. Les pièces contiennent des données de **tiers** non parties au contrat : base distincte à justifier (intérêt légitime ?) et, si données de l'article 9 ou 10, condition supplémentaire. À trancher dans l'AIPD. |
| 28 | Recours uniquement à des sous-traitants offrant des garanties suffisantes ; contrat écrit obligatoire (instructions documentées, confidentialité, sécurité, sous-traitants ultérieurs, suppression, audits). | Le DPA du fournisseur d'IA doit être accepté et archivé avant le premier envoi. ClairDossier est lui-même sous-traitant de ses clients professionnels : son propre DPA doit citer le fournisseur d'IA comme sous-traitant ultérieur. |
| 32 | Mesures techniques et organisationnelles appropriées (chiffrement, confidentialité, restauration, tests réguliers). | Acquis : cloisonnement en base, stockage privé, journal sans contenu. À faire : test de restauration daté, procédure d'incident écrite (déjà « À CONFIRMER » sur la page Sécurité). |
| 35 | AIPD avant le traitement si risque élevé probable, notamment nouvelles technologies ; contenu minimal fixé au paragraphe 7 ; art. 36 : consultation de l'autorité si le risque reste élevé. | Le projet `docs/ia/AIPD.md` conclut qu'elle est requise. Elle doit être **signée et datée avant toute activation**. |

### B.2 CNIL [recommandations lues, 21-23]

- Fiche « Réaliser une analyse d'impact si nécessaire » (8 avril 2024) : deux des neuf critères européens suffisent à
  présumer l'obligation ; l'IA générative relève de l'« usage innovant ». Cette fiche vise d'abord le **développement**
  de systèmes d'IA [21].
- Questions-réponses sur l'utilisation d'un système d'IA générative (18 juillet 2024) : qualifier le fournisseur
  (sous-traitant ou responsable conjoint), contrat de sous-traitance, désactiver la réutilisation des données par le
  fournisseur, informer les personnes, vérifier les sorties sans les reproduire telles quelles [22].
- Les fiches pratiques IA (liste consultée) portent sur le développement ; ClairDossier n'entraîne aucun modèle [23].
- Liste CNIL des traitements soumis à AIPD et publications postérieures à juillet 2024 : **non vérifié**.

### B.3 Loi n° 71-1130 du 31 décembre 1971

[DROIT] Texte lu dans la base LEGI officielle de la DILA (données de Légifrance, export du 2026-11-08) [26]. Le site
legifrance.gouv.fr refusant l'accès automatisé, les mises à jour du 8 au 25 novembre 2026 ne sont pas vérifiées.

| Article (version en vigueur depuis) | Ce que dit le texte | Portée pour ClairDossier |
|---|---|---|
| 54 (1er janvier 2020) | « Nul ne peut, directement ou par personne interposée, à titre habituel et rémunéré, donner des consultations juridiques ou rédiger des actes sous seing privé, pour autrui » sans remplir les conditions de diplôme, d'honorabilité et d'autorisation des articles suivants. | [INTERPRÉTATION] Service payant et habituel : toute sortie qui applique le droit à la situation du client (qualifier, conseiller une action, calculer un délai légal) risque d'être une consultation. |
| 55 (1er janvier 2014) | Les personnes autorisées doivent être assurées, garanties et respecter le secret professionnel. | Sans objet tant que ClairDossier reste hors du champ de l'article 54. |
| 56 et 60 | Listent les professions autorisées (avocats, notaires, etc.) et les activités non réglementées agréées, dans la limite de leur activité principale. | ClairDossier n'en fait pas partie : aucune autorisation propre. |
| 66-1 (1er janvier 1992) | Le chapitre « ne fait pas obstacle à la diffusion en matière juridique de renseignements et informations à caractère documentaire ». | [INTERPRÉTATION] Fondement du positionnement : résumé, chronologie, relevé de dates **figurant dans les pièces** = information documentaire. |
| 66-2 (version actuelle ; nouvelle rédaction au 1er février 2027) | Sanction pénale (peines de l'article 72) de la consultation ou de la rédaction d'actes en violation du chapitre. | Risque pénal pour l'éditeur, pas seulement contractuel. |
| 66-5 (30 mars 2011) | Consultations de l'avocat, correspondances avocat-client et entre confrères (hors mention « officielle »), notes d'entretien et « toutes les pièces du dossier » sont couvertes par le secret professionnel, « en toutes matières », conseil comme défense. | ClairDossier n'est pas avocat. Mais les pièces déposées par un client ou un avocat peuvent être couvertes : leur envoi à un sous-traitant d'IA doit être décidé par l'utilisateur, en connaissance du destinataire. |

[INTERPRÉTATION] Champs du schéma actuel à faire examiner par un avocat : `deadlines.kind = 'computed'` avec `basis`
(calcul d'une échéance, donc possible application d'une règle de droit), `next_actions`, `attention_points` et
`reminder_drafts` (projets de courriers destinés à des tiers). [RECO] Tant que l'avis n'est pas rendu : n'afficher que
les échéances « mentionnées » dans une pièce, formuler les actions comme des rappels d'organisation, garder les
relances à l'état de brouillon non envoyé (déjà le cas). Jurisprudence sur les services juridiques automatisés : **non vérifié**.

### B.4 Règlement (UE) 2024/1689 sur l'IA, modifié par le règlement (UE) 2026/1744 [DROIT, textes lus, 24-25]

Calendrier au 2026-11-25 (article 113 modifié) :

| Date | Application |
|---|---|
| 2 février 2025 | Chapitres I et II (définitions, maîtrise de l'IA, pratiques interdites) |
| 2 août 2025 | Gouvernance, modèles d'IA à usage général, sanctions (sauf art. 101) |
| 27 juillet 2026 | Entrée en vigueur du règlement modificatif 2026/1744 |
| **2 août 2026** | Application générale, **dont l'article 50 (transparence)** — déjà applicable |
| 2 décembre 2026 | Nouvelles interdictions ajoutées à l'article 5 ; fin du délai de mise en conformité à l'article 50 § 2 pour les systèmes mis sur le marché avant le 2 août 2026 |
| 2 décembre 2027 | Obligations des systèmes à haut risque de l'annexe III |
| 2 août 2028 | Systèmes à haut risque de l'annexe I |

- **Article 4 (rédaction 2026)** : fournisseurs et déployeurs « prennent des mesures pour favoriser le développement de
  la maîtrise de l'IA » de leur personnel. [RECO] Consigner une courte note de formation pour la personne qui relit.
- **Article 50 § 1** : informer les personnes qu'elles interagissent avec un système d'IA, sauf évidence.
  **§ 2** : les sorties de texte générées doivent être marquées dans un format lisible par machine, sauf simple
  assistance de mise en forme ou absence de modification substantielle des données d'entrée. **§ 5** : information
  claire au plus tard à la première interaction.
- [INTERPRÉTATION] ClairDossier mettrait le système en service sous sa marque : rôle probable de **fournisseur** d'un
  système d'IA bâti sur un modèle à usage général (art. 3). Le système n'étant pas sur le marché avant le 2 août 2026,
  le délai transitoire ne lui profite pas : l'article 50 s'applique dès l'activation. Résumés et projets de relances
  sont du texte généré : le marquage du § 2 est probablement dû (métadonnées des PDF/DOCX + mention visible).
- [INTERPRÉTATION] **Haut risque peu probable** : l'annexe III, point 8 a), vise les systèmes destinés aux autorités
  judiciaires ou utilisés de manière similaire en règlement extrajudiciaire des litiges. Un outil de préparation de
  dossier pour particuliers et entreprises n'y entre pas a priori. À documenter par écrit et à faire confirmer ;
  toute fonction d'aide à la décision d'un médiateur ou d'un arbitre changerait l'analyse.
- Lignes directrices de la Commission sur l'article 6 et codes de bonne pratique de l'article 50 : **non vérifié**.

### B.5 Textes publics à adapter si l'analyse automatique est activée

**Aucun fichier modifié.** Propositions **à valider par le propriétaire / un avocat**. Elles complètent
`docs/ia/TEXTES_A_APPROUVER.md` (qui couvre déjà CGV art. 6 § 1, finalité, base légale, destinataire, conservation).
Les fichiers `public/*.md` sont générés : la source est `src/data/legal.ts` et `src/data/trust.ts` (`npm run gen:md`).

| Fichier · passage actuel | Problème si l'IA est activée | Proposition (à valider) |
|---|---|---|
| `cgv.md` art. 1 § 1 — « permettant la création de dossiers, le dépôt de pièces […] et la mise à disposition des pièces » | L'objet du contrat ne mentionne pas l'analyse | Ajouter : « et, sur activation expresse du Client, la production de documents de travail par analyse automatique des pièces » |
| `cgv.md` art. 1 § 2 — « Il ne constitue ni un cabinet d'avocats, ni un conseil juridique. » | À conserver ; à renforcer pour les sorties IA | Ajouter : « Les documents produits automatiquement sont des aides à l'organisation ; ils ne constituent ni une consultation juridique ni un acte. » |
| `cgv.md` art. 6 § 1 — « Il ne procède à aucune lecture, extraction ou analyse automatique des documents : le contenu des dossiers est saisi et structuré par le Client lui-même. » | **Contradiction directe** (ancienne exclusion) | Texte déjà proposé dans `TEXTES_A_APPROUVER.md` § 1 ; y ajouter la mention de marquage « généré par un système d'IA » (art. 50) |
| `cgv.md` art. 7 — DPA « disponible sur simple demande » | Ne nomme pas le sous-traitant ultérieur d'IA | Ajouter : « Le DPA liste les sous-traitants ultérieurs, dont le fournisseur du service d'IA. » |
| `cgv.md` art. 8 § 2 — « ne saurait être tenue responsable des décisions prises par le Client » | Ne couvre pas l'erreur ou l'omission d'une sortie IA | Ajouter une phrase sur la vérification par le Client des documents générés (validité de la clause à faire relire, notamment envers les consommateurs) |
| `cgv.md` en-tête — « Dernière mise à jour : 20 septembre 2026 » | Date et acceptation des nouvelles CGV | Nouvelle date ; prévoir l'information des clients existants |
| `politique-confidentialite.md` « Données collectées » — « Données de dossier : informations renseignées par vous » | N'inclut pas les données extraites ni les tiers cités dans les pièces | Ajouter : contenu des pièces analysées, résultats structurés, données de tiers figurant dans les pièces |
| idem « Finalités du traitement » (liste) | Finalité d'analyse absente | Voir `TEXTES_A_APPROUVER.md` § 2 |
| idem « Base légale » — « repose principalement sur l'exécution du contrat » | Muet sur les tiers et les données sensibles | Préciser la base retenue par l'AIPD pour les données de tiers |
| idem « Destinataires » — liste + « Resend et GitHub sont des sociétés établies aux États-Unis » | Fournisseur d'IA absent ; transfert hors UE non décrit | Ajouter le fournisseur (entité irlandaise, traitement possible hors UE, clauses contractuelles types, durée de conservation réellement applicable au compte) |
| idem « Durée de conservation » | Analyses, livrables et rétention fournisseur absents | Ajouter : analyses supprimées avec le dossier ; conservation chez le fournisseur selon contrat |
| idem « Vos droits » | Pas de moyen de désactivation ni d'information des tiers | Ajouter : désactivation par dossier ; point de contact pour les tiers cités dans une pièce |
| `securite.md` l. 19 — « Aucune lecture, extraction ou analyse automatique des documents déposés — engagement contractuel (CGV). » | **Devient faux** | « Aucune lecture automatique sans votre activation expresse, dossier par dossier (CGV, art. 6). » |
| `securite.md` l. 81 « Secret professionnel » — « Aucune lecture automatique des pièces (engagement contractuel, CGV). » | **Devient faux** ; point sensible pour les avocats | Réécrire : analyse désactivée par défaut ; si activée, pièces transmises au sous-traitant nommé ; le professionnel reste juge de la compatibilité avec son secret |
| `securite.md` « Sous-traitants » | Fournisseur d'IA absent | Nouvelle fiche : finalité, données, localisation, conservation, DPA |
| `securite.md` « En attente de vérification » — « Analyse d'impact (AIPD) : évaluation de la nécessité à documenter. » | Incompatible avec une activation | Remplacer par la date de l'AIPD réalisée |
| `securite.md` « Journal des changements » | Aucune entrée d'activation | Ajouter une entrée datée le jour de la mise en service |

Autres emplacements à aligner (non relus ici) : FAQ, accueil, application mobile, `llms.txt`, et tests qui figent la phrase.

### B.6 Avant toute activation [RECO]

1. AIPD signée ; 2. DPA du fournisseur archivé et décision sur la rétention et le lieu de traitement ; 3. textes publiés
dans la même mise en ligne que l'activation ; 4. marquage « généré par IA » visible et dans les métadonnées des
livrables ; 5. avis écrit d'un avocat sur le périmètre des articles 54 et suivants (échéances calculées, relances) ;
6. note de qualification au regard du règlement IA.

---

## Sources (consultées le 2026-11-25)

[1] Anthropic, Commercial Terms of Service — https://www.anthropic.com/legal/commercial-terms · [2] Anthropic, Pricing — https://platform.claude.com/docs/en/about-claude/pricing  
[3] Anthropic, Data residency — https://platform.claude.com/docs/en/manage-claude/data-residency · [4] Anthropic, API and data retention — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention  
[5] OpenAI, Services Agreement — https://openai.com/policies/services-agreement/ · [6] OpenAI, Data residency — https://developers.openai.com/api/docs/guides/data-residency  
[7] OpenAI, Your data — https://developers.openai.com/api/docs/guides/your-data · [8] Harvey — https://www.harvey.ai/  
[9] Harvey, Security — https://www.harvey.ai/security · [10] Doctrine, CGU — https://www.doctrine.fr/cgu  
[11] Lefebvre Dalloz, GenIA-L — https://www.lefebvre-dalloz.fr/genia-l/ · [12] PISTE, CGU — https://piste.gouv.fr/cgu  
[13] Justice administrative, open data — https://opendata.justice-administrative.fr/ · [14] Office des publications de l'UE (Cellar) — http://publications.europa.eu/resource/celex/32024R1689  
[15] Microsoft Learn, Document Intelligence — https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview · [16] Google Cloud, Document AI pricing — https://cloud.google.com/document-ai/pricing  
[17] Google Cloud, Document AI regions — https://docs.cloud.google.com/document-ai/docs/regions · [18] Anthropic, rétention commerciale — https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data  
[19] Anthropic, Data Processing Addendum — https://www.anthropic.com/legal/data-processing-addendum · [20] RGPD, texte français — http://publications.europa.eu/resource/celex/32016R0679  
[21] CNIL, fiche AIPD — https://www.cnil.fr/fr/realiser-une-analyse-dimpact-si-necessaire · [22] CNIL, questions-réponses IA générative — https://cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-lutilisation-dun-systeme-dia-generative  
[23] CNIL, fiches pratiques IA — https://www.cnil.fr/fr/les-fiches-pratiques-ia · [24] Règlement (UE) 2024/1689, texte français — http://publications.europa.eu/resource/celex/32024R1689  
[25] Règlement (UE) 2026/1744 (JO L du 24.7.2026), texte français — http://publications.europa.eu/resource/celex/32026R1744 · [26] DILA, base LEGI (open data officiel), loi n° 71-1130, JORFTEXT000000508793 — https://echanges.dila.gouv.fr/OPENDATA/LEGI/  

## Points « non vérifié »

- Légifrance (site) : pages de la loi n° 71-1130 et « open data et API » en erreur 403 ; texte lu dans l'export DILA du 2026-11-08, modifications postérieures non contrôlées.
- Licence et gratuité de l'API Légifrance ; CGU propres à chaque API sur PISTE.
- Judilibre : conditions d'accès, licence, quotas (page protégée contre l'accès automatisé).
- Justice administrative : licence et réutilisation (page CGU introuvable). EUR-Lex : conditions du webservice (pages vides) ; seul l'accès Cellar est constaté.
- LexisNexis : produit, API, tarifs, hébergement.
- OpenAI et Doctrine : tarifs. Azure Document Intelligence : tarifs et régions UE. Google Document AI : unité exacte des prix relevés (supposée par 1 000 pages).
- Claude via Amazon Bedrock ou Google Cloud : disponibilité et garanties des régions européennes.
- Harvey, Doctrine, GenIA-L : absence d'API déduite des seules pages consultées, sans confirmation du fournisseur.
- CNIL : liste des traitements soumis à AIPD ; recommandations publiées après juillet 2024 sur le déploiement de l'IA.
- Règlement IA : lignes directrices de la Commission (article 6), codes de bonne pratique et lignes directrices de l'article 50, autorité française compétente.
- Jurisprudence sur l'article 54 appliqué aux services automatisés ; règles déontologiques des barreaux sur l'IA ; qualification de ClairDossier au regard du règlement IA (interprétation non confirmée par un juriste).
- Région d'hébergement Supabase et encadrement des transferts Resend / GitHub : déjà « À CONFIRMER » sur le site, non traités ici.
