# Dépendances du chantier A — ingestion documentaire

*Poids mesurés le 19 août 2026 par bundling réel (esbuild, `--minify`, format ESM,
plateforme navigateur), pas repris d'une fiche de paquet. Les tailles dépaquetées
publiées par npm sont trompeuses : elles incluent sources, cartes de code et
variantes de build.*

## Contrainte

L'atelier doit démarrer hors ligne et son bundle actuel pèse **106 Ko**. Toute
dépendance ajoutée est donc jugée sur son poids réel *et* sur ce qu'elle exige du
réseau à l'exécution — une bibliothèque légère qui télécharge ses ressources
depuis un CDN au premier usage n'est pas hors ligne.

## Mesures

| Candidat | Minifié | Gzip | Ressources d'exécution |
|---|---:|---:|---|
| `pdfjs-dist` | 417 Ko | **124 Ko** | worker séparé : 1 232 Ko → **365 Ko gz** |
| `mammoth` (docx) | 492 Ko | 122 Ko | — |
| `xlsx` (SheetJS) | 329 Ko | 110 Ko | — |
| `postal-mime` (eml) | 71 Ko | **22 Ko** | — |
| `tesseract.js` (OCR) | 17 Ko | 7 Ko | **WASM ~2,8–3,4 Mo + données `fra` 6,8 Mo**, chargés depuis `cdn.jsdelivr.net` |
| `fflate` (zip) | 5 Ko | 2 Ko | — *(déjà présent)* |

## Décisions

### Retenues

| Besoin | Choix | Coût gz | Motif |
|---|---|---:|---|
| Archives `.zip` | `fflate` | 0 | Déjà une dépendance du projet. |
| PDF à couche texte | `pdfjs-dist` | 124 + 365 | Aucune alternative crédible. Format le plus fréquent d'un dossier pénal numérisé. Chargé **paresseusement**. |
| Courriels `.eml` | `postal-mime` | 22 | Voir ci-dessous. |

### Écartées au profit d'une extraction maison

**`mammoth` et `xlsx` — 232 Ko gz économisés, zéro dépendance ajoutée.**

Un `.docx` comme un `.xlsx` est une archive ZIP contenant du XML. `fflate` est
déjà là pour l'ouvrir ; l'extraction du texte demande un scanner XML d'une
trentaine de lignes, testable en Node comme au navigateur.

Prototype exécuté avant décision, sur des fichiers construits pour l'occasion :

```
=== DOCX ===
  [1] PROCÈS-VERBAL D'AUDITION
  [2] Le 14 mars 2026 à 08h00, nous, OPJ.
  [3] Ligne <avec> entités & caractères.
  [4] Dernier paragraphe.
=== XLSX ===
  chaînes partagées : ["Cote","Intitulé","PV de placement","D1"]
  | Cote | Intitulé |
  | D1 | PV de placement |
  | 42 | en ligne |
```

Paragraphes séparés, entités décodées, chaînes partagées résolues, chaînes en
ligne et valeurs numériques distinguées.

**Ce que cette économie coûte, et qui doit le savoir.** Ces bibliothèques gèrent
des cas que le scanner maison ne gère pas : styles complexes, notes de bas de
page, révisions suivies, formats de date de tableur, formules. L'extraction
maison vise le **texte et la table**, pas la fidélité de mise en forme. C'est
acceptable ici parce que l'aval — chronologie, points de contrôle — ne consomme
que du texte, et parce qu'un échec d'extraction n'est pas silencieux : la page
part en quarantaine avec sa mesure de confiance. Si un cabinet dépose
régulièrement des documents que le scanner rend mal, la bonne réponse sera
d'ajouter `mammoth` à ce moment-là, avec la preuve du besoin.

**Pourquoi `postal-mime` malgré tout.** MIME n'est pas du XML : frontières
multipartites, `quoted-printable`, base64, mots encodés RFC 2047, pièces jointes
imbriquées. Écrire cela à la main sur des pièces de procédure, c'est accepter des
bugs subtils sur des éléments de preuve — un accent mal décodé dans un courriel
versé au dossier. 22 Ko gz est un prix dérisoire pour ne pas prendre ce risque.

### Écartée sans remplacement — OCR

**`tesseract.js` n'est pas retenu dans cette tranche.**

Deux constats mesurés, pas supposés :

1. **Poids réel.** Le paquet JS pèse 7 Ko gz, mais il ne fait rien seul. Il lui
   faut un cœur WebAssembly (2,8 à 3,4 Mo selon la variante) et les données de
   langue française (**6 988 041 octets**). Auto-héberger l'OCR, c'est expédier
   une dizaine de mégaoctets.

2. **Le défaut décisif.** Par défaut, `tesseract.js` télécharge son worker, son
   cœur WASM *et* ses données de langue depuis `cdn.jsdelivr.net` — trois
   requêtes sortantes vérifiées dans son code source. Pour un outil qui traite du
   secret professionnel, cela divulgue l'adresse IP, l'agent utilisateur et le
   référent du lecteur à un tiers, à chaque océrisation. C'est exactement le
   défaut retiré de la page autonome à propos des fontes Google.

   « OCR local » n'est donc vrai qu'à la condition d'auto-héberger l'ensemble.

