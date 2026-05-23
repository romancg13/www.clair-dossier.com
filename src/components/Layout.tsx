import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { footerBadges, legalLinks, productLinks, publicNav, resourceLinks, site, warnings } from '../data/site';
import { supabase } from '../lib/supabase';

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

export function Layout() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountType, setAccountType] = useState<string>('client');

  useEffect(() => {
    function applySession(session: Session | null) {
      setIsAuthenticated(Boolean(session));
      setAccountType(String(session?.user.user_metadata?.account_type || 'client'));
    }

    if (!supabase) {
      applySession(null);
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) applySession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setIsAuthenticated(false);
    navigate('/');
  }

  return (
    <div className="app-shell">
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
            <NavLink key={item.path} to={item.path} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && <NavLink to="/dashboard" className={linkClass}>Espace client</NavLink>}
          {isAuthenticated && accountType === 'cabinet' && <NavLink to="/cabinet/dashboard" className={linkClass}>Cabinet</NavLink>}
        </nav>
        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link className="ghost-button" to="/dashboard">Mon espace</Link>
              <button className="secondary-button" type="button" onClick={signOut}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link className="ghost-button" to="/connexion">Connexion</Link>
              <Link className="primary-button" to="/creer-dossier">Créer un dossier</Link>
            </>
          )}
        </div>
      </header>

      <main>
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
          <span>© 2026 ClairDossier. Informations juridiques prudentes, à faire valider avant mise en production.</span>
          <Link to="/contact">Nous contacter</Link>
        </div>
      </footer>
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
