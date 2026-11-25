// Application installable (PWA) : même site, mêmes comptes, même serveur — aucune donnée privée gardée sur l'appareil.
// Enregistrement du service worker minimal (public/sw.js), invitation d'installation, détection des mises à jour.
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export type Plateforme = 'ios' | 'android' | 'mac-safari' | 'ordinateur' | 'autre';

interface Etat {
  /** Invitation native disponible (Chrome, Edge, Android) : le navigateur a confirmé que l'installation est possible. */
  invitation: InstallEvent | null;
  /** Une nouvelle version attend l'accord de l'utilisateur. */
  miseAJour: ServiceWorker | null;
  /** Installation confirmée par le navigateur pendant cette visite. */
  installee: boolean;
}
let etat: Etat = { invitation: null, miseAJour: null, installee: false };
const abonnes = new Set<() => void>();
const publier = (p: Partial<Etat>) => {
  etat = { ...etat, ...p };
  abonnes.forEach((f) => f());
};

/** Vrai si la page s'exécute comme application installée (et non dans un onglet). */
export function estInstallee(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Plateforme déduite du navigateur : sert uniquement à choisir la consigne affichée. */
export function plateforme(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent, tactile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1): Plateforme {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactile)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'ordinateur';
  return 'autre';
}

let demarre = false;
/** À appeler une fois au démarrage. Sans effet en développement, hors HTTPS ou si le navigateur ne le permet pas. */
export function demarrerPwa(): void {
  if (demarre || typeof window === 'undefined') return;
  demarre = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // pas de bandeau imposé : l'invitation n'apparaît qu'au clic sur « Installer l'application »
    publier({ invitation: e as InstallEvent });
  });
  window.addEventListener('appinstalled', () => publier({ invitation: null, installee: true }));
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    void (async () => {
      try {
        // Coupe-circuit : /pwa.json { "actif": false } désinscrit le service worker et vide ses caches.
        const cfg = (await fetch('/pwa.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { actif?: boolean } | null;
        if (cfg && cfg.actif === false) return void (await desactiverPwa());
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        const signaler = (sw: ServiceWorker | null) => sw && navigator.serviceWorker.controller && publier({ miseAJour: sw });
        signaler(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => sw.state === 'installed' && signaler(sw));
        });
        // Nouvelle version recherchée au retour dans l'application, jamais appliquée sans accord.
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update().catch(() => undefined));
      } catch {
        /* navigation privée, stockage refusé : le site fonctionne normalement sans service worker */
      }
    })();
  });
}

/** Désinscrit le service worker et supprime tous les caches ClairDossier (retour arrière, ou déconnexion par prudence). */
export async function desactiverPwa(): Promise<void> {
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('clairdossier-')) await caches.delete(k);
  } catch {
    /* rien à nettoyer */
  }
}

/** Propose l'installation native. 'indisponible' : le navigateur n'offre pas d'invitation (consigne manuelle à suivre). */
export async function installer(): Promise<'acceptee' | 'refusee' | 'indisponible'> {
  const e = etat.invitation;
  if (!e) return 'indisponible';
  await e.prompt();
  const { outcome } = await e.userChoice;
  publier({ invitation: null });
  return outcome === 'accepted' ? 'acceptee' : 'refusee';
}

/** Applique la nouvelle version : uniquement sur demande de l'utilisateur (jamais pendant un dépôt en cours). */
export function appliquerMiseAJour(): void {
  const sw = etat.miseAJour;
  if (!sw) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  sw.postMessage('ACTIVER');
}

export function usePwa() {
  const [, rafraichir] = useState(0);
  useEffect(() => {
    const f = () => rafraichir((n) => n + 1);
    abonnes.add(f);
    return () => void abonnes.delete(f);
  }, []);
  return { invitationDisponible: Boolean(etat.invitation), miseAJourDisponible: Boolean(etat.miseAJour), installeeMaintenant: etat.installee };
}
