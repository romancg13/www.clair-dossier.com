import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { blogPosts } from '../../data/blog';
import { ArrowRightIcon } from '../icons';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function BlogPreview() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
              Journal
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Trois lectures pour comprendre où on se situe.
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
          >
            Tout le journal
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
        </div>

        <Stagger inView className="mt-12 grid gap-5 md:grid-cols-3">
          {blogPosts.map((post) => (
            <StaggerItem key={post.slug}>
              <Link
                to={`/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border hairline bg-white transition-colors duration-300 hover:border-gold-500"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-cream-100">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, #152348 0%, #1e2c52 50%, #2a3960 100%)',
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 30% 30%, rgba(196,164,86,0.3), transparent 60%), radial-gradient(circle at 80% 70%, rgba(196,164,86,0.15), transparent 50%)',
                    }}
                  />
                  <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-cream-50/95 px-2.5 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-navy-900">
                    {post.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                    {formatDate(post.date)} · {post.readMinutes} min de lecture
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-navy-900 transition-colors group-hover:text-navy-800 sm:text-2xl">
                    {post.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                    {post.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900">
                    Lire l'article
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}
