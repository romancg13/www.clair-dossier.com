import { useEffect, useRef, useState } from "react";
import symbole from "../../assets/brand/logo-symbole-clair-94.webp";
import type { PendingAction, Reply } from "../../../supabase/functions/_shared/intelligence/core.ts";
import type { DeliverableKey } from "../../../supabase/functions/_shared/analysis-model.ts";

/** Transport de l'assistant : exécution locale (démonstration) ou appel serveur (service réel). */
export type IntelligenceTransport = (message: string) => Promise<Reply>;

type Props = {
  /** Envoie une demande et rend la réponse réellement produite. */
  transport: IntelligenceTransport;
  suggestions: string[];
  /** Ouvre / télécharge un document existant (aucune nouvelle analyse). */
  onFile: (key: DeliverableKey) => void;
  /** Enregistre une action de niveau 2 après confirmation explicite. Absent : confirmation indisponible. */
  onConfirm?: (action: PendingAction) => Promise<string>;
  /** Mention affichée sous le titre (ex. « Démonstration — rien n'est conservé »). */
  note?: string;
};

type Turn = { from: "vous" | "ia"; text: string; reply?: Reply; done?: Record<string, string> };

/** Bouton discret + panneau latéral rétractable (feuille plein écran sur mobile). Pas de bulle flottante. */
export function IntelligenceLauncher(props: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-gold-500/60 bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-gold-500/10"
      >
        <img src={symbole} alt="" width={20} height={15} className="h-[15px] w-auto" />
        ClairDossier IA
      </button>
      {open && (
        <IntelligencePanel
          {...props}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </>
  );
}

function IntelligencePanel({ transport, suggestions, onFile, onConfirm, note, onClose }: Props & { onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      // Focus maintenu dans le panneau tant qu'il est ouvert.
      const f = panel.current.querySelectorAll<HTMLElement>("button:not([disabled]),textarea,a[href],summary");
      if (!f.length) return;
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setValue("");
    setTurns((t) => [...t, { from: "vous", text: msg }]);
    setBusy(true);
    try {
      const reply = await transport(msg);
      setTurns((t) => [...t, { from: "ia", text: reply.text, reply }]);
    } catch {
      setTurns((t) => [...t, { from: "ia", text: "Je n’ai pas pu traiter cette demande. Réessayez dans un instant." }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };
  const confirm = async (index: number, action: PendingAction) => {
    if (!onConfirm) return;
    const result = await onConfirm(action).catch(() => "L’enregistrement a échoué : rien n’a été modifié.");
    setTurns((t) => t.map((x, i) => (i === index ? { ...x, done: { ...x.done, [action.id]: result } } : x)));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Fermer ClairDossier IA" tabIndex={-1} onClick={onClose} className="absolute inset-0 hidden cursor-default bg-navy-900/25 sm:block" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="ia-title" className="relative flex h-full w-full flex-col bg-cream-50 shadow-2xl sm:w-[26rem] sm:border-l sm:border-gold-500/40">
        <header className="flex items-center justify-between gap-3 border-b hairline bg-navy-900 px-4 py-3 text-cream-50">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-cream-50">
              <img src={symbole} alt="" width={22} height={17} className="h-[17px] w-auto" />
            </span>
            <div>
              <h2 id="ia-title" className="font-display text-lg leading-none">
                ClairDossier Intelligence
              </h2>
              {note && <p className="mt-1 text-[0.68rem] text-gold-400">{note}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2.5 py-1 text-sm text-cream-50 hover:bg-white/10" aria-label="Fermer">
            Fermer
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {turns.length === 0 && (
            <div>
              <p className="text-sm leading-relaxed text-navy-900">Dites-moi ce dont vous avez besoin : je travaille à partir des pièces de ce dossier et je vous montre mes sources.</p>
              <ul className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => void send(s)} className="w-full rounded-xl border hairline bg-white px-3.5 py-2.5 text-left text-sm font-medium text-navy-900 hover:border-gold-500/60">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {turns.map((t, i) =>
            t.from === "vous" ? (
              <p key={i} className="ml-8 rounded-2xl rounded-br-sm bg-navy-900 px-3.5 py-2.5 text-sm leading-relaxed text-cream-50">
                {t.text}
              </p>
            ) : (
              <div key={i} className="mr-4 rounded-2xl rounded-bl-sm border hairline bg-white px-3.5 py-3 text-sm leading-relaxed text-navy-900">
                {t.reply && t.reply.steps.length > 0 && <p className="mb-1.5 text-[0.7rem] text-slate-500">{t.reply.steps.map((s) => s.label).join(" · ")}</p>}
                <p className="whitespace-pre-line break-words">{t.text}</p>
                {t.reply && t.reply.files.length > 0 && (
                  <p className="mt-2.5 flex flex-wrap gap-2">
                    {t.reply.files.map((f) => (
                      <button key={f.key} type="button" onClick={() => onFile(f.key)} className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-gold-400">
                        Ouvrir : {f.label}
                      </button>
                    ))}
                  </p>
                )}
                {t.reply?.confirm.map((a) => (
                  <div key={a.id} className="mt-2.5 rounded-xl border border-gold-500/50 bg-gold-500/10 p-3">
                    <p className="text-xs font-semibold text-navy-900">{a.title}</p>
                    <p className="text-xs text-slate-600">{a.detail}</p>
                    {t.done?.[a.id] ? (
                      <p className="mt-1.5 text-xs font-medium text-navy-900">{t.done[a.id]}</p>
                    ) : onConfirm ? (
                      <button type="button" onClick={() => void confirm(i, a)} className="mt-2 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-navy-800">
                        Confirmer
                      </button>
                    ) : (
                      <p className="mt-1.5 text-xs text-slate-600">La confirmation n’est pas disponible ici.</p>
                    )}
                  </div>
                ))}
                {t.reply && t.reply.sources.length > 0 && (
                  <details className="mt-2 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium text-slate-500 hover:text-navy-900">Sources ({t.reply.sources.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {t.reply.sources.map((s) => (
                        <li key={s.label} className="break-words">{s.label}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ),
          )}
          {busy && <p role="status" className="mr-4 rounded-2xl border hairline bg-white px-3.5 py-2.5 text-sm text-slate-500">Je consulte votre dossier…</p>}
          <div ref={end} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(value);
          }}
          className="border-t hairline bg-white p-3"
        >
          <label htmlFor="ia-input" className="sr-only">
            Votre demande
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="ia-input"
              ref={input}
              value={value}
              rows={2}
              maxLength={2000}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), void send(value));
              }}
              placeholder="Écrivez votre demande…"
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border hairline-strong bg-cream-50 px-3 py-2 text-sm text-navy-900"
            />
            <button type="submit" disabled={busy || !value.trim()} className="rounded-full bg-navy-900 px-4 py-2.5 text-xs font-semibold text-cream-50 hover:bg-navy-800 disabled:opacity-50">
              Envoyer
            </button>
          </div>
          <p className="mt-1.5 text-[0.68rem] leading-relaxed text-slate-500">Je prépare, vous décidez : aucun envoi, paiement ni suppression sans vous. Réponses à vérifier ; pas un conseil juridique.</p>
        </form>
      </div>
    </div>
  );
}