**Condition de réexamen**, écrite pour ne pas dépendre d'une humeur : l'OCR sera
ajouté lorsque ses ressources seront servies depuis le même domaine que
l'application, avec téléchargement explicitement déclenché par l'avocat et non au
premier fichier déposé, et un état visible indiquant si le moteur est disponible
hors ligne. Tant que ce n'est pas fait, les PDF sans couche texte partent en
quarantaine et l'écran le dit — l'outil ne prétend pas les lire.

### Reportée — `.msg` Outlook

Le format `.msg` est un conteneur composé OLE, sans rapport avec `.eml`. Il
demande une bibliothèque dédiée pour un gain limité : la plupart des cabinets
exportent en `.eml` ou en PDF. Reporté jusqu'à demande réelle.

## Effet sur le démarrage — mesuré, pas affirmé

Toutes les dépendances d'ingestion sont chargées **paresseusement**, par `import()`
dynamique, au moment où un fichier du format concerné est déposé.

Découpage constaté à la compilation (`npm run build`, 19 août 2026) :

| Fragment | Taille | Gzip | Chargé |
|---|---:|---:|---|
| `LdiAtelier` | 131,69 Ko | 41,21 Ko | à l'ouverture de l'atelier |
| `lourds` | 3,73 Ko | 1,81 Ko | au premier PDF ou courriel déposé |
| `postal-mime` | 66,35 Ko | 22,64 Ko | au premier courriel |
| `pdf` | 432,99 Ko | 128,91 Ko | au premier PDF |
| `pdf.worker.min` | 1 262,40 Ko | — | par le worker, au premier PDF |

Trois vérifications, plutôt qu'une déclaration :

1. `dist/index.html` ne précharge (`modulepreload`) que `index`, `react`,
   `router`, `motion` et `supabase`. Ni `pdf`, ni `postal-mime`, ni `lourds`.
2. Le fragment `LdiAtelier` n'importe statiquement que `browser`, `index`,
   `react` et `router`.
3. Les seules références à `pdf` et `postal-mime` dans `lourds` sont des
   `import("./pdf-….js")` et `import("./postal-mime-….js")`.

Un test verrouille les deux conditions qui pourraient défaire ce découpage sans
qu'on s'en aperçoive : un `import` statique d'une dépendance lourde dans le
noyau, et un `import` statique de `lourds` lui-même depuis `src/`. Le second a
été vérifié dans les deux sens — introduit exprès dans `VueDepot.tsx`, il fait
échouer la suite en nommant le fichier fautif.

C'est la décision d'architecture qui rend le reste acceptable.


## Vérification en navigateur réel

Le découpage ci-dessus prouve que les extracteurs ne sont pas dans le bundle
initial. Il ne prouve pas qu'ils fonctionnent. Cette seconde vérification a
donc été faite dans Chromium, sur un PDF à couche texte et un courriel `.eml`
porteur d'une pièce jointe, à travers les deux passes réelles de l'ingestion :

```
APRES PASSE 1 : {"pieces":2,"pagesTotal":2,"pagesEnQuarantaine":2}
APRES PASSE 2 : {"pieces":3,"pagesTotal":4,"pagesEnQuarantaine":0}

PIECE piece.pdf [pdf] 2 page(s)
   p1 (couche-texte, q=false) PROCES-VERBAL D'AUDITION - 04 fevrier 2025 - Brigade…
   p2 (couche-texte, q=false) Page 2 : declaration recueillie a 14h30, en presence…
PIECE courriel.eml [courriel] 1 page(s)
   p1 (mime, q=false) De : Greffe du tribunal <greffe@exemple.fr> …
   JOINTE bordereau-greffe.csv [csv] : Cote  Nature  Date / D1 Proces-verbal …

FICHE D1   | piece.pdf            | audition | 2025-02-04
FICHE D2   | courriel.eml         | autre    | 2025-02-03
FICHE D2.1 | bordereau-greffe.csv | audition | 2025-02-03
```

Trois faits s'y lisent : la première passe compte les deux pièces sans les lire
et les met en quarantaine ; la seconde les lit et lève la quarantaine ; la pièce
jointe devient une pièce du dossier, cotée `D2.1` sous le message dont elle vient.

Les dates proposées sortent du **texte du document**, pas du nom de fichier —
c'est pourquoi la mise en état s'exécute après la seconde passe et non avant.

*Ce que cette vérification ne couvre pas :* sous Node, `pdfjs-dist` exige sa
variante `legacy` et échoue autrement sur `DOMMatrix is not defined`. La suite
de tests ne couvre donc pas le chemin PDF ; elle couvre en revanche le fait
qu'un document illisible ne fasse pas tomber le lot — vérifié sur un lot de 60
fichiers, où l'échec PDF est ressorti en quarantaine nommée sans interrompre
les 59 autres.
