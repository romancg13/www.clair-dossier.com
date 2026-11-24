import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Seo } from '../lib/seo';
import { CONTACT_EMAIL, PHONE_DISPLAY, PHONE_HREF } from '../data/contact';
import { formatEuro } from '../data/pricing';
import {
  PILOTE,
  PILOTE_DOSSIERS,
  PILOTE_PRIX,
  PILOTE_PRIX_PAR_DOSSIER,
  PILOTE_SEMAINES,
  PILOTE_TVA,
} from '../demo/construction/pilote';

/**
 * Fiche publique « Pilote ClairDossier — assurance construction » (build VITE_DEMO=1
 * uniquement, montée hors Layout). Une page A4 à l'impression : la règle ci-dessous ne
 * vit que pendant l'affichage de cette page (aucune feuille globale modifiée) ; la
 * taille de police racine réduite en impression met à l'échelle tout le gabarit en rem.
 */
const PRINT_CSS = `
@page { size: A4; margin: 8mm 12mm; }
@media print {
  html { font-size: 11.5px; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: #fff; min-height: 0; }
}`;

const WEEKS = Array.from({ length: PILOTE_SEMAINES }, (_, i) => i + 1);

function weekLabel(debut: number, fin: number) {
  return debut === fin ? `Semaine ${debut}` : `Semaines ${debut} à ${fin}`;
}

