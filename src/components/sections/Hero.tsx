import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { MarkerHighlight } from "../primitives/MarkerHighlight";
import { SplitWords } from "../primitives/SplitWords";
import { ArrowRightIcon } from "../icons";

// Données de l'aperçu : uniquement ce que l'application fait réellement
// (cf. DossierDetail : 5 étapes métier, pièces, échéances renseignées, transmission
// déclenchée par l'utilisateur). Aucune fonction non livrée n'est suggérée.
const heroPanelRows = [
  { label: "Étape", value: "Suivi du dossier", tone: "gold" as const },
  { label: "Pièces déposées", value: "7 / 9" },
  { label: "Échéance", value: "affichée sur le dossier" },
  { label: "Transmission", value: "à votre validation", tone: "navy" as const },
];

// Mêmes 5 étapes que la frise « Avancement du dossier » de la page dossier.
const timelineSteps = [
  { state: "done" as const, label: "Création" },
  { state: "done" as const, label: "Contrat" },
  { state: "active" as const, label: "Suivi" },
  { state: "pending" as const, label: "Facture" },
  { state: "pending" as const, label: "Impayé" },
];

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="premium-hero-shell relative isolate overflow-hidden">
      {/* Background subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 80% 0%, rgba(196,164,86,0.10), transparent 60%), radial-gradient(50% 40% at 0% 100%, rgba(13,27,61,0.06), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-12 lg:pb-32 lg:pt-24">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700"
          >
            Legaltech pour PME · artisans · indépendants
          </motion.p>

          <h1 className="mt-5 font-display text-[clamp(2.1rem,7vw,5.4rem)] font-semibold leading-[0.98] tracking-tight text-navy-900 sm:leading-[0.96]">
            <SplitWords
              segments={[
                "Votre",
                "dossier",
                "administratif",
                "et",
                "juridique,",
                { node: <MarkerHighlight delay={0.6}>clair,</MarkerHighlight> },
                {
                  node: (
                    <MarkerHighlight delay={0.85}>structuré</MarkerHighlight>
                  ),
                },
                "et",
                { node: <MarkerHighlight delay={1.1}>suivi.</MarkerHighlight> },
              ]}
              text="Votre dossier administratif et juridique, clair, structuré et suivi."
              stagger={0.06}
              duration={0.85}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg"
          >
            Créez des dossiers administratifs et juridiques structurés : déposez
            vos pièces dans un espace privé, suivez l'avancement et vos
            échéances, puis transmettez quand vous le décidez. Pour les PME,
            artisans, entreprises individuelles et professions libérales.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/dossier/nouveau"
              className="sheen group inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
            >
              Créer un dossier
              <ArrowRightIcon
                width={14}
                height={14}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              to="/contact"
              className="rounded-full bg-navy-900 px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
            >
              Demander une démo
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center gap-2.5"
          >
            <FactPill>Suivi étape par étape</FactPill>
            <FactPill>Pièces chiffrées</FactPill>
            <FactPill>Conçu pour le RGPD</FactPill>
          </motion.div>
        </div>

        {/* Right: preview card */}
        <motion.aside
          aria-label="Aperçu dossier ClairDossier"
          className="relative mt-16 lg:mt-0"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="premium-card premium-preview-card relative rounded-2xl border hairline bg-white p-7 shadow-card"
            animate={reduce ? {} : { y: [0, -6, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: 8, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border hairline-gold bg-gold-500/12 px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-gold-700">
                <span className="h-1 w-1 rounded-full bg-gold-500" />
                Exemple
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-slate-500">
                <span className="grid h-2 w-2 place-items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                </span>
                Actif
              </span>
            </div>

            <div className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Aperçu · exemple de dossier · #CD-2026-0421
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold leading-tight text-navy-900">
                Dossier client — aperçu
              </h2>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold-500/12 px-2.5 py-1 text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                En cours de suivi
              </span>
            </div>

            <dl className="mt-6 divide-y hairline border-y hairline">
              {heroPanelRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd
                    className={`text-right font-medium ${
                      row.tone === "gold"
                        ? "text-gold-700"
                        : row.tone === "navy"
                          ? "text-navy-900"
                          : "text-navy-900"
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Avancement
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                {timelineSteps.map((step, i) => (
                  <div key={i} className="flex flex-1 items-center gap-1.5">
                    {step.state === "done" && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-navy-900"
                        aria-hidden="true"
                      />
                    )}
                    {step.state === "active" && (
                      <motion.span
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500"
                        animate={
                          reduce
                            ? {}
                            : { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }
                        }
                        transition={
                          reduce
                            ? undefined
                            : {
                                duration: 1.8,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }
                        }
                        aria-hidden="true"
                      />
                    )}
                    {step.state === "pending" && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border hairline-strong"
                        aria-hidden="true"
                      />
                    )}
                    {i < timelineSteps.length - 1 && (
                      <span
                        className={`h-px flex-1 ${step.state === "done" ? "bg-navy-900/40" : "bg-slate-300/40"}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              {/* Mobile: étape active uniquement (les labels chevauchent à 360px) */}
              <div className="mt-2 flex items-center justify-between text-[0.7rem] font-mono uppercase tracking-[0.16em] text-slate-500 sm:hidden">
                <span>
                  Étape{" "}
                  {timelineSteps.findIndex((s) => s.state === "active") + 1} /{" "}
                  {timelineSteps.length}
                </span>
                <span className="text-gold-700">
                  {timelineSteps.find((s) => s.state === "active")?.label}
                </span>
              </div>

              {/* Desktop: tous les labels sous chaque point */}
              <div className="mt-2 hidden justify-between text-[0.65rem] font-mono uppercase tracking-[0.14em] text-slate-500 sm:flex">
                {timelineSteps.map((step) => (
                  <span
                    key={step.label}
                    className={step.state === "active" ? "text-gold-700" : ""}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <div
            aria-hidden="true"
            className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-br from-gold-500/15 via-transparent to-navy-900/10 blur-2xl"
          />
        </motion.aside>
      </div>
    </section>
  );
}

function FactPill({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900">
      <span className="h-1 w-1 rounded-full bg-gold-500" />
      {children}
    </span>
  );
}
