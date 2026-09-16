/**
 * Pipeline d'import : contrôle → envoi sécurisé → classement → journalisation.
 *
 *   IMPORT → contrôle (format, taille, doublon)
 *          → envoi en flux dans le bucket privé (progression réelle)
 *          → écriture de la ligne `dossier_documents`
 *          → journal d'activité
 *          → résultat (succès / échec relançable)
 *
 * Aucune analyse du contenu n'est faite : la catégorie provient du NOM du
 * fichier (règle déterministe partagée avec le site).
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { classifyFileName, userMessage, type ExistingDoc } from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';
import { log } from '../lib/logger';
import { checkBeforeUpload, uploadToStorage, type PickedFile } from '../lib/files';
import { logDossierEvent } from '../data/dossiers';
import { fetchDocuments } from '../data/documents';
import { hasDocExtras } from '../data/capabilities';

export type ImportItemState = 'en-attente' | 'envoi' | 'termine' | 'echec' | 'ignore';

export type ImportItem = {
  file: PickedFile;
  state: ImportItemState;
  progress: number;
  message?: string;
};

export type ImportSummary = { done: number; failed: number; skipped: number };

export function useImport(userId: string) {
  const qc = useQueryClient();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patch = useCallback((index: number, next: Partial<ImportItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setRunning(false);
  }, []);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setRunning(false);
  }, []);

  /**
   * Envoie une série de fichiers dans un dossier.
   * `onDuplicate` décide du sort d'un doublon détecté (par défaut : on garde).
   */
  const run = useCallback(
    async (
      files: PickedFile[],
      dossierId: string,
      options?: { onDuplicate?: (warning: string, file: PickedFile) => Promise<boolean> },
    ): Promise<ImportSummary> => {
      if (!files.length) return { done: 0, failed: 0, skipped: 0 };

      const controller = new AbortController();
      abort.current = controller;
      setRunning(true);
      setItems(files.map((file) => ({ file, state: 'en-attente', progress: 0 })));

      let existing: ExistingDoc[] = [];
      try {
        existing = (await fetchDocuments(dossierId, userId))
          .filter((d) => !d.deleted_at)
          .map((d) => ({ file_name: d.file_name, size_bytes: d.size_bytes }));
      } catch (error) {
        log.error('import.existing', error); // le contrôle de doublon est un confort, jamais bloquant
      }

      const summary: ImportSummary = { done: 0, failed: 0, skipped: 0 };
      const extras = await hasDocExtras();

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i] as PickedFile;
        if (controller.signal.aborted) {
          patch(i, { state: 'ignore', message: 'Envoi interrompu.' });
          summary.skipped += 1;
          continue;
        }

        const check = checkBeforeUpload(file, existing);
        if (!check.ok) {
          patch(i, { state: 'echec', message: check.error });
          summary.failed += 1;
          continue;
        }
        if (check.warning && options?.onDuplicate) {
          const keep = await options.onDuplicate(check.warning, file);
          if (!keep) {
            patch(i, { state: 'ignore', message: 'Doublon ignoré.' });
            summary.skipped += 1;
            continue;
          }
        }

        patch(i, { state: 'envoi', progress: 0, message: check.warning });
        try {
          const uploaded = await uploadToStorage(
            file,
            userId,
            dossierId,
            (ratio) => patch(i, { progress: ratio }),
            controller.signal,
          );

          const row: Record<string, unknown> = {
            dossier_id: dossierId,
            user_id: userId,
            file_path: uploaded.path,
            file_name: file.name,
            size_bytes: uploaded.size,
          };
          // La catégorie n'est écrite que si la colonne existe (migration appliquée).
          if (extras) row.category = classifyFileName(file.name);

          const { error } = await supabase.from('dossier_documents').insert(row);
          if (error) throw error;

          await logDossierEvent(dossierId, userId, 'document_ajoute', file.name);
          existing.push({ file_name: file.name, size_bytes: uploaded.size });
          patch(i, { state: 'termine', progress: 1, message: undefined });
          summary.done += 1;
        } catch (error) {
          log.error('import.upload', error);
          patch(i, {
            state: 'echec',
            message: userMessage(error, `« ${file.name} » n'a pas pu être importé.`),
          });
          summary.failed += 1;
        }
      }

      abort.current = null;
      setRunning(false);
      void qc.invalidateQueries({ queryKey: qk.documents(dossierId) });
      void qc.invalidateQueries({ queryKey: qk.events(dossierId) });
      void qc.invalidateQueries({ queryKey: qk.dossiers });
      return summary;
    },
    [patch, qc, userId],
  );

  /** Relance uniquement les fichiers en échec. */
  const retryFailed = useCallback(
    async (dossierId: string): Promise<ImportSummary> => {
      const failed = items.filter((i) => i.state === 'echec').map((i) => i.file);
      return run(failed, dossierId);
    },
    [items, run],
  );

  return { items, running, run, retryFailed, reset, cancel };
}
