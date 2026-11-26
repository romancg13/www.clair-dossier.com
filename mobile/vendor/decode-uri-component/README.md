# decode-uri-component 0.5.1 (portage CommonJS)

Copie à logique identique de `decode-uri-component@0.5.1` (MIT, Sam Verschueren), qui corrige
GHSA-vcc3-ghjq-m6fr et GHSA-qr28-fpjm-wq7f. La version amont est ESM seule ; `query-string@7.1.3`
(imposé par `expo-router@57`) la charge avec `require()`, ce qui casserait l'analyse des liens profonds.
Seul changement : export CommonJS (`module.exports`) et `catch (_error)`.
Branché par `overrides` dans `mobile/package.json`. À supprimer dès qu'expo-router embarque une version corrigée de `query-string`.
