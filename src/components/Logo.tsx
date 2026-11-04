import { Link } from 'react-router-dom';
import horizontal185 from '../assets/brand/logo-horizontal-clair-185.webp';
import horizontal370 from '../assets/brand/logo-horizontal-clair-370.webp';
import horizontal555 from '../assets/brand/logo-horizontal-clair-555.webp';
// no-inline : variante des très petits écrans, inutile de la loger dans chaque page.
import symbole45 from '../assets/brand/logo-symbole-clair-45.webp?no-inline';
import symbole90 from '../assets/brand/logo-symbole-clair-90.webp';
import symbole135 from '../assets/brand/logo-symbole-clair-135.webp';

// Logo officiel détouré (fond transparent, déclinaison pour fonds clairs : bleu nuit + or).
// Symbole seul sous 300 px de large. Kit complet et méthode d'extraction : docs/marque/.
export function Logo() {
  return (
    <Link to="/" aria-label="ClairDossier, accueil" className="inline-flex shrink-0 rounded-sm">
      <picture>
        <source
          media="(max-width: 299px)"
          srcSet={`${symbole45} 45w, ${symbole90} 90w, ${symbole135} 135w`}
          sizes="45px"
          width={45}
          height={34}
        />
        <img
          src={horizontal185}
          srcSet={`${horizontal185} 185w, ${horizontal370} 370w, ${horizontal555} 555w`}
          sizes="(min-width: 640px) 185px, 143px"
          width={185}
          height={44}
          alt="ClairDossier"
          decoding="async"
          className="h-[34px] w-auto sm:h-11"
        />
      </picture>
    </Link>
  );
}
