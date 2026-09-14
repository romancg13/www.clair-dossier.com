/**
 * Détection statique du niveau de qualité 3D (Phase 4b).
 *
 * Décision AVANT tout chargement du moteur 3D — donc sans Three, sans
 * contexte WebGL persistant (un contexte de sonde est ouvert puis perdu
 * volontairement). Jamais appelée au pré-rendu : `typeof window` gardé.
 *
 * Tiers :
 *  - high     : scène complète, DPR jusqu'à 1,5, instances complètes
 *  - medium   : moins d'instances, DPR 1,25
 *  - low      : scène essentielle, DPR 1
 *  - fallback : AUCUN WebGL — la composition HTML/CSS existante reste seule
 *
 * La largeur d'écran n'est jamais le seul critère : elle ne compte que
 * combinée aux signaux matériels et aux préférences utilisateur.
 */

export type CinematicQuality = 'high' | 'medium' | 'low' | 'fallback';

export type DeviceSignals = {
  reducedMotion: boolean;
  saveData: boolean;
  webgl2: boolean;
  cores: number;
  memoryGb: number | null;
  coarsePointer: boolean;
  width: number;
  dpr: number;
  ios: boolean;
  /** Renderer WebGL déclaré (WEBGL_debug_renderer_info), si exposé. */
  renderer: string | null;
};

const SWIFTSHADER = /swiftshader|llvmpipe|software|mesa offscreen/i;

/** Sonde WebGL2 : crée puis abandonne un contexte, sans jamais le garder. */
function probeWebgl2(): { ok: boolean; renderer: string | null } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return { ok: false, renderer: null };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: null };
  }
}

export function readDeviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const probe = probeWebgl2();
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData) || /^(slow-2g|2g)$/.test(nav.connection?.effectiveType ?? ''),
    webgl2: probe.ok,
    cores: nav.hardwareConcurrency || 2,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    width: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
    ios,
    renderer: probe.renderer,
  };
}

/**
 * Score → tier. Règles explicites, testables sans navigateur (voir tests).
 *
 * Les mobiles et tablettes ne sont jamais exclus par principe : ils reçoivent
 * une composition allégée (plafond « medium », budgets réduits), et le
 * moniteur de framerate dégrade ensuite si nécessaire. Seuls les appareils
 * réellement contraints (< 2 Go, ≤ 2 cœurs tactiles) ou les préférences de
 * l'utilisateur mènent au repli sans WebGL.
 */
export function classify(s: DeviceSignals): CinematicQuality {
  // Choix de l'utilisateur ou réseau contraint : aucune cinématique.
  if (s.reducedMotion || s.saveData) return 'fallback';
  if (!s.webgl2) return 'fallback';
  if (s.renderer && SWIFTSHADER.test(s.renderer)) return 'fallback';
  // Appareil réellement contraint.
  if (s.memoryGb !== null && s.memoryGb < 2) return 'fallback';
  if (s.cores <= 2 && s.coarsePointer && s.width < 400) return 'fallback';

  let score = 0;
  score += s.cores >= 8 ? 3 : s.cores >= 6 ? 2 : s.cores >= 4 ? 1 : 0;
  if (s.memoryGb !== null) score += s.memoryGb >= 8 ? 2 : s.memoryGb >= 4 ? 1 : 0;

  let tier: CinematicQuality = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  // Tactile, petit écran ou iOS (mémoire GPU partagée, contextes limités) : jamais « high ».
  if ((s.coarsePointer || s.width < 768 || s.ios) && tier === 'high') tier = 'medium';
  return tier;
}

/** DPR plafonné par tier — jamais le devicePixelRatio brut. */
export function dprFor(tier: CinematicQuality, deviceDpr: number): number {
  const cap = tier === 'high' ? 1.5 : tier === 'medium' ? 1.25 : 1;
  return Math.min(cap, Math.max(0.75, deviceDpr));
}

export function detectQuality(): CinematicQuality {
  if (typeof window === 'undefined') return 'fallback';
  return classify(readDeviceSignals());
}
