import { useEffect, useState, type ReactNode } from 'react';
import sqlCheckRaw from './sql-check.json';
import {
  FRESHNESS_LABEL,
  VALIDITY_DAYS,
  classifyConnection,
  evaluateCheck,
  formatFrDate,
  parseSqlCheck,
  parseVersionMarker,
  type ConnectionState,
  type Freshness,
  type VersionMarker,
} from './status-model';

/**
 * « Indicateurs techniques observables » de /securite.
 *
 * Uniquement ce qui se constate automatiquement, daté, sans détail
 * exploitable : connexion de la page (constat du navigateur), version publiée
 * et contrôles de publication (/version.json, écrit par le déploiement après
 * typage + tests + construction), tests SQL de cloisonnement rejoués hors
 * production (src/components/security/sql-check.json).
 *
 * Hydratation : le pré-rendu et la première passe client affichent le même
 * état neutre ; la date courante, le protocole et /version.json ne sont lus
 * que dans useEffect.
 */

const sqlCheck = parseSqlCheck(sqlCheckRaw);

type PillState = Freshness | 'pending';

const PILL_CLASS: Record<PillState, string> = {
  ok: 'border hairline bg-navy-900/5 text-navy-900',
  stale: 'border hairline-gold bg-gold-500/10 text-gold-700',
  failed: 'border hairline-gold bg-gold-500/10 text-gold-700',
  unavailable: 'border hairline bg-cream-100 text-slate-500',
  pending: 'border hairline bg-cream-100 text-slate-500',
};

function StatePill({ state, label }: { state: PillState; label?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] ${PILL_CLASS[state]}`}
    >
      {label ?? (state === 'pending' ? 'Vérification…' : FRESHNESS_LABEL[state])}
    </span>
  );
}

function Indicator({
  title,
  state,
  pillLabel,
  value,
  method,
}: {
  title: string;
  state: PillState;
  pillLabel?: string;
  value: ReactNode;
  method: string;
}) {
  return (
    <li className="rounded-xl border hairline bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="font-medium text-navy-900">{title}</h3>
        <StatePill state={state} label={pillLabel} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-navy-900">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{method}</p>
    </li>
  );
}

type ClientView = { now: Date; connection: ConnectionState; secureUrl: string };
type VersionView = 'pending' | 'unavailable' | VersionMarker;

export function SecurityIndicators() {
  const [client, setClient] = useState<ClientView | null>(null);
  const [version, setVersion] = useState<VersionView>('pending');

  useEffect(() => {
    const { protocol, hostname, pathname } = window.location;
    setClient({
      now: new Date(),
      connection: classifyConnection(protocol, hostname),
      secureUrl: `https://www.clair-dossier.com${pathname}`,
    });

    let alive = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (alive) setVersion(parseVersionMarker(json) ?? 'unavailable');
      })
      .catch(() => {
        if (alive) setVersion('unavailable');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      alive = false;
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  // 1. Connexion de cette page — constat du navigateur.
  let connState: PillState = 'pending';
  let connValue: ReactNode = 'Vérification dans votre navigateur…';
  if (client) {
    if (client.connection === 'https') {
      connState = 'ok';
      connValue = `Cette page vous est servie par une connexion chiffrée (HTTPS) — constat du ${formatFrDate(client.now.toISOString())}.`;
    } else if (client.connection === 'local') {
      connState = 'unavailable';
      connValue = 'Environnement local : indicateur sans objet hors du domaine publié.';
    } else {
      connState = 'failed';
      connValue = (
        <>
          Cette page ne vous est pas servie en HTTPS.{' '}
          <a href={client.secureUrl} className="border-b hairline-gold font-medium text-navy-900 hover:text-gold-700">
            Ouvrir la version sécurisée
          </a>
          .
        </>
      );
    }
  }

  // 2. Version publiée — /version.json, écrit après typage + tests + construction.
  let buildState: PillState = 'pending';
  let buildValue: ReactNode = 'Lecture du repère de version…';
  if (version === 'unavailable') {
    buildState = 'unavailable';
    buildValue = 'Le repère de version publié n’a pas pu être lu.';
  } else if (version !== 'pending' && client) {
    buildState = evaluateCheck({ checkedAt: version.builtAt, validityDays: VALIDITY_DAYS.build }, client.now);
    const when = formatFrDate(version.builtAt);
    buildValue =
      buildState === 'ok'
        ? `Version ${version.commit.slice(0, 7)} publiée le ${when}, après réussite des contrôles automatiques.`
        : buildState === 'stale'
          ? `Dernière publication le ${when} : plus de ${VALIDITY_DAYS.build} jours, contrôles à refaire.`
          : 'Le repère de version publié est incohérent.';
  }

  // 3. Cloisonnement entre comptes — relevé des tests SQL hors production.
  let sqlState: PillState = 'pending';
  let sqlValue: ReactNode = 'Lecture du dernier relevé…';
  if (!sqlCheck) {
    sqlState = 'unavailable';
    sqlValue = 'Aucun relevé de test exploitable n’est publié avec cette version.';
  } else if (client) {
    sqlState = evaluateCheck(
      { checkedAt: sqlCheck.checkedAt, validityDays: VALIDITY_DAYS.sqlIsolation, failed: sqlCheck.failed > 0 },
      client.now,
    );
    const when = formatFrDate(sqlCheck.checkedAt);
    sqlValue =
      sqlState === 'ok'
        ? `Tests de cloisonnement réussis lors du dernier passage, le ${when}.`
        : sqlState === 'failed'
          ? `Le dernier passage, le ${when}, n’a pas entièrement réussi.`
          : sqlState === 'stale'
            ? `Dernier passage le ${when} : plus de ${VALIDITY_DAYS.sqlIsolation} jours, à refaire.`
            : 'Le relevé de test publié est incohérent.';
  }

  return (
    <div>
      <ul className="grid gap-3 lg:grid-cols-3">
        <Indicator
          title="Connexion de cette page"
          state={connState}
          pillLabel={connState === 'ok' ? 'Constaté' : connState === 'failed' ? 'Non chiffrée' : undefined}
          value={connValue}
          method="Constat fait par votre navigateur au chargement de la page."
        />
        <Indicator
          title="Version publiée"
          state={buildState}
          value={buildValue}
          method="Le site n’est publié qu’après réussite du typage, des tests automatiques et de la construction. Source : repère public /version.json."
        />
        <Indicator
          title="Cloisonnement entre comptes"
          state={sqlState}
          value={sqlValue}
          method="Les règles d’isolation écrites dans le code (Row Level Security) sont rejouées sur une base de test locale. Ce contrôle ne porte pas sur la base de production."
        />
      </ul>
      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-slate-500">
        Un indicateur « Vérifié » n’est ni une certification ni une garantie : un site
        accessible n’est pas, pour autant, un site sûr. Un constat trop ancien
        s’affiche « À revérifier », une donnée manquante « Information
        indisponible ». Les éléments de preuve détaillés sont conservés par
        l’administration et ne sont pas publiés.
      </p>
    </div>
  );
}
