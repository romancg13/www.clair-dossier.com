import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import {
  FormGuideIcon,
  FilePagesIcon,
  StatusTrackIcon,
  ValidateIcon,
  AuditIcon,
  UsersIcon,
} from '../icons';

const STEPS = [
  {
    Icon: FormGuideIcon,
    label: 'Création du dossier',
    body: "On ouvre un dossier pour un client, un chantier ou une affaire, et on y rattache tout ce qui s'y rapporte.",
  },
  {
    Icon: FilePagesIcon,
    label: 'Devis, contrat ou accord',
    body: "Devis signé, contrat, bon de commande ou simple accord écrit : la base de la relation est posée et conservée.",
  },
  {
    Icon: StatusTrackIcon,
    label: 'Suivi du dossier',
    body: "Documents ajoutés au fil de l'eau, échéances renseignées et affichées sur le dossier. On voit où en est chaque dossier.",
  },
  {
    Icon: ValidateIcon,
    label: 'Facture et paiement',
    body: "Facture, montant dû et échéance de paiement sont renseignés sur le dossier, et les justificatifs restent regroupés au même endroit.",
  },
  {
    Icon: AuditIcon,
    label: 'Option impayé / pré-contentieux',
    body: "En cas d'impayé, on regroupe les pièces utiles et on prépare un dossier clair, prêt à être transmis si besoin.",
  },
];

const PERSONNEL = [
  'Contrat de travail',
  'DPAE',
  'Fiche de poste',
  'Planning',
  'Bulletins de paie',
  'Congés et absences',
  'Arrêts maladie',
  'Notes de frais',
  'Documents de fin de contrat',
  'Autre document RH',
];

export function DossierLifecycle() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Cycle de vie du dossier
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            De la création du dossier au contentieux.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            ClairDossier permet de créer un dossier, ajouter les documents, garder en vue
            les échéances renseignées, conserver la trace de la facture et regrouper les
            pièces utiles en cas d'impayé ou de contentieux. Le dossier peut aussi servir à
            transmettre les pièces au comptable ou à un professionnel du droit.
          </p>
        </div>

        {/* Chronologie en 5 étapes */}
        <Stagger inView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <StaggerItem key={step.label}>
              <div className="flex h-full flex-col rounded-xl border hairline bg-white p-6">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-cream-100 text-navy-900">
                  <step.Icon />
                </span>
                <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">
                  Étape {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-navy-900">
                  {step.label}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Encart personnel + transmissions */}
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Documents liés au personnel */}
          <div className="rounded-2xl border hairline bg-cream-100 p-7 sm:p-9">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-navy-900">
              <UsersIcon />
            </span>
            <h3 className="mt-5 font-display text-2xl font-semibold leading-tight text-navy-900">
              Documents liés au personnel
            </h3>
            <ul className="mt-6 flex flex-wrap gap-2">
              {PERSONNEL.map((doc) => (
                <li
                  key={doc}
                  className="rounded-full border hairline bg-white px-3.5 py-1.5 text-sm leading-none text-slate-500"
                >
                  {doc}
                </li>
              ))}
            </ul>
          </div>

          {/* Transmissions : comptable + professionnel du droit */}
          <div className="grid gap-4">
            <div className="rounded-2xl border hairline bg-white p-7 sm:p-9">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                Comptable
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                ClairDossier permet également de regrouper les pièces utiles à transmettre au
                comptable : factures, devis, justificatifs de paiement, documents administratifs
                et pièces liées au personnel.
              </p>
            </div>
            <div className="rounded-2xl bg-navy-900 p-7 text-cream-50 sm:p-9">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                Professionnel du droit
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cream-50/80">
                En cas d'impayé ou de contentieux, ClairDossier aide à préparer un dossier clair
                pouvant être transmis à un avocat, un commissaire de justice, un notaire ou tout
                autre professionnel compétent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
