import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import {
  HostingFranceIcon,
  EncryptionIcon,
  RgpdIcon,
  ComplianceRinIcon,
  BackupIcon,
  AuditIcon,
  ArrowRightIcon,
} from '../components/icons';

const PILLARS = [
  {
    Icon: HostingFranceIcon,
    title: 'Infrastructure',
    body:
      "Datacenters OVH France (Roubaix, Strasbourg). Aucun datacenter hors UE, ni pour la production, ni pour les sauvegardes. Bare-metal souverain, pas de cloud public américain. Architecture trois tiers avec bastion de sortie et VPN administrateur 2FA obligatoire.",
    bullets: [
      "Datacenter primaire : OVH Roubaix",
      "Réplication temps réel : OVH Strasbourg",
      "Connectivité dédiée, pas de transit public",
    ],
  },
  {
    Icon: EncryptionIcon,
    title: 'Chiffrement',
    body:
      "AES-256 au repos pour la base de données et le coffre-fort de pièces. TLS 1.3 obligatoire pour tous les flux client ↔ serveur (HSTS preload). Clés chiffrées par KMS, rotation automatique tous les 90 jours, séparation stricte clés / données.",
    bullets: [
      "AES-256-GCM au repos",
      "TLS 1.3 minimum, HSTS preload",
      "Rotation clés KMS automatique 90 jours",
    ],
  },
  {
    Icon: RgpdIcon,
    title: 'Accès',
    body:
      "Authentification obligatoire à deux facteurs pour les accès administrateurs internes. Journalisation des consultations sensibles avec conservation des logs 12 mois. Aucune donnée client accessible par défaut aux équipes ClairDossier — accès sur demande tracée et justifiée.",
    bullets: [
      "2FA admin obligatoire (TOTP)",
      "Journalisation 12 mois consultable client",
      "Accès interne via demande tracée et justifiée",
    ],
  },
  {
    Icon: ComplianceRinIcon,
    title: 'Conformité',
    body:
      "RGPD (UE 2016/679) appliqué dès la conception : registre des traitements, DPIA réalisée, DPA standard et version renforcée disponibles. Conformité RIN (Règlement Intérieur National des avocats) sur le périmètre IA : préparation autorisée, conseil interdit. Hébergement HDS en cours pour les dossiers contenant des données de santé.",
    bullets: [
      "DPIA réalisée et consultable sur demande",
      "DPA opposable signable avant contrat",
      "Conformité RIN 2024 sur le périmètre IA",
    ],
  },
  {
    Icon: BackupIcon,
    title: 'Continuité',
    body:
      "Sauvegardes 3-2-1 : trois copies de chaque donnée, sur deux supports différents, dont une hors site. Restauration testée chaque trimestre avec un dossier de test représentatif. Point de reprise (RPO) de 15 minutes, durée de reprise (RTO) inférieure à 4 heures.",
    bullets: [
      "Sauvegardes 3-2-1 documentées",
      "RPO 15 minutes / RTO < 4 heures",
      "Restauration testée trimestriellement",
    ],
  },
  {
    Icon: AuditIcon,
    title: 'Audit & incident',
    body:
      "Audit annuel de sécurité réalisé par un cabinet de pentest indépendant — rapport remis aux clients Entreprise. Politique de divulgation responsable publiée. Procédure d'incident documentée avec notification CNIL sous 72 h, notification client sous 24 h pour les fuites concernant leurs données.",
    bullets: [
      "Audit annuel par cabinet de pentest tiers",
      "Politique de divulgation responsable",
      "Notification CNIL < 72 h, client < 24 h",
    ],
  },
];

