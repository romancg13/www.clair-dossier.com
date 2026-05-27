import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Seo, breadcrumbSchema } from '../lib/seo';
import { Reveal } from '../components/primitives/Reveal';
import { legalPages, type LegalBlock } from '../data/legal';
import { NotFound } from './NotFound';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function LegalPage({ slug }: { slug: keyof typeof legalPages }) {
  const page = legalPages[slug];
  if (!page) return <NotFound />;

  return (
    <>
      <Seo
        title={page.title}
        description={page.metaDescription}
        path={`/${page.slug}`}
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: page.title, path: `/${page.slug}` },
        ])}
      />

      {/* Breadcrumb */}
      <nav aria-label="Fil d'ariane" className="border-b hairline bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 text-xs text-slate-500 sm:px-8 lg:px-12">
          <Link to="/" className="hover:text-navy-900">Accueil</Link>
          <span className="text-slate-300">/</span>
          <span className="text-navy-900">{page.title}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 pb-10 pt-16 sm:pt-20 lg:pt-24 sm:px-8 lg:px-12">
          <Reveal>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Document légal
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl lg:text-6xl">
              {page.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
              {page.intro}
            </p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
              Dernière mise à jour · {formatDate(page.lastUpdate)}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Body */}
      <Reveal as="section" className="bg-cream-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[260px_1fr] lg:gap-12 lg:px-12">
          {/* Table of contents — desktop sticky */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                Sommaire
              </p>
              <ol className="mt-4 space-y-2.5 text-sm">
                {page.sections.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 text-slate-500 transition-colors hover:text-navy-900"
                    >
                      <span className="font-mono text-[0.7rem] tabular-nums text-slate-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="leading-snug">{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* Sections */}
          <article className="space-y-12">
            {page.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-display text-2xl font-semibold leading-tight text-navy-900 sm:text-3xl">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate-500">
                  {section.blocks.map((block, i) => (
                    <LegalBlockRender key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>
      </Reveal>

      {/* Cross-links to other legal pages */}
      <Reveal as="section" className="border-t hairline bg-cream-100/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16 sm:px-8 lg:px-12">
          <h2 className="font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
            Documents associés
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(legalPages)
              .filter((p) => p.slug !== page.slug)
              .map((p) => (
                <Link
                  key={p.slug}
                  to={`/${p.slug}`}
                  className="group flex flex-col rounded-xl border hairline bg-white p-5 transition-colors hover:border-gold-500"
                >
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-gold-500">
                    Document légal
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold leading-tight text-navy-900 group-hover:text-navy-800">
                    {p.title}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{p.metaDescription}</p>
                </Link>
              ))}
          </div>
          <p className="mt-10 text-sm text-slate-500">
            Une question sur ces documents ou besoin d'une version signée ? Écrivez à{' '}
            <a
              href="mailto:contact@clair-dossier.com"
              className="border-b hairline-gold text-navy-900 hover:text-gold-500"
            >
              contact@clair-dossier.com
            </a>
            .
          </p>
        </div>
      </Reveal>
    </>
  );
}

// URLs (http/https) and emails — turn them into clickable links
// when they appear inside a legal text block.
const URL_RE = /\b(https?:\/\/[^\s,)]+[a-zA-Z0-9\/])|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

function renderTextWithLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    const matched = match[0];
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const href = matched.includes('@') && !matched.startsWith('http') ? `mailto:${matched}` : matched;
    const isExternal = !matched.includes('@');
    parts.push(
      <a
        key={`${match.index}-${matched}`}
        href={href}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="border-b hairline-gold text-navy-900 transition-colors hover:text-gold-500"
      >
        {matched}
      </a>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function LegalBlockRender({ block }: { block: LegalBlock }) {
  if (block.type === 'p') {
    return <p>{renderTextWithLinks(block.text)}</p>;
  }
  if (block.type === 'h3') {
    return (
      <h3 className="mt-6 font-display text-lg italic font-medium leading-tight text-navy-900 sm:text-xl">
        {block.text}
      </h3>
    );
  }
  return (
    <ul className="space-y-2 border-l-2 border-gold-500/40 pl-5">
      {block.items.map((item, i) => (
        <li key={i} className="text-navy-900">
          {renderTextWithLinks(item)}
        </li>
      ))}
    </ul>
  );
}
