import { Seo, orgSchema, websiteSchema, softwareApplicationSchema } from "../lib/seo";
import { plans } from "../data/pricing";
import { Hero } from "../components/sections/Hero";
import { AvantApres } from "../components/sections/AvantApres";
import { FeaturesGrid } from "../components/sections/FeaturesGrid";
import { WorkspacesTabs } from "../components/sections/WorkspacesTabs";
import { Workflow } from "../components/sections/Workflow";
import { DossierLifecycle } from "../components/sections/DossierLifecycle";
import { SecurityBlock } from "../components/sections/SecurityBlock";
import { PricingPreview } from "../components/sections/PricingPreview";
import { BlogPreview } from "../components/sections/BlogPreview";
import { FaqBlock } from "../components/sections/FaqBlock";
import { FinalCTA } from "../components/sections/FinalCTA";
import { homeFaq } from "../data/faq";
// Phase 4 — Homepage elevation : composition cinématique derrière un flag
// (src/lib/flags.ts). VITE_HOME_CINEMATIC=false rétablit la composition ci-dessous.
import { HOME_CINEMATIC } from "../lib/flags";
import { HomeCinematic } from "../components/landing/HomeCinematic";

// Constructeur commun (src/lib/seo.tsx) : prix publics de src/data/pricing.ts, sans
// « HT » (TVA non applicable, art. 293 B du CGI, CGV) ni catégorie LegalService.
const softwareSchema = softwareApplicationSchema(plans.map((plan) => plan.priceMonthly));

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaq.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: { "@type": "Answer", text: entry.answer },
  })),
};

export function Home() {
  if (HOME_CINEMATIC) return <HomeCinematic />;
  return (
    <>
      <Seo
        title="ClairDossier — Votre dossier juridique, clair, structuré et suivi"
        description="ClairDossier transforme les demandes juridiques en dossiers structurés et suivis. Plateforme legaltech française pour clients, PME et cabinets d'avocats."
        path="/"
        jsonLd={[orgSchema, websiteSchema, softwareSchema, faqSchema]}
      />
      <Hero />
      <AvantApres />
      <FeaturesGrid />
      <WorkspacesTabs />
      <Workflow />
      <DossierLifecycle />
      <SecurityBlock />
      <PricingPreview />
      <BlogPreview />
      <FaqBlock />
      <FinalCTA />
    </>
  );
}
