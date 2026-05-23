import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { footerBadges, legalLinks, productLinks, publicNav, resourceLinks, site, warnings } from '../data/site';
import { supabase } from '../lib/supabase';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

const COOKIE_KEY = 'cd_cookie_consent';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

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

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setIsAuthenticated(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
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

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erreur déconnexion Supabase', error);
      return;
    }
    setIsAuthenticated(false);
    navigate('/connexion');
  }, [navigate]);

  return (
    <div className="app-shell">
      <a className="skip-nav" href="#main-content">Aller au contenu principal</a>

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
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link className="ghost-button" to="/dashboard">Mon espace</Link>
              <button className="ghost-button" type="button" onClick={signOut}>Déconnexion</button>
            </>
          ) : (
            <Link className="ghost-button" to="/connexion">Connexion</Link>
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
          <div className="drawer-actions">
            {isAuthenticated ? (
              <>
                <Link className="ghost-button full" to="/dashboard">Mon espace</Link>
                <button className="ghost-button full" type="button" onClick={signOut}>Déconnexion</button>
              </>
            ) : (
              <Link className="ghost-button full" to="/connexion">Connexion</Link>
            )}
            <Link className="primary-button full" to="/creer-dossier">Créer un dossier</Link>
          </div>
        </nav>
      </div>

      <main id="main-content">
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
