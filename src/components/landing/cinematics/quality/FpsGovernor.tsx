import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { degradeQuality, getQuality, improveQuality } from './QualityManager';

/**
 * Gouverneur de framerate (Phase 4b) — un par canvas, décisions partagées.
 *
 * Politique (volontairement prudente, jamais oscillante) :
 *  - chauffe : les 2,5 premières secondes sont ignorées (compilation des
 *    shaders, premier upload GPU) ;
 *  - fenêtre glissante de 2 s ; si la moyenne passe sous 0,75 × le taux de
 *    rafraîchissement estimé → un cran de moins, puis 6 s de repos ;
 *  - jamais de repli complet sur le seul framerate : la dégradation s'arrête
 *    à « low » (DPR 1, budgets réduits) — le repli reste réservé aux erreurs ;
 *  - une seule remontée possible, après 12 s stables au-dessus de 0,95 × le
 *    taux, et jamais au-dessus du tier statique.
 */
export function FpsGovernor() {
  const t = useRef({ elapsed: 0, acc: 0, frames: 0, cooldown: 0, stable: 0, improved: false, refresh: 60, maxDt: 0 });

  useFrame((_, delta) => {
    const s = t.current;
    const dt = Math.min(delta, 0.25);
    s.elapsed += dt;
    if (s.elapsed < 2.5) {
      // Estimation du taux de rafraîchissement (60 / 90 / 120 Hz) pendant la chauffe.
      if (dt > 0.004 && dt < 0.03) s.refresh = Math.max(s.refresh, Math.min(120, Math.round(1 / dt)));
      return;
    }
    s.acc += dt;
    s.frames += 1;
    s.maxDt = Math.max(s.maxDt, dt);
    if (s.cooldown > 0) s.cooldown -= dt;
    if (s.acc < 2) return;

    const fps = s.frames / s.acc;
    s.acc = 0;
    s.frames = 0;
    const worst = s.maxDt;
    s.maxDt = 0;

    const q = getQuality();
    if (fps < s.refresh * 0.75 && s.cooldown <= 0 && q.tier !== 'low' && q.tier !== 'fallback') {
      degradeQuality(`framerate ${Math.round(fps)} fps (${Math.round(worst * 1000)} ms max)`);
      s.cooldown = 6;
      s.stable = 0;
      return;
    }
    if (fps >= s.refresh * 0.95) {
      s.stable += 2;
      if (!s.improved && s.stable >= 12 && q.tier !== q.staticTier) {
        improveQuality('framerate stable');
        s.improved = true;
      }
    } else {
      s.stable = 0;
    }
  });

  return null;
}
