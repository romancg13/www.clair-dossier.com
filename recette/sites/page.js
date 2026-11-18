"use strict";
const byId = (id) => document.getElementById(id);
let initialSelection = new URLSearchParams(location.search).get("client");
const counts = ["aucune", "une", "deux", "trois", "quatre"];
const labels = {
  dashboard: ["Tableau de bord", "La situation, la prochaine action et son responsable."],
  resume: ["Résumé du dossier", "Les faits qui comptent et les pièces qui les établissent."],
  chronologie: ["Chronologie", "Les événements dans l’ordre, avec leurs sources."],
  dates: ["Dates modifiables", "Les dates extraites et les corrections retenues."],
  echeances: ["Calendrier des échéances", "Les dates confirmées et les rendez-vous à préparer."],
  relances: ["Brouillons de messages", "Les messages prêts à relire avant toute transmission."],
  manquants: ["Pièces à confirmer", "Les justificatifs manquants ou à vérifier."],
  preparation: ["Préparation du rendez-vous", "Les questions et les pièces à avoir sous la main."]
};
function validHref(path, prefix = "/api/") {
  if (typeof path !== "string" || !path) return null;
  try {
    const url = new URL(path, location.origin);
    return url.origin === location.origin && url.pathname.startsWith(prefix) ? url.href : null;
  } catch {
    return null;
  }
}
let state = null,
  busy = false,
  timer = 0,
  sequence = 0;
function feedback(message = "") {
  byId("error").textContent = message;
  byId("error").hidden = !message;
}
function lock(locked) {
  busy = locked;
  document.querySelectorAll("button,input").forEach((el) => {
    el.disabled = locked;
  });
  if (!locked) {
    updateDeposit();
    updateBrief();
  }
}
async function request(path, body) {
  const opts = { credentials: "same-origin", cache: "no-store" };
  if (body !== undefined) {
    opts.method = "POST";
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const response = await fetch(path, opts);
  const data = await response.json().catch(() => null);
  if (path === "/api/dossier" && response.status === 401) return { persona: null, run: null, fixtures: [] };
  if (!response.ok) {
    const err = new Error(
      typeof data?.error === "string" ? data.error : "La requête n’a pas abouti. Vérifiez l’état du dossier."
    );
    err.status = response.status;
    throw err;
  }
  return data;
}
let selectionScope = "";
function notice(message = "") {
  byId("notice").textContent = message;
  byId("notice").hidden = !message;
}
function dateFr(value) {
  if (!value) return "Aucune date confirmée";
  return new Date(value + "T12:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris"
  });
}
function timeFr(value) {
  return new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}
