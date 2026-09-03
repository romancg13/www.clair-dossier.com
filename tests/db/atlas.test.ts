/**
 * Étape 10 — critère de sortie : « seuils de la PARTIE 10 atteints » pour ATLAS,
 * mesurés sur le dossier étalon : précision de classification ≥ 90 %, doublons
 * stricts 100 % (établis à l'étape 5), quasi-doublon rapproché, pièce illisible
 * signalée, catégorie humaine jamais écrasée (F11).
 */
import { describe, expect, it } from 'vitest';
import { executerFile } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { deposer, dossierEtalon, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

async function inventorierEtalon(tx: Tx) {
  const f = await dossierEtalon(tx);
  const ids = new Map<string, string>();
  for (const p of manifest.pieces) ids.set(p.fichier, (await deposer(tx, f.a.id, f.dossierId, p.fichier)).id);
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
  const store = creerStorePg(tx.sql);
  const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-atlas', maxTravaux: 300, modele: null });
  return { f, store, bilan, ids };
}

type Inventaire = {
  file_name: string; statut_ingestion: string; categorie: string | null; confiance_classification: string | null;
  nom_normalise: string | null; quasi_de: string | null; similarite: string | null; doublon_de: string | null;
};

const INVENTAIRE = `
  select d.file_name, d.statut_ingestion, d.categorie, d.confiance_classification::text, d.nom_normalise,
         q.file_name as quasi_de, d.similarite::text, s.file_name as doublon_de
    from public.dossier_documents d
    left join public.dossier_documents q on q.id = d.quasi_doublon_de_id
    left join public.dossier_documents s on s.id = d.doublon_de_id
   where d.dossier_id = $1 order by d.file_name`;

describe('ATLAS sur le dossier étalon (inventaire, classification, quasi-doublons)', () => {
  it('atteint les seuils : classification ≥ 90 % (100 % ici), doublons stricts 100 %, quasi-doublon et illisible signalés', async () => {
    await withTx(async (tx) => {
      const { f, bilan } = await inventorierEtalon(tx);
      expect(bilan.echecs).toBe(0);
      const inv = await tx.sql<Inventaire>(INVENTAIRE, [f.dossierId]);
      const par = (nom: string) => inv.find((d) => d.file_name === nom)!;

      // Classification : chaque pièce lisible porte la catégorie du manifeste, au-dessus du seuil.
      const lisibles = manifest.pieces.filter((p) => p.role !== 'illisible' && p.role !== 'doublon_strict');
      let justes = 0;
      for (const p of lisibles) {
        const d = par(p.fichier);
        if (d.categorie === p.categorie) justes++;
        expect(d.categorie, p.fichier).toBe(p.categorie);
        expect(Number(d.confiance_classification), p.fichier).toBeGreaterThanOrEqual(0.85);
        expect(d.statut_ingestion, p.fichier).toBe('termine');
        expect(d.nom_normalise, p.fichier).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2}_${p.categorie}`));
      }
      const precision = justes / lisibles.length;
      expect(precision).toBeGreaterThanOrEqual(0.9);
      // Doublons stricts (étape 5) : 100 %, jamais classés ni inventoriés deux fois.
      for (const d of verite.doublons_stricts) {
        expect(par(d.piece).statut_ingestion).toBe('doublon');
        expect(par(d.piece).doublon_de).toBe(d.original);
        expect(par(d.piece).categorie).toBeNull();
      }
      // Quasi-doublon : la version scan est rapprochée de l'original, mais reste une pièce analysée.
      for (const q of verite.quasi_doublons) {
        expect(par(q.piece).quasi_de).toBe(q.original);
        expect(Number(par(q.piece).similarite)).toBeGreaterThanOrEqual(0.85);
        expect(par(q.piece).statut_ingestion).toBe('termine');
      }
      expect(par('01-facture-F-2026-0042.pdf').quasi_de).toBeNull();
      // Illisible : non classée, signalée.
      const ill = par(verite.documents_illisibles[0].piece);
      expect(ill.statut_ingestion).toBe('qualite_insuffisante');
      expect(ill.categorie).toBeNull();

      const runs = await tx.sql<{ sortie: { statut: string; resultat: { methode: string; quasi_doublon: unknown } } }>("select sortie from public.agent_runs where agent = 'ATLAS'");
      expect(runs.length).toBe(lisibles.length);
      for (const r of runs) {
        expect(valider(r.sortie)).toMatchObject({ valide: true });
        expect(r.sortie.resultat.methode).toBe('regles');
      }
      const journal = await tx.sql("select 1 from public.audit_log where action = 'document.classe' and dossier_id = $1", [f.dossierId]);
      expect(journal.length).toBe(lisibles.length);
      // Le client voit l'inventaire de ses pièces ; l'autre tenant, rien.
      await tx.as(f.a.id);
      expect((await tx.sql("select 1 from public.dossier_documents where categorie is not null")).length).toBe(lisibles.length);
      await tx.as(f.b.id);
      expect((await tx.sql('select 1 from public.dossier_documents')).length).toBe(0);
    });
  });

  it('une catégorie corrigée par l’utilisateur n’est jamais écrasée par une réanalyse (F11) ; les colonnes d’inventaire restent serveur', async () => {
    await withTx(async (tx) => {
      const { f, store, ids } = await inventorierEtalon(tx);
      const docId = ids.get('07-courriel-relance-2026-02-13.pdf')!;
      await tx.as(f.a.id);
      await tx.sql("update public.dossier_documents set categorie = 'courrier' where id = $1", [docId]);
      const [apres] = await tx.sql<{ categorie: string; categorie_humaine: boolean; confiance_classification: string }>(
        'select categorie, categorie_humaine, confiance_classification::text from public.dossier_documents where id = $1', [docId],
      );
      expect(apres).toEqual({ categorie: 'courrier', categorie_humaine: true, confiance_classification: '1.000' });
      await tx.expectError(() => tx.sql('update public.dossier_documents set similarite = 0.5 where id = $1', [docId]), /METADONNEES_PIECE_SERVEUR_UNIQUEMENT/);
      await tx.expectError(() => tx.sql('update public.dossier_documents set categorie_humaine = false where id = $1', [docId]), /METADONNEES_PIECE_SERVEUR_UNIQUEMENT/);
      await tx.expectError(
        () => tx.sql("select public.enregistrer_classification($1::uuid, 'facture', 0.9, null)", [docId]),
        /permission denied|SERVEUR_UNIQUEMENT/,
      );
      // Réanalyse par l'agent : la catégorie humaine prime.
      await tx.asService();
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      await tx.sql("select public.planifier_travail('atlas', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, docId]);
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-atlas-2', modele: null, types: ['atlas'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1 });
      const [final] = await tx.sql<{ categorie: string; categorie_humaine: boolean; nom_normalise: string }>(
        'select categorie, categorie_humaine, nom_normalise from public.dossier_documents where id = $1', [docId],
      );
      expect(final.categorie).toBe('courrier');
      expect(final.categorie_humaine).toBe(true);
      expect(final.nom_normalise).toMatch(/_courriel_/); // le nom proposé suit l'analyse ; la catégorie retenue reste celle de l'humain
      const journal = await tx.sql<{ apres: { categorie_humaine: boolean; categorie: string } }>(
        "select apres from public.audit_log where action = 'document.classe' and objet_id = $1 order by id desc limit 1", [docId],
      );
      expect(journal[0].apres).toMatchObject({ categorie_humaine: true, categorie: 'courrier' });
    });
  });
});