export function Security() {
  return (
    <>
      <Seo
        title="Sécurité &amp; conformité"
        description="Hébergement OVH France, chiffrement AES-256, conformité RGPD et RIN, audit annuel par tiers. La charte sécurité complète de ClairDossier."
        path="/securite"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: 'Sécurité', path: '/securite' },
        ])}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Sécurité &amp; conformité
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              La sécurité juridique commence par la sécurité technique.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
              Pour une legaltech, la conformité n'est pas une case à cocher — c'est la condition
              d'existence. Cette page expose nos engagements techniques, leurs preuves, et les
              documents que vous pouvez exiger avant de signer.
            </p>
          </div>
        </div>
      </section>

      {/* Schéma archi simplifié */}
      <Reveal as="section" className="bg-cream-50 pb-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="rounded-2xl border hairline bg-white p-8 shadow-card sm:p-10">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
              Architecture simplifiée
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-navy-900">
              Du navigateur jusqu'à vos sauvegardes.
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">
              {[
                { kicker: '1', label: 'Client', detail: 'Navigateur · App · API' },
                { kicker: '2', label: 'TLS 1.3', detail: 'HSTS preload · Pinning' },
                { kicker: '3', label: 'Bastion', detail: 'WAF · Rate-limit · Audit' },
                { kicker: '4', label: 'Application', detail: 'France · 2FA admin' },
                { kicker: '5', label: 'Coffre chiffré', detail: 'AES-256 · Réplique FR' },
              ].map((node) => (
                <div
                  key={node.kicker}
                  className="rounded-xl border hairline bg-cream-50 p-4 text-center"
                >
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-gold-500">
                    Étape {node.kicker}
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-navy-900">
                    {node.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{node.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-500">
              Chaque flèche du schéma est chiffrée. Chaque nœud est journalisé. Chaque accès
              hors flux nominal est tracé. Aucune donnée client n'est lisible en clair sur
              les sauvegardes.
            </p>
          </div>
        </div>
      </Reveal>

      {/* 6 piliers */}
      <Reveal as="section" id="conformite" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
          <Stagger inView className="grid gap-5 md:grid-cols-2">
            {PILLARS.map((p) => (
              <StaggerItem key={p.title}>
                <article className="flex h-full flex-col rounded-2xl border hairline bg-white p-7 sm:p-8">
                  <span className="grid h-12 w-12 place-items-center rounded-lg bg-cream-100 text-navy-900">
                    <p.Icon width={28} height={28} />
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-semibold leading-tight text-navy-900">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.body}</p>
                  <ul className="mt-5 space-y-2 border-t hairline pt-4 font-mono text-[0.75rem] text-navy-900">
                    {p.bullets.map((b) => (
                      <li key={b}>· {b}</li>
                    ))}
                  </ul>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

      {/* Badges */}
      <Reveal as="section" className="border-y hairline bg-cream-100/40">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12">
          <p className="text-center font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-400">
            Cadres réglementaires couverts
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'RGPD', status: 'Conforme' },
              { label: 'RIN 2024', status: 'Conforme · IA encadrée' },
              { label: 'HDS', status: 'En cours · 2026 T3' },
              { label: 'ISO 27001', status: 'Objectif · 2027' },
            ].map((b) => (
              <div
                key={b.label}
                className="rounded-xl border hairline bg-white px-4 py-5 text-center"
              >
                <p className="font-display text-2xl font-semibold text-navy-900">{b.label}</p>
                <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-gold-500">
                  {b.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Téléchargements */}
      <Reveal id="dpa" as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Documents
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Les pièces que vous pouvez exiger.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              Aucune legaltech sérieuse ne refuse de fournir ces documents. Les nôtres sont
              prêts — certains à la demande pour des raisons de personnalisation contractuelle.
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2">
            {[
              { name: 'DPA standard', detail: 'Data Processing Agreement, version générique', state: 'Sur demande' },
              { name: 'DPA renforcé', detail: 'Personnalisé, plan Entreprise', state: 'Sur demande' },
              { name: 'Politique de sécurité', detail: 'Document interne de référence', state: 'Sur demande' },
              { name: 'Registre des sous-traitants', detail: 'Mis à jour à chaque changement', state: 'Sur demande' },
              { name: 'Rapport pentest 2026', detail: 'Audit annuel — synthèse remise', state: 'Plan Entreprise' },
              { name: 'DPIA — Analyse d\'impact', detail: 'Art. 35 RGPD', state: 'Sur demande' },
            ].map((doc) => (
              <div
                key={doc.name}
                className="flex items-center justify-between gap-4 rounded-xl border hairline bg-white px-5 py-4"
              >
                <div>
                  <p className="font-medium text-navy-900">{doc.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{doc.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-cream-100 px-3 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-navy-900">
                  {doc.state}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
            >
              Demander un document
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Divulgation responsable */}
      <Reveal as="section" className="bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Divulgation responsable
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-cream-50 sm:text-5xl">
            Trouvé une faille ? Écrivez-nous.
          </h2>
          <p className="mt-4 max-w-2xl text-cream-50/75 leading-relaxed">
            Nous prenons les rapports de vulnérabilités au sérieux. Réponse sous 24 h ouvrées.
            Programme de récompense informel pour les contributions confirmées et exploitables —
            détaillé au cas par cas. Aucune action en justice contre les chercheurs de bonne foi
            qui respectent la procédure.
          </p>
          <a
            href="mailto:security@clair-dossier.com"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 hover:-translate-y-0.5 transition-all duration-200"
          >
            security@clair-dossier.com
          </a>
        </div>
      </Reveal>
    </>
  );
}