function renderFixtures(next, inputs, run) {
  const scope =
    next.dossierId + "|" + next.persona + "|" + inputs.slice().sort().join(",") + "|" + Boolean(run?.closed);
  if (scope === selectionScope) return;
  selectionScope = scope;
  byId("fixtures").replaceChildren();
  byId("choices").replaceChildren();
  byId("copies").value = "";
  for (const f of next.fixtures) {
    const href = new URL(f.url, location.origin);
    if (href.origin !== location.origin || !/^([a-f0-9]{64})$/.test(f.sha256)) continue;
    const li = document.createElement("li"),
      link = document.createElement("a");
    link.href = href.href;
    link.download = f.name;
    link.textContent = f.name;
    li.append(link);
    if (inputs.includes(f.id)) li.append(" · déjà déposé");
    byId("fixtures").append(li);
    const label = document.createElement("label"),
      check = document.createElement("input");
    label.className = "choice";
    check.type = "checkbox";
    check.name = "fixture";
    check.value = f.id;
    check.checked = !inputs.includes(f.id);
    check.addEventListener("change", updateDeposit);
    label.append(check, document.createTextNode(f.name));
    byId("choices").append(label);
  }
  byId("choose").open = false;
  updateDeposit();
}
function updateBrief() {
  byId("brief-submit").disabled =
    busy ||
    !["audience", "offer", "region", "goal"].every((name) => byId("brief").elements.namedItem(name).value);
}
function updateDeposit() {
  const count = byId("copies").files.length || document.querySelectorAll("[name=fixture]:checked").length;
  byId("deposit").textContent = state?.run
    ? "Déposer le complément"
    : count > 1
      ? "Déposer les " + (counts[count] || count) + " pièces"
      : "Déposer la pièce";
  byId("deposit").disabled = busy || !count;
  if (state?.run && !state.run.closed && count) byId("deposit").hidden = false;
}
function renderHistory(run) {
  byId("versions").replaceChildren();
  byId("corrections").replaceChildren();
  byId("lot-events").replaceChildren();
  for (const lot of run.lotEvents || []) {
    const li = document.createElement("li");
    li.textContent =
      "Lot " +
      lot.revision +
      " du " +
      timeFr(lot.submittedAt) +
      (lot.publishedAt
        ? " · Notification de disponibilité le " + timeFr(lot.publishedAt)
        : " · Livraison en attente");
    byId("lot-events").append(li);
  }
  for (const record of run.history || []) {
    const version = Number(record.revision);
    if (!Number.isInteger(version) || version < 1) continue;
    const link = document.createElement("a"),
      li = document.createElement("li");
    const pdfHref = validHref(record.href);
    if (!pdfHref) continue;
    link.href = pdfHref;
    link.download = "Tableau-de-bord-r" + version + ".pdf";
    link.textContent = "Télécharger la révision " + version + " du " + timeFr(record.publishedAt);
    li.append(link);
    if (validHref(record.packHref) && Number(record.fileCount) > 1) {
      const pack = document.createElement("a");
      pack.href = validHref(record.packHref);
      pack.download = "ClairDossier-r" + version + ".zip";
      pack.textContent = "Archive de " + record.fileCount + " fichiers";
      li.append(" · ", pack);
    }
    byId("versions").append(li);
  }
  for (const change of run.corrections || []) {
    const li = document.createElement("li");
    li.textContent =
      dateFr(change.date) + " · " + change.reason + " · " + change.author + " · " + timeFr(change.createdAt);
    byId("corrections").append(li);
  }
  byId("close").textContent = run.closed ? "Rouvrir le dossier" : "Clôturer le dossier";
}
function render(next) {
  if (!next || !Array.isArray(next.fixtures))
    throw new Error("Le serveur n’a pas renvoyé l’état du dossier.");
  const previous = state;
  state = next;
  const run = state.run;
  for (const id of [
    "entry",
    "denied",
    "upload",
    "progress",
    "result",
    "profiles",
    "retry",
    "failure",
    "secondary",
    "change-date",
    "services-slot"
  ])
    byId(id).hidden = true;
  byId("message").textContent = "";
  const changed = previous?.persona !== next.persona || previous?.dossierId !== next.dossierId;
  if (changed) {
    byId("deliverable-list").replaceChildren();
    byId("profiles").open = false;
    if (byId("preview-dialog").open) byId("preview-dialog").close();
    serviceGeneration++;
    byId("services-slot").open = false;
    byId("communication").open = false;
    byId("service-results").replaceChildren();
    byId("service-status").textContent = "";
    byId("brief").reset();
    selectionScope = "";
    byId("tools").open = false;
    byId("change-date").open = false;
    byId("draft-block").open = false;
    for (const id of [
      "summary",
      "draft",
      "due-date",
      "date-source",
      "next-action",
      "versions",
      "corrections",
      "notices",
      "published",
      "original-date"
    ])
      byId(id).replaceChildren();
    byId("date-form").reset();
    for (const name of ["audience", "offer", "region", "goal"])
      byId("brief").elements.namedItem(name).replaceChildren();
  }
  const scenario = next.scenario || {};
  const clientKey = scenario.id === "atelier" ? "a" : next.persona;
  const clientCard = [...byId("client-list").querySelectorAll("[data-session]")].find(
    (button) => button.dataset.session === clientKey
  );
  const company = clientCard?.querySelector("strong")?.textContent || "";
  const subject = scenario.title?.split(" · ").filter((part) => part !== company).join(" · ");
  byId("client-label").textContent = company || scenario.clientLabel || "";
  byId("client-label").hidden = !company && !scenario.clientLabel;
  byId("page-title").textContent = state.persona
    ? subject || scenario.title || (state.persona === "sans" ? "Accès au dossier" : "Votre dossier")
    : "Choisissez un dossier.";
  byId("intro-copy").hidden = Boolean(state.persona);
  byId("reset").hidden = !state.persona || state.persona === "sans" || !state.dossierId;
  byId("connector-slot").hidden = state.persona !== "a" || !run || Boolean(run.closed);
  if (!state.persona) {
    byId("entry").hidden = false;
    return;
  }
  byId("profiles").hidden = false;
  if (state.persona === "sans") {
    byId("denied").hidden = false;
    return;
  }
  const published = Boolean(run?.publishedRevision) || run?.status === "published";
  const working = run?.status === "queued" || run?.status === "processing";
  const inputs = run?.inputs || [];
  renderFixtures(next, inputs, run);
  if (run?.closed) byId("message").textContent = "Dossier clôturé";
  if (working && !run.closed) {
    byId("progress").hidden = false;
    byId("progress-title").textContent = run.status === "queued" ? "Dépôt reçu" : "Traitement en cours";
    timer = setTimeout(() => void refresh(), 1800);
  }
  if (run?.status === "failed") byId("failure").hidden = false;
  if (published) {
    byId("result").hidden = false;
    const count = Number(run.fileCount),
      revision = Number(run.publishedRevision);
    const pieceCount = Object.keys(run.extraction || {}).length;
    byId("delivery-metrics").textContent = [
      pieceCount ? pieceCount + " pièce" + (pieceCount > 1 ? "s réunies" : " réunie") : "",
      count ? count + " document" + (count > 1 ? "s prêts" : " prêt") : ""
    ]
      .filter(Boolean)
      .join(" · ");
    byId("pdf-only").hidden = run.packStatus !== "pdf-only";
    const packHref = validHref(run.packHref);
    const pdfHref = validHref(run.pdfHref);
    const dashboard = byId("dashboard-link");
    dashboard.hidden = !pdfHref;
    if (pdfHref) dashboard.href = pdfHref;
    else dashboard.removeAttribute("href");
    byId("current-pack").hidden = !(packHref && count > 1 && revision >= 1);
    if (packHref && count > 1 && revision >= 1) {
      byId("current-pack-link").href = packHref;
      byId("current-pack-link").textContent = "Télécharger les " + count + " fichiers de cette révision";
    }
    const initialHref = validHref(run.initialPackHref);
    byId("initial-pack").hidden =
      !initialHref || run.hasInitialPack !== true || (count > 1 && !run.corrections?.length);
    if (initialHref) byId("initial-pack-link").href = initialHref;
    renderDeliverables(run);
    byId("summary").textContent = run.summary || "Le tableau de bord est disponible.";
    byId("due-date").textContent = dateFr(run.date);
    byId("date-source").textContent = run.dateSource || "Aucune échéance documentée dans les pièces remises.";
    byId("next-action").textContent = run.action || "Rien à faire pour le moment.";
    const actionOwner = run.actionOwner || (next.persona === "c" ? "Coordination de collecte" : "Client");
    byId("owner").textContent = run.action ? "Responsable · " + actionOwner : "";
    byId("draft-block").hidden = !run.draft;
    byId("draft").textContent = run.draft || "";
    byId("published").textContent =
      "Révision " +
      (run.publishedRevision || run.revision || 1) +
      (run.publishedAt ? " · Livrée le " + timeFr(run.publishedAt) : "");
    const methods = {
      "fixture-replay": "reprise d’une extraction préenregistrée",
      "tesseract-wasm-eng": "reconnaissance optique du scan (Tesseract)",
      "pdf-text": "extraction du texte du PDF"
    };
    const readings = Object.entries(run.extraction || {});
    byId("reading").hidden = !readings.length;
    byId("reading-list").replaceChildren();
    for (const [id, extraction] of readings) {
      const li = document.createElement("li"),
        fixture = next.fixtures.find((f) => f.id === id);
      li.textContent =
        (fixture?.name || "Pièce") + " · " + (methods[extraction?.method] || "Méthode à vérifier");
      byId("reading-list").append(li);
    }
    byId("notices").textContent =
      "Notifications enregistrées dans la boîte de recette · " + run.notifications;
  }
  byId("upload").hidden = Boolean(run?.closed || working);
  byId("piece-title").textContent = run ? "Vos pièces et compléments" : "Vos pièces";
  const remaining = next.fixtures.filter((f) => !inputs.includes(f.id)).length;
  const number = next.fixtures.length;
  byId("piece-help").textContent = run
    ? remaining
      ? "Les pièces restantes sont présélectionnées pour compléter le dossier."
      : "Toutes les pièces d’exemple ont été déposées."
    : "Le lot de " +
      (counts[number] || number) +
      " pièces fictives est prêt. Vous pouvez le déposer en un geste ou choisir les pièces ci-dessous.";
  if (run && !remaining && !run.closed) byId("deposit").hidden = true;
  else byId("deposit").hidden = false;
  if (run) {
    byId("secondary").hidden = false;
    renderHistory(run);
    byId("change-date").hidden = !published || (!run.extractedDate && !run.date) || run.closed || working;
    if (!byId("change-date").open) {
      byId("date-value").value = run.date || "";
      byId("date-reason").value = "";
    }
    byId("original-date").textContent =
      (run.extractedDate
        ? "Valeur extraite · " +
          dateFr(run.extractedDate) +
          " · " +
          (run.extractedDateSource || "Devis du dossier") +
          ". "
        : "Valeur extraite consultable dans le devis du dossier. ") +
      "Date retenue · " +
      dateFr(run.date) +
      ".";
    byId("services-slot").hidden = !published;
    byId("connector-slot").hidden = state.persona !== "a" || run.closed;
    byId("service-actions").hidden = run.closed;
    byId("communication").hidden = run.closed;
    if (run.closed) byId("communication").open = false;
  }
}
async function refresh() {
  clearTimeout(timer);
  const version = ++sequence;
  try {
    let next = await request("/api/dossier");
    if (version !== sequence) return;
    if (initialSelection) {
      if (initialSelection === "banque-alimentaire") {
        if (next.persona !== "c") {
          await request("/api/session", { persona: "c" });
          next = await request("/api/dossier");
        }
        const clean = new URL(location.href);
        clean.searchParams.delete("client");
        history.replaceState(history.state, "", clean.pathname + clean.search + clean.hash);
      }
      initialSelection = null;
    }
    if (version === sequence) {
      render(next);
      byId("retry").hidden = true;
    }
  } catch (e) {
    if (version === sequence) {
      feedback(e.message);
      byId("retry").hidden = false;
    }
  }
}
async function runAction(fn) {
  if (busy) return;
  lock(true);
  feedback();
  clearTimeout(timer);
  sequence++;
  try {
    await fn();
  } catch (e) {
    feedback(e.message);
    byId("retry").hidden = false;
  } finally {
    lock(false);
  }
}
async function fixtureData() {
  const chosen = Array.from(byId("copies").files);
  const allowed = state.fixtures.filter((f) => /^[a-f0-9]{64}$/.test(f.sha256));
  if (chosen.length > allowed.length)
    throw new Error("Sélectionnez uniquement les pièces fournies pour ce dossier.");
  const selected = Array.from(document.querySelectorAll("[name=fixture]:checked"), (el) => el.value);
  const fixtures = allowed.filter((f) => selected.includes(f.id));
  if (!chosen.length && !fixtures.length) throw new Error("Choisissez au moins une pièce du jeu fictif.");
  let buffers;
  if (chosen.length) {
    if (chosen.some((f) => f.size > 100000)) throw new Error("Fichier hors du jeu de recette.");
    buffers = await Promise.all(chosen.map((f) => f.arrayBuffer()));
  } else {
    buffers = await Promise.all(
      fixtures.map(async (f) => {
        const url = new URL(f.url, location.origin);
        if (url.origin !== location.origin) throw new Error("Adresse de pièce indisponible.");
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error("Pièce de recette indisponible.");
        return r.arrayBuffer();
      })
    );
  }
  const result = {};
  for (const b of buffers) {
    if (b.byteLength > 100000) throw new Error("Fichier hors du jeu de recette.");
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (v) =>
      v.toString(16).padStart(2, "0")
    ).join("");
    const id = allowed.find((f) => f.sha256 === digest)?.id;
    if (!id || result[id])
      throw new Error("Chaque pièce doit provenir du jeu fictif et figurer une seule fois dans le lot.");
    result[id] = btoa(Array.from(new Uint8Array(b), (v) => String.fromCharCode(v)).join(""));
  }
  return Object.values(result);
}
document.querySelectorAll("[data-session]").forEach((el) =>
  el.addEventListener("click", () =>
    runAction(async () => {
      await request("/api/session", { persona: el.dataset.session });
      notice();
      byId("copies").value = "";
      await refresh();
    })
  )
);
document
  .querySelectorAll("[data-refresh]")
  .forEach((el) => el.addEventListener("click", () => runAction(refresh)));
