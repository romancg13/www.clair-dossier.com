/**
 * Étape 8 — critère de sortie : « sortie non conforme rejetée en test ».
 * Le validateur applique le JSON Schema strict de la PARTIE 6 puis les règles
 * sémantiques (source obligatoire, confiance globale = minimum, cohérence des
 * statuts, codes d'escalade fermés).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEMA_SORTIE_UNIVERSELLE } from '../../supabase/functions/_shared/schema/sortie-universelle.schema.ts';
import { sortieDeRejet, valider, validerOuRejeter, type SortieUniverselle } from '../../supabase/functions/_shared/schema/validateur.ts';

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const TRACE = '22222222-2222-4222-8222-222222222222';
const DOC = '33333333-3333-4333-8333-333333333333';

/** Exemple de la PARTIE 6, complété des champs obligatoires. */
function exemple(): SortieUniverselle {
  return {
    agent: 'VERITAS',
    version: '1.0',
    dossier_id: DOSSIER,
    trace_id: TRACE,
    horodatage: '2026-09-02T14:31:05+02:00',
    statut: 'escalade',
    confiance_globale: 0.93,
    resultat: {},
    assertions: [
      {
        id: 'a1',
        enonce: 'Le contrat prend fin le 31 décembre 2026.',
        nature: 'piece',
        confiance: 0.97,
        sources: [
          { document_id: DOC, nom_fichier: 'contrat-cadre-2024.pdf', page: 7, extrait: 'Le présent contrat expire le 31 décembre 2026.', offset_debut: 1420, offset_fin: 1471 },
        ],
      },
      {
        id: 'a2',
        enonce: 'Le montant réclamé est de 1 200,00 € TTC.',
        nature: 'piece',
        confiance: 0.93,
        critique: true,
        sources: [{ document_id: DOC, nom_fichier: 'facture.pdf', page: 1, extrait: 'Total TTC 1 200,00 €' }],
      },
    ],
    incertitudes: [{ objet: 'Montant page 3 illisible', impact: 'moyen', action: 'E4' }],
    escalades: [{ code: 'E3', motif: 'Courrier du 12 avril cité dans 3 pièces, absent du dossier', destinataire: 'utilisateur' }],
    donnees_sensibles_detectees: ['nom', 'adresse'],
    cout: { modele: 'claude-sonnet-5', tokens_entree: 18420, tokens_sortie: 2310 },
    duree_ms: 4210,
  };
}

function avec(mutation: (s: SortieUniverselle) => void): unknown {
  const s = exemple();
  mutation(s);
  return s;
}

function codes(brut: unknown): string[] {
  const r = valider(brut);
  return r.valide ? [] : r.erreurs.map((e) => e.code);
}

