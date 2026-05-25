import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import {
  HostingFranceIcon,
  EncryptionIcon,
  RgpdIcon,
  ComplianceRinIcon,
  BackupIcon,
  AuditIcon,
  ArrowRightIcon,
} from '../icons';

const TRUST = [
  {
    Icon: HostingFranceIcon,
    title: 'Hébergement français',
    body: "Datacenters OVH à Roubaix et Strasbourg. Sauvegardes redondantes uniquement en France. Aucun transfert hors UE.",
  },
  {
    Icon: EncryptionIcon,
    title: 'Chiffrement AES-256 / TLS 1.3',
    body: "Au repos pour les pièces et bases de données. En transit pour tous les flux client ↔ serveur.",
  },
  {
    Icon: RgpdIcon,
    title: 'RGPD natif',
    body: "Registre des traitements à jour, DPA standard et renforcé, DPIA réalisée et consultable sur demande.",
  },
  {
    Icon: ComplianceRinIcon,
    title: 'Conformité RIN',
    body: "Règlement Intérieur National des avocats : l'IA prépare, l'avocat décide. La frontière est technique, pas seulement contractuelle.",
  },
  {
    Icon: BackupIcon,
    title: 'Sauvegardes 3-2-1',
    body: "Trois copies de chaque donnée, sur deux supports différents, dont une hors site — restauration testée chaque trimestre.",
  },
  {
    Icon: AuditIcon,
    title: 'Audit annuel par tiers',
    body: "Un cabinet de sécurité externe indépendant audite l'infrastructure et les configurations. Rapport remis aux clients Entreprise.",
  },
];

export function SecurityBlock() {
  return (
    <Reveal as="section" className="border-y hairline bg-cream-100/40">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
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

        <Stagger inView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}
