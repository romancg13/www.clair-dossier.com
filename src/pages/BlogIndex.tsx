import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal, Stagger, StaggerItem } from '../components/primitives/Reveal';
import { blogPosts } from '../data/blog';
import { authors } from '../data/authors';
import { ArrowRightIcon } from '../components/icons';
import { JournalIllustration } from '../components/journal/JournalIllustration';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function BlogIndex() {
  return (
    <>
      <Seo
        title="Journal — conseils pour gérer vos dossiers"
        description="Des conseils simples pour organiser un dossier, conserver les bons documents et protéger vos pièces. Articles pédagogiques, sources officielles citées."
        path="/blog"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Journal', path: '/blog' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Journal ClairDossier',
            url: 'https://www.clair-dossier.com/blog',
            inLanguage: 'fr-FR',
            blogPost: blogPosts.map((p) => ({
              '@type': 'BlogPosting',
              headline: p.title,
              datePublished: p.date,
              url: `https://www.clair-dossier.com/blog/${p.slug}`,
              author: { '@type': 'Person', name: authors[p.author]?.name ?? 'ClairDossier' },
            })),
          },
        ]}
      />

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-12 sm:pt-16 lg:pt-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
              Journal
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-navy-900 sm:text-6xl">
              Des conseils simples pour mieux gérer vos dossiers
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Organiser, conserver, protéger : des repères pratiques rédigés par l'équipe
              ClairDossier à partir des textes officiels cités en sources. Contenus
              pédagogiques, qui ne remplacent pas un conseil personnalisé.
            </p>
          </div>
        </div>
      </section>

      {/* Posts */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto max-w-7xl px-5 pb-14 sm:pb-20 lg:pb-24 sm:px-8 lg:px-12">
          <Stagger inView className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => {
              const author = authors[post.author];
              return (
                <StaggerItem key={post.slug}>
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border hairline bg-white">
                    <Link to={`/blog/${post.slug}`} className="group relative block overflow-hidden" tabIndex={-1} aria-hidden="true">
                      <JournalIllustration kind={post.illustration} className="aspect-[16/6]" />
                      <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-cream-50/95 px-2.5 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-navy-900">
                        {post.category}
                      </span>
                    </Link>

                    <div className="flex flex-1 flex-col p-6">
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                        {post.updated ? `Mis à jour le ${formatDate(post.updated)}` : formatDate(post.date)} · {post.readMinutes} min
                      </p>
                      <h2 className="mt-3 font-display text-xl font-semibold leading-snug text-navy-900 sm:text-2xl">
                        <Link to={`/blog/${post.slug}`} className="hover:text-navy-800">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                        {post.summary}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t hairline pt-4">
                        {author && (
                          <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-900 font-mono text-[0.65rem] font-semibold text-gold-700">
                              {author.initials}
                            </span>
                            {author.name}
                          </span>
                        )}
                        <Link
                          to={`/blog/${post.slug}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 hover:text-gold-700"
                        >
                          Lire
                          <ArrowRightIcon width={14} height={14} strokeWidth={2} />
                        </Link>
                      </div>
                    </div>
                  </article>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </Reveal>
    </>
  );
}
