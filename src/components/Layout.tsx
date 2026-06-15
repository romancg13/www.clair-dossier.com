import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Nav } from './Nav';
import { Footer } from './Footer';

export function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Reset scroll + déplacer le focus sur <main> à chaque changement de route
  // (accessibilité SPA : les lecteurs d'écran repartent du contenu principal).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50 text-ink">
      <a className="skip-nav" href="#main">Aller au contenu principal</a>
      <Nav />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
