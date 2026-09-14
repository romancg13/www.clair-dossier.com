#!/usr/bin/env python3
"""
Garde-fou PreToolUse (Claude Code) — ClairDossier, MASTER_PROMPT II.3.3 / I.3.

Bloque toute commande Bash contenant un motif destructif non explicitement
whitelisté : suppression de table, de bucket, de webhook, de produit/prix Stripe,
de compte, de policy, de migration ; push forcé ; reset de base ; rm -rf.

Entrée : JSON du hook sur stdin ({"tool_name": "Bash", "tool_input": {"command": "..."}})
         ou, à défaut, la commande en argv[1].
Sortie : code 0 = autorisé ; code 2 = BLOQUÉ (le harness annule l'appel et
         affiche le message stderr à l'agent).

Règle de conception : ce script ne prend aucune décision métier. Il refuse
mécaniquement ; seule une personne peut lever le blocage en exécutant elle-même
la commande ou en ajoutant un motif à ALLOWLIST (avec justification commitée).
"""
import json
import re
import sys

# Motifs BLOQUÉS (insensibles à la casse). Chaque entrée : (regex, motif humain).
DENY_PATTERNS = [
    (r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b", "rm -rf"),
    (r"\bgit\s+push\b[^\n|;&]*(--force|-f\b|--force-with-lease)", "git push --force"),
    (r"\bgit\s+push\b[^\n|;&]*\borigin\s+main\b", "git push direct sur main (production GitHub Pages)"),
    (r"\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|branch\s+-D|checkout\s+--\s+\.)", "git destructif (reset --hard / clean -f / branch -D)"),
    (r"\bsupabase\s+db\s+reset\b", "supabase db reset"),
    (r"\bsupabase\s+(projects?|functions?|secrets?)\s+delete\b", "supabase delete"),
    (r"\bstripe\s+(products?|prices?|customers?|subscriptions?|webhook_endpoints?)\s+(delete|del|cancel)\b", "stripe delete/cancel"),
    (r"\bdrop\s+(table|schema|database|policy|function|trigger|index|bucket|extension)\b", "DROP …"),
    (r"\btruncate\s+(table\s+)?\w+", "TRUNCATE"),
    (r"\bdelete\s+from\s+\w+", "DELETE FROM"),
    (r"\balter\s+table\b[^\n;]*\b(drop|rename)\b", "ALTER TABLE … DROP/RENAME"),
    (r"storage\.(delete_bucket|empty_bucket)|\bdelete_bucket\b|\bempty_bucket\b", "suppression de bucket Storage"),
    (r"\bauth\.admin\.deleteUser\b|\bdeleteUser\(", "suppression de compte utilisateur"),
    (r"\bdrop\s+policy\b|\bdisable\s+row\s+level\s+security\b", "suppression/désactivation RLS"),
    (r"\bgh\s+(repo|release|secret|api\s+-X\s+DELETE)\b[^\n]*\b(delete|DELETE)\b", "gh delete"),
    (r"\bnpm\s+(publish|deprecate|unpublish)\b", "npm publish/unpublish"),
    (r"\bcurl\b[^\n]*-X\s*DELETE", "curl DELETE"),
    (r">\s*(supabase/migrations/\d+_[^\s]+\.sql)\b", "écrasement d'une migration existante par redirection"),
    (r"\bsed\s+-i\b[^\n]*\bsupabase/migrations/", "édition in-place d'une migration existante"),
]

# Motifs AUTORISÉS malgré une correspondance ci-dessus (vérifiés avant DENY).
# À n'étendre qu'avec une justification commitée.
ALLOWLIST = [
    # Déploiement production du 2026-09-15, demandé explicitement par le
    # propriétaire (message « MASTER PROMPT — INTÉGRATION … EN PRODUCTION »).
    # Forme préfixée volontairement : la commande nue reste bloquée.
    r"\bCLAIRDOSSIER_DEPLOY=20260915\s+git\s+push\s+origin\s+main\b",
    r"\brm\s+-rf\s+(\./)?(dist|node_modules|\.vite|\.netlify|coverage|playwright-report|test-results)(/|\s|$)",
    r"\bgit\s+branch\s+-D\s+(tmp|wip)/",  # branches jetables explicitement préfixées
]


def extract_command() -> str:
    raw = ""
    if not sys.stdin.isatty():
        try:
            raw = sys.stdin.read()
        except Exception:
            raw = ""
    if raw.strip():
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                if payload.get("tool_name") not in (None, "Bash"):
                    return ""  # ne concerne pas Bash
                ti = payload.get("tool_input") or {}
                if isinstance(ti, dict):
                    return str(ti.get("command", ""))
                return str(ti)
        except json.JSONDecodeError:
            return raw
    if len(sys.argv) > 1:
        return " ".join(sys.argv[1:])
    return ""


def main() -> int:
    cmd = extract_command()
    if not cmd.strip():
        return 0
    flat = cmd.replace("\\\n", " ")
    for allow in ALLOWLIST:
        if re.search(allow, flat, flags=re.IGNORECASE):
            return 0
    for pattern, label in DENY_PATTERNS:
        if re.search(pattern, flat, flags=re.IGNORECASE):
            sys.stderr.write(
                "BLOQUÉ par scripts/guard_destructive.py — motif destructif « "
                + label
                + " » (MASTER_PROMPT I.3 / II.3.3). "
                "Cette action exige une exécution humaine explicite ou un ajout justifié à ALLOWLIST.\n"
                "Commande refusée : " + flat.strip()[:400] + "\n"
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
