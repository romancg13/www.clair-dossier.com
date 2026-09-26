/**
 * packages/core — dossiers, échéances, événements, droits, erreurs.
 * Inclut un contrôle de dérive avec les données du site (src/data/statuses.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_LABELS,
  CATEGORIES,
  PROFILS,
  STATUS_LABELS,
  STEP_MESSAGES,
  STEP_NEXT_ACTIONS,
  TIMELINE_STEPS,
  TYPOLOGY_LABELS,
  UNKNOWN_ENTITLEMENTS,
  checkDossierQuota,
  countDeadlines,
  currentStep,
  deadlineStatus,
  dossierDisplayTitle,
  eventLabel,
  fieldsFor,
  isGenericTitle,
  isISODate,
  isTimeOfDay,
  matchesQuery,
  parseEntitlements,
  relativeDueLabel,
  reminderInstant,
  routeForNotificationData,
  routeForPath,
  sortDeadlines,
  subscriptionSummary,
  translateAuthError,
  userMessage,
  type Deadline,
} from '../packages/core/src/index';
import { statuses } from '../src/data/statuses';

/* ── Dossiers ─────────────────────────────────────────────────────────────── */

test('typologies : chaque catégorie du tunnel a un libellé de lecture', () => {
  for (const category of CATEGORIES) {
    assert.equal(TYPOLOGY_LABELS[category.id], category.label);
  }
});

test('typologies héritées : les anciens dossiers restent lisibles', () => {
  for (const legacy of ['litige-commercial', 'recouvrement', 'bail', 'prud-hommes', 'divorce', 'succession']) {
    assert.ok(TYPOLOGY_LABELS[legacy], `typologie héritée perdue : ${legacy}`);
  }
});

test('champs du tunnel : jeu générique, surcharges pour impayé et RH', () => {
  assert.deepEqual(fieldsFor('dossier-client').map((f) => f.id), [
    'counterparty',
    'startDate',
    'amount',
    'deadline',
    'situation',
  ]);
  assert.equal(fieldsFor('impaye-precontentieux')[0]?.label, 'Débiteur (client ou société)');
  assert.equal(fieldsFor('rh')[0]?.label, 'Salarié concerné');
  // Toute clé écrite dans `answers` doit être lisible côté détail.
  for (const category of CATEGORIES) {
    for (const field of fieldsFor(category.id)) {
      assert.ok(ANSWER_LABELS[field.id], `libellé de lecture manquant : ${field.id}`);
    }
  }
});

test('profils : identifiants stables (ils sont écrits dans answers.profil)', () => {
  assert.deepEqual(PROFILS.map((p) => p.id), [
    'artisan',
    'independant',
    'profession-liberale',
    'entreprise-pme',
    'autre',
  ]);
});

test('étapes : chaque statut mène à une étape existante, avec message et action', () => {
  for (const status of [...Object.keys(STATUS_LABELS), 'statut-inconnu']) {
    const step = currentStep(status);
    assert.ok(step >= 1 && step <= TIMELINE_STEPS.length);
    assert.ok(STEP_MESSAGES[step], `message manquant pour l'étape ${step}`);
    assert.ok(STEP_NEXT_ACTIONS[step], `action manquante pour l'étape ${step}`);
  }
});

test('titres génériques : détectés, accents et casse ignorés', () => {
  assert.ok(isGenericTitle(''));
  assert.ok(isGenericTitle('Impayé / pré-contentieux'));
  assert.ok(isGenericTitle('DOSSIER CLIENT'));
  assert.ok(!isGenericTitle('Facture 2026-014 — SARL Dupont'));
});

test('titre affiché : le titre saisi, sinon le libellé de typologie', () => {
  assert.equal(dossierDisplayTitle({ title: 'Chantier Léon', typology: 'rh' }), 'Chantier Léon');
  assert.equal(dossierDisplayTitle({ title: '   ', typology: 'rh' }), 'Personnel / RH');
});

test('recherche locale : insensible aux accents, tous les termes exigés', () => {
  assert.ok(matchesQuery(['Impayé SARL Dupont', 'Factures'], 'impaye dupont'));
  assert.ok(!matchesQuery(['Impayé SARL Dupont'], 'impaye martin'));
  assert.ok(matchesQuery(['quoi que ce soit'], '   '));
});

