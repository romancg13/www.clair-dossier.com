import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { TRUST } from '../sections/SecurityBlock';
import { ArrowRightIcon } from '../icons';

/**
 * Confiance — ENHANCE de SecurityBlock : mêmes six affirmations vérifiables
 * (exportées de la section d'origine), présentation beaucoup plus sobre.
 * Aucune certification, aucun audit, aucun partenaire : seulement ce qui se
 * vérifie dans le code, les migrations ou les documents publiés.
 */
export function TrustChapter() {
  return (
    <Reveal as="section" id="confiance" className="border-y hairline bg-cream-100/40">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Sécurité &amp; conformité</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
              Vos dossiers méritent un environnement conçu pour être fiable.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500">
              Chaque affirmation ci-contre se vérifie dans le code, les migrations ou les documents
              publiés. Ce qui n’est pas encore vérifiable est dit tel quel, daté, sur le centre de
              confiance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/securite"
                className="group inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
              >
                Centre de confiance
                <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/etat-du-produit"
                className="border-b hairline-gold text-sm font-medium text-navy-900 transition-colors hover:text-gold-700"
              >
                État du produit, daté
              </Link>
            </div>
          </div>

          <Stagger inView className="divide-y hairline border-y hairline sm:grid sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0 sm:border-y-0">
            {TRUST.map((item) => (
              <StaggerItem key={item.title} className="sm:border-b sm:hairline">
                <div className="flex gap-4 py-6">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-navy-900 ring-1 ring-navy-900/8">
                    <item.Icon width={18} height={18} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold leading-snug text-navy-900">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.body}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </Reveal>
  );
}
