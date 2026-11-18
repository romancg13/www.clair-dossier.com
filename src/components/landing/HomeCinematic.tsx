import { Link } from 'react-router-dom';
import { homeFaq, type FaqEntry } from '../../data/faq';
import { FaqBlock } from '../sections/FaqBlock';
import { Seo, orgSchema, websiteSchema } from '../../lib/seo';
import { HeroCinematic } from './HeroCinematic';
import { OffreClairNova } from './OffreClairNova';

const previewQuestions: FaqEntry[] = [
  { id: 'pieces-recette', question: 'Quelles pièces utiliser dans la démo ?', answer: 'Utilisez le jeu de pièces fictives proposé dans le dossier de recette. Gardez vos documents personnels et professionnels dans votre espace habituel.' },
  { id: 'paiement-recette', question: 'Faut-il payer pour essayer ?', answer: 'La recette utilise des profils de test. Vous pouvez comparer les sept formules et essayer le parcours abonné sans effectuer de paiement.' },
  { id: 'envoi-recette', question: 'Qui envoie les courriers et les relances ?', answer: 'Vous choisissez le destinataire et relisez le brouillon. La démonstration conserve les projets dans le dossier et ne transmet aucun message à un tiers.' },
];
const faq = import.meta.env.VITE_DEMO === '1'
  ? previewQuestions
  : homeFaq.filter((entry) => ['donnees-securisees', 'refus-avocat', 'obligation-avocat', 'export-possible'].includes(entry.id));

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  })),
};

export function HomeCinematic() {
  return (
    <>
      <Seo
        title="ClairDossier — Vos pièces, vos dates et votre prochaine action"
        description="Retrouvez vos pièces dans un dossier privé. Un exemple fictif vous montre la synthèse, la source d’une échéance et votre prochaine action."
        path="/"
        jsonLd={[orgSchema, websiteSchema, faqSchema]}
      />
      <OffreClairNova />
      <HeroCinematic />
      <nav aria-label="Découvrir ClairDossier" className="border-t hairline bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 px-5 py-4 text-sm font-medium text-navy-900 sm:px-8 lg:px-12">
          <Link id="tarifs" to="/tarifs" className="inline-flex min-h-11 items-center hover:underline">Comparer les formules</Link>
          <Link to="/fonctionnalites" className="inline-flex min-h-11 items-center hover:underline">Explorer les fonctionnalités</Link>
          <Link to="/securite" className="inline-flex min-h-11 items-center hover:underline">Protection des pièces</Link>
          <Link to="/rendez-vous" className="inline-flex min-h-11 items-center hover:underline">Demander une démonstration</Link>
        </div>
      </nav>
      <FaqBlock entries={faq} />
    </>
  );
}
