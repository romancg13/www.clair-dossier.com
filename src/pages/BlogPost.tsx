import { Link, useParams } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import { getPostBySlug, getRelatedPosts, type BlogContentBlock } from '../data/blog';
import { authors } from '../data/authors';
import { ArrowRightIcon } from '../components/icons';
import { NotFound } from './NotFound';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) return <NotFound />;

  const author = authors[post.author];
  const related = getRelatedPosts(post);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'fr-FR',
    author: author
      ? { '@type': 'Person', name: author.name, jobTitle: author.role }
      : { '@type': 'Organization', name: 'ClairDossier' },
    publisher: {
      '@type': 'Organization',
      name: 'ClairDossier',
      logo: { '@type': 'ImageObject', url: 'https://www.clair-dossier.com/favicon.svg' },
    },
    mainEntityOfPage: `https://www.clair-dossier.com/blog/${post.slug}`,
    keywords: post.tags.join(', '),
  };

  const faqSchema = post.faq
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  return (
    <>
      <Seo
        title={post.metaTitle}
        description={post.metaDescription}
        path={`/blog/${post.slug}`}
        type="article"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Accueil', path: '/' },
            { name: 'Journal', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          articleSchema,
          ...(faqSchema ? [faqSchema] : []),
        ]}
      />

      {/* Breadcrumb */}
      <nav aria-label="Fil d'ariane" className="border-b hairline bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 text-xs text-slate-500 sm:px-8 lg:px-12">
          <Link to="/" className="hover:text-navy-900">Accueil</Link>
          <span className="text-slate-300">/</span>
          <Link to="/blog" className="hover:text-navy-900">Journal</Link>
          <span className="text-slate-300">/</span>
          <span className="line-clamp-1 text-navy-900">{post.title}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-3xl px-5 pb-12 pt-16 sm:px-8 lg:px-12">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            {post.category} · {post.readMinutes} min de lecture
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-navy-900 sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-6 font-display text-xl italic leading-relaxed text-navy-700 sm:text-[1.4rem]">
            {post.summary}
          </p>
          {author && (
            <div className="mt-8 flex items-center gap-3 border-t hairline pt-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 font-mono text-sm font-semibold text-gold-500">
                {author.initials}
              </span>
              <div>
                <p className="font-medium text-navy-900">{author.name}</p>
                <p className="text-xs text-slate-500">{author.role}</p>
              </div>
              <span className="ml-auto font-mono text-xs text-slate-400">
                {formatDate(post.date)}
              </span>
            </div>
          )}
        </div>

        {/* Hero image placeholder */}
        <div className="mx-auto max-w-5xl px-5 sm:px-8 lg:px-12">
          <div
            aria-hidden="true"
            className="relative aspect-[21/9] overflow-hidden rounded-2xl"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #0d1b3d 0%, #152348 50%, #1e2c52 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 25% 35%, rgba(196,164,86,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(196,164,86,0.18), transparent 50%)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Body */}
      <Reveal as="article" className="bg-cream-50">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:px-12">
          <div className="drop-cap space-y-5 text-base leading-relaxed text-navy-900 sm:text-[1.06rem]">
            {post.content.map((block, i) => (
              <ContentBlock key={i} block={block} />
            ))}
          </div>

          {/* Takeaways */}
          <aside className="mt-12 rounded-2xl border hairline bg-white p-7 sm:p-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
              À retenir
            </p>
            <ul className="mt-4 space-y-3">
              {post.takeaways.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-navy-900">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                  {t}
                </li>
              ))}
            </ul>
          </aside>

          {/* FAQ inline */}
          {post.faq && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
                Questions liées
              </h2>
              <div className="mt-6 space-y-5 border-t hairline pt-6">
                {post.faq.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-display text-lg font-semibold text-navy-900">{f.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </Reveal>

      {/* Related */}
      {related.length > 0 && (
        <Reveal as="section" className="border-t hairline bg-cream-100/40">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
            <h2 className="font-display text-3xl font-semibold text-navy-900 sm:text-4xl">
              Continuer la lecture.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="group flex flex-col rounded-2xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500"
                >
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-500">
                    {p.category} · {p.readMinutes} min
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-navy-900">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500 line-clamp-3">
                    {p.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
                    Lire
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </>
  );
}

function ContentBlock({ block }: { block: BlogContentBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>;
    case 'h2':
      return (
        <h2 className="mt-12 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 className="mt-8 font-display text-xl italic font-medium leading-tight text-navy-900 sm:text-2xl">
          {block.text}
        </h3>
      );
    case 'quote':
      return (
        <figure className="my-10 border-l-2 border-gold-500 pl-6">
          <blockquote className="font-display text-2xl italic leading-snug text-navy-700 sm:text-[1.65rem]">
            « {block.text} »
          </blockquote>
          {block.cite && (
            <figcaption className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-slate-400">
              — {block.cite}
            </figcaption>
          )}
        </figure>
      );
    case 'list':
      return (
        <ul className="my-6 space-y-3 border-l-2 border-gold-500/40 pl-6">
          {block.items.map((item, i) => (
            <li key={i} className="text-navy-900">
              {item}
            </li>
          ))}
        </ul>
      );
    case 'callout': {
      const tone = block.tone === 'navy';
      return (
        <aside
          className={`my-10 rounded-2xl px-7 py-6 ${
            tone ? 'bg-navy-900 text-cream-50' : 'bg-gold-500/10 text-navy-900'
          }`}
        >
          <p
            className={`font-mono text-[0.7rem] uppercase tracking-[0.18em] ${
              tone ? 'text-gold-500' : 'text-gold-500'
            }`}
          >
            Note
          </p>
          <p className="mt-2 font-display text-lg italic leading-snug sm:text-xl">{block.text}</p>
        </aside>
      );
    }
    default:
      return null;
  }
}
