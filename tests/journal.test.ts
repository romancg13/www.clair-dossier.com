import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogPosts, journalReviewAlerts } from '../src/data/blog';
import { readingMinutes } from '../src/data/blog/reading';

test('journal : durée de lecture calculée depuis le texte, jamais codée en dur', () => {
  for (const p of blogPosts) {
    assert.ok(p.wordCount > 150, `${p.slug} : texte trop court`);
    assert.equal(p.readMinutes, readingMinutes(p.wordCount));
  }
});

test('journal : les trois contenus demandés sont publiés, sans doublon de slug', () => {
  const slugs = blogPosts.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of ['organiser-un-dossier', 'conservation-documents', 'rgpd-legaltech']) assert.ok(slugs.includes(s), s);
});

test('journal : dates honnêtes et sources officielles sur les articles révisés', () => {
  for (const p of blogPosts) {
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
    if (p.updated) {
      assert.ok(p.updated >= p.date, `${p.slug} : mise à jour antérieure à la publication`);
      assert.ok((p.sources ?? []).length > 0, `${p.slug} : révisé sans source`);
    }
    assert.notEqual(p.author, '', 'auteur requis');
  }
});

test('journal : alerte de révision pour les articles non revus', () => {
  const alerts = journalReviewAlerts('2026-09-19');
  const slugs = alerts.map((a) => a.slug);
  for (const s of ['ia-droit', 'mediation-contentieux', 'mise-en-demeure']) assert.ok(slugs.includes(s), s);
  assert.ok(!slugs.includes('organiser-un-dossier'));
});
