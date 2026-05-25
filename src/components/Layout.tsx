import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Nav } from './Nav';
import { Footer } from './Footer';

export function Layout() {
  const location = useLocation();

  // Reset scroll on every route change so each page mounts at the top.
  // Legacy two-arg form is guaranteed synchronous and instant on all browsers.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50 text-ink">
      <a className="skip-nav" href="#main">Aller au contenu principal</a>
      <Nav />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
