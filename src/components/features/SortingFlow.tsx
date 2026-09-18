import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * SortingFlow — animation explicative de /fonctionnalites (LB13 · chantier 12).
 *
 * Des documents ABSTRAITS (formes génériques, aucune donnée réelle) arrivent
 * dispersés, sont rangés par catégorie, puis réunis dans un dossier organisé.
 * Aucune « analyse » n'est mise en scène : le produit classe d'après le NOM
 * du fichier et ne lit jamais le contenu (CGV) — le texte visible le dit.
 *
 * Garanties :
 *  - dimensions réservées (aspect-ratio 4/3, viewBox identique) : aucun CLS ;
 *  - SVG décoratif (aria-hidden) ; texte équivalent VISIBLE, rendu dès le
 *    HTML pré-rendu (aucun texte retardé) ;
 *  - l'état de repos EST l'état final : rendu serveur, sans JavaScript et
 *    prefers-reduced-motion affichent le dossier organisé, immobile ;
 *  - une seule lecture (< 5 s, WCAG 2.2.2) quand le visuel entre à l'écran,
 *    puis repos ; bouton « Rejouer » ;
 *  - pause hors écran (IntersectionObserver) et onglet masqué
 *    (visibilitychange) ; écouteurs retirés au démontage ;
 *  - transform et opacity uniquement, aucun clignotement.
 */

type Category = 'a' | 'b' | 'c';

const CATEGORY_COLORS: Record<Category, string> = {
  a: '#c4a456', // or
  b: '#7a5f28', // bronze (gold-700)
  c: '#2a3960', // marine (navy-600)
};

/** Feuille : position dispersée (x, y, rotation), place dans sa rangée, place finale dans le dossier. */
const SHEETS: Array<{
  cat: Category;
  scatter: [number, number, number];
  lane: [number, number];
  final: [number, number];
}> = [
  { cat: 'a', scatter: [96, 62, 9], lane: [196, 52], final: [338, 104] },
  { cat: 'a', scatter: [20, 246, -5], lane: [240, 52], final: [352, 114] },
  { cat: 'b', scatter: [24, 34, -14], lane: [196, 154], final: [366, 124] },
  { cat: 'b', scatter: [104, 170, -10], lane: [240, 154], final: [380, 134] },
  { cat: 'c', scatter: [30, 138, 7], lane: [196, 256], final: [394, 144] },
  { cat: 'c', scatter: [98, 270, 12], lane: [240, 256], final: [408, 154] },
];

const LANES: Array<{ cat: Category; y: number }> = [
  { cat: 'a', y: 44 },
  { cat: 'b', y: 146 },
  { cat: 'c', y: 248 },
];

const STAGGER_S = 0.09;
const LAST_DELAY_S = STAGGER_S * (SHEETS.length - 1);

const CSS = `
.cd-sf-sheet, .cd-sf-check { transform-box: fill-box; transform-origin: 50% 50%; }
.cd-sf-lane { opacity: .6; }
.cd-sf.is-playing .cd-sf-sheet {
  animation: cd-sf-sheet 4.2s cubic-bezier(.65,0,.35,1) both;
  animation-delay: var(--d);
}
.cd-sf.is-playing .cd-sf-lane {
  animation: cd-sf-lane 4.2s ease-in-out both;
  animation-delay: var(--d);
}
.cd-sf.is-playing .cd-sf-glow { animation: cd-sf-glow 4.2s ease-out both; }
.cd-sf.is-playing .cd-sf-check {
  animation: cd-sf-check 4.2s cubic-bezier(.22,1,.36,1) both;
  animation-delay: ${LAST_DELAY_S.toFixed(2)}s;
}
.cd-sf[data-paused="true"] .cd-sf-anim { animation-play-state: paused; }
@keyframes cd-sf-sheet {
  0% { opacity: 0; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)); }
  10% { opacity: 1; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)); }
  26% { transform: translate(var(--sx), var(--sy)) rotate(var(--sr)); }
  50% { transform: translate(var(--lx), var(--ly)) rotate(0deg); }
  62% { transform: translate(var(--lx), var(--ly)) rotate(0deg); }
  88%, 100% { opacity: 1; transform: translate(0px, 0px) rotate(0deg); }
}
@keyframes cd-sf-lane {
  0%, 30% { opacity: .35; }
  50%, 62% { opacity: 1; }
  88%, 100% { opacity: .6; }
}
@keyframes cd-sf-glow {
  0%, 70% { opacity: .3; }
  100% { opacity: 1; }
}
@keyframes cd-sf-check {
  0%, 86% { opacity: 0; transform: scale(.6); }
  100% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .cd-sf .cd-sf-anim { animation: none !important; }
}
`;

function Sheet({ cat }: { cat: Category }) {
  return (
    <>
      <path
        d="M0 4a4 4 0 0 1 4-4h26l10 10v38a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4Z"
        fill="#fbf9f4"
      />
      <path d="M30 0v10h10Z" fill="#ebe2cf" />
      <rect x="6" y="-3" width="13" height="6" rx="2" fill={CATEGORY_COLORS[cat]} />
      <rect x="7" y="16" width="22" height="2.5" rx="1.25" fill="#0d1b3d" opacity=".22" />
      <rect x="7" y="23" width="26" height="2.5" rx="1.25" fill="#0d1b3d" opacity=".16" />
      <rect x="7" y="30" width="18" height="2.5" rx="1.25" fill="#0d1b3d" opacity=".16" />
      <rect x="7" y="37" width="24" height="2.5" rx="1.25" fill="#0d1b3d" opacity=".12" />
    </>
  );
}

