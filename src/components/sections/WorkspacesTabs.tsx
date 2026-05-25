import { Tabs } from '../ui/Tabs';
import { Reveal } from '../primitives/Reveal';
import { workspaces } from '../../data/workspaces';
import { CheckIcon } from '../icons';

export function WorkspacesTabs() {
  return (
    <Reveal as="section" className="relative isolate overflow-hidden bg-navy-900 text-cream-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(40% 30% at 10% 0%, rgba(196,164,86,0.10), transparent 70%), radial-gradient(50% 40% at 90% 100%, rgba(196,164,86,0.05), transparent 70%)',
        }}
      />
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Espaces dédiés
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-cream-50 sm:text-5xl">
            Un même dossier, trois lectures différentes.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-cream-50/75">
            Chaque acteur du dossier accède aux informations utiles à sa décision —
            jamais plus, jamais moins.
          </p>
        </div>

        <div className="mt-12">
          <Tabs
            defaultId="client"
            items={workspaces.map((w) => ({
              id: w.id,
              label: w.label,
              content: <WorkspacePanel workspace={w} />,
            }))}
          />
        </div>
      </div>
    </Reveal>
  );
}

function WorkspacePanel({ workspace }: { workspace: (typeof workspaces)[number] }) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <h3 className="font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
          {workspace.title}
        </h3>
        <p className="mt-4 text-cream-50/75 leading-relaxed">{workspace.description}</p>
        <ul className="mt-7 space-y-3">
          {workspace.capabilities.map((cap) => (
            <li key={cap} className="flex gap-3 text-sm leading-relaxed text-cream-50/80">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-500/15">
                <CheckIcon width={12} height={12} strokeWidth={2.2} className="text-gold-500" />
              </span>
              {cap}
            </li>
          ))}
        </ul>
      </div>

      {/* Mockup */}
      <div className="rounded-2xl border border-cream-50/15 bg-navy-800/60 p-6 backdrop-blur sm:p-7">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-cream-50/55">
          {workspace.mockup.kicker}
        </p>
        <h4 className="mt-2 font-display text-xl font-semibold leading-tight text-cream-50 sm:text-2xl">
          {workspace.mockup.title}
        </h4>
        <dl className="mt-5 divide-y divide-cream-50/10 border-y border-cream-50/10">
          {workspace.mockup.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <dt className="text-cream-50/60">{row.label}</dt>
              <dd
                className={`text-right font-medium ${
                  row.tone === 'gold' ? 'text-gold-500' : row.tone === 'navy' ? 'text-cream-50' : 'text-cream-50/90'
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {workspace.mockup.footnote && (
          <p className="mt-4 text-[0.75rem] italic text-cream-50/50">
            {workspace.mockup.footnote}
          </p>
        )}
      </div>
    </div>
  );
}
