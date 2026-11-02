#!/bin/bash
# Mesure Lighthouse reproductible : N passes mobile et/ou desktop, métriques extraites.
# Usage: scripts/lh-run.sh <url> <label> <runs> <mobile|desktop>
set -u
URL="$1"; LABEL="$2"; RUNS="${3:-3}"; FORM="${4:-mobile}"
OUT="$HOME/.cache/clairdossier-lh"
mkdir -p "$OUT"
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for i in $(seq 1 "$RUNS"); do
  F="$OUT/${LABEL}-${FORM}-${i}.json"
  if [ "$FORM" = "desktop" ]; then PRESET="--preset=desktop"; else PRESET=""; fi
  # Une erreur de chargement (ex. page d'erreur réseau Chrome) invalide la passe : on la refait.
  for attempt in 1 2 3; do
    npx -y lighthouse@13.5.0 "$URL" $PRESET --output=json --output-path="$F" \
      --only-categories=performance,accessibility,best-practices,seo \
      --chrome-flags="--headless=new --no-first-run" --quiet 2>/dev/null
    [ -f "$F" ] && node -e "process.exit(require('$F').runtimeError ? 1 : 0)" && break
  done
  node -e "
    const r=require('$F');
    const a=r.audits, c=r.categories;
    const ms=(k)=>Math.round(a[k].numericValue);
    console.log(JSON.stringify({run:$i,
      perf:Math.round(c.performance.score*100),
      a11y:Math.round(c.accessibility.score*100),
      bp:Math.round(c['best-practices'].score*100),
      seo:Math.round(c.seo.score*100),
      FCP:ms('first-contentful-paint'),
      LCP:ms('largest-contentful-paint'),
      TBT:ms('total-blocking-time'),
      CLS:a['cumulative-layout-shift'].numericValue.toFixed(3),
      SI:ms('speed-index')}));
  "
done
