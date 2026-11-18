import { useEffect } from 'react';

// Origine dédiée aux seuls dossiers fictifs. La navigation n'emporte ni
// identifiant de dossier, ni cookie, ni paramètre provenant du visiteur.
const portail = 'https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site/';

export function PortailEnLigne() {
  useEffect(() => { window.location.replace(portail); }, []);
  return <main className="mx-auto max-w-3xl px-5 py-16">
    <h1 className="font-display text-4xl">Votre dossier de démonstration</h1>
    <a className="mt-5 inline-block underline" href={portail} rel="noreferrer">Ouvrir le dépôt des deux pièces fictives</a>
  </main>;
}
