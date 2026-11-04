import { Link } from 'react-router-dom';
import horizontal179 from '../assets/brand/logo-horizontal-clair-179.webp';
import horizontal357 from '../assets/brand/logo-horizontal-clair-357.webp';
import horizontal536 from '../assets/brand/logo-horizontal-clair-536.webp';
// no-inline : variante des très petits écrans, inutile de la loger dans chaque page.
import symbole47 from '../assets/brand/logo-symbole-clair-47.webp?no-inline';
import symbole94 from '../assets/brand/logo-symbole-clair-94.webp';
import symbole141 from '../assets/brand/logo-symbole-clair-141.webp';

// Logo officiel détouré (fond transparent, déclinaison pour fonds clairs : bleu nuit + or).
// Symbole seul sous 300 px de large. Kit complet et méthode d'extraction : docs/marque/.
export function Logo() {
  return (
    <Link to="/" aria-label="ClairDossier, accueil" className="inline-flex shrink-0 rounded-sm">
      <picture>
        <source
          media="(max-width: 299px)"
          srcSet={`${symbole47} 47w, ${symbole94} 94w, ${symbole141} 141w`}
          sizes="47px"
          width={47}
          height={36}
        />
        <img
          src={horizontal179}
          srcSet={`${horizontal179} 179w, ${horizontal357} 357w, ${horizontal536} 536w`}
          sizes="(min-width: 640px) 179px, 146px"
          width={179}
          height={44}
          alt="ClairDossier"
          decoding="async"
          className="h-9 w-auto sm:h-11"
        />
      </picture>
    </Link>
  );
}
