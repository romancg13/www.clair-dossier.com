/**
 * Polices de marque — Cormorant Garamond (titres) et Inter (texte), les mêmes
 * que le site. Chargées au démarrage ; l'application reste utilisable si le
 * chargement échoue (repli système), elle n'est jamais bloquée par une police.
 */
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

export const fontMap = {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};
