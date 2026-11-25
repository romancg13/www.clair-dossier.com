import { useState } from "react";
import { buildZip, zipFileName, type ZipSource } from "../../lib/deliverables-zip.ts";

type Props = {
  /**
   * Fichiers de la DERNIÈRE révision du dossier affiché — et d'aucun autre :
   * la liste est fournie par la page, ce composant ne lit ni base ni stockage.
   */
  files: ZipSource[];
  /** Intitulé du dossier (sert au nom de l'archive). */
  title?: string | null;
  className?: string;
};

/**
 * Bouton autonome « Tout télécharger (.zip) » : archive côté navigateur les
 * fichiers reçus en props. Aucun appel IA, aucune régénération : les fichiers
 * sont ceux déjà produits.
 */
export function DeliverablesZip({ files, title, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = async () => {
    if (busy || files.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const { zip, failed } = await buildZip(files);
      if (!zip) {
        setMessage("Téléchargement indisponible pour le moment.");
        return;
      }
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFileName(title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (failed.length) setMessage(`${failed.length} fichier(s) non inclus dans l'archive : ${failed.join(", ")}.`);
    } catch {
      setMessage("L'archive n'a pas pu être préparée. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy || files.length === 0}
        className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
      >
        {busy ? "Préparation…" : "Tout télécharger (.zip)"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-slate-500">
          {message}
        </p>
      )}
    </div>
  );
}