byId("deposit").addEventListener("click", () =>
  runAction(async () => {
    const uploads = await fixtureData();
    try {
      const receipt = await request("/api/depot", { uploads, dossier: state.dossierId });
      notice(
        "Lot enregistré" + (receipt?.duplicates ? " · " + receipt.duplicates + " doublon(s) écarté(s)." : ".")
      );
    } catch (e) {
      if (e.status !== 409) throw e;
      notice(e.message);
    }
    await refresh();
  })
);
let serviceGeneration = 0;
function appendText(parent, tag, text, className = "") {
  const el = document.createElement(tag);
  el.textContent = text;
  el.className = className;
  parent.append(el);
  return el;
}
function showDraft(parent, text, label) {
  appendText(parent, "p", text, "draft");
  const copy = appendText(parent, "button", label, "link");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      byId("service-status").textContent = "Brouillon copié.";
    } catch {
      byId("service-status").textContent = "Sélectionnez le texte pour le copier.";
    }
  });
}
function showServices(items) {
  const list = byId("service-results");
  list.replaceChildren();
  for (const service of items) {
    const result = service.result,
      article = document.createElement("article");
    article.className = "paper";
    list.append(article);
    appendText(article, "h3", result.title);
    if (result.text) showDraft(article, result.text, "Copier le brouillon");
    for (const [i, post] of (result.posts || []).entries()) {
      appendText(article, "h4", "Publication " + (i + 1) + " · " + post.when.display + ", " + post.when.hour);
      appendText(article, "p", post.when.zone + " (" + post.when.offset + ") · " + post.reason, "meta");
      showDraft(article, post.text, "Copier la publication " + (i + 1));
    }
    if (result.metric) appendText(article, "p", result.metric, "meta");
  }
}
async function services(payload) {
  const seq = ++serviceGeneration;
  byId("service-status").textContent = payload ? "Préparation du brouillon…" : "Lecture des brouillons…";
  try {
    const data = await request(
      "/api/services",
      payload ? { ...payload, dossier: state.dossierId } : undefined
    );
    if (seq !== serviceGeneration) return;
    if (!Array.isArray(data?.services)) throw new Error("Réponse du service indisponible.");
    for (const name of ["audience", "offer", "region", "goal"]) {
      const select = byId("brief").elements.namedItem(name),
        was = select.value,
        choices = data.communication?.[name];
      if (Array.isArray(choices)) {
        select.replaceChildren(...choices.map((v) => new Option(v, v)));
        if (choices.includes(was)) select.value = was;
      }
    }
    updateBrief();
    showServices(data.services);
    byId("service-status").textContent = payload ? "Brouillon enregistré dans ce dossier." : "";
    if (payload?.kind === "linkedin") byId("communication").open = false;
  } catch (e) {
    if (seq === serviceGeneration) byId("service-status").textContent = e.message;
  }
}
byId("services-slot").addEventListener("toggle", () => {
  if (byId("services-slot").open) void services();
});
document
  .querySelectorAll("[data-service]")
  .forEach((b) => b.addEventListener("click", () => runAction(() => services({ kind: b.dataset.service }))));
