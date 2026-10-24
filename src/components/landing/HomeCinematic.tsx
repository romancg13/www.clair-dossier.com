import { Seo, orgSchema, websiteSchema } from '../../lib/seo';
import { homeFaq } from '../../data/faq';
import { FaqBlock } from '../sections/FaqBlock';
import { HeroCinematic } from './HeroCinematic';
import { StoryScene } from './StoryScene';
import { ChapterStructure } from './ChapterStructure';
import { ChapterTimeline } from './ChapterTimeline';
import { ChapterDeadlines } from './ChapterDeadlines';
import { ChapterTransmission } from './ChapterTransmission';
import { ChapterOverview } from './ChapterOverview';
import { TrustChapter } from './TrustChapter';
import { PricingCinematic } from './PricingCinematic';
import { FinalCinematic } from './FinalCinematic';

/**
 * Home cinématique — Phase 4, simplifiée (2026-10-24, « hero 3 secondes »).
 *
 * Montée derrière le flag HOME_CINEMATIC (src/lib/flags.ts) depuis
 * src/pages/Home.tsx, dont la composition historique reste intacte.
 *
 * Six temps : HERO (convergence 3D) → RÉCIT PRODUIT (01–06, fond cinéma) →
 * CONFIANCE (+ FAQ dépliable) → OFFRES → CONCLUSION (maquette produit).
 * Sections déplacées, PAS supprimées (2026-10-24) : FeaturesBento,
 * BeforeAfter, AudienceSwitcher et WorkspacesTabs vivent désormais sur
 * /fonctionnalites (FeaturesIndex) ; le Journal reste accessible au pied de
 * page ; MidCTA (CTA dupliqué, aucun effet propre) a été retiré.
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
        title="ClairDossier — Vos dossiers administratifs et juridiques, clairs et suivis"
        description="ClairDossier réunit vos documents dans un espace privé, structure votre dossier administratif ou juridique, suit son avancement et vos échéances — et ne transmet rien sans votre validation. Pour les entreprises, indépendants et cabinets."
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
        <div aria-hidden="true" className="h-32 bg-gradient-to-t from-cream-50 to-transparent" />
      </div>

      {/* Sections claires : rendu différé hors écran (.cd-cv) — coût de mise en
          page initial réduit sur mobile. La confiance porte l'ambiance 3D
          « dossier suspendu » : pas de .cd-cv (la scène suit le défilement). */}
      <TrustChapter />
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 900px' }}>
        <FaqBlock />
      </div>
      <div className="cd-cv" style={{ containIntrinsicSize: 'auto 1000px' }}>
        <PricingCinematic />
      </div>
      <FinalCinematic />
    </>
  );
}
