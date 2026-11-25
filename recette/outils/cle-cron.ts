// Build uniquement : écrit sur la sortie standard la clé du planificateur (dérivée d'un secret serveur
// conservé dans le stockage privé). Le build la capture sans l'afficher.
import { cronKey } from '../server/runtime.ts';

process.stdout.write(await cronKey());
