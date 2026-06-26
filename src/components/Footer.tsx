import { Link } from "react-router-dom";
import { Logo } from "./Logo";

const PRODUIT = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/securite", label: "Sécurité" },
  { to: "/dossier/nouveau", label: "Créer un dossier" },
];

const RESSOURCES = [
  { to: "/blog", label: "Journal" },
  { to: "/contact", label: "Contact & démo" },
  { to: "/securite#conformite", label: "Conformité" },
  { to: "/securite#dpa", label: "DPA" },
];

const LEGAL = [
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/cgv", label: "CGV" },
  { to: "/politique-confidentialite", label: "Confidentialité" },
  { to: "/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="border-t hairline bg-cream-100/60">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">
              ClairDossier structure vos dossiers administratifs et juridiques —
              du brouillon à la transmission, avec dépôt de pièces sécurisé,
              suivi de l'avancement et échéances réunies au même endroit.
            </p>
          </div>

          <FooterCol title="Produit" items={PRODUIT} />
          <FooterCol title="Ressources" items={RESSOURCES} />
          <FooterCol title="Légal" items={LEGAL} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t hairline pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">
            © 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734
          </span>
          <span>
            Hébergeur conforme RGPD · Pièces chiffrées au repos ·{" "}
            <Link
              to="/securite"
              className="border-b hairline-gold hover:text-navy-900"
            >
              Charte de sécurité
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { to: string; label: string }[];
}) {
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