/* ── Cohérence avec le site ───────────────────────────────────────────────── */

test('dérive : les statuts publiés sur le site restent tous connus du cœur partagé', () => {
  // Le site décrit 6 états de parcours ; l'application en écrit 5 en base.
  // « attente-avocat » (page publique) correspond au statut écrit « transmis »,
  // et « complete » / « validation » sont des étapes de récit, pas des statuts.
  const written = new Set(Object.keys(STATUS_LABELS));
  const narrative = new Set(['complete', 'attente-avocat', 'validation']);
  for (const status of statuses) {
    assert.ok(
      written.has(status.id) || narrative.has(status.id),
      `statut du site inconnu du cœur partagé : ${status.id}`,
    );
  }
  assert.equal(STATUS_LABELS.transmis, 'Transmis');
});

/* ── Échéances ────────────────────────────────────────────────────────────── */

const deadline = (over: Partial<Deadline>): Deadline => ({
  id: 'd1',
  dossier_id: 'x',
  user_id: 'u',
  title: 'Échéance',
  description: null,
  due_date: '2026-09-20',
  due_time: null,
  priority: 'normale',
  done: false,
  created_at: '2026-09-01T10:00:00Z',
  ...over,
});

test('statut d’échéance : terminée > retard > à venir', () => {
  const now = new Date('2026-09-16T12:00:00');
  assert.equal(deadlineStatus('2026-09-10', false, now), 'retard');
  assert.equal(deadlineStatus('2026-09-20', false, now), 'a-venir');
  assert.equal(deadlineStatus('2026-09-10', true, now), 'terminee');
  // Le jour même reste « à venir » jusqu'à la fin de la journée.
  assert.equal(deadlineStatus('2026-09-16', false, now), 'a-venir');
});

test('tri : retards d’abord, puis par date, puis par priorité', () => {
  const now = new Date('2026-09-16T12:00:00');
  const sorted = sortDeadlines(
    [
      deadline({ id: 'a-venir', due_date: '2026-09-25' }),
      deadline({ id: 'terminee', due_date: '2026-09-01', done: true }),
      deadline({ id: 'retard', due_date: '2026-09-02' }),
      deadline({ id: 'urgente', due_date: '2026-09-25', priority: 'haute' }),
    ],
    now,
  );
  assert.deepEqual(sorted.map((d) => d.id), ['retard', 'urgente', 'a-venir', 'terminee']);
});

test('compteurs et libellés relatifs', () => {
  const now = new Date('2026-09-16T12:00:00');
  const counts = countDeadlines(
    [deadline({ due_date: '2026-09-01' }), deadline({ due_date: '2026-09-30' }), deadline({ done: true })],
    now,
  );
  assert.deepEqual(counts, { retard: 1, 'a-venir': 1, terminee: 1 });
  assert.equal(relativeDueLabel('2026-09-16', now), "Aujourd'hui");
  assert.equal(relativeDueLabel('2026-09-17', now), 'Demain');
  assert.equal(relativeDueLabel('2026-09-19', now), 'Dans 3 jours');
  assert.equal(relativeDueLabel('2026-09-14', now), '2 jours de retard');
});

test('formats de date et d’heure', () => {
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'), 'le 30 février n’existe pas');
  assert.ok(!isISODate('28/02/2026'));
  assert.ok(isTimeOfDay('09:30'));
  assert.ok(!isTimeOfDay('24:00'));
});

test('rappel local : jamais programmé dans le passé', () => {
  const now = new Date('2026-09-16T12:00:00');
  const future = reminderInstant('2026-09-20', null, 1, 9, now);
  assert.ok(future instanceof Date);
  assert.equal(future?.getHours(), 9);
  assert.equal(reminderInstant('2026-09-10', null, 1, 9, now), null);
  assert.equal(reminderInstant('pas-une-date', null, 0, 9, now), null);
  assert.equal(reminderInstant('2026-09-20', '18:30', 0, 9, now)?.getMinutes(), 30);
});

/* ── Journal ──────────────────────────────────────────────────────────────── */

