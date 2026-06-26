import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../primitives/Reveal";
import {
  HostingFranceIcon,
  EncryptionIcon,
  RgpdIcon,
  ComplianceRinIcon,
  BackupIcon,
  AuditIcon,
  ArrowRightIcon,
} from "../icons";

const TRUST = [
  {
    Icon: HostingFranceIcon,
    title: "Hébergeur conforme RGPD",
    body: "Vos données sont hébergées chez un sous-traitant conforme au RGPD. Aucune lecture ni exploitation automatique de vos pièces.",
  },
  {
    Icon: EncryptionIcon,
    title: "Chiffrement en transit et au repos",
    body: "Tous les échanges passent en HTTPS. Vos pièces et données sont chiffrées au repos côté hébergeur.",
  },
  {
    Icon: RgpdIcon,
    title: "Vos droits RGPD",
    body: "Accès, export et suppression de vos données sur demande, via le contact ou votre espace. Traitement sous 30 jours.",
  },
  {
    Icon: ComplianceRinIcon,
    title: "Vous gardez la main",
    body: "Rien ne quitte votre espace sans votre validation. La transmission d'un dossier par e-mail ou WhatsApp est déclenchée par vous.",
  },
  {
    Icon: BackupIcon,
    title: "Stockage privé des pièces",
    body: "Vos documents sont déposés dans un espace privé. Le téléchargement passe par des liens signés temporaires.",
  },
  {
    Icon: AuditIcon,
    title: "Isolation par utilisateur",
    body: "Chaque compte ne voit que ses propres dossiers. L'accès est protégé par authentification et isolé entre utilisateurs.",
  },
];

export function SecurityBlock() {
  return (
    <Reveal as="section" className="border-y hairline bg-cream-100/40">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Sécurité &amp; conformité
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              La sécurité juridique commence par la sécurité technique.
            </h2>
          </div>
          <Link
            to="/securite"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800 lg:self-end"
          >
            Charte complète
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>

        <Stagger
          inView
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {TRUST.map((item) => (
            <StaggerItem key={item.title}>
              <div className="flex h-full gap-4 rounded-xl border hairline bg-white p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cream-100 text-navy-900">
                  <item.Icon />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold leading-snug text-navy-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {item.body}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}
