import { Link } from 'react-router-dom';
import horizontal162 from '../assets/brand/logo-horizontal-162.webp';
import horizontal324 from '../assets/brand/logo-horizontal-324.webp';
import horizontal486 from '../assets/brand/logo-horizontal-486.webp';
import complet260 from '../assets/brand/logo-complet-260.webp';
import complet520 from '../assets/brand/logo-complet-520.webp';
import complet780 from '../assets/brand/logo-complet-780.webp';

// Logo officiel (PNG fourni, fond bleu nuit conservé — aucun détourage) :
// « horizontal » = symbole + nom (en-tête), « complet » = avec la signature (pied de page).
const VARIANTS = {
  horizontal: {
    src: horizontal162,
    srcSet: `${horizontal162} 162w, ${horizontal324} 324w, ${horizontal486} 486w`,
    sizes: '(min-width: 640px) 162px, 132px',
    width: 162,
    height: 44,
    className: 'h-9 w-auto sm:h-11',
  },
  complet: {
    src: complet260,
    srcSet: `${complet260} 260w, ${complet520} 520w, ${complet780} 780w`,
    sizes: '260px',
    width: 260,
    height: 71,
    className: 'h-auto w-[260px] max-w-full',
  },
} as const;

export function Logo({ variant = 'horizontal' }: { variant?: keyof typeof VARIANTS }) {
  const v = VARIANTS[variant];
  return (
    <Link to="/" aria-label="ClairDossier, accueil" className="inline-flex max-w-full shrink-0 rounded-md">
      <img
        src={v.src}
        srcSet={v.srcSet}
        sizes={v.sizes}
        width={v.width}
        height={v.height}
        alt="ClairDossier"
        decoding="async"
        className={`${v.className} rounded-md object-contain`}
      />
    </Link>
  );
}