test('journal : libellés identiques web et mobile', () => {
  assert.equal(eventLabel('document_ajoute'), 'Document ajouté');
  assert.equal(eventLabel('document_ajoute', 'facture.pdf'), 'Document ajouté — facture.pdf');
  assert.equal(eventLabel('dossier_transmis', 'WhatsApp'), 'Dossier transmis — WhatsApp');
});

/* ── Droits ───────────────────────────────────────────────────────────────── */

test('droits : sans publication serveur, RIEN n’est verrouillé côté client', () => {
  assert.equal(UNKNOWN_ENTITLEMENTS.kind, 'unknown');
  assert.equal(checkDossierQuota(UNKNOWN_ENTITLEMENTS, 9999).allowed, true);
  assert.match(subscriptionSummary(UNKNOWN_ENTITLEMENTS), /suivi par l'équipe/);
});

test('droits : charge utile invalide → inconnu, jamais une valeur inventée', () => {
  assert.equal(parseEntitlements(null).kind, 'unknown');
  assert.equal(parseEntitlements({ plan: 'formule-pirate', status: 'active' }).kind, 'unknown');
  assert.equal(parseEntitlements({ plan: 'essentiel', status: 'inconnu' }).kind, 'unknown');
});

test('droits : une limite publiée par le serveur est appliquée', () => {
  const state = parseEntitlements({ plan: 'essentiel', status: 'active', limits: { dossiers: 5 } });
  assert.equal(state.kind, 'known');
  assert.equal(checkDossierQuota(state, 4).allowed, true);
  const refused = checkDossierQuota(state, 5);
  assert.equal(refused.allowed, false);
  assert.match(refused.allowed === false ? refused.message : '', /Essentiel/);
  // `null` = illimité.
  const unlimited = parseEntitlements({ plan: 'business-pme-pro', status: 'active', limits: { dossiers: null } });
  assert.equal(checkDossierQuota(unlimited, 10_000).allowed, true);
});

/* ── Erreurs ──────────────────────────────────────────────────────────────── */

test('erreurs : message utilisateur compréhensible, jamais technique', () => {
  const message = userMessage({ status: 401 }, "Impossible d'importer le document.");
  assert.match(message, /Impossible d'importer le document\./);
  assert.match(message, /session a expiré/);
  assert.match(userMessage(new Error('fetch failed')), /Connexion indisponible/);
  assert.match(userMessage({ status: 413 }), /trop volumineux/);
  // Le détail brut ne doit jamais fuiter à l'écran.
  assert.ok(!userMessage(new Error('duplicate key value violates unique constraint')).includes('constraint'));
});

test('erreurs : traductions d’authentification alignées sur le site', () => {
  assert.equal(translateAuthError('Invalid login credentials'), 'Email ou mot de passe incorrect.');
  assert.match(translateAuthError('User already registered'), /existe déjà/);
});

/* ── Liens profonds ───────────────────────────────────────────────────────── */

test('liens profonds : seules les adresses connues ouvrent une route', () => {
  const id = '8f14e45f-ceea-467a-9a8f-1b2c3d4e5f60';
  assert.equal(routeForPath(`/compte/dossier/${id}`), `/dossier/${id}`);
  assert.equal(routeForPath(`dossier/${id}`), `/dossier/${id}`);
  assert.equal(routeForPath('/dossier/nouveau'), '/dossier/nouveau');
  assert.equal(routeForPath('/compte'), '/compte');
  assert.equal(routeForPath('/tarifs'), null);
  assert.equal(routeForPath('/compte/dossier/../../admin'), null);
  assert.equal(routeForPath(`/compte/dossier/${id}?utm=x`), `/dossier/${id}`);
});

test('notifications : charge utile contrôlée, pas de redirection arbitraire', () => {
  const id = '8f14e45f-ceea-467a-9a8f-1b2c3d4e5f60';
  assert.equal(routeForNotificationData({ dossierId: id }), `/dossier/${id}`);
  assert.equal(routeForNotificationData({ dossierId: 'pas-un-id' }), null);
  assert.equal(routeForNotificationData({ route: 'https://exemple.test' }), null);
  assert.equal(routeForNotificationData({ route: '//exemple.test' }), null);
  assert.equal(routeForNotificationData(null), null);
});