function Rubrique({ id, n, titre, children, className = '' }: { id: string; n: string; titre: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`break-inside-avoid ${className}`}>
      <h2 id={id} className="flex items-baseline gap-2.5 border-b hairline-strong pb-1.5 font-mono text-xs font-medium uppercase tracking-[0.16em] text-gold-700">
        <span className="text-navy-900">{n}</span>
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Liste({ items, marque, tone }: { items: readonly string[]; marque: string; tone: string }) {
  return (
    <ul className="mt-2 space-y-1.5 print:space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span aria-hidden="true" className={`w-3 shrink-0 font-mono ${tone}`}>
            {marque}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Chiffre({ label, valeur, unite, testId }: { label: string; valeur: string; unite: string; testId: string }) {
  return (
    <div className="px-3 py-4 sm:px-4 print:px-3 print:py-3">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1">
        <span data-testid={testId} className="block font-display text-[1.8rem] font-semibold leading-none text-navy-900 lining-nums tabular-nums sm:text-[2.1rem] print:text-[2.1rem]">
          {valeur}
        </span>
        <span className="mt-1.5 block text-sm font-medium text-slate-500">{unite}</span>
      </dd>
    </div>
  );
}

export function PiloteConstruction() {
  return (
    <div className="min-h-dvh bg-cream-100 px-4 pb-14 text-ink sm:px-8 print:min-h-0 print:bg-white print:p-0">
      <style>{PRINT_CSS}</style>
      <Seo
        title="Pilote assurance construction"
        description={`Fiche pilote ClairDossier pour l'assurance construction : ${PILOTE_DOSSIERS} dossiers en ${PILOTE_SEMAINES} semaines, puis décision sur résultats.`}
        path="/pilote-assurance-construction"
        noindex
      />
      <a className="skip-nav print:hidden" href="#main">
        Aller au contenu principal
      </a>

      <header className="mx-auto flex max-w-[54rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 print:max-w-none print:py-0">
        <Logo />
        <p className="hidden text-right font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500 print:block">
          Proposition de pilote · document de travail
        </p>
        <nav aria-label="Actions" className="flex flex-wrap items-center gap-2 print:hidden">
          <Link
            to="/demo/assurance-construction"
            className="rounded-full border hairline-strong bg-white px-3.5 py-2 text-sm sm:px-4 font-medium text-navy-900 transition-colors hover:bg-cream-50"
          >
            ← Revoir la démo
          </Link>
          <button
            type="button"
            data-testid="pilote-print"
            onClick={() => window.print()}
            className="rounded-full bg-navy-900 px-3.5 py-2 text-sm sm:px-4 font-semibold text-cream-50 transition-colors hover:bg-navy-800"
          >
            Imprimer / enregistrer en PDF
          </button>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <article className="mx-auto max-w-[54rem] border hairline bg-white px-5 py-8 text-[0.9375rem] leading-relaxed text-pretty text-slate-700 shadow-card sm:px-12 sm:py-12 print:mt-2 print:max-w-none print:border-0 print:p-0 print:leading-snug print:shadow-none">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-700 print:hidden">Proposition de pilote · document de travail</p>
          <h1 className="mt-3 font-display text-[2.35rem] lining-nums print:mt-0 leading-[1.05] text-navy-900 sm:text-5xl print:text-[2.6rem]">{PILOTE.titre}</h1>
          <p className="mt-2 text-base text-slate-500">{PILOTE.public}</p>

          {/* Décision proposée : le « term sheet » de la fiche. */}
          <section aria-labelledby="decision" className="mt-7 border-y-2 border-navy-900 print:mt-2.5">
            <div className="grid sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="py-4 sm:pr-6 print:py-2 print:pr-5">
                <h2 id="decision" className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-gold-700">
                  Décision proposée
                </h2>
                <p className="mt-2 font-display text-[1.45rem] font-medium leading-snug text-navy-900 lining-nums">{PILOTE.decision}</p>
              </div>
              <dl className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)] divide-x divide-[rgba(13,27,61,0.12)] border-t hairline-strong sm:border-t-0 sm:border-l print:border-t-0 print:border-l">
                <Chiffre label="Volume" valeur={String(PILOTE_DOSSIERS)} unite="dossiers" testId="pilote-volume" />
                <Chiffre label="Durée" valeur={String(PILOTE_SEMAINES)} unite="semaines" testId="pilote-duration" />
                <Chiffre label="Prix" valeur={formatEuro(PILOTE_PRIX)} unite="HT, pour le pilote" testId="pilote-price" />
              </dl>
            </div>
            <p className="border-t hairline-strong py-2 text-sm text-slate-500">
              Soit <strong className="font-semibold text-navy-900">{formatEuro(PILOTE_PRIX_PAR_DOSSIER)} HT par dossier</strong>. {PILOTE_TVA}
            </p>
          </section>

          <Rubrique id="perimetre" n="01" titre="Périmètre" className="mt-8 print:mt-2.5">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 print:grid-cols-2 print:gap-y-3">
              <div className="mt-3 print:mt-2">
                <h3 className="font-semibold text-navy-900">Ce que ClairDossier prépare</h3>
                <Liste items={PILOTE.prepare} marque="+" tone="text-gold-700" />
              </div>
              <div className="mt-3 print:mt-2">
                <h3 className="font-semibold text-navy-900">Ce qu'il ne fait pas</h3>
                <Liste items={PILOTE.nePasFaire} marque="–" tone="text-slate-500" />
              </div>
            </div>
            <p className="mt-5 border-l-2 border-gold-500 bg-cream-50 px-4 py-3 text-sm leading-relaxed print:mt-2 print:py-2">
              <strong className="font-semibold text-navy-900">Préalable. </strong>
              {PILOTE.prealable}
            </p>
          </Rubrique>

          <Rubrique id="calendrier" n="02" titre={`Calendrier — ${PILOTE_SEMAINES} semaines`} className="mt-8 print:mt-2.5">
            <div className="mt-3 print:mt-2 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] print:grid print:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-hidden="true">
              <span />
              <span className="grid grid-cols-6 gap-0.5 text-center font-mono text-[0.6875rem] text-slate-500">
                {WEEKS.map((w) => (
                  <span key={w}>S{w}</span>
                ))}
              </span>
            </div>
            <ol className="mt-1 divide-y divide-[rgba(13,27,61,0.08)]">
              {PILOTE.calendrier.map((p) => (
                <li
                  key={p.titre}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-6 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] print:py-1"
                >
                  <div className="col-span-2 sm:col-span-1 print:col-span-1">
                    <p className="font-semibold text-navy-900">
                      <span className="font-mono text-xs font-medium text-gold-700">{weekLabel(p.debut, p.fin)} · </span>
                      {p.titre}
                    </p>
                    <p className="text-sm">{p.detail}</p>
                  </div>
                  {/* Piste de 6 semaines : or pour les temps de décision, bleu nuit pour le traitement. */}
                  <span aria-hidden="true" className="col-span-2 mt-2 grid grid-cols-6 gap-0.5 sm:col-span-1 sm:mt-1.5 print:col-span-1 print:mt-1">
                    {WEEKS.map((w) => (
                      <span
                        key={w}
                        className={`h-2.5 ${w >= p.debut && w <= p.fin ? (p.debut === p.fin ? 'bg-gold-500' : 'bg-navy-900') : 'bg-cream-100'}`}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </Rubrique>

          <Rubrique id="referents" n="03" titre="Référents" className="mt-8 print:mt-2.5">
            <dl className="mt-3 print:mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-3 print:grid-cols-3">
              {PILOTE.referents.map((r) => (
                <div key={r.role} className="border-t-2 border-navy-900 pt-2">
                  <dt className="font-semibold text-navy-900">{r.role}</dt>
                  <dd className="text-sm">{r.mission}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-slate-500 print:hidden">{PILOTE.referentsNote}</p>
          </Rubrique>

          <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 print:mt-2.5 print:grid-cols-2">
            <Rubrique id="mesure" n="04" titre="Méthode de mesure">
              <p className="mt-3 print:mt-2 text-sm">{PILOTE.mesure.principe}</p>
              <Liste items={PILOTE.mesure.indicateurs} marque="·" tone="text-gold-700" />
              <p className="mt-2 text-sm font-medium text-navy-900">{PILOTE.mesure.note}</p>
            </Rubrique>
            <Rubrique id="extension" n="05" titre="Critères d'extension">
              <p className="mt-3 print:mt-2 text-sm font-medium text-navy-900">{PILOTE.extension.intro}</p>
              <Liste items={PILOTE.extension.criteres} marque="·" tone="text-gold-700" />
            </Rubrique>
          </div>

          <Rubrique id="apres" n="06" titre="Après le pilote — deux décisions distinctes" className="mt-8 print:mt-2.5">
            <ol className="mt-3 print:mt-2 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              {PILOTE.decisionsApres.map((d, i) => (
                <li key={d.titre} className="border hairline-strong bg-cream-50 px-4 py-3 print:py-1.5">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-gold-700">Décision {i + 1}</p>
                  <p className="mt-1 font-display text-xl font-semibold leading-tight text-navy-900">{d.titre}</p>
                  <p className="mt-1 text-sm">{d.detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm print:hidden">{PILOTE.decisionsNote}</p>
          </Rubrique>

          <footer className="mt-8 flex break-inside-avoid flex-col gap-2 border-t-2 border-navy-900 pt-3 text-sm sm:flex-row sm:items-baseline sm:justify-between print:mt-2.5 print:flex-row print:items-baseline print:justify-between">
            <p>
              <span className="font-semibold text-navy-900">{PILOTE.contact}</span>
              {' · '}
              <a href={PHONE_HREF} className="whitespace-nowrap text-navy-900 underline decoration-gold-500 underline-offset-2">
                {PHONE_DISPLAY}
              </a>
              {' · '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-navy-900 underline decoration-gold-500 underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="text-xs text-slate-500">{PILOTE.mentionDocument}</p>
          </footer>
        </article>
      </main>
    </div>
  );
}
