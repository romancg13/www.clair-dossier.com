import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; /** Affiché à la place du bloc en erreur ; null = rien. */ fallback?: ReactNode };

/**
 * Frontière d'erreur locale : un bloc en erreur (analyse, assistant, alertes) est
 * remplacé par son repli, le reste de la page du dossier (pièces, échéances) reste utilisable.
 */
export class SectionBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    if (import.meta.env.DEV) console.error('[section]', error);
  }

  render(): ReactNode {
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children;
  }
}
