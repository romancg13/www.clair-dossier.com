// Coût d'un appel au modèle. Contrairement à estimateCostCents (0 pour un modèle
// inconnu, ce qui désarmait les budgets), un identifiant inconnu est compté au
// tarif le plus élevé connu : un budget n'est jamais contourné par un nom de modèle.
import { MODEL_PRICES_USD_PER_MTOK } from '../ai-pipeline.ts';

export function normalizeModel(model: string | null | undefined): string {
  return (model ?? '').replace(/^anthropic\//, '').replace(/\./g, '-').replace(/-\d{8}$/, '');
}

export function costCents(model: string | null | undefined, inputTokens: number, outputTokens: number, usdToEur = 0.92): number {
  const known = MODEL_PRICES_USD_PER_MTOK[normalizeModel(model)];
  const p = known ?? Object.values(MODEL_PRICES_USD_PER_MTOK).reduce((a, b) => (b.output > a.output ? b : a));
  const usd = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Math.round(usd * usdToEur * 100 * 100) / 100;
}
