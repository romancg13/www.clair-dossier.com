/** Texte proposé pour la recette fictive. Le montage est limité au build de recette. */
export default function RecetteLegalNotice() {
  return (
    <aside aria-labelledby="recette-cadre" className="mx-auto my-6 max-w-3xl rounded-xl border border-slate-300 bg-white p-5 text-slate-900">
      <h2 id="recette-cadre" className="text-lg font-semibold">Conditions proposées pour la démonstration</h2>
      <p className="mt-2">Dans cette recette, le dépôt est réservé à un abonné fictif. Les pièces d’exemple servent à préparer une situation, des dates et des brouillons. Toute transmission reste à l’initiative du client.</p>
      <details className="mt-3">
        <summary className="cursor-pointer font-medium">Ce qui doit être validé avant une ouverture aux clients</summary>
        <p className="mt-2">Les CGV publiées permettent le dépôt avant souscription (article 2) et excluent l’analyse automatique (article 6). Un nouveau texte devra préciser les droits des clients déjà inscrits, les dossiers éligibles et l’accord à recueillir avant le premier traitement.</p>
        <p className="mt-2">Le centre de confiance et la politique de confidentialité devront identifier le prestataire d’IA et d’OCR retenu, ses accès, sa localisation et ses délais d’effacement. L’équipe devra vérifier le paiement en environnement Stripe de test et confirmer la mise en service du rattachement automatique avant toute annonce.</p>
      </details>
    </aside>
  );
}