byId("brief").addEventListener("submit", (e) => {
  e.preventDefault();
  const brief = Object.fromEntries(new FormData(e.currentTarget));
  void runAction(() => services({ kind: "linkedin", brief }));
});
byId("copies").addEventListener("change", updateDeposit);
byId("change-date").addEventListener("toggle", () => {
  if (byId("change-date").open && state?.run) byId("date-form").dataset.revision = String(state.run.revision);
});
byId("date-form").addEventListener("submit", (e) => {
  e.preventDefault();
  void runAction(async () => {
    await request("/api/correction", {
      dossier: state.dossierId,
      date: byId("date-value").value,
      reason: byId("date-reason").value.trim(),
      revision: Number(byId("date-form").dataset.revision)
    });
    byId("change-date").open = false;
    notice("Correction enregistrée. La nouvelle version est en préparation.");
    await refresh();
  });
});
byId("close").addEventListener("click", () =>
  runAction(async () => {
    await request("/api/cloture", { dossier: state.dossierId, closed: !state.run.closed });
    notice();
    await refresh();
  })
);
let previewUrl = null;
let previewRequest = 0;

function showPdf(file, href) {
  const popup = byId("preview-dialog");
  byId("preview-title").textContent = file.title || file.name;
  byId("preview-download").href = href;
  byId("preview-download").download = file.name;
  byId("preview-frame").replaceChildren();
  byId("preview-status").textContent = "Ouverture du document…";
  popup.showModal();
  const attempt = ++previewRequest;
  fetch(href, { credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) {
        throw new Error("Ce document n’est plus disponible. Actualisez le dossier.");
      }
      const bytes = await response.blob();
      if (attempt !== previewRequest || !popup.open) return;
      previewUrl = URL.createObjectURL(bytes);
      const viewer = document.createElement("iframe");
      viewer.title = "Aperçu du PDF · " + (file.title || file.name);
      viewer.src = previewUrl;
      byId("preview-frame").append(viewer);
      byId("preview-status").textContent =
        "Si votre navigateur ne présente pas l’aperçu, utilisez le téléchargement.";
    })
    .catch((error) => {
      if (attempt === previewRequest) byId("preview-status").textContent = error.message;
    });
}
byId("preview-close").addEventListener("click", () => byId("preview-dialog").close());
byId("preview-dialog").addEventListener("close", () => {
  previewRequest++;
  byId("preview-frame").replaceChildren();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  byId("preview-download").removeAttribute("href");
});

