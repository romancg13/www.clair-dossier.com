import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erreur React globale ClairDossier', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main id="main-content">
        <section className="section-block centered">
          <p className="eyebrow">ClairDossier</p>
          <h1>Le site rencontre une erreur temporaire.</h1>
          <p className="notice">
            La page publique reste accessible. Rechargez la page ou revenez a l'accueil.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              Recharger
            </button>
            <a className="secondary-button" href="/">
              Retour a l'accueil
            </a>
          </div>
        </section>
      </main>
    );
  }
}
