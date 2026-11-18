// Comptes de démonstration : chaque visiteur reçoit SON compte fictif isolé
// (aucun partage de données entre visiteurs), reproductible.
import { TITULAIRE_A, TITULAIRE_B, DOSSIER_LUMEN } from '../fixtures/dossier-lumen.ts';
import { hashPassword, token } from './security.ts';
import type { ApiEnv } from './api.ts';
import type { UserRec } from './store.ts';

export async function seedDemo(env: ApiEnv, scenario: 'a' | 'b' | 'sans-abonnement'): Promise<UserRec> {
  const s = env.store;
  const id = crypto.randomUUID();
  const who = scenario === 'b' ? TITULAIRE_B : TITULAIRE_A;
  const u: UserRec = {
    id,
    email: `demo-${id.slice(0, 8)}@recette.clair-dossier.example`,
    first_name: who.prenom,
    last_name: who.nom,
    company: who.societe,
    role: 'client',
    pwd: await hashPassword(token(24)),
    notifications: true,
    created_at: s.now().toISOString(),
    fixture: scenario,
  };
  await s.putUser(u);
  if (scenario !== 'sans-abonnement') {
    const end = new Date(s.now().getTime() + 30 * 86_400_000).toISOString();
    await s.updateSub(id, (x) => ({ ...x, status: 'active', plan_id: 'essentiel', current_period_end: end, history: [{ at: s.now().toISOString(), event: 'demonstration', status: 'active' }] }));
    await s.createDossier({ id: crypto.randomUUID(), user_id: id, title: scenario === 'b' ? 'Devis atelier — démonstration B' : DOSSIER_LUMEN.titre, typology: DOSSIER_LUMEN.typologie, objective: scenario === 'b' ? null : DOSSIER_LUMEN.objectif, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: s.now().toISOString() });
  }
  return u;
}

/** Compte d'administration de la recette : créé seulement si un mot de passe serveur est configuré. */
export async function ensureAdmin(env: ApiEnv): Promise<void> {
  if (!env.adminPassword || env.adminPassword.length < 16) return;
  const email = 'admin@recette.clair-dossier.example';
  const { emailKey, checkPassword } = await import('./security.ts');
  const existing = await env.store.userIdByEmailHash(emailKey(email));
  if (existing) {
    const u = await env.store.getUser(existing);
    if (u && !(await checkPassword(env.adminPassword, u.pwd))) await env.store.putUser({ ...u, pwd: await hashPassword(env.adminPassword) });
    return;
  }
  const id = crypto.randomUUID();
  if (await env.store.claimEmail(emailKey(email), id)) await env.store.putUser({ id, email, first_name: 'Administration', last_name: 'Recette', company: 'ClairDossier', role: 'admin', pwd: await hashPassword(env.adminPassword), notifications: false, created_at: env.store.now().toISOString() });
}
