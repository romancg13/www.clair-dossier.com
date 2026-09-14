import type { SVGProps } from 'react';
import type { DemoDocType } from './demo-dossier';

/**
 * Glyphes documentaires (trait 1.5, 20 px) — dessinés pour ClairDossier,
 * aucune bibliothèque d'icônes générique.
 */
export function DocumentGlyph({ type, ...props }: { type: DemoDocType } & SVGProps<SVGSVGElement>) {
  const base = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
  switch (type) {
    case 'facture':
      return (
        <svg {...base}>
          <path d="M5 2.5h7l3 3v12H5z" />
          <path d="M12 2.5v3h3" />
          <path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h3" />
        </svg>
      );
    case 'email':
      return (
        <svg {...base}>
          <rect x="2.5" y="5" width="15" height="10.5" rx="1.5" />
          <path d="M3 6l7 5 7-5" />
        </svg>
      );
    case 'courrier':
      return (
        <svg {...base}>
          <path d="M4 3.5h12v13H4z" />
          <path d="M7 7h6M7 10h6M7 13h4" />
          <circle cx="13.5" cy="13" r="1.2" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...base}>
          <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
          <path d="M3 14l4.5-4.5 3 3 2-2L17 14" />
          <circle cx="13.5" cy="7.5" r="1.2" />
        </svg>
      );
    case 'echeance':
      return (
        <svg {...base}>
          <rect x="3" y="4" width="14" height="13" rx="1.5" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" />
          <circle cx="12.5" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'contrat':
      return (
        <svg {...base}>
          <path d="M5 2.5h7l3 3v12H5z" />
          <path d="M12 2.5v3h3" />
          <path d="M7.5 9h5M7.5 11.5h5" />
          <path d="M7.5 14.5c1-1 2-1 3 0s2 1 3 0" />
        </svg>
      );
    case 'justificatif':
      return (
        <svg {...base}>
          <path d="M5 2.5h7l3 3v12H5z" />
          <path d="M12 2.5v3h3" />
          <path d="M7.5 12.5l2 2 3.5-4" />
        </svg>
      );
    case 'devis':
    default:
      return (
        <svg {...base}>
          <path d="M5 2.5h7l3 3v12H5z" />
          <path d="M12 2.5v3h3" />
          <path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h5" />
        </svg>
      );
  }
}
