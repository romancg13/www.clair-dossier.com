/**
 * Borne d'erreur — le filet sous l'atelier entier.
 *
 * Une erreur de rendu ne doit jamais laisser un écran blanc à un avocat en
 * pleine préparation : elle est attrapée, dite, et l'écran propose de
 * recharger. Ce qui est en coffre est scellé à chaque changement — recharger
 * ne perd que ce qui n'a jamais été conservé, et l'écran le dit.
 *
 * Rien n'est transmis nulle part : il n'existe aucun canal pour le faire
 * (B7/B10), l'erreur reste sur ce poste.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Etat = { erreur: Error | null };

export class BorneErreur extends Component<{ children: ReactNode }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo): void {
    // Console locale uniquement — aucune télémétrie n'existe (B10).
    console.error('Defense OS — erreur de rendu :', erreur, info.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-fond p-6">
        <div role="alert" className="w-full max-w-xl rounded-xl border border-alerte/60 bg-surface p-8 shadow-card">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-alerte-clair">
            erreur d’affichage
          </p>
          <h1 className="mt-2 font-display text-xl font-semibold text-encre">
            L’atelier a rencontré une erreur de rendu
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-encre-2">
            L’erreur est restée sur ce poste — il n’existe aucun canal pour la transmettre. Ce qui
            était scellé dans le coffre l’est toujours : recharger ne perd que ce qui n’avait pas
            encore été conservé.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-fond p-3 font-mono text-xs leading-relaxed text-alerte-clair">
            {this.state.erreur.message || String(this.state.erreur)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-laiton px-5 py-2.5 text-sm text-fond transition-colors hover:bg-laiton-clair"
          >
            Recharger l’atelier
          </button>
        </div>
      </div>
    );
  }
}
