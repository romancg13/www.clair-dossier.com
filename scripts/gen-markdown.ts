/**
 * Génère une version .md de chaque page importante du site, à partir des
 * mêmes data files que ceux utilisés par les composants React.
 *
 * Pourquoi : les crawlers IA (Perplexity, ChatGPT, Claude, etc.) préfèrent
 * du markdown brut au HTML+JS. Plus les contenus sont propres et linkés,
 * plus le site est cité correctement dans les réponses génératives.
 *
 * Usage :  npm run gen:md
 * Auto :   inclus dans npm run build avant tsc/vite.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blogPosts } from '../src/data/blog/index';
import type { BlogContentBlock, BlogPost } from '../src/data/blog/types';
import { homeFaq } from '../src/data/faq';
import { features, type Feature } from '../src/data/features';
import { legalPages, type LegalPage } from '../src/data/legal';
import {
  COMPARISON_FEATURES,
  TRUST_PILLARS,
  plans,
  type Plan,
} from '../src/data/pricing';
import { statuses } from '../src/data/statuses';
import {
  TRUST_UPDATED,
  openTodos,
  retentionRows,
  securityChangelog,
  subprocessors,
} from '../src/data/trust';
import { workspaces } from '../src/data/workspaces';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const SITE = 'https://www.clair-dossier.com';

function write(rel: string, body: string): void {
  const full = join(PUBLIC_DIR, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body.trim() + '\n', 'utf-8');
}

function footer(path: string): string {
  return [
    '',
    '---',
    '',
    `*Source : ${SITE}${path} — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE.*`,
    '',
    '*Citation suggérée : « ClairDossier, [titre de la page], ' + SITE + path + ' ».*',
  ].join('\n');
}

// ─── Home ──────────────────────────────────────────────────────────
function generateHome(): void {
  const lines: string[] = [
    '---',
    'title: "ClairDossier — Votre dossier administratif et juridique, clair, structuré et suivi"',
    'description: "Plateforme legaltech française pour les PME, artisans, entreprises individuelles et professions libérales."',
    `url: ${SITE}/`,
    '---',
    '',
    '# ClairDossier',
    '',
    '**Votre dossier administratif et juridique, clair, structuré et suivi.**',
    '',
    "Créez des dossiers administratifs et juridiques structurés : calendrier, relances à échéance et projets de réponse aux e-mails. Pour les PME, artisans, entreprises individuelles et professions libérales. Option : un préavis juridique et un résumé de la situation à valider par un professionnel du droit.",
    '',
    '## Promesse',
    '',
    '- 6 statuts dossier standardisés et traçables',
    '- Calendrier et relances automatiques à échéance',
    '- 100 % conforme RGPD — hébergement OVH France',
    '',
    '## Trois espaces, un dossier',
    '',
  ];

  for (const w of workspaces) {
    lines.push(`### ${w.label} — ${w.title}`);
    lines.push('');
    lines.push(w.description);
    lines.push('');
    for (const cap of w.capabilities) lines.push(`- ${cap}`);
    lines.push('');
  }

  lines.push('## Workflow — 6 statuts');
  lines.push('');
  statuses.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.label}** — ${s.description}`);
  });
  lines.push('');

  lines.push('## Fonctionnalités');
  lines.push('');
  for (const f of features) {
    lines.push(`- [**${f.shortTitle}**](${SITE}/fonctionnalites/${f.slug}) — ${f.blurb}`);
  }
  lines.push('');

  lines.push('## Tarifs');
  lines.push('');
  for (const p of plans) {
    const price =
      p.priceMonthly === 0
        ? 'Gratuit'
        : p.priceMonthly === null
          ? 'Sur devis'
          : `${p.priceMonthly} €/mois HT`;
    lines.push(`- **${p.name}** (${p.audience}) — ${price}. ${p.description}`);
  }
  lines.push('');
  lines.push(
    'Facturation annuelle disponible sur tous les plans payants avec 10 % de réduction sur le cumul mensuel.'
  );
  lines.push('');
  lines.push(`Détail complet : ${SITE}/tarifs`);
  lines.push('');

  lines.push('## Questions fréquentes');
  lines.push('');
  for (const q of homeFaq) {
    lines.push(`### ${q.question}`);
    lines.push('');
    lines.push(q.answer);
    lines.push('');
  }

  lines.push('## Contact');
  lines.push('');
  lines.push('- Téléphone et WhatsApp : 07 82 98 36 44 (réponse en moyenne sous 1 h en journée)');
  lines.push('- Email : contact.clairdossier@icloud.com (réponse sous 24 h ouvrées)');
  lines.push('- Sécurité (divulgation responsable) : contact.clairdossier@icloud.com');
  lines.push(`- Formulaire : ${SITE}/contact`);
  lines.push(footer('/'));

  write('index.md', lines.join('\n'));
  // /page.md alias for discoverability
  write('page.md', lines.join('\n'));
}

// ─── Blog ──────────────────────────────────────────────────────────
function renderBlogContent(blocks: BlogContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'p') return b.text;
      if (b.type === 'h2') return `## ${b.text}`;
      if (b.type === 'h3') return `### ${b.text}`;
      if (b.type === 'quote') {
        const cite = b.cite ? `\n>\n> — *${b.cite}*` : '';
        return `> « ${b.text} »${cite}`;
      }
      if (b.type === 'list') return b.items.map((i) => `- ${i}`).join('\n');
      if (b.type === 'callout') return `> **Note —** ${b.text}`;
      return '';
    })
    .join('\n\n');
}

function generateBlogPost(p: BlogPost): void {
  const path = `/blog/${p.slug}`;
  const lines: string[] = [
    '---',
    `title: "${p.title.replace(/"/g, '\\"')}"`,
    `description: "${p.metaDescription.replace(/"/g, '\\"')}"`,
    `date: ${p.date}`,
    'author: Rédaction ClairDossier',
    `category: ${p.category}`,
    `readMinutes: ${p.readMinutes}`,
    `url: ${SITE}${path}`,
    '---',
    '',
    `# ${p.title}`,
    '',
    `*Publié le ${new Date(p.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} — ${p.readMinutes} min de lecture — catégorie : ${p.category}*`,
    '',
    `**Résumé.** ${p.summary}`,
    '',
    renderBlogContent(p.content),
    '',
    '## À retenir',
    '',
    p.takeaways.map((t) => `- ${t}`).join('\n'),
  ];

  if (p.faq?.length) {
    lines.push('');
    lines.push('## Questions liées');
    lines.push('');
    for (const item of p.faq) {
      lines.push(`### ${item.q}`);
      lines.push('');
      lines.push(item.a);
      lines.push('');
    }
  }

  if (p.howTo) {
    lines.push('## Méthode étape par étape');
    lines.push('');
    lines.push(`_${p.howTo.description}_`);
    if (p.howTo.totalTime) {
      const minutes = p.howTo.totalTime.replace(/^PT(\d+)M$/, '$1');
      lines.push('');
      lines.push(`Temps estimé : ${minutes} minutes.`);
    }
    lines.push('');
    p.howTo.steps.forEach((s, i) => {
      lines.push(`${i + 1}. **${s.name}.** ${s.text}`);
    });
    lines.push('');
  }

  if (p.relatedSlugs?.length) {
    lines.push('## Articles liés');
    lines.push('');
    for (const slug of p.relatedSlugs) {
      const related = blogPosts.find((b) => b.slug === slug);
      if (related) lines.push(`- [${related.title}](${SITE}/blog/${slug})`);
    }
    lines.push('');
  }

  lines.push(footer(path));
  write(`blog/${p.slug}.md`, lines.join('\n'));
}

function generateBlogIndex(): void {
  const lines: string[] = [
    '---',
    'title: "Journal ClairDossier"',
    'description: "Articles juridiques pédagogiques : méthode, procédure, conformité, résolution de conflit."',
    `url: ${SITE}/blog`,
    '---',
    '',
    '# Journal ClairDossier',
    '',
    "Articles écrits par la rédaction ClairDossier, relus par des avocats. Pédagogie, sans conseil personnalisé.",
    '',
    '## Articles publiés',
    '',
  ];
  for (const p of blogPosts) {
    lines.push(`### ${p.title}`);
    lines.push('');
    lines.push(
      `*${new Date(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — ${p.readMinutes} min — ${p.category}*`
    );
    lines.push('');
    lines.push(p.summary);
    lines.push('');
    lines.push(`Lire : ${SITE}/blog/${p.slug} · Markdown : ${SITE}/blog/${p.slug}.md`);
    lines.push('');
  }
  lines.push(footer('/blog'));
  write('blog/index.md', lines.join('\n'));
}

// ─── Features ──────────────────────────────────────────────────────
function generateFeature(f: Feature): void {
  const path = `/fonctionnalites/${f.slug}`;
  const lines: string[] = [
    '---',
    `title: "${f.title.replace(/"/g, '\\"')}"`,
    `description: "${f.blurb.replace(/"/g, '\\"')}"`,
    `url: ${SITE}${path}`,
    '---',
    '',
    `# ${f.title}`,
    '',
    `**${f.hero}**`,
    '',
    f.body.join('\n\n'),
    '',
    '## Concrètement',
    '',
    f.bullets.map((b) => `- ${b}`).join('\n'),
    '',
    footer(path),
  ];
  write(`fonctionnalites/${f.slug}.md`, lines.join('\n'));
}

function generateFeaturesIndex(): void {
  const lines: string[] = [
    '---',
    'title: "Fonctionnalités ClairDossier"',
    'description: "Neuf fonctionnalités pour structurer, suivre et traiter vos dossiers administratifs et juridiques."',
    `url: ${SITE}/fonctionnalites`,
    '---',
    '',
    '# Fonctionnalités ClairDossier',
    '',
    "Neuf briques conçues à partir de points de friction identifiés dans des dossiers réels.",
    '',
  ];
  for (const f of features) {
    lines.push(`## ${f.title}`);
    lines.push('');
    lines.push(f.blurb);
    lines.push('');
    lines.push(`Détail : ${SITE}/fonctionnalites/${f.slug} · Markdown : ${SITE}/fonctionnalites/${f.slug}.md`);
    lines.push('');
  }
  lines.push(footer('/fonctionnalites'));
  write('fonctionnalites/index.md', lines.join('\n'));
}

// ─── Pricing ───────────────────────────────────────────────────────
function generatePricing(): void {
  const lines: string[] = [
    '---',
    'title: "Tarifs ClairDossier"',
    'description: "Sept formules, de l\'indépendant à l\'entreprise : Essentiel 19€, Entrepreneur 39€, Business PME 20 (49€), Business PME 50 (89€), Pro 169€, Premium 299€, et offre sur-mesure."',
    `url: ${SITE}/tarifs`,
    '---',
    '',
    '# Tarifs ClairDossier',
    '',
    "De l'indépendant à l'entreprise — sept niveaux de service couvrent tous les usages. Compte gratuit, abonnement sans engagement. Facturation mensuelle ou annuelle (−10 % en annuel).",
    '',
    '## Les sept formules',
    '',
  ];

  const euroFr = (n: number) =>
    n.toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €';

  for (const p of plans) {
    const price =
      p.priceMonthly === 0
        ? 'Gratuit'
        : p.priceMonthly === null
          ? 'Sur devis'
          : `${p.priceMonthly} € HT/mois`;
    const variant = p.variant === 'dark' ? ' (mis en avant)' : '';
    lines.push(`### ${p.name}${variant} — ${price}`);
    lines.push('');
    lines.push(`*${p.audience}.* ${p.description}`);
    lines.push('');
    if (p.priceMonthly !== null && p.priceMonthly > 0) {
      lines.push(
        `Facturation annuelle : ${euroFr(p.priceMonthly * 12 * 0.9)} HT/an, soit ${euroFr(p.priceMonthly * 0.9)} HT/mois (−10 %).`
      );
      lines.push('');
    }
    lines.push(`- **Dossiers** : ${p.specs.dossiers}`);
    lines.push(`- **Utilisateurs** : ${p.specs.users}`);
    lines.push(`- **Support** : ${p.specs.support}`);
    lines.push('');
    lines.push('Fonctionnalités incluses :');
    for (const feat of COMPARISON_FEATURES) {
      const status = p.features[feat.id];
      const mark = status === 'yes' ? '✓' : status === 'limited' ? 'limité' : '✗';
      lines.push(`- ${feat.label} : ${mark}`);
    }
    lines.push('');
  }

  lines.push('## Devis sur-mesure');
  lines.push('');
  lines.push(
    'Pour structures avec exigences de marque blanche, intégration API, SSO, audit dédié, ou volumétrie au-dessus du Premium — proposition chiffrée sous 48 h. Contact : contact.clairdossier@icloud.com ou téléphone / WhatsApp 07 82 98 36 44.'
  );
  lines.push('');

  lines.push('## Engagement');
  lines.push('');
  for (const t of TRUST_PILLARS) {
    lines.push(`- **${t.title}.** ${t.body}`);
  }
  lines.push('');

  lines.push(footer('/tarifs'));
  write('tarifs.md', lines.join('\n'));
}

// ─── Sécurité — centre de confiance ────────────────────────────────
// Généré depuis src/data/trust.ts : mêmes données que la page /securite.
// Règle : rien d'invérifiable — les éléments en attente sont marqués
// « À CONFIRMER », jamais comblés par une formulation vague.
function generateSecurity(): void {
  const path = '/securite';
  const lines: string[] = [
    '---',
    'title: "Sécurité & centre de confiance ClairDossier"',
    'description: "Sous-traitants nommés, localisation et durées de conservation, secret professionnel, continuité, DPA sur demande, journal daté des changements de sécurité."',
    `lastUpdate: ${TRUST_UPDATED}`,
    `url: ${SITE}${path}`,
    '---',
    '',
    '# Sécurité & centre de confiance',
    '',
    "Ce centre de confiance expose ce que nous faisons concrètement : chiffrement, isolation par utilisateur, sous-traitants nommés, durées de conservation et journal des changements. Ce que nous ne pouvons pas encore prouver est marqué « À CONFIRMER » — jamais maquillé.",
    '',
    `*Dernière mise à jour : ${TRUST_UPDATED}*`,
    '',
    '## Ce qui est en place',
    '',
    '- Connexion chiffrée (HTTPS) entre le navigateur et l\'application ; données chiffrées au repos côté hébergeur.',
    '- Isolation des données par utilisateur appliquée en base (Row Level Security) — y compris pour le stockage des pièces (bucket privé, liens signés temporaires).',
    "- Accès à l'espace par authentification (compte confirmé par e-mail) ; consultation support limitée à un administrateur unique.",
    "- Aucune lecture, extraction ou analyse automatique des documents déposés — engagement contractuel (CGV).",
    "- Transmission d'un dossier uniquement sur action explicite de l'utilisateur (e-mail ou WhatsApp).",
    '',
    '## Sous-traitants',
    '',
  ];

  for (const s of subprocessors) {
    lines.push(`### ${s.name}`);
    lines.push('');
    lines.push(`- **Finalité** : ${s.finalite}`);
    lines.push(`- **Données** : ${s.donnees}`);
    lines.push(`- **Localisation** : ${s.localisation}${s.localisationTodo ? ' *(À CONFIRMER)*' : ''}`);
    lines.push(`- **Conservation** : ${s.retention}`);
    lines.push(`- **DPA** : ${s.dpa}${s.dpaTodo ? ' *(À CONFIRMER)*' : ''}`);
    lines.push('');
  }

  lines.push('## Durées de conservation (politique publiée)');
  lines.push('');
  for (const r of retentionRows) {
    lines.push(`- **${r.label}** : ${r.value}`);
  }
  lines.push('');
  lines.push('## Secret professionnel');
  lines.push('');
  lines.push(
    "Aucune lecture automatique des pièces (engagement contractuel, CGV). Cloisonnement entre comptes appliqué en base, pas seulement dans l'interface. Rien ne sort de l'espace d'un utilisateur sans son action explicite ; le professionnel destinataire, choisi par l'utilisateur, reste responsable de son propre cadre déontologique. Accès support limité à un administrateur unique et identifié."
  );
  lines.push('');
  lines.push('## Sauvegarde, restauration & incident');
  lines.push('');
  lines.push("- Sauvegardes automatiques de la base par l'hébergeur ; fréquence et profondeur exactes selon le plan souscrit *(À CONFIRMER)*.");
  lines.push("- Test de restauration documenté et daté : à publier au journal *(À CONFIRMER)*.");
  lines.push("- Incident : notification CNIL sous 72 h et information des personnes en cas de risque élevé (RGPD art. 33-34). Procédure écrite détaillée *(À CONFIRMER)*.");
  lines.push('');
  lines.push('## DPA');
  lines.push('');
  lines.push(
    "Le DPA s'obtient sans formulaire : demande par e-mail à contact.clairdossier@icloud.com, envoi sous 24 h ouvrées. Téléchargement direct depuis la page /securite en préparation *(À CONFIRMER)*."
  );
  lines.push('');
  lines.push('## Journal des changements de sécurité');
  lines.push('');
  for (const c of securityChangelog) {
    lines.push(`- **${c.date}** — ${c.entry}`);
  }
  lines.push('');
  lines.push('## En attente de vérification (affiché tel quel)');
  lines.push('');
  for (const t of openTodos) {
    lines.push(`- À CONFIRMER : ${t}`);
  }
  lines.push('');
  lines.push('## Divulgation responsable');
  lines.push('');
  lines.push(
    'Vulnérabilités à signaler à contact.clairdossier@icloud.com — réponse sous 24 h ouvrées. Aucune action en justice contre les chercheurs de bonne foi qui respectent une démarche responsable.'
  );
  lines.push('');
  lines.push(footer(path));
  write('securite.md', lines.join('\n'));
}

// ─── Contact ───────────────────────────────────────────────────────
function generateContact(): void {
  const path = '/contact';
  const lines: string[] = [
    '---',
    'title: "Contacter ClairDossier"',
    'description: "WhatsApp, email, formulaire guidé. Réponse en moyenne sous 1 h en journée."',
    `url: ${SITE}${path}`,
    '---',
    '',
    '# Contact',
    '',
    'Pas de formulaire en file d\'attente, pas de tickets perdus. Vous écrivez, on lit, on répond — directement sur WhatsApp.',
    '',
    '## Canaux',
    '',
    '- **Téléphone et WhatsApp** : 07 82 98 36 44 — réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi).',
    '- **Email général** : contact.clairdossier@icloud.com — réponse sous 24 h ouvrées.',
    '- **Sécurité (divulgation responsable)** : contact.clairdossier@icloud.com — réponse sous 24 h.',
    `- **Formulaire guidé** : ${SITE}/contact`,
    '',
    '## Coordonnées de l\'éditeur',
    '',
    'Roman Gomes — entrepreneur individuel — SIREN 105 490 734 — Château-Gombert, 13013 Marseille, France.',
    '',
    'Site réalisé et développé par Nouh BENZIDANE — https://nouhbenzidane.fr.',
    '',
    footer(path),
  ];
  write('contact.md', lines.join('\n'));
}

// ─── Legal ─────────────────────────────────────────────────────────
function generateLegal(p: LegalPage): void {
  const path = `/${p.slug}`;
  const lines: string[] = [
    '---',
    `title: "${p.title}"`,
    `description: "${p.metaDescription.replace(/"/g, '\\"')}"`,
    `lastUpdate: ${p.lastUpdate}`,
    `url: ${SITE}${path}`,
    '---',
    '',
    `# ${p.title}`,
    '',
    `*Dernière mise à jour : ${new Date(p.lastUpdate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}*`,
    '',
    p.intro,
    '',
  ];

  for (const section of p.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const block of section.blocks) {
      if (block.type === 'p') lines.push(block.text);
      if (block.type === 'h3') lines.push(`### ${block.text}`);
      if (block.type === 'list') lines.push(block.items.map((i) => `- ${i}`).join('\n'));
      lines.push('');
    }
  }

  lines.push(footer(path));
  write(`${p.slug}.md`, lines.join('\n'));
}

// ─── Run ───────────────────────────────────────────────────────────
function main(): void {
  console.log('Generating markdown for AI crawlers...');

  generateHome();
  generateBlogIndex();
  for (const p of blogPosts) generateBlogPost(p);
  generateFeaturesIndex();
  for (const f of features) generateFeature(f);
  generatePricing();
  generateSecurity();
  generateContact();
  for (const slug of Object.keys(legalPages)) {
    generateLegal(legalPages[slug]);
  }

  const count =
    /* home */ 2 +
    /* blog index + posts */ 1 +
    blogPosts.length +
    /* features index + items */ 1 +
    features.length +
    /* tarifs */ 1 +
    /* securite */ 1 +
    /* contact */ 1 +
    /* legal */ Object.keys(legalPages).length;
  console.log(`Wrote ${count} markdown files into public/.`);
}

main();