function renderDeliverables(run) {
  const list = byId("deliverable-list");
  const files = run.files || run.deliverables || [];
  const arranged = new Map();
  for (const file of files) {
    const href = validHref(file.href);
    if (!href || typeof file.name !== "string") continue;
    const key = file.key || file.category || file.name;
    if (!arranged.has(key)) arranged.set(key, []);
    arranged.get(key).push({ ...file, href });
  }
  const opened = new Set([...list.querySelectorAll("details[open]")].map((el) => el.dataset.deliverable));
  list.replaceChildren();
  for (const [key, group] of arranged) {
    const [label, description] = labels[key] || [
      group[0].title || group[0].name,
      "Document remis avec cette révision."
    ];
    const heading = key === "preparation" && state?.persona === "c" ? "Préparation logistique" : label;
    const caption =
      key === "preparation" && state?.persona === "c"
        ? "Les horaires, les rôles et les consignes de la collecte."
        : description;
    const details = document.createElement("details");
    details.className = "deliverable";
    details.dataset.deliverable = key;
    details.open = opened.has(key);
    const summary = document.createElement("summary");
    appendText(summary, "strong", heading);
    appendText(summary, "small", caption);
    details.append(summary);
    const actions = document.createElement("div");
    actions.className = "files";
    const pdf = group.find((f) => f.mime === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdf) {
      const preview = appendText(actions, "button", "Aperçu du PDF", "secondary");
      preview.type = "button";
      preview.setAttribute("aria-label", "Aperçu du PDF · " + heading);
      preview.addEventListener("click", () => showPdf({ ...pdf, title: heading }, pdf.href));
    }
    for (const file of group) {
      const ext = file.name.split(".").pop().toUpperCase();
      const link = appendText(actions, "a", "Télécharger " + ext);
      link.href = file.href;
      link.download = file.name;
      link.setAttribute("aria-label", "Télécharger " + heading + " · " + ext);
    }
    details.append(actions);
    list.append(details);
  }
}

