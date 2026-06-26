import { Link } from "react-router-dom";
import { Seo, breadcrumbSchema } from "../lib/seo";
import { Reveal, Stagger, StaggerItem } from "../components/primitives/Reveal";
import {
  HostingFranceIcon,
  EncryptionIcon,
  RgpdIcon,
  ComplianceRinIcon,
  BackupIcon,
  AuditIcon,
  ArrowRightIcon,
} from "../components/icons";

const PILLARS = [
  {
    Icon: HostingFranceIcon,
    title: "Hébergement",
    body: "L'application est hébergée chez un sous-traitant conforme au RGPD. Les données sont chiffrées en transit (HTTPS) et au repos côté hébergeur. Vous gardez la main : aucune pièce n'est transmise à un tiers sans votre validation explicite.",
    bullets: [
      "Sous-traitant hébergeur conforme RGPD",
      "Chiffrement en transit (HTTPS)",
      "Chiffrement au repos côté hébergeur",
    ],
  },
  {
    Icon: EncryptionIcon,
    title: "Chiffrement",
    body: "Tous les échanges entre votre navigateur et l'application passent par une connexion chiffrée (HTTPS). Les pièces déposées sont conservées dans un stockage privé, chiffré au repos côté hébergeur. Les liens de téléchargement sont signés et temporaires.",
    bullets: [
      "Connexion chiffrée HTTPS de bout en bout",
      "Stockage des pièces chiffré au repos",
      "Liens de téléchargement signés et temporaires",
    ],
  },
  {
    Icon: RgpdIcon,
    title: "Accès",
    body: "L'accès à votre espace passe par une authentification (compte avec confirmation par e-mail). Vos données sont isolées par utilisateur : un client ne voit jamais les dossiers d'un autre. Seul un administrateur unique peut consulter les dossiers côté support.",
    bullets: [
      "Accès protégé par authentification",
      "Isolation des données par utilisateur",
      "Consultation support limitée à un seul admin",
    ],
  },
  {
    Icon: ComplianceRinIcon,
    title: "Conformité",
    body: "Le service est conçu pour respecter le RGPD (UE 2016/679). Vos données restent les vôtres : vous pouvez exercer vos droits d'accès, d'export et de suppression sur simple demande via le contact ou votre espace. L'hébergeur intervient comme sous-traitant conforme au RGPD.",
    bullets: [
      "Conçu pour le RGPD (UE 2016/679)",
      "Droits d'accès, export et suppression sur demande",
      "Hébergeur sous-traitant conforme RGPD",
    ],
  },
  {
    Icon: BackupIcon,
    title: "Vos pièces",
    body: "Chaque dossier rassemble vos pièces dans un espace privé et sécurisé. Vous les retrouvez à tout moment depuis la liste de vos dossiers et la page d'avancement, où elles restent téléchargeables. Rien n'est partagé tant que vous ne déclenchez pas la transmission.",
    bullets: [
      "Espace privé et sécurisé par dossier",
      "Pièces téléchargeables depuis votre espace",
      "Transmission déclenchée par vous seul",
    ],
  },
  {
    Icon: AuditIcon,
    title: "Maîtrise & contact",
    body: "Vous décidez de chaque envoi : la transmission d'un dossier par e-mail ou WhatsApp ne part qu'après votre validation explicite. Pour toute question de sécurité ou demande relative à vos données, une adresse de contact dédiée vous répond.",
    bullets: [
      "Aucune transmission sans votre validation",
      "Envoi par e-mail ou WhatsApp à votre main",
      "Contact dédié pour vos demandes données",
    ],
  },
];

