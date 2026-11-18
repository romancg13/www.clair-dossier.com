import { zipSync } from "fflate";
import type { AnalysisData, DeliverableKey, EventOverride, RetainedEvent } from "../../supabase/functions/_shared/analysis-model";

export type Persona = "a" | "b" | "sans-abonnement";
export type JobStatus = "empty" | "queued" | "processing" | "ready" | "partial" | "failed" | "closed" | "review";
export type Fixture = { id: string; name: string; href: string; sha256: string };
export type PublishedFile = { href: string; name: string; key: DeliverableKey | null; revision: number };
export type State = {
  persona: Persona;
  subscribed: boolean;
  receipt?: { added: number; duplicates: number };
  fixtures: Fixture[];
  dossier: {
    id: string; title: string; objective?: string; closed: boolean; revision: number;
    jobStatus: JobStatus; formattedAt: string | null;
    objects: { id: string; name: string; href: string }[];
    files: PublishedFile[]; historyFiles: PublishedFile[];
    analysis: AnalysisData | null; events: RetainedEvent[]; overrides: EventOverride[];
    notifications: { revision: number; createdAt: string }[];
  };
};

export class SessionEnded extends Error {}
export class ServerUnavailable extends Error {}
async function request(path: string, payload?: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/recette/${path}`, {
    method: payload === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (response.status === 401) throw new SessionEnded("Votre session de démonstration est terminée.");
  if (response.status === 204) return null;
  if (!response.headers.get("content-type")?.includes("application/json")) throw new ServerUnavailable();
  const result = await response.json();
  if (!response.ok) {
    if (response.status >= 500 || response.status === 404) throw new ServerUnavailable();
    throw new Error(typeof result.error === "string" ? result.error : "L’opération n’a pas pu être enregistrée.");
  }
  return result;
}

export async function requestRecovery(persona: "a" | "b") {
  const result = await request("recuperation", { persona });
  if (!result?.pending) throw new Error("Impossible de préparer la récupération.");
}

export async function api(path: string, payload?: unknown, signal?: AbortSignal): Promise<State | null> {
  const result = await request(path, payload, signal);
  if (path === "logout") return null;
  if (!result?.dossier || !Array.isArray(result.fixtures)) throw new ServerUnavailable();
  return result as State;
}

/** Compare avant tout envoi. Une pièce personnelle ne quitte jamais le navigateur. */
export async function encodeFixtures(input: File[], catalog: Fixture[]): Promise<string[]> {
  if (input.length > 190 || input.reduce((sum, file) => sum + file.size, 0) > 740_000) {
    throw new Error("Ce lot dépasse la taille admise en recette.");
  }
  return Promise.all(input.map(async file => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(hash, n => n.toString(16).padStart(2, "0")).join("");
    if (!catalog.some(f => f.sha256 === hex)) throw new Error("Choisissez uniquement les fichiers fictifs proposés ci-dessous.");
    return btoa(Array.from(bytes, n => String.fromCharCode(n)).join(""));
  }));
}

export function downloadFile(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

type PrivateFile = { name: string; href: string };
async function freshFile(file: PrivateFile): Promise<PrivateFile> {
  const current = new URL(file.href, window.location.origin);
  if (Number(current.searchParams.get("expires")) > Date.now() + 5000) return file;
  const state = await api("state");
  const d = state?.dossier;
  const next = d && [...d.files, ...d.historyFiles, ...d.objects].find(f => new URL(f.href, current.origin).pathname === current.pathname);
  if (!next) throw new Error("Document indisponible.");
  return next;
}

export async function accessFile(file: PrivateFile, preview = false) {
  const tab = preview && /\.pdf$/i.test(file.name) ? window.open("about:blank", "_blank") : null;
  if (tab) tab.opener = null;
  try {
    const current = await freshFile(file);
    if (tab) {
      const url = new URL(current.href, window.location.origin);
      url.searchParams.set("inline", "1");
      tab.location.replace(url.href);
    } else downloadFile(current.href, current.name);
  } catch (error) { tab?.close(); throw error; }
}

export async function downloadResults(files: PublishedFile[]) {
  const latest = await api("state");
  if (!latest) throw new Error("Session expirée.");
  const offered = [...latest.dossier.files, ...latest.dossier.historyFiles];
  const urls = new Map(offered.map(file => [file.href.split("?")[0], file.href]));
  const contents: Record<string, Uint8Array> = {};
  for (const [index, file] of files.entries()) {
    const url = urls.get(file.href.split("?")[0]);
    if (!url) throw new Error("Document indisponible.");
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Un fichier n’est plus accessible. Actualisez le dossier pour renouveler les liens.");
    const name = file.name.replace(/[/\\]/g, "_");
    contents[Object.hasOwn(contents, name) ? `${index + 1}-${name}` : name] = new Uint8Array(await response.arrayBuffer());
  }
  const url = URL.createObjectURL(new Blob([zipSync(contents) as BlobPart], { type: "application/zip" }));
  downloadFile(url, "ClairDossier-resultats.zip");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