let resetTarget = null;
byId("reset").addEventListener("click", () => {
  if (busy || !state?.dossierId) return;
  resetTarget = { persona: state.persona, dossier: state.dossierId };
  if (state.run) {
    byId("reset-copy").textContent =
      "Les pièces, les résultats, les brouillons et les corrections de « " +
      (state.scenario?.title || "ce dossier") +
      " » seront effacés de votre démo. Les autres dossiers conservent leur état.";
    byId("reset-dialog").showModal();
  } else {
    void resetActive();
  }
});
async function resetActive() {
  const target = resetTarget;
  if (!target || target.dossier !== state?.dossierId || target.persona !== state?.persona) return;
  if (byId("reset-dialog").open) byId("reset-dialog").close();
  await runAction(async () => {
    const result = await request("/api/reset", target);
    selectionScope = "";
    await refresh();
    notice(
      result?.reset === false
        ? "Une autre session a déjà changé ce dossier. Son état vient d’être actualisé."
        : "Dossier réinitialisé. Les pièces d’exemple sont prêtes pour un nouveau dépôt."
    );
    byId("deposit").focus();
  });
  resetTarget = null;
}
byId("reset-confirm").addEventListener("click", () => void resetActive());
byId("reset-cancel").addEventListener("click", () => byId("reset-dialog").close());
void refresh();
