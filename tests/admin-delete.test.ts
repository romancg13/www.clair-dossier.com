/**
 * Suppression directe depuis « Vos dossiers » (vue admin, chantier 13) :
 * droits d'affichage du menu « … », libellé du propriétaire dans la
 * confirmation, et ordre « succès serveur PUIS retrait de la carte ».
 * La base reste seule juge (tests SQL : tests/sql/migrations.pglite.mjs) ;
 * ces règles garantissent que l'interface n'annonce jamais un faux succès.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRASH_ERRORS,
  TRASH_REASONS,
  createSingleFlight,
  isMissingFunction,
  ownerIdentity,
  trashMenuState,
  trashThenRemove,
  trashWithServerCheck,
  type ServerTrashCheck,
  type TrashRights,
} from '../src/lib/admin';

const SUPER_AAL2: TrashRights = { isAdmin: true, superAdmin: true, aal2: true, trashColumn: true, server: 'oui' };

/* ── Droits d'affichage du menu ───────────────────────────────────────── */

test('client : aucun menu, quels que soient les autres signaux', () => {
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, isAdmin: false }), { kind: 'hidden' });
});

test('super admin + AAL2 + corbeille + confirmation serveur : « Supprimer » actif', () => {
  assert.deepEqual(trashMenuState(SUPER_AAL2), { kind: 'enabled' });
});

test('admin « support » : entrée désactivée, réservée au super administrateur', () => {
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, superAdmin: false, server: 'non' }), {
    kind: 'disabled',
    reason: TRASH_REASONS.support,
  });
});

test('production actuelle (migrations non appliquées) : désactivé, « migration à appliquer »', () => {
  // is_super_admin absent → repli is_admin (true) ; pas de deleted_at ; pas de super_admin_aal2.
  const state = trashMenuState({ isAdmin: true, superAdmin: true, aal2: true, trashColumn: false, server: 'absente' });
  assert.deepEqual(state, { kind: 'disabled', reason: TRASH_REASONS.migration });
  assert.match(TRASH_REASONS.migration, /Corbeille indisponible : migration à appliquer/);
});

test('garde serveur absente (colonne présente mais 20260918100000 non appliquée) : désactivé', () => {
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, server: 'absente' }), {
    kind: 'disabled',
    reason: TRASH_REASONS.migration,
  });
});

test('super admin en AAL1 : désactivé, vérification en deux étapes requise', () => {
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, aal2: false, server: 'non' }), {
    kind: 'disabled',
    reason: TRASH_REASONS.mfa,
  });
});

test('jeton client AAL2 mais serveur non confirmé : désactivé (jamais sur la seule foi du navigateur)', () => {
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, server: 'non' }), { kind: 'disabled', reason: TRASH_REASONS.unconfirmed });
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, superAdmin: null }), { kind: 'disabled', reason: TRASH_REASONS.unconfirmed });
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, server: 'inconnue' }), { kind: 'disabled', reason: TRASH_REASONS.network });
});

test('sondes en échec réseau : raison « réseau », jamais une fausse raison de droits', () => {
  // checkSuperAdmin() se replie sur false en cas d'erreur : la sonde serveur prime.
  assert.deepEqual(trashMenuState({ ...SUPER_AAL2, superAdmin: false, trashColumn: false, server: 'inconnue' }), {
    kind: 'disabled',
    reason: TRASH_REASONS.network,
  });
});

test('exhaustif : actif si et seulement si toutes les conditions sont réunies', () => {
  const servers: ServerTrashCheck[] = ['oui', 'non', 'absente', 'inconnue'];
  for (const isAdmin of [true, false])
    for (const superAdmin of [true, false, null])
      for (const aal2 of [true, false])
        for (const trashColumn of [true, false])
          for (const server of servers) {
            const state = trashMenuState({ isAdmin, superAdmin, aal2, trashColumn, server });
            const expected = isAdmin && superAdmin === true && aal2 && trashColumn && server === 'oui';
            assert.equal(state.kind === 'enabled', expected, JSON.stringify({ isAdmin, superAdmin, aal2, trashColumn, server }));
            if (!isAdmin) assert.equal(state.kind, 'hidden');
            if (state.kind === 'disabled') assert.ok(state.reason.length > 10, 'raison lisible');
          }
});

