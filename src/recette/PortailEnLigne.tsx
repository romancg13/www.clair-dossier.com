import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare const __RECETTE_COMMIT__: string;

export function PortailEnLigne() {
  const { search } = useLocation();
  const url = new URL('https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site/');
  if (/^[a-f0-9]{40}$/.test(__RECETTE_COMMIT__)) url.searchParams.set('version', __RECETTE_COMMIT__);
  // Seul ce nom public d'exemple peut traverser la redirection.
  if (new URLSearchParams(search).get('client') === 'banque-alimentaire') {
    url.searchParams.set('client', 'banque-alimentaire');
  }
  const portail = url.href;
  useEffect(() => { window.location.replace(portail); }, [portail]);
  return <main className="mx-auto max-w-3xl px-5 py-16">
    <h1 className="font-display text-4xl">Votre dossier de démonstration</h1>
    <a className="mt-5 inline-block underline" href={portail} rel="noreferrer">Ouvrir la démonstration</a>
  </main>;
}
