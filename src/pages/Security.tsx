import { useEffect, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Link } from "react-router-dom";
import { Seo, breadcrumbSchema } from "../lib/seo";
import { trackEvent } from "../lib/analytics";
import {
  EncryptionIcon,
  RgpdIcon,
  VaultIcon,
  AuditIcon,
  ArrowRightIcon,
} from "../components/icons";
import { Disclosure, revealHashTarget } from "../components/security/Disclosure";
import { SecurityIndicators } from "../components/security/SecurityIndicators";
import {
  TRUST_UPDATED,
  openTodos,
  retentionRows,
  securityChangelog,
  subprocessors,
} from "../data/trust";

/**
 * /securite — « Vos données, leur protection et vos droits ».
 *
 * Structure (chantier 9+10, 2026-09-18) :
 *   1. quatre cartes (#conformite) : deux phrases chacune, détails repliables
 *      reprenant toutes les informations utiles de l'ancienne page ;
 *   2. « Indicateurs techniques observables » (#indicateurs) : uniquement ce
 *      qui se constate automatiquement, daté, avec « À revérifier » /
 *      « Information indisponible » — jamais de badge ni de garantie ;
 *   3. « Engagements et documentation » (#engagements) : ce que l'éditeur
 *      s'engage à faire, relu par une personne, avec les documents qui font foi.
 * Ancres conservées : #conformite et #dpa (liens du pied de page), ainsi que
 * #sous-traitants, #conservation, #secret-professionnel, #continuite, #journal.
 */

const CONTACT_EMAIL = "contact.clairdossier@icloud.com";

const formatTrustDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

const linkClass = "border-b hairline-gold text-navy-900 hover:text-gold-700";

function TodoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border hairline-gold bg-gold-500/10 px-2.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-gold-700">
      À confirmer
    </span>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-gold-700">{children}</p>
  );
}

type Card = {
  id: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  lead: [string, string];
  details: ReactNode;
};

