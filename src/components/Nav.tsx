import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';
import { newDossierHref } from '../lib/cta';

// Journal, Contact, État du produit et parcours dédiés : pied de page.
const NAV_ITEMS = [
  { to: '/fonctionnalites', label: 'Fonctionnalités' },
  { to: '/tarifs', label: 'Tarifs' },
  { to: '/securite', label: 'Sécurité' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(64);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const { session } = useAuth();
  const { key: locationKey } = useLocation();

  useMotionValueEvent(scrollY, 'change', (latest) => setScrolled(latest > 24));

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Toute navigation (logo, même vers la page courante, retour arrière…) referme le menu.
  useEffect(() => setOpen(false), [locationKey]);

  // Ouverture : focus sur le premier lien. Escape : fermeture, focus rendu au bouton du menu.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={`cd-nav-enter sticky top-0 z-40 transition-[background,border-color,box-shadow] duration-300 ${
        scrolled
          ? 'border-b hairline bg-cream-50/92 backdrop-blur-xl shadow-[0_4px_24px_rgba(13,27,61,0.05)]'
          : 'border-b border-transparent bg-cream-50/70 backdrop-blur-md'
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 transition-[padding] duration-300 sm:px-8 lg:px-12 ${
          scrolled ? 'lg:py-2.5' : ''
        }`}
      >
        <Logo />

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-navy-900 bg-cream-100'
                    : 'text-slate-500 hover:text-navy-900 hover:bg-cream-100/70'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {session ? (
            <>
              <Link
                to="/compte"
                className="rounded-full bg-navy-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
              >
                Mon compte
              </Link>
              <Link
                to="/dossier/nouveau"
                className="sheen rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Créer un dossier
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/connexion"
                className="rounded-full px-4 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100"
              >
                Se connecter
              </Link>
              <Link
                to={newDossierHref(false)}
                className="sheen rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Créer un dossier
              </Link>
            </>
          )}
        </div>

        <button
          ref={burgerRef}
          type="button"
          className="ml-auto grid h-11 w-11 place-items-center rounded-md border hairline lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => {
            // Panneau ancré sous la barre réelle (le slogan du logo peut passer sur deux lignes).
            setPanelTop(headerRef.current?.getBoundingClientRect().bottom ?? 64);
            setOpen(!open);
          }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-navy-900">
            {open ? (
              <>
                <line x1="2" y1="2" x2="16" y2="12" />
                <line x1="16" y1="2" x2="2" y2="12" />
              </>
            ) : (
              <>
                <line x1="2" y1="3" x2="16" y2="3" />
                <line x1="2" y1="7" x2="16" y2="7" />
                <line x1="2" y1="11" x2="11" y2="11" />
              </>
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 z-50 bottom-0 lg:hidden"
            style={{ top: panelTop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute inset-0 bg-navy-900/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.nav
              ref={panelRef}
              className="absolute inset-x-0 top-0 overflow-y-auto overscroll-contain bg-cream-50 border-b hairline px-5 py-6 shadow-card"
              // Le flou de la barre fait d'elle le bloc conteneur de ce panneau « fixed » :
              // hauteur maximale calculée sur l'écran, pas sur le parent.
              style={{ maxHeight: `calc(100dvh - ${panelTop}px)` }}
              initial={{ y: '-30%' }}
              animate={{ y: 0 }}
              exit={{ y: '-30%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              id="mobile-menu"
              aria-label="Navigation mobile"
            >
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `rounded-md px-4 py-3 text-base font-medium transition-colors ${
                        isActive ? 'bg-cream-100 text-navy-900' : 'text-slate-500 hover:bg-cream-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t hairline pt-4">
                {session ? (
                  <>
                    <Link
                      to="/compte"
                      onClick={() => setOpen(false)}
                      className="w-full rounded-full bg-navy-900 px-4 py-3 text-center text-sm font-medium text-cream-50"
                    >
                      Mon compte
                    </Link>
                    <Link
                      to="/dossier/nouveau"
                      onClick={() => setOpen(false)}
                      className="sheen w-full rounded-full bg-gold-500 px-4 py-3 text-center text-sm font-semibold text-navy-900"
                    >
                      Créer un dossier
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/connexion"
                      onClick={() => setOpen(false)}
                      className="w-full rounded-full bg-navy-900 px-4 py-3 text-center text-sm font-medium text-cream-50"
                    >
                      Se connecter
                    </Link>
                    <Link
                      to={newDossierHref(false)}
                      onClick={() => setOpen(false)}
                      className="sheen w-full rounded-full bg-gold-500 px-4 py-3 text-center text-sm font-semibold text-navy-900"
                    >
                      Créer un dossier
                    </Link>
                  </>
                )}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