test('fonction RPC absente reconnue (PostgREST / PostgreSQL), pas les autres erreurs', () => {
  assert.equal(isMissingFunction({ code: 'PGRST202', message: 'Could not find the function public.super_admin_aal2' }), true);
  assert.equal(isMissingFunction({ code: '42883', message: 'function public.super_admin_aal2() does not exist' }), true);
  assert.equal(isMissingFunction({ message: 'TypeError: Failed to fetch' }), false);
  assert.equal(isMissingFunction({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingFunction(null), false);
});

/* ── Libellé du propriétaire ──────────────────────────────────────────── */

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

test('propriétaire : structure en premier, nom et e-mail en précision', () => {
  assert.deepEqual(
    ownerIdentity({ companyName: 'Martin SAS', fullName: 'Alice Martin', email: 'a@test.fr', userId: UUID }),
    { label: 'Martin SAS', detail: 'Alice Martin · a@test.fr', source: 'profil' },
  );
});

test('propriétaire : nom seul (particulier), e-mail en précision', () => {
  assert.deepEqual(ownerIdentity({ companyName: null, fullName: 'Bruno Durand', email: 'b@test.fr', userId: UUID }), {
    label: 'Bruno Durand',
    detail: 'b@test.fr',
    source: 'profil',
  });
});

test('propriétaire : structure identique au nom → pas de doublon', () => {
  assert.equal(ownerIdentity({ companyName: 'Durand', fullName: 'Durand', userId: UUID }).detail, null);
});

test('propriétaire : sans profil exploitable → e-mail', () => {
  assert.deepEqual(ownerIdentity({ companyName: '  ', fullName: '', email: 'c@test.fr', userId: UUID }), {
    label: 'c@test.fr',
    detail: null,
    source: 'email',
  });
});

test('propriétaire : dernier recours → identifiant TRONQUÉ, jamais l’UUID complet', () => {
  const o = ownerIdentity({ userId: UUID });
  assert.equal(o.source, 'identifiant');
  assert.equal(o.label, 'Compte 3f2b8c1e…');
  assert.equal(o.label.includes(UUID), false);
});

/* ── Écriture, relecture serveur, puis retrait ────────────────────────── */

type Rows = { deleted_at: string | null }[] | null;
function fakeApi(opts: {
  rows?: Rows;
  error?: unknown;
  throwOnUpdate?: unknown;
  reread?: { deleted_at: string | null } | null;
  rereadThrows?: boolean;
  log?: string[];
}) {
  const log = opts.log ?? [];
  return {
    log,
    api: {
      update: async () => {
        log.push('écriture');
        if (opts.throwOnUpdate) throw opts.throwOnUpdate;
        return { rows: opts.rows ?? null, error: opts.error ?? null };
      },
      reread: async () => {
        log.push('relecture');
        if (opts.rereadThrows) throw new Error('Failed to fetch');
        return { row: opts.reread === undefined ? { deleted_at: '2026-09-18T10:00:00Z' } : opts.reread, error: null };
      },
    },
  };
}

test('refus RLS silencieux (0 ligne, aucune erreur) : échec lisible, aucune relecture', async () => {
  const { api, log } = fakeApi({ rows: [] });
  assert.deepEqual(await trashWithServerCheck(api), { ok: false, error: TRASH_ERRORS.refused });
  assert.deepEqual(log, ['écriture']);
});

test('déclencheur anti-contournement (deleted_at remis à null) : échec', async () => {
  const { api } = fakeApi({ rows: [{ deleted_at: null }] });
  assert.deepEqual(await trashWithServerCheck(api), { ok: false, error: TRASH_ERRORS.refused });
});

test('erreur serveur : échec « refusé » ; coupure réseau : message réseau', async () => {
  assert.deepEqual(await trashWithServerCheck(fakeApi({ error: { code: '42501', message: 'denied' } }).api), {
    ok: false,
    error: TRASH_ERRORS.refused,
  });
  assert.deepEqual(await trashWithServerCheck(fakeApi({ error: { message: 'TypeError: Failed to fetch' } }).api), {
    ok: false,
    error: TRASH_ERRORS.network,
  });
  assert.deepEqual(await trashWithServerCheck(fakeApi({ throwOnUpdate: new TypeError('Failed to fetch') }).api), {
    ok: false,
    error: TRASH_ERRORS.network,
  });
});

test('succès confirmé par la relecture serveur', async () => {
  const { api, log } = fakeApi({ rows: [{ deleted_at: '2026-09-18T10:00:00Z' }] });
  assert.deepEqual(await trashWithServerCheck(api), { ok: true, deletedAt: '2026-09-18T10:00:00Z' });
  assert.deepEqual(log, ['écriture', 'relecture']);
});

test('relecture contradictoire (deleted_at vide) : échec, la carte reste', async () => {
  const { api } = fakeApi({ rows: [{ deleted_at: '2026-09-18T10:00:00Z' }], reread: { deleted_at: null } });
  assert.deepEqual(await trashWithServerCheck(api), { ok: false, error: TRASH_ERRORS.notPersisted });
});

test('relecture impossible (réseau) : la réponse d’écriture post-commit fait foi', async () => {
  const { api } = fakeApi({ rows: [{ deleted_at: '2026-09-18T10:00:00Z' }], rereadThrows: true });
  assert.equal((await trashWithServerCheck(api)).ok, true);
});

test('ordre : écriture → relecture → retrait de la carte, jamais avant', async () => {
  const { api, log } = fakeApi({ rows: [{ deleted_at: '2026-09-18T10:00:00Z' }] });
  const outcome = await trashThenRemove(() => trashWithServerCheck(api), () => log.push('retrait'));
  assert.equal(outcome.ok, true);
  assert.deepEqual(log, ['écriture', 'relecture', 'retrait']);
});

test('échec serveur : la carte n’est jamais retirée', async () => {
  for (const opts of [
    { rows: [] as Rows },
    { rows: [{ deleted_at: null }] as Rows },
    { error: { message: 'denied' } },
    { rows: [{ deleted_at: '2026-09-18T10:00:00Z' }] as Rows, reread: { deleted_at: null } },
  ]) {
    const { api, log } = fakeApi(opts);
    const outcome = await trashThenRemove(() => trashWithServerCheck(api), () => log.push('retrait'));
    assert.equal(outcome.ok, false);
    assert.equal(log.includes('retrait'), false, JSON.stringify(opts));
  }
});

test('anti double-clic : un seul appel serveur tant que le premier est en vol', async () => {
  const run = createSingleFlight();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const job = async () => {
    calls++;
    await gate;
    return 'fait';
  };
  const first = run(job);
  const second = run(job);
  assert.equal(await second, null, 'second clic ignoré');
  release();
  assert.equal(await first, 'fait');
  assert.equal(calls, 1);
  // Une fois terminé (succès ou échec), une nouvelle tentative est possible.
  assert.equal(await run(async () => 'à nouveau'), 'à nouveau');
  await assert.rejects(run(async () => { throw new Error('refus'); }));
  assert.equal(await run(async () => 'après échec'), 'après échec');
});