describe('validateur de schéma universel (PARTIE 6)', () => {
  it('accepte l’exemple de référence et une sortie minimale « ok » sans assertion', () => {
    expect(valider(exemple())).toMatchObject({ valide: true });
    const minimale = avec((s) => {
      s.statut = 'ok';
      s.assertions = [];
      s.incertitudes = [];
      s.escalades = [];
      s.confiance_globale = 1;
      s.agent = 'INGESTION';
    });
    expect(valider(minimale)).toMatchObject({ valide: true });
  });

  it('rejette toute sortie structurellement non conforme, avec le chemin fautif', () => {
    const cas: [string, unknown, string][] = [
      ['champ obligatoire absent', avec((s) => delete (s as Partial<SortieUniverselle>).trace_id), 'schema.required'],
      ['propriété inconnue au premier niveau', avec((s) => ((s as Record<string, unknown>).commentaire = 'x')), 'schema.additionalProperties'],
      ['agent hors architecture', avec((s) => (s.agent = 'ORACLE')), 'schema.enum'],
      ['statut inconnu', avec((s) => ((s as Record<string, unknown>).statut = 'termine')), 'schema.enum'],
      ['dossier_id non uuid', avec((s) => (s.dossier_id = '42')), 'schema.format'],
      ['horodatage invalide', avec((s) => (s.horodatage = 'hier')), 'schema.format'],
      ['confiance > 1', avec((s) => (s.assertions[0].confiance = 1.2)), 'schema.maximum'],
      ['nature inconnue', avec((s) => ((s.assertions[0] as Record<string, unknown>).nature = 'certain')), 'schema.enum'],
      ['page 0 dans une source', avec((s) => (s.assertions[0].sources[0].page = 0)), 'schema.minimum'],
      ['code d’escalade hors liste fermée', avec((s) => ((s.escalades[0] as Record<string, unknown>).code = 'E10')), 'schema.enum'],
      ['destinataire inconnu', avec((s) => ((s.escalades[0] as Record<string, unknown>).destinataire = 'avocat')), 'schema.enum'],
      ['action d’incertitude hors codes', avec((s) => ((s.incertitudes[0] as Record<string, unknown>).action = 'ignorer')), 'schema.enum'],
      ['tokens négatifs', avec((s) => (s.cout.tokens_entree = -1)), 'schema.minimum'],
      ['version mal formée', avec((s) => (s.version = 'v1')), 'schema.pattern'],
      ['assertions absentes', avec((s) => delete (s as Partial<SortieUniverselle>).assertions), 'schema.required'],
      ['source sans extrait', avec((s) => delete (s.assertions[0].sources[0] as Partial<{ extrait: string }>).extrait), 'schema.required'],
    ];
    for (const [nom, brut, attendu] of cas) {
      expect(codes(brut), nom).toContain(attendu);
    }
    expect(valider(null)).toMatchObject({ valide: false });
    expect(valider('{}')).toMatchObject({ valide: false });
  });

  it('rejette une assertion « piece » ou « a_verifier » sans source ; admet déclaration du client et déduction', () => {
    expect(codes(avec((s) => (s.assertions[0].sources = [])))).toEqual(['assertion.sans_source']);
    expect(codes(avec((s) => { s.assertions[0].sources = []; s.assertions[0].nature = 'a_verifier'; }))).toEqual(['assertion.sans_source']);
    expect(codes(avec((s) => { s.assertions[0].sources = []; s.assertions[0].nature = 'declaration_client'; }))).toEqual([]);
    expect(codes(avec((s) => { s.assertions[0].sources = []; s.assertions[0].nature = 'deduction'; }))).toEqual([]);
  });

  it('exige que confiance_globale soit le minimum des assertions critiques, jamais une moyenne', () => {
    // a2 (critique) = 0,93 → 0,93 attendu ; la moyenne (0,95) est refusée.
    expect(codes(avec((s) => (s.confiance_globale = 0.95)))).toEqual(['confiance.pas_le_minimum']);
    // Sans assertion critique marquée : minimum de toutes les assertions.
    expect(codes(avec((s) => { delete s.assertions[1].critique; s.confiance_globale = 0.93; }))).toEqual([]);
    expect(codes(avec((s) => { delete s.assertions[1].critique; s.confiance_globale = 0.97; }))).toEqual(['confiance.pas_le_minimum']);
    // Arrondi au millième toléré.
    expect(codes(avec((s) => (s.confiance_globale = 0.9304)))).toEqual([]);
  });

  it('impose la cohérence statut ↔ escalades et l’unicité des identifiants', () => {
    expect(codes(avec((s) => (s.statut = 'ok')))).toEqual(expect.arrayContaining(['statut.ok_avec_escalade']));
    expect(codes(avec((s) => { s.escalades = []; s.statut = 'escalade'; }))).toEqual(['statut.escalade_sans_code']);
    expect(codes(avec((s) => { s.escalades = []; s.statut = 'ok'; }))).toEqual(['statut.ok_avec_action']);
    expect(codes(avec((s) => (s.assertions[1].id = 'a1')))).toEqual(['assertion.id_duplique']);
    expect(codes(avec((s) => { s.assertions[0].sources[0].offset_fin = 1400; }))).toEqual(['source.offsets_incoherents']);
    expect(codes(avec((s) => { delete s.assertions[0].sources[0].offset_fin; }))).toEqual(['source.offsets_incomplets']);
  });

  it('remplace une sortie rejetée par une sortie d’échec E8, elle-même conforme et sans assertion', () => {
    const brut = avec((s) => { s.assertions[0].sources = []; (s as Record<string, unknown>).extra = 1; });
    const r = validerOuRejeter(brut, { agent: 'VERITAS', dossier_id: DOSSIER, trace_id: TRACE });
    expect(r.rejetee).toBe(true);
    expect(r.erreurs.length).toBeGreaterThan(0);
    expect(r.sortie.statut).toBe('echec');
    expect(r.sortie.assertions).toEqual([]);
    expect(r.sortie.escalades).toEqual([expect.objectContaining({ code: 'E8', destinataire: 'utilisateur' })]);
    expect(valider(r.sortie)).toMatchObject({ valide: true });
    expect(valider(sortieDeRejet({ agent: 'HERMES', dossier_id: DOSSIER, trace_id: TRACE, erreurs: [] }))).toMatchObject({ valide: true });
    // Une sortie valide passe inchangée.
    const ok = validerOuRejeter(exemple(), { agent: 'VERITAS', dossier_id: DOSSIER, trace_id: TRACE });
    expect(ok.rejetee).toBe(false);
    expect(ok.sortie).toEqual(exemple());
  });

  it('la copie JSON du schéma dans docs/schemas est à jour', () => {
    const copie = JSON.parse(readFileSync(resolve(__dirname, '../../docs/schemas/sortie-universelle.schema.json'), 'utf8'));
    expect(copie).toEqual(JSON.parse(JSON.stringify(SCHEMA_SORTIE_UNIVERSELLE)));
  });
});
