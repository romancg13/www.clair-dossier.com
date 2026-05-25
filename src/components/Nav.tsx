import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { to: '/fonctionnalites', label: 'Fonctionnalités' },
  { to: '/tarifs', label: 'Tarifs' },
  { to: '/securite', label: 'Sécurité' },
  { to: '/blog', label: 'Journal' },
  { to: '/contact', label: 'Contact' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => setScrolled(latest > 24));

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background,border-color,box-shadow] duration-300 ${
        scrolled
          ? 'border-b hairline bg-cream-50/92 backdrop-blur-xl shadow-[0_4px_24px_rgba(13,27,61,0.05)]'
          : 'border-b border-transparent bg-cream-50/70 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8 lg:px-12">
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
          <Link
            to="/contact"
            className="rounded-full bg-navy-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
          >
            Demander une démo
          </Link>
          <Link
            to="/dossier/nouveau"
            className="sheen rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Créer un dossier
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center rounded-md border hairline lg:hidden"
          aria-expanded={open}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOpen(!open)}
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
            className="fixed inset-x-0 top-[64px] z-50 bottom-0 lg:hidden"
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
              className="absolute inset-x-0 top-0 bg-cream-50 border-b hairline px-5 py-6 shadow-card"
              initial={{ y: '-30%' }}
              animate={{ y: 0 }}
              exit={{ y: '-30%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
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
                <Link
                  to="/contact"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full bg-navy-900 px-4 py-3 text-center text-sm font-medium text-cream-50"
                >
                  Demander une démo
                </Link>
                <Link
                  to="/dossier/nouveau"
                  onClick={() => setOpen(false)}
                  className="sheen w-full rounded-full bg-gold-500 px-4 py-3 text-center text-sm font-semibold text-navy-900"
                >
                  Créer un dossier
                </Link>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
