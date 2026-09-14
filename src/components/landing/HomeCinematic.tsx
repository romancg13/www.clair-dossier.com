import { Seo, orgSchema, websiteSchema } from '../../lib/seo';
import { homeFaq } from '../../data/faq';
import { WorkspacesTabs } from '../sections/WorkspacesTabs';
import { DossierLifecycle } from '../sections/DossierLifecycle';
import { BlogPreview } from '../sections/BlogPreview';
import { FaqBlock } from '../sections/FaqBlock';
import { HeroCinematic } from './HeroCinematic';
import { StoryScene } from './StoryScene';
import { ChapterStructure } from './ChapterStructure';
import { ChapterTimeline } from './ChapterTimeline';
import { ChapterDeadlines } from './ChapterDeadlines';
import { ChapterTransmission } from './ChapterTransmission';
import { ChapterOverview } from './ChapterOverview';
import { MidCTA } from './MidCTA';
import { FeaturesBento } from './FeaturesBento';
import { BeforeAfter } from './BeforeAfter';
import { AudienceSwitcher } from './AudienceSwitcher';
import { TrustChapter } from './TrustChapter';
import { PricingCinematic } from './PricingCinematic';
import { FinalCinematic } from './FinalCinematic';

/**
 * Home cinématique — Phase 4 « Homepage elevation » (MASTER_PROMPT VI.4).
 *
 * Montée derrière le flag HOME_CINEMATIC (src/lib/flags.ts) depuis
 * src/pages/Home.tsx, dont la composition historique reste intacte.
 * Mapping SECTION CURRENT → KEEP / ENHANCE / MOVE / MERGE :
 * docs/HOMEPAGE_ELEVATION.md.
 *
 * Narration en huit temps (VI.4) : le problème (01) → ce que ClairDossier
 * transforme (02–05) → la vue d'ensemble (06) → les fonctionnalités →
 * avant / avec → pour qui → espaces dédiés → cycle de vie → confiance →
 * tarifs → journal → FAQ → commencer.
 */

// Aligné sur src/pages/Home.tsx (composition historique) — ne pas diverger.
const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ClairDossier',
  applicationCategory: 'LegalService',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '19',
    priceCurrency: 'EUR',
    description: 'Création de compte gratuite, abonnement à partir de 19 €/mois HT.',
  },
  description:
    'Plateforme legaltech française. Transforme les demandes juridiques en dossiers structurés, suivis et transmis sur validation de l’utilisateur.',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: homeFaq.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  })),
};

export function HomeCinematic() {
  return (
    <>
      <Seo
        title="ClairDossier — Des documents dispersés, un dossier clair, structuré et suivi"
        description="ClairDossier réunit vos pièces dans un espace privé, structure votre dossier administratif ou juridique en cinq étapes, affiche vos échéances et ne transmet rien sans votre validation. Pour PME, artisans, indépendants et professions libérales."
        path="/"
        jsonLd={[orgSchema, websiteSchema, softwareSchema, faqSchema]}
      />

      <HeroCinematic />

      {/* Chapitres du récit — fond cinéma continu, transitions en dégradé */}
      <div className="cd-cinema cd-grain text-cream-50">
        <div aria-hidden="true" className="h-40 bg-gradient-to-b from-cream-50 to-transparent" />
        <StoryScene />
        <ChapterStructure />
        <ChapterTimeline />
        <ChapterDeadlines />
        <ChapterTransmission />
        <ChapterOverview />
        <MidCTA />
        <div aria-hidden="true" className="h-32 bg-gradient-to-t from-cream-50 to-transparent" />
      </div>

      {/* Sections claires : rendu différé hors écran (.cd-cv) — coût de mise en
          page initial réduit sur mobile ; aucune de ces sections ne pilote une
          animation par sa propre hauteur. */}
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 1400px' }}>
        <FeaturesBento />
      </div>
      <BeforeAfter />
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <AudienceSwitcher />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 800px' }}>
        <WorkspacesTabs />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 1200px' }}>
        <DossierLifecycle />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <TrustChapter />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 1000px' }}>
        <PricingCinematic />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <BlogPreview limit={3} />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <FaqBlock />
      </div>
      <FinalCinematic />
    </>
  );
}
