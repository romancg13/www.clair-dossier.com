import { Color } from 'three';

/**
 * Palette 3D = tokens de la charte (src/index.css, src/styles/landing.css).
 * Couleurs créées UNE fois (module) et partagées : jamais `new Color()` par frame.
 * Rendu `flat` (pas de tone mapping) : les valeurs sont les vraies couleurs.
 */
export const PALETTE = {
  navy900: new Color('#0d1b3d'),
  navy925: new Color('#0a1530'),
  navy950: new Color('#060d22'),
  cream: new Color('#fbf9f4'),
  cream100: new Color('#f5f0e6'),
  gold: new Color('#c4a456'),
  gold400: new Color('#e6c97d'),
  silver: new Color('#d6dbe6'),
  silver400: new Color('#9aa3b8'),
  sky: new Color('#b3d2ef'),
  ink: new Color('#0a1228'),
  /** Verre pâle (cartes d'interface sur fond clair). */
  glass: new Color('#e9eef6'),
  glassEdge: new Color('#d9e2ee'),
} as const;

/** Vecteur temporaire partagé pour les conversions (usage synchrone uniquement). */
export const TMP_COLOR = new Color();
