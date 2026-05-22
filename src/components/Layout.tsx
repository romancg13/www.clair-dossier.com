import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { cabinetNav, clientNav, footerBadges, legalLinks, productLinks, publicNav, resourceLinks, site, warnings } from '../data/site';
import { supabase } from '../lib/supabase';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

const COOKIE_KEY = 'cd_cookie_consent';
type UserRole = 'client' | 'lawyer' | 'cabinet_admin' | 'admin';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('client');
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    async function applySession(session: Session | null) {
      if (!active) return;
      setCurrentUserEmail(session?.user.email || '');
      if (!session) {
        setUserRole('client');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Impossible de récupérer le rôle utilisateur', error);
      }
      if (active) setUserRole((data?.role as UserRole | undefined) || 'client');
    }

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.error('Impossible de récupérer la session Supabase', error);
        void applySession(data.session);
      })
      .catch((error: unknown) => console.error('Erreur session Supabase', error));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) setShowCookies(true);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const acceptCookies = useCallback(() => {
    try { localStorage.setItem(COOKIE_KEY, 'accepted'); } catch { /* noop */ }
    setShowCookies(false);
  }, []);

  const refuseCookies = useCallback(() => {
    try { localStorage.setItem(COOKIE_KEY, 'refused'); } catch { /* noop */ }
    setShowCookies(false);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const skipToContent = useCallback(() => {
    document.getElementById('main-content')?.focus();
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erreur déconnexion Supabase', error);
      window.alert("La déconnexion n'a pas pu être finalisée. Réessayez dans quelques instants.");
      return;
    }
    setCurrentUserEmail('');
    setUserRole('client');
  }, []);

  const workspaceNav = userRole === 'lawyer' || userRole === 'cabinet_admin' || userRole === 'admin' ? cabinetNav : clientNav;

  return (
    <div className="app-shell">
      <button className="skip-nav" type="button" onClick={skipToContent}>Aller au contenu principal</button>

      <header className="site-header">
        <Link className="brand" to="/" aria-label="Accueil ClairDossier">
          <span className="brand-mark">CD</span>
          <span>
            <strong>{site.name}</strong>
            <small>{site.slogan}</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Navigation principale">
          {publicNav.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>{item.label}</NavLink>
          ))}
          {currentUserEmail && workspaceNav.slice(0, 3).map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>{item.label}</NavLink>
          ))}
        </nav>

        <div className="header-actions">
          {currentUserEmail ? (
            <>
              <Link className="ghost-button" to={workspaceNav[0].path}>Mon espace</Link>
              <button className="ghost-button" type="button" onClick={signOut}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link className="ghost-button" to="/connexion">Connexion</Link>
              <Link className="secondary-button" to="/inscription">Inscription</Link>
            </>
          )}
          <Link className="primary-button" to="/creer-dossier">Créer un dossier</Link>
        </div>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="menu-open" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          <svg className="menu-close" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </header>

      {/* Mobile drawer */}
      <div className={`mobile-drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
        <nav className="drawer-panel" aria-label="Navigation mobile">
          {publicNav.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClass}>{item.label}</NavLink>
          ))}
          {currentUserEmail && (
            <div className="drawer-section">
              <span className="drawer-label">Espace connecté</span>
              {workspaceNav.map((item) => (
                <NavLink key={item.path} to={item.path} className={linkClass}>{item.label}</NavLink>
              ))}
            </div>
          )}
          <div className="drawer-actions">
            {currentUserEmail ? (
              <button className="ghost-button full" type="button" onClick={signOut}>Déconnexion</button>
            ) : (
              <>
                <Link className="ghost-button full" to="/connexion">Connexion</Link>
                <Link className="secondary-button full" to="/inscription">Inscription</Link>
              </>
            )}
            <Link className="primary-button full" to="/creer-dossier">Créer un dossier</Link>
          </div>
        </nav>
      </div>

      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <aside className="ai-warning" aria-label="Avertissements IA et validation">
        {warnings.map((warning) => <span key={warning}>{warning}</span>)}
      </aside>

      <footer className="site-footer">
        <div className="footer-brand">
          <Link className="brand footer-logo" to="/">
            <span className="brand-mark">CD</span>
            <span>
              <strong>{site.name}</strong>
              <small>{site.slogan}</small>
            </span>
          </Link>
          <p>Une base LegalTech professionnelle pour structurer les dossiers, sécuriser les échanges et préparer la relation client-avocat.</p>
          <div className="badge-row">
            {footerBadges.map((badge) => (
              <Link key={badge.label} to={badge.path} className="trust-badge">{badge.label}</Link>
            ))}
          </div>
        </div>
        <FooterColumn title="Produit" links={productLinks} />
        <FooterColumn title="Ressources" links={resourceLinks} />
        <FooterColumn title="Légal" links={legalLinks} />
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ClairDossier. Informations juridiques prudentes, à faire valider avant mise en production.</span>
          <Link to="/contact">Nous contacter</Link>
        </div>
      </footer>

      {/* Scroll to top */}
      <button
        className={`scroll-top${showScrollTop ? ' visible' : ''}`}
        type="button"
        onClick={scrollToTop}
        aria-label="Retour en haut de page"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
      </button>

      {/* Cookie consent banner */}
      {showCookies && (
        <div className="cookie-banner" role="dialog" aria-label="Consentement cookies">
          <p>
            ClairDossier utilise des cookies nécessaires au fonctionnement du site.
            Aucun cookie analytique ou marketing n'est activé sans votre consentement.{' '}
            <Link to="/cookies">En savoir plus</Link>
          </p>
          <div className="cookie-actions">
            <button className="ghost-button" type="button" onClick={refuseCookies}>Refuser</button>
            <button className="primary-button" type="button" onClick={acceptCookies}>Accepter</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; path: string }[] }) {
  return (
    <div className="footer-column">
      <h3>{title}</h3>
      {links.map((link) => (
        <Link key={link.path} to={link.path}>{link.label}</Link>
      ))}
    </div>
  );
}
