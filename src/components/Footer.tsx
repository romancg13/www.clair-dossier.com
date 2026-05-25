import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const PRODUIT = [
  { to: '/fonctionnalites', label: 'Fonctionnalités' },
  { to: '/tarifs', label: 'Tarifs' },
  { to: '/securite', label: 'Sécurité' },
  { to: '/dossier/nouveau', label: 'Créer un dossier' },
];

const RESSOURCES = [
  { to: '/blog', label: 'Journal' },
  { to: '/contact', label: 'Contact & démo' },
  { to: '/securite#conformite', label: 'Conformité' },
  { to: '/securite#dpa', label: 'DPA' },
];

const LEGAL = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/cgv', label: 'CGV' },
  { to: '/politique-confidentialite', label: 'Confidentialité' },
  { to: '/cookies', label: 'Cookies' },
];

export function Footer() {
  return (
    <footer className="border-t hairline bg-cream-100/60">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">
              ClairDossier transforme les demandes juridiques en dossiers structurés,
              suivis et prêts à être validés par un professionnel habilité.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                aria-label="LinkedIn ClairDossier"
                className="grid h-9 w-9 place-items-center rounded-md border hairline text-slate-500 transition-colors hover:border-gold-500 hover:text-navy-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="X (Twitter) ClairDossier"
                className="grid h-9 w-9 place-items-center rounded-md border hairline text-slate-500 transition-colors hover:border-gold-500 hover:text-navy-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2H21.5l-7.39 8.443L23 22h-6.91l-5.4-7.066L4.5 22H1.244l7.88-9.012L1 2h7.05l4.88 6.45L18.244 2zm-1.21 18.05h1.836L7.05 3.823H5.083L17.034 20.05z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterCol title="Produit" items={PRODUIT} />
          <FooterCol title="Ressources" items={RESSOURCES} />
          <FooterCol title="Légal" items={LEGAL} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t hairline pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">
            © 2026 ClairDossier · SAS — RCS Paris XXX · SIREN XXXXXXXXX
          </span>
          <span>
            Hébergement OVH (France) · Données en territoire européen ·{' '}
            <Link to="/securite" className="border-b hairline-gold hover:text-navy-900">
              Charte de sécurité
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-navy-900">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="text-sm text-slate-500 transition-colors hover:text-navy-900"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
