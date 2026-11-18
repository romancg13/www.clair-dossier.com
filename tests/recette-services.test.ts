import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { linkedin, handleServices } from "../recette/services.mjs";

const brief = { audience: "Syndics", offer: "Étude de menuiseries", region: "Marseille", tone: "Pédagogique", goal: "Demandes de devis", zone: "Europe/Paris" };

test("brief de communication : trois textes datés, futur local, décalage d’été et créneau fourni", () => {
  const now = new Date("2026-03-26T23:30:00Z"); // Vendredi 27 en France.
  const result = linkedin({ ...brief, preferredDay: 5, preferredHour: 12 }, now);
  assert.deepEqual(result.posts.map(p => p.when.date), ["2026-04-03", "2026-04-10", "2026-04-17"]);
  assert.equal(new Set(result.posts.map(p => p.text)).size, 3);
  for (const p of result.posts) {
    assert.equal(p.when.day, "vendredi");
    assert.equal(p.when.hour, "12:00");
    assert.match(p.when.offset, /\+2$/);
    assert.match(p.reason, /relevé pour/);
    assert.match(p.text, /Étude de menuiseries/);
    assert.match(p.text, /#Marseille/);
  }
  const winter = linkedin(brief, new Date("2026-10-24T22:30:00Z"));
  assert.match(winter.posts[0].when.offset, /\+1$/);
  assert.match(winter.posts[0].reason, /test/);
  assert.throws(() => linkedin({ ...brief, zone: "invalide" }));
});

test("brouillons de dossier : persistance, trois questions et aucune donnée de pièce dans le brief", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE dossiers(id TEXT PRIMARY KEY); INSERT INTO dossiers VALUES ('d1'),('d2')");
  const session = { dossierId: "d1" };
  const analysis = { next_actions: ["Vérifier le PV"], deadlines: [{ title: "Retour du PV" }], missing_items: [{ text: "Dossier confidentiel fictif", why: "Vérifier la signature" }] };
  const run = (kind: string) => handleServices({ method: "POST", body: { kind, brief }, db, session, analysis });
  assert.match(run("justificatifs").services[0].result.text, /Dossier confidentiel fictif/);
  assert.match(run("rendezvous").services.find(s => s.kind === "rendezvous").result.text, /3\. Comment obtenir/);
  assert.doesNotMatch(JSON.stringify(run("linkedin").services.find(s => s.kind === "linkedin")), /confidentiel/);
  assert.equal(handleServices({ method: "GET", db, session }).services.length, 3);
  assert.deepEqual(handleServices({ method: "GET", db, session: { dossierId: "d2" } }).services, []);
  db.close();
});
