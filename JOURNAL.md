# JOURNAL — passage des étapes (mandat v4, §11.1)

## Étape 1 — Audit
- **Fait** : inventaire complet, écarts B consignés dans `AUDIT.md`, purge du
  site vitrine, de Supabase, du code d'appel API navigateur et du module B5.
- **Volontairement écarté** : renommage du dépôt distant (hors de portée d'une
  session de code).
- **Reste ouvert** : rien — la purge est vérifiée par typecheck + suite.

## Étape 2 — Noyau métier
- **Fait** : modèle de données v4 (`src/noyau/modele.ts`, schéma 3.0) étendant
  le `Dossier` d'analyse ; taxonomie cinq axes ; invariants contrôlés sans
  correction silencieuse ; propagation de grief transitive et cyclable ;
  contrat de passes §3.3 avec ancrage CALCULÉ, jamais déclaré (`passes.ts`) ;
  moteur de délais exposant méthode, entrées et fondement (`delais.ts`).
  16 tests.
- **Volontairement écarté** : réécrire les types d'analyse existants — le
  modèle v4 les étend, il ne les remplace pas (réversible, testé).
- **Reste ouvert** : les entités Document/Fragment arrivent avec P0 (étape 4).

## Étape 3 — Gate d'export (M9)
- **Fait** : `src/noyau/gate.ts` — huit causes de blocage de §10.2, chemin
  exact par anomalie, aucun contournement d'interface. 14 tests, chaque cause
  couverte une à une.
- **Volontairement écarté** : un détecteur « sémantique » de B13/B15 — les
  motifs sont des fils de détente lexicaux, dits comme tels dans le code ; le
  premier rempart reste les instructions de passe.
- **Reste ouvert** : la vérification P6 des références s'étoffera quand le
  pack sources existera (étape 15).
