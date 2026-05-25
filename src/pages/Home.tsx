import { Seo, orgSchema, websiteSchema } from '../lib/seo';
import { Hero } from '../components/sections/Hero';
import { Partners } from '../components/sections/Partners';
import { AvantApres } from '../components/sections/AvantApres';
import { FeaturesGrid } from '../components/sections/FeaturesGrid';
import { WorkspacesTabs } from '../components/sections/WorkspacesTabs';
import { Workflow } from '../components/sections/Workflow';
import { SecurityBlock } from '../components/sections/SecurityBlock';
import { PricingPreview } from '../components/sections/PricingPreview';
import { TestimonialsBlock } from '../components/sections/TestimonialsBlock';
import { BlogPreview } from '../components/sections/BlogPreview';
import { FaqBlock } from '../components/sections/FaqBlock';
import { FinalCTA } from '../components/sections/FinalCTA';
import { homeFaq } from '../data/faq';

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ClairDossier',
  applicationCategory: 'LegalService',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
    description: "Plan Particulier gratuit, plan Professionnel à 49 €/mois HT, plan Entreprise sur devis.",
  },
  description:
    "Plateforme legaltech française. Transforme les demandes juridiques en dossiers structurés, suivis et validés par un avocat habilité.",
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

export function Home() {
  return (
    <>
      <Seo
        title="ClairDossier — Votre dossier juridique, clair, structuré et suivi"
        description="ClairDossier transforme les demandes juridiques en dossiers structurés et suivis. Plateforme legaltech française pour clients, PME et cabinets d'avocats."
        path="/"
        jsonLd={[orgSchema, websiteSchema, softwareSchema, faqSchema]}
      />
      <Hero />
      <Partners />
      <AvantApres />
      <FeaturesGrid />
      <WorkspacesTabs />
      <Workflow />
      <SecurityBlock />
      <PricingPreview />
      <TestimonialsBlock />
      <BlogPreview />
      <FaqBlock />
      <FinalCTA />
    </>
  );
}