export function SortingFlow({ className = '' }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const playedRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduce || typeof IntersectionObserver === 'undefined') return;
    let inView = false;

    const sync = () => {
      const visible = document.visibilityState !== 'hidden';
      if (inView && visible && !playedRef.current) {
        playedRef.current = true;
        setRun((r) => r + 1);
        setPlaying(true);
      }
      setPaused(!(inView && visible));
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [reduce]);

  // Préférence « réduire les animations » activée en cours de route : repos immédiat.
  useEffect(() => {
    if (reduce) setPlaying(false);
  }, [reduce]);

  function onAnimationEnd(e: AnimationEvent<SVGSVGElement>) {
    if (e.animationName === 'cd-sf-check') setPlaying(false);
  }

  function replay() {
    playedRef.current = true;
    setRun((r) => r + 1);
    setPlaying(true);
  }

  return (
    <div
      ref={rootRef}
      className={`cd-sf ${playing ? 'is-playing' : ''} ${className}`}
      data-paused={playing && paused ? 'true' : 'false'}
    >
      <style>{CSS}</style>
      <div
        aria-hidden="true"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] bg-navy-900 shadow-card"
      >
        <svg
          key={run}
          viewBox="0 0 480 360"
          className="absolute inset-0 h-full w-full"
          focusable="false"
          onAnimationEnd={onAnimationEnd}
        >
          <defs>
            <radialGradient id="cd-sf-glow" cx="392" cy="196" r="190" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#c4a456" stopOpacity=".42" />
              <stop offset=".5" stopColor="#c4a456" stopOpacity=".1" />
              <stop offset="1" stopColor="#c4a456" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cd-sf-haze" cx="80" cy="60" r="200" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fbf9f4" stopOpacity=".08" />
              <stop offset="1" stopColor="#fbf9f4" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="480" height="360" fill="#0d1b3d" />
          <rect width="480" height="360" fill="url(#cd-sf-haze)" />
          <rect className="cd-sf-glow cd-sf-anim" width="480" height="360" fill="url(#cd-sf-glow)" />

          {/* Rangées de classement (une par catégorie) */}
          {LANES.map((lane, i) => (
            <g
              key={lane.cat}
              className="cd-sf-lane cd-sf-anim"
              style={{ '--d': `${(i * 2 * STAGGER_S).toFixed(2)}s` } as CSSProperties}
            >
              <rect
                x="182"
                y={lane.y}
                width="112"
                height="68"
                rx="10"
                fill="#fbf9f4"
                fillOpacity=".04"
                stroke="#fbf9f4"
                strokeOpacity=".22"
              />
              <circle
                cx="168"
                cy={lane.y + 34}
                r="4.5"
                fill={CATEGORY_COLORS[lane.cat]}
                stroke="#fbf9f4"
                strokeOpacity=".6"
              />
            </g>
          ))}

          {/* Dossier — dos */}
          <path
            d="M318 92A12 12 0 0 1 330 80H370L380 92H450A12 12 0 0 1 462 104V292A12 12 0 0 1 450 304H330A12 12 0 0 1 318 292Z"
            fill="#152348"
            stroke="#c4a456"
            strokeOpacity=".5"
          />

          {/* Pièces : dessinées à leur place finale, l'animation part des positions dispersées */}
          {SHEETS.map((s, i) => {
            const [fx, fy] = s.final;
            const style = {
              '--sx': `${s.scatter[0] - fx}px`,
              '--sy': `${s.scatter[1] - fy}px`,
              '--sr': `${s.scatter[2]}deg`,
              '--lx': `${s.lane[0] - fx}px`,
              '--ly': `${s.lane[1] - fy}px`,
              '--d': `${(i * STAGGER_S).toFixed(2)}s`,
            } as CSSProperties;
            return (
              <g key={i} className="cd-sf-sheet cd-sf-anim" style={style}>
                <g transform={`translate(${fx} ${fy})`}>
                  <Sheet cat={s.cat} />
                </g>
              </g>
            );
          })}

          {/* Dossier — face avant */}
          <rect
            x="318"
            y="178"
            width="144"
            height="126"
            rx="12"
            fill="#1e2c52"
            stroke="#c4a456"
            strokeOpacity=".45"
          />
          <rect x="336" y="200" width="64" height="4" rx="2" fill="#c4a456" opacity=".75" />
          <rect x="336" y="214" width="92" height="3" rx="1.5" fill="#fbf9f4" opacity=".18" />
          <rect x="336" y="225" width="72" height="3" rx="1.5" fill="#fbf9f4" opacity=".14" />

          {/* Dossier organisé */}
          <g className="cd-sf-check cd-sf-anim">
            <circle cx="436" cy="278" r="14" fill="#c4a456" />
            <path
              d="M429.5 278.5l4.5 4.5 8.5-9"
              fill="none"
              stroke="#0d1b3d"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      <ol className="mt-5 grid gap-3 text-sm leading-relaxed text-slate-500 sm:grid-cols-3 sm:gap-4">
        <li>
          <span className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
            1 · Dispersés
          </span>
          Vos documents arrivent de partout : e-mails, photos, courriers.
        </li>
        <li>
          <span className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
            2 · Classés
          </span>
          Chacun est rangé par catégorie d'après son nom de fichier ; son contenu n'est jamais lu.
        </li>
        <li>
          <span className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
            3 · Organisés
          </span>
          Le dossier réunit ses pièces, prêt à être suivi puis transmis par vous.
        </li>
      </ol>

      <button
        type="button"
        onClick={replay}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border hairline-strong bg-white px-3.5 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-cream-100 motion-reduce:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 8a5.5 5.5 0 1 0 1.7-3.97" />
          <path d="M2.5 2.5v3h3" />
        </svg>
        Rejouer l'animation
      </button>
    </div>
  );
}