export function Security() {
  return (
    <>
      <Seo
        title="Sécurité &amp; conformité"
        description="Chiffrement en transit et au repos, isolation des données par utilisateur, stockage privé des pièces et hébergeur conforme RGPD. Les engagements sécurité de ClairDossier."
        path="/securite"
        jsonLd={breadcrumbSchema([
          { name: "Accueil", path: "/" },
          { name: "Sécurité", path: "/securite" },
        ])}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-12 sm:pt-16 lg:pt-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Sécurité &amp; conformité
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              La sécurité administrative et juridique commence par la sécurité
              technique.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
              Pour une legaltech, la confiance se mérite. Cette page expose,
              sans jargon, ce que nous faisons concrètement pour protéger vos
              données : chiffrement, isolation par utilisateur, stockage privé
              de vos pièces et respect de vos droits RGPD.
            </p>
          </div>
        </div>
      </section>

      {/* Schéma archi simplifié */}
      <Reveal as="section" className="bg-cream-50 pb-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="rounded-2xl border hairline bg-white p-8 shadow-card sm:p-10">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Architecture simplifiée
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-navy-900">
              Du navigateur jusqu'à vos sauvegardes.
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">
              {[
                { kicker: "1", label: "Client", detail: "Navigateur · App" },
                { kicker: "2", label: "HTTPS", detail: "Connexion chiffrée" },
                {
                  kicker: "3",
                  label: "Authentification",
                  detail: "Compte confirmé",
                },
                {
                  kicker: "4",
                  label: "Application",
                  detail: "Isolation par utilisateur",
                },
                {
                  kicker: "5",
                  label: "Stockage privé",
                  detail: "Pièces chiffrées au repos",
                },
              ].map((node) => (
                <div
                  key={node.kicker}
                  className="rounded-xl border hairline bg-cream-50 p-4 text-center"
                >
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-gold-700">
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
              Les échanges passent par une connexion chiffrée. L'accès à votre
              espace exige une authentification, et vos données sont isolées des
              autres utilisateurs. Vos pièces sont conservées dans un stockage
              privé, chiffrées au repos côté hébergeur.
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
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {p.body}
                  </p>
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
          <p className="text-center font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-500">
            Nos engagements en clair
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "RGPD", status: "Conçu pour" },
              { label: "Chiffrement", status: "Transit & repos" },
              { label: "Isolation", status: "Par utilisateur" },
              { label: "Vos droits", status: "Sur demande" },
            ].map((b) => (
              <div
                key={b.label}
                className="rounded-xl border hairline bg-white px-4 py-5 text-center"
              >
                <p className="font-display text-2xl font-semibold text-navy-900">
                  {b.label}
                </p>
                <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-gold-700">
                  {b.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Téléchargements */}
      <Reveal id="dpa" as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Vos droits
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Vos données restent les vôtres.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              Au titre du RGPD, vous pouvez exercer vos droits sur vos données.
              Adressez-nous votre demande via le contact ou depuis votre espace
              : nous la traitons dans un délai de 30 jours.
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-2">
            {[
              {
                name: "Accès à vos données",
                detail: "Connaître les données vous concernant",
                state: "Sur demande",
              },
              {
                name: "Export de vos données",
                detail: "Récupérer une copie de vos dossiers",
                state: "Sur demande",
              },
              {
                name: "Suppression",
                detail: "Effacement de votre compte et de vos données",
                state: "Sur demande",
              },
              {
                name: "Rectification",
                detail: "Corriger une information inexacte",
                state: "Sur demande",
              },
              {
                name: "Création de compte",
                detail: "Gratuite, confirmée par e-mail",
                state: "Inclus",
              },
              {
                name: "Stockage privé des pièces",
                detail: "Espace sécurisé par dossier",
                state: "Inclus",
              },
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
              Exercer un droit
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
            Nous prenons les rapports de vulnérabilités au sérieux. Si vous
            identifiez une faille, écrivez-nous à l'adresse ci-dessous : nous
            reviendrons vers vous. Aucune action en justice contre les
            chercheurs de bonne foi qui respectent une démarche responsable.
          </p>
          <a
            href="mailto:contact.clairdossier@icloud.com"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 hover:-translate-y-0.5 transition-all duration-200"
          >
            contact.clairdossier@icloud.com
          </a>
        </div>
      </Reveal>
    </>
  );
}
