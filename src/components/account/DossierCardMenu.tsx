import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { TrashMenuState } from '../../lib/admin';

/**
 * Menu « … » d'une carte dossier (vue administrateur de /compte).
 * Rendu À CÔTÉ du lien de la carte, jamais à l'intérieur (pas de bouton
 * imbriqué dans un <a>). Motif « menu button » : Entrée/Espace/↓ ouvrent,
 * Échap ferme et rend le focus au déclencheur, Tab ou clic extérieur ferment.
 */
export function DossierCardMenu({
  dossierLabel,
  state,
  onDelete,
}: {
  dossierLabel: string;
  state: Exclude<TrashMenuState, { kind: 'hidden' }>;
  /** Reçoit le déclencheur pour y rendre le focus à la fermeture de la confirmation. */
  onDelete: (trigger: HTMLButtonElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRef.current?.focus();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function closeToTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      closeToTrigger();
    } else if (e.key === 'ArrowDown' && !open && e.target === triggerRef.current) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  }

  const disabled = state.kind === 'disabled';

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions pour le dossier « ${dossierLabel} »`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border hairline-strong bg-white text-navy-900 transition-colors hover:border-gold-500 hover:bg-cream-100"
      >
        <span aria-hidden="true" className="text-lg font-semibold leading-none tracking-[0.08em]">
          …
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions — ${dossierLabel}`}
          className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl border hairline bg-white p-1.5 shadow-card-hover"
        >
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            aria-disabled={disabled || undefined}
            onClick={() => {
              if (disabled) return;
              setOpen(false);
              onDelete(triggerRef.current);
            }}
            className={`block w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium ${
              disabled ? 'cursor-not-allowed text-slate-400' : 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50'
            }`}
          >
            <span className="block">Supprimer</span>
            {disabled && (
              <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{state.reason}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
