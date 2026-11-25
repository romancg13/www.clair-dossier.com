// Accueil « clarté » (drapeau VITE_HOME_CLARTE) : une promesse, une phrase, un
// bouton principal ; un seul avant/après fictif ; trois résultats concrets.
// Identité conservée (logo, marine, champagne, Cormorant/Inter), bandeau ClairNova conservé.
import { Link } from 'react-router-dom';
import { Seo, orgSchema, websiteSchema } from '../../lib/seo';
import { OffreClairNova } from '../landing/OffreClairNova';
import { Reveal } from '../primitives/Reveal';

const PIECES = [
  { n: 'Courrier du gestionnaire', f: 'PDF · 2 pages' },
  { n: 'Avis d’échéance', f: 'scan' },
  { n: 'Relevé de charges 2025', f: 'tableur' },
  { n: 'Votre courriel de réponse', f: 'e-mail' },
];

export function HomeClarte() {
  return (
    <>
      <Seo title="ClairDossier — déposez vos pièces, sachez quoi faire" description="Déposez vos pièces : un résumé, vos dates importantes et votre prochaine action, dans votre espace ClairDossier." path="/" jsonLd={[orgSchema, websiteSchema]} />
      <OffreClairNova />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Entreprises, indépendants et cabinets</p>
          <h1 className="mt-4 max-w-3xl font-display text-[44px] leading-[1.02] text-navy-900 sm:text-[64px]">Déposez vos pièces. Sachez quoi faire ensuite.</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-slate-500 sm:text-[20px]">Un résumé, vos dates importantes et votre prochaine action, dans votre espace.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/tarifs" className="inline-flex min-h-12 items-center justify-center rounded-full bg-navy-900 px-7 text-[16px] font-semibold text-white transition hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">Choisir une formule</Link>
            <a href="#exemple" className="inline-flex min-h-12 items-center justify-center px-2 text-[16px] text-navy-900 underline decoration-gold-500 underline-offset-4">Voir un exemple</a>
          </div>
        </div>
      </section>

      <section id="exemple" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Exemple fictif</p>
          <h2 className="mt-2 font-display text-[32px] leading-tight text-navy-900 sm:text-[40px]">Avant, quatre pièces. Après, une décision.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-cream-200 bg-cream-50 p-5">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Avant</p>
                <ul className="mt-4 space-y-2">
                  {PIECES.map((p) => (
                    <li key={p.n} className="flex items-center justify-between rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-navy-900">
                      <span>{p.n}</span>
                      <span className="text-[12.5px] text-slate-500">{p.f}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[14px] text-slate-500">Un montant, une date limite et une pièce manquante, répartis entre quatre documents.</p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-2xl border border-navy-900/10 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(13,27,61,0.35)]">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Après</p>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-800 ring-1 ring-emerald-200">Résultats disponibles</span>
                </div>
                <p className="mt-4 text-[16.5px] leading-relaxed text-navy-900">Au 18 novembre 2026, le gestionnaire réclame 3 480,00 € de charges 2025. Le relevé joint indique 3 210,00 € ; réponse attendue avant le 15 janvier 2027.</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 pt-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Prochaine action</p>
                    <p className="mt-1 text-[15px] font-semibold text-navy-900">Joindre le bail</p>
                  </div>
                  <p className="text-[13px] text-slate-500">15 janvier 2027 · date confirmée<br />source : courrier, p. 1</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-cream-50">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            { t: 'Une situation claire', d: 'Deux phrases datées : ce qui est réclamé, ce qui ne concorde pas.' },
            { t: 'Vos dates, sourcées', d: 'Chaque échéance renvoie à sa pièce et à sa page ; l’incertain reste « à confirmer ».' },
            { t: 'Votre prochaine action', d: 'Un seul geste à la fois, ou « rien à faire pour le moment ».' },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-cream-200 bg-white p-5">
              <h3 className="font-display text-[22px] text-navy-900">{x.t}</h3>
              <p className="mt-2 text-[15px] text-slate-500">{x.d}</p>
            </div>
          ))}
          <p className="text-[14px] text-slate-500 sm:col-span-3">
            <Link to="/fonctionnalites" className="underline decoration-gold-500 underline-offset-4">Toutes les fonctionnalités</Link> · <Link to="/securite" className="underline decoration-gold-500 underline-offset-4">Sécurité et confidentialité</Link> · <Link to="/etat-du-produit" className="underline decoration-gold-500 underline-offset-4">État du produit</Link>
          </p>
        </div>
      </section>

      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="font-display text-[30px] leading-tight text-cream-50 sm:text-[36px]">Vos pièces, une fois. La suite, au clair.</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/tarifs" className="inline-flex min-h-12 items-center rounded-full bg-gold-500 px-7 text-[16px] font-semibold text-navy-900 transition hover:bg-gold-400">Choisir une formule</Link>
            <Link to="/connexion" className="inline-flex min-h-12 items-center px-2 text-[15px] text-cream-50 underline decoration-gold-500 underline-offset-4">Se connecter</Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function TroisResultats() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6">
        {[
          { t: 'Une situation en deux phrases', d: 'Datée, sourcée, sans jargon.' },
          { t: 'Vos dates et leur source', d: 'Confirmées ou à confirmer, calendrier compris.' },
          { t: 'Une prochaine action', d: 'Pour vous, votre cabinet ou personne.' },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
            <h2 className="font-display text-[22px] text-navy-900">{x.t}</h2>
            <p className="mt-2 text-[15px] text-slate-500">{x.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
