import { Seo, orgSchema, websiteSchema, softwareApplicationSchema } from '../../lib/seo';
import { plans } from '../../data/pricing';
import { homeFaq } from '../../data/faq';
import { FaqBlock } from '../sections/FaqBlock';
import { HeroCinematic } from './HeroCinematic';
import { StoryScene } from './StoryScene';
import { ChapterStructure } from './ChapterStructure';
import { ChapterDeadlines } from './ChapterDeadlines';
import { ChapterOverview } from './ChapterOverview';
import { TrustChapter } from './TrustChapter';
import { PricingCinematic } from './PricingCinematic';
import { FinalCinematic } from './FinalCinematic';

/**
 * Accueil — cinq sections (UX simplifiée, 2026-11-04) :
 *   1. Hero
 *   2. Comment ça fonctionne : trois gestes (déposer, organiser, suivre)
 *   3. Le résultat concret : la page dossier, trois informations
 *   4. Sécurité et confiance : faits vérifiables + liens
 *   5. Offres et action : tarifs (gelés), questions fréquentes, CTA final
 *
 * Montée derrière le flag HOME_CINEMATIC (src/lib/flags.ts) depuis
 * src/pages/Home.tsx, dont la composition historique reste intacte.
 * Chapitres déplacés sur /fonctionnalites avec leurs animations : suivi
 * (ChapterTimeline), transmission, bento, avant / avec, pour qui.
 */

// Constructeur commun (src/lib/seo.tsx) : prix publics de src/data/pricing.ts, sans
// « HT » (TVA non applicable, art. 293 B du CGI, CGV) ni catégorie LegalService.
const softwareSchema = softwareApplicationSchema(plans.map((plan) => plan.priceMonthly));

const HOME_FAQ_IDS = ['donnees-securisees', 'refus-avocat', 'obligation-avocat', 'export-possible'];
const faqEntries = homeFaq.filter((entry) => HOME_FAQ_IDS.includes(entry.id));

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  })),
};

export function HomeCinematic() {
  return (
    <>
      <Seo
        title="ClairDossier — Dossiers administratifs et juridiques, clairs et suivis"
        description="Réunissez vos pièces dans un espace privé, structurez votre dossier administratif ou juridique et suivez vos échéances. Rien n'est transmis sans votre accord."
        path="/"
        jsonLd={[orgSchema, websiteSchema, softwareSchema, faqSchema]}
      />

      <HeroCinematic />

      {/* Comment ça fonctionne + le résultat concret — fond cinéma continu */}
      <div className="cd-cinema cd-grain text-cream-50">
        <div aria-hidden="true" className="h-40 bg-gradient-to-b from-cream-50 to-transparent" />
        <StoryScene />
        <ChapterStructure />
        <ChapterDeadlines />
        <ChapterOverview />
        <div aria-hidden="true" className="h-32 bg-gradient-to-t from-cream-50 to-transparent" />
      </div>

      {/* Sections claires : rendu différé hors écran (.cd-cv) — aucune ne pilote
          une animation par sa propre hauteur. */}
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <TrustChapter />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 1000px' }}>
        <PricingCinematic />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 600px' }}>
        <FaqBlock entries={faqEntries} />
      </div>
      <FinalCinematic />
    </>
  );
}
