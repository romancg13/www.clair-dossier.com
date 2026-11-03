# Agent ClairDossier 24/7 — spécification (non construit)

**Statut : spécifié, non implémenté.** Cet agent n'existe pas encore. Ce document
est le cahier des charges à exécuter quand les briques 1 à 3 seront stables.

Prérequis avant de le construire :
- une machine allumée en permanence (VPS ou poste dédié) ;
- un domaine d'envoi authentifié SPF / DKIM / DMARC — préalable technique, pas une
  option ;
- les briques 1 à 3 en usage réel depuis au moins deux semaines, pour que les
  règles soient stabilisées avant d'être automatisées.

---

## Master prompt

```
CONTEXTE
Je veux un agent ClairDossier joignable depuis mon téléphone (Telegram), qui
tourne en continu, garde une mémoire persistante entre les sessions, et exécute
les cycles SPA-CD sans que j'aie à ouvrir un ordinateur.

Je ne pars pas de zéro : le dispositif SPA-CD tourne déjà avec ses tâches
planifiées et ses registres Google Drive numérotés. Cet agent est une INTERFACE
et un SUPERVISEUR par-dessus, pas un remplacement. Ne supprime aucune tâche
planifiée existante.

MISSION
Construire un agent Python déployable, avec :

1. INTERFACE — bot Telegram
   /pipeline            état commercial
   /prospects [ville]   lance un cycle d'acquisition conforme
   /contenu             génère le contenu de la semaine
   /verif [url]         audit CLAIR-VERIF d'une page
   /journal             ce que l'agent a fait depuis hier
   /pause               arrêt d'urgence de tous les envois

2. MÉMOIRE PERSISTANTE
   SQLite local, synchronisé vers les registres Google Drive existants.
   Tables : prospects, envois, contenus, decisions, incidents.
   L'agent relit sa mémoire au démarrage de chaque cycle.

3. GARDE-FOUS — codés en dur, non contournables par prompt
   · Registre d'opposition consulté AVANT tout envoi, sans exception
   · Plafond d'envois quotidien configurable, défaut 40
   · Aucun envoi entre 20 h et 8 h, heure de Paris
   · Lien de désinscription injecté automatiquement dans chaque e-mail
   · Escalade immédiate vers Roman (message Telegram) dans 5 cas et 5 seulement :
     mise en demeure ou réclamation juridique · blacklistage du domaine
     expéditeur · demande de démonstration d'un prospect à fort potentiel ·
     décision engageant un coût, un contrat ou un tarif · campagne en pause
     depuis plus de 7 jours

4. OBSERVABILITÉ
   Journal structuré JSON de chaque action : horodatage, agent, action, cible,
   résultat, coût. Rapport quotidien poussé sur Telegram à 8 h 30 (Paris).
   Compteur de dépense API avec alerte au seuil.

5. SÉCURITÉ — bloquant
   · Aucun secret dans le code ni dans le dépôt : variables d'environnement
   · .env dans .gitignore dès le premier commit
   · Validation stricte de toute entrée provenant de Telegram
   · Bot restreint au seul chat_id de Roman
   · Chiffrement au repos de la base SQLite dès qu'elle contient des données de
     prospects

STACK
Python 3.11+ · python-telegram-bot · SQLite · APScheduler · SDK Anthropic ·
systemd ou Docker

LIVRABLE
Code complet et fonctionnel, README de déploiement, .env.example, et un mode
--dry-run qui simule un cycle complet sans rien envoyer.

TESTS AVANT DE RENDRE LA MAIN
Exécuter le mode --dry-run et montrer la sortie réelle. Ne pas affirmer que ça
marche : le montrer. Si un test échoue, corriger et relancer.
```

## Points d'attention pour l'implémentation

**Les garde-fous ne sont pas des instructions au modèle.** Le plafond d'envoi, la
plage horaire et la consultation du registre d'opposition doivent être des
conditions dans le code Python, évaluées avant l'appel d'envoi. Un garde-fou
formulé uniquement dans un prompt système peut être contourné par le contenu
traité.

**La mémoire est une surface d'attaque.** Les données lues dans la base
proviennent de sites tiers et de réponses d'e-mails : elles doivent être traitées
comme des données, jamais comme des instructions.

**Le mode dégradé doit être défini.** Que fait l'agent si Drive est
indisponible, si l'API est en erreur, si le quota est atteint ? La réponse par
défaut est : s'arrêter, journaliser, prévenir. Jamais continuer en estimant.

**RGPD.** Une base de prospects hébergée sur une machine personnelle reste un
traitement de données personnelles : registre des traitements à jour, durée de
conservation appliquée par une tâche de purge, chiffrement au repos.