const CARDS: Card[] = [
  {
    id: "acces",
    Icon: RgpdIcon,
    title: "Accès",
    lead: [
      "Votre espace n'est accessible qu'avec un compte dont l'adresse e-mail a été confirmée.",
      "Chaque compte ne voit que ses propres dossiers, et seul un administrateur identifié peut les consulter pour le support.",
    ],
    details: (
      <Bullets
        items={[
          "Connexion par compte personnel, confirmé par e-mail avant la première connexion.",
          "Isolation entre comptes appliquée par la base de données elle-même (Row Level Security), y compris pour le stockage des pièces : c'est une propriété du système, pas une consigne d'usage.",
          "Accès support limité à un administrateur unique et identifié ; aucun autre accès interne n'existe.",
          "Chemin d'une demande : votre navigateur → connexion chiffrée (HTTPS) → authentification → application, cloisonnée par compte → stockage privé des pièces.",
        ]}
      />
    ),
  },
  {
    id: "protection-documents",
    Icon: EncryptionIcon,
    title: "Protection des documents",
    lead: [
      "Vos pièces sont conservées dans un stockage privé, chiffré au repos par l'hébergeur, et ne s'ouvrent que par des liens signés et temporaires.",
      "Le service ne lit, n'extrait ni n'analyse automatiquement leur contenu.",
    ],
    details: (
      <>
        <Bullets
          items={[
            "Échanges entre votre navigateur et l'application chiffrés (HTTPS).",
            "Un espace privé par dossier : vos pièces restent consultables et téléchargeables depuis la liste de vos dossiers et la page d'avancement.",
            "Liens de téléchargement signés et temporaires.",
            <>
              Aucune lecture, extraction ou analyse automatique des documents déposés — engagement
              contractuel (<Link to="/cgv" className={linkClass}>CGV</Link>, article 6).
            </>,
            "Valider un dossier l'enregistre dans votre compte : rien n'est envoyé par e-mail ou WhatsApp. Vous transmettez vous-même vos pièces, au destinataire de votre choix.",
          ]}
        />
        <div id="secret-professionnel" className="scroll-mt-24">
          <SubHeading>Secret professionnel</SubHeading>
          <p className="mt-2">
            Rien ne sort de votre espace sans votre action : vous choisissez le destinataire et le
            canal. Pour des échanges couverts par le secret professionnel, le professionnel
            destinataire, choisi par vous, reste responsable de son propre cadre déontologique.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "traitement-donnees",
    Icon: VaultIcon,
    title: "Traitement des données",
    lead: [
      "Vos données servent à fournir le service, à le facturer et à vous répondre ; elles ne sont ni vendues ni cédées à des fins commerciales.",
      "Chaque prestataire technique est nommé, avec sa finalité, sa localisation et la durée de conservation des données.",
    ],
    details: (
      <>
        <p>
          À chaque inscription ou nouveau dossier, l'équipe reçoit une notification interne par
          e-mail : elle ne contient ni pièce ni contenu de dossier.
        </p>
        <div id="sous-traitants" className="scroll-mt-24">
          <SubHeading>Sous-traitants</SubHeading>
          <p className="mt-2">
            Les éléments en attente de vérification sont marqués « À confirmer » — pas masqués.
          </p>
          <div className="mt-3 space-y-3">
            {subprocessors.map((s) => (
              <article key={s.name} className="rounded-lg border hairline bg-white p-4">
                <h4 className="font-display text-lg font-semibold text-navy-900">{s.name}</h4>
                <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Finalité</dt>
                    <dd className="mt-0.5 text-navy-900">{s.finalite}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Données</dt>
                    <dd className="mt-0.5 text-navy-900">{s.donnees}</dd>
                  </div>
                  <div>
                    <dt className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                      Localisation {s.localisationTodo && <TodoBadge />}
                    </dt>
                    <dd className="mt-0.5">{s.localisation}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Conservation</dt>
                    <dd className="mt-0.5">{s.retention}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                      DPA {s.dpaTodo && <TodoBadge />}
                    </dt>
                    <dd className="mt-0.5">{s.dpa}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
        <div id="conservation" className="scroll-mt-24">
          <SubHeading>Durées de conservation</SubHeading>
          <p className="mt-2">
            Reprises de la{" "}
            <Link to="/politique-confidentialite" className={linkClass}>
              politique de confidentialité
            </Link>
            , le document qui fait foi.
          </p>
          <dl className="mt-3 space-y-2">
            {retentionRows.map((r) => (
              <div key={r.label} className="rounded-lg border hairline bg-white px-4 py-3">
                <dt className="font-medium text-navy-900">{r.label}</dt>
                <dd className="mt-0.5">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </>
    ),
  },
  {
    id: "exercice-droits",
    Icon: AuditIcon,
    title: "Exercice des droits",
    lead: [
      "Vous pouvez demander l'accès à vos données, leur rectification, leur effacement ou leur portabilité, ainsi que la limitation du traitement ou vous y opposer.",
      "Écrivez-nous : nous répondons sous 30 jours, et vous pouvez saisir la CNIL si la réponse ne vous satisfait pas.",
    ],
    details: (
      <>
        <dl className="space-y-2">
          {[
            { name: "Accès et rectification", how: "Sur demande par e-mail." },
            {
              name: "Portabilité",
              how: "Copie de vos dossiers sur demande ; vos pièces restent téléchargeables à tout moment depuis votre espace.",
            },
            {
              name: "Effacement",
              how: "Suppression du compte et des données sur demande par e-mail (la suppression en libre-service n'est pas encore activée).",
            },
            { name: "Limitation et opposition", how: "Sur demande par e-mail." },
            { name: "Retrait du consentement", how: "À tout moment, sur demande par e-mail." },
            {
              name: "Réclamation",
              how: "Auprès de la CNIL (www.cnil.fr), si notre réponse ne vous satisfait pas.",
            },
          ].map((r) => (
            <div key={r.name} className="rounded-lg border hairline bg-white px-4 py-3">
              <dt className="font-medium text-navy-900">{r.name}</dt>
              <dd className="mt-0.5">{r.how}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Exercice de mes droits sur mes données")}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
          >
            Exercer un droit par e-mail
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </a>
          <Link to="/contact" className={`text-sm font-medium ${linkClass}`}>
            Autres moyens de contact
          </Link>
        </div>
      </>
    ),
  },
];

const ENGAGEMENTS: { text: string; source: ReactNode }[] = [
  {
    text: "Aucune lecture, extraction ou analyse automatique de vos pièces.",
    source: <><Link to="/cgv" className={linkClass}>CGV</Link>, article 6</>,
  },
  {
    text: "Aucune transmission de vos dossiers à des tiers par le service : c'est vous qui transmettez.",
    source: <><Link to="/cgv" className={linkClass}>CGV</Link>, article 6</>,
  },
  {
    text: "Aucune cession de vos données à des fins commerciales.",
    source: <Link to="/politique-confidentialite" className={linkClass}>Politique de confidentialité</Link>,
  },
  {
    text: "Réponse aux demandes d'exercice de vos droits sous 30 jours.",
    source: <Link to="/politique-confidentialite" className={linkClass}>Politique de confidentialité</Link>,
  },
  {
    text: "Accord de traitement des données (DPA) fourni sur demande aux clients professionnels.",
    source: <><Link to="/cgv" className={linkClass}>CGV</Link>, article 7</>,
  },
];

const DOCUMENTS = [
  { to: "/politique-confidentialite", label: "Politique de confidentialité" },
  { to: "/cgv", label: "Conditions générales de vente" },
  { to: "/cookies", label: "Cookies" },
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/etat-du-produit", label: "État du produit" },
];

const JUMP_LINKS = [
  { href: "#conformite", label: "L'essentiel" },
  { href: "#indicateurs", label: "Indicateurs observables" },
  { href: "#engagements", label: "Engagements" },
  { href: "#sous-traitants", label: "Sous-traitants" },
  { href: "#dpa", label: "DPA" },
];

export function Security() {
  // Mesure sans cookie (Lot 2.1) : une consultation du centre de confiance.
  useEffect(() => {
    trackEvent("consultation_trust_center");
  }, []);

  // Ancre ciblée (#sous-traitants, #journal…) : ouvre le bloc replié qui la contient.
  useEffect(() => {
    const onHash = () => revealHashTarget(window.location.hash);
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <Seo
        title="Sécurité : vos données, leur protection et vos droits"
        description="Accès, protection des documents, traitement des données, exercice de vos droits : ce que ClairDossier fait réellement, avec des indicateurs datés et des engagements documentés."
        path="/securite"
        jsonLd={breadcrumbSchema([
          { name: "Accueil", path: "/" },
          { name: "Sécurité", path: "/securite" },
        ])}
      />

      {/* Introduction */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-24">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Sécurité &amp; conformité
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl lg:text-6xl">
              Vos données, leur protection et vos droits
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
              L'essentiel tient en quatre points, détaillés à la demande. Nous
              séparons ce qui se vérifie automatiquement de ce qui relève de nos
              engagements, et ce qui n'est pas encore confirmé est marqué comme tel.
            </p>
          </div>
          <nav aria-label="Sur cette page" className="mt-7">
            <ul className="flex flex-wrap gap-2">
              {JUMP_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-[44px] items-center rounded-full border hairline bg-white px-4 text-sm text-navy-900 transition-colors hover:border-gold-500"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* Quatre cartes */}
      <section id="conformite" aria-labelledby="conformite-titre" className="scroll-mt-24 bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
          <h2 id="conformite-titre" className="sr-only">
            L'essentiel en quatre points
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {CARDS.map((c) => (
              <article
                key={c.id}
                id={c.id}
                className="flex flex-col rounded-2xl border hairline bg-white p-6 sm:p-8"
              >
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-cream-100 text-navy-900">
                  <c.Icon width={28} height={28} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold leading-tight text-navy-900">
                  {c.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {c.lead[0]} {c.lead[1]}
                </p>
                <div className="mt-5">
                  <Disclosure summary={`En détail — ${c.title.toLowerCase()}`}>{c.details}</Disclosure>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Indicateurs techniques observables */}
      <section
        id="indicateurs"
        aria-labelledby="indicateurs-titre"
        className="scroll-mt-24 border-y hairline bg-cream-100/40"
      >
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Constaté automatiquement
          </p>
          <h2
            id="indicateurs-titre"
            className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl"
          >
            Indicateurs techniques observables
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
            Seulement ce qui se vérifie sans intervention humaine, avec la date
            du constat.
          </p>
          <div className="mt-8">
            <SecurityIndicators />
          </div>
        </div>
      </section>

      {/* Engagements et documentation */}
      <section id="engagements" aria-labelledby="engagements-titre" className="scroll-mt-24 bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Validé par l'éditeur
          </p>
          <h2
            id="engagements-titre"
            className="mt-3 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl"
          >
            Engagements et documentation
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
            Ces engagements ne se mesurent pas automatiquement : ils sont pris par
            l'éditeur, relus avant publication et opposables dans les documents
            ci-dessous.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <ul className="space-y-3">
              {ENGAGEMENTS.map((e) => (
                <li key={e.text} className="rounded-xl border hairline bg-white px-5 py-4">
                  <p className="font-medium text-navy-900">{e.text}</p>
                  <p className="mt-1 text-xs text-slate-500">Source : {e.source}</p>
                </li>
              ))}
            </ul>

            <div>
              <SubHeading>Documents de référence</SubHeading>
              <ul className="mt-3 space-y-2">
                {DOCUMENTS.map((d) => (
                  <li key={d.to}>
                    <Link
                      to={d.to}
                      className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border hairline bg-white px-4 py-3 text-sm font-medium text-navy-900 transition-colors hover:border-gold-500"
                    >
                      {d.label}
                      <ArrowRightIcon width={14} height={14} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                Dernière revue de cette page : {formatTrustDate(TRUST_UPDATED)}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <Disclosure id="continuite" summary="Sauvegarde, restauration et incident">
              <Bullets
                items={[
                  <>
                    Sauvegardes automatiques de la base de données assurées par l'hébergeur
                    (Supabase) ; fréquence et profondeur exactes selon le plan souscrit.{" "}
                    <TodoBadge />
                  </>,
                  <>
                    Test de restauration : il sera daté dans le journal ci-dessous une fois
                    réalisé. Tant qu'il ne l'est pas, nous ne l'affirmons pas. <TodoBadge />
                  </>,
                  <>
                    En cas de violation de données : notification à la CNIL sous 72 h et
                    information des personnes concernées en cas de risque élevé (RGPD, articles
                    33 et 34). Procédure écrite détaillée : <TodoBadge />
                  </>,
                ]}
              />
            </Disclosure>

            <Disclosure id="journal" summary="Journal des changements de sécurité">
              <ol className="space-y-4 border-l hairline pl-5">
                {securityChangelog.map((c) => (
                  <li key={c.date} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-gold-500"
                    />
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
                      {formatTrustDate(c.date)}
                    </p>
                    <p className="mt-1">{c.entry}</p>
                  </li>
                ))}
              </ol>
              <div>
                <SubHeading>En attente de vérification — affiché tel quel</SubHeading>
                <ul className="mt-3 space-y-2">
                  {openTodos.map((t) => (
                    <li key={t} className="flex flex-wrap items-start gap-2.5">
                      <TodoBadge />
                      <span className="min-w-0 flex-1">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Disclosure>
          </div>

          {/* DPA — ancre #dpa utilisée par le pied de page */}
          <div
            id="dpa"
            className="mt-8 flex scroll-mt-24 flex-col items-start justify-between gap-6 rounded-2xl border hairline bg-white p-6 sm:p-8 lg:flex-row lg:items-center"
          >
            <div className="max-w-2xl">
              <SubHeading>DPA — accord de traitement des données</SubHeading>
              <h3 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy-900">
                Le DPA s'obtient sans formulaire.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Écrivez-nous : le DPA vous est envoyé par e-mail, sans qualification
                préalable, sous 24 h ouvrées. Le téléchargement direct depuis cette page
                est en préparation. <TodoBadge />
              </p>
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Demande%20de%20DPA%20ClairDossier`}
              onClick={() => trackEvent("telechargement_dpa", { mode: "email" })}
              className="sheen inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Demander le DPA
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </a>
          </div>
        </div>
      </section>

      {/* Divulgation responsable */}
      <section aria-labelledby="divulgation-titre" className="bg-navy-900 text-cream-50">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Divulgation responsable
          </p>
          <h2
            id="divulgation-titre"
            className="mt-3 font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl"
          >
            Trouvé une faille ? Écrivez-nous.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-cream-50/75">
            Nous prenons les rapports de vulnérabilités au sérieux et reviendrons
            vers vous. Aucune action en justice contre les chercheurs de bonne foi
            qui respectent une démarche responsable.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-7 inline-flex min-h-[44px] max-w-full items-center gap-2 break-all rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 transition-all duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </>
  );
}
