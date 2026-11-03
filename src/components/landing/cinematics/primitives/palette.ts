import { Color } from 'three';

/**
 * Palette 3D = tokens de la charte (src/index.css, src/styles/landing.css).
 * Couleurs créées UNE fois (module) et partagées : jamais `new Color()` par frame.
 * Rendu `flat` (pas de tone mapping) : les valeurs sont les vraies couleurs.
 */
export const PALETTE = {
  navy900: new Color('#01113d'),
  navy925: new Color('#010e33'),
  navy950: new Color('#00081f'),
  cream: new Color('#fbf9f4'),
  cream100: new Color('#f5f0e6'),
  gold: new Color('#f4c95d'),
  gold400: new Color('#e6c97d'),
  silver: new Color('#dce3f2'),
  silver400: new Color('#aab2c5'),
  sky: new Color('#39a8ff'),
  ink: new Color('#030b26'),
  /** Verre pâle (cartes d'interface sur fond clair). */
  glass: new Color('#eaf1fb'),
  glassEdge: new Color('#d7e4f6'),
} as const;

/** Vecteur temporaire partagé pour les conversions (usage synchrone uniquement). */
export const TMP_COLOR = new Color();
