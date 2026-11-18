// Les brouillons métier utilisent la dernière livraison publiée. Le générateur marketing reçoit le seul brief.
import { buildService } from '../services.mjs';
import { foodReport } from './collecte.mjs';
import { report as bReport } from './chantier-b.mjs';

const chantier = {
  audience:['syndics de copropriété','architectes en rénovation','gestionnaires de locaux professionnels'],
  offer:['diagnostic de menuiseries avant rénovation','visite de préparation du chantier','entretien des fenêtres en bois'],
  region:['Marseille','Aix-en-Provence','Aubagne'],
};
const collecte = {
  audience:['commerces de proximité','équipes bénévoles','associations de quartier'],
  offer:['préparation d’un don de denrées','organisation d’une collecte solidaire'],
  region:['Marseille','Aix-en-Provence','Bouches-du-Rhône'],
};
const objectifsChantier = ['Demandes de devis','Visites du profil','Échanges en commentaire'];
const objectifsCollecte = ['Prises de contact','Visites du profil','Échanges en commentaire'];

const binding = `FROM runs r JOIN sandboxes s ON s.id=r.sandbox
  WHERE s.id=? AND s.persona=? AND r.id=? AND r.persona=s.persona AND s.persona IN ('a','b','c') AND s.expires>?`;
const fail = (status, error) => ({ status, data: { error } });

function context(delivery) {
  const evidence = JSON.parse(delivery.extraction);
  if (Object.keys(evidence).some(id => ['don','inventaire','tournee','quai'].includes(id))) {
    return foodReport(evidence,delivery.deadline).analysis;
  }
  if (evidence['devis-b'] || evidence['reception-b']) {
    return bReport(evidence,delivery.deadline).analysis;
  }
  const missing_items = [];
  if (!evidence.devis) missing_items.push({text:'Devis CD-041',why:'Le devis ne figure pas dans le lot publié.'});
  if (!evidence.scan) missing_items.push({text:'Bon de réception',why:'La réception ne peut pas être vérifiée sans cette pièce.'});
  else missing_items.push({text:'Bon de réception signé',why:'La copie numérisée publiée ne porte pas de signature (page 1).'});
  return {missing_items, next_actions:[delivery.action], deadlines:delivery.deadline?[{title:'Retour du procès-verbal'}]:[]};
}

export async function handleDossierServices(db, sandbox, method, body) {
  if (!['GET','POST'].includes(method)) return fail(405,'Méthode non autorisée.');
  const scope = () => [sandbox.id, sandbox.persona, sandbox.dossierId, Date.now()];
  const association = sandbox.persona === 'c';
  const communication = {
    ...(association ? collecte : chantier),
    goal: association ? objectifsCollecte : objectifsChantier,
  };
  const run = await db.prepare(`SELECT r.id,r.closed,r.published_revision revision ${binding}`).bind(...scope()).first();
  if (!run?.revision) return fail(409,'Une première livraison est nécessaire pour accéder aux prestations.');
  if (method === 'POST') {
    if (run.closed) return fail(409,'Le dossier est clôturé.');
    const delivery = await db.prepare('SELECT action,extraction,deadline FROM deliveries WHERE run_id=? AND revision=?')
      .bind(run.id,run.revision).first();
    if (!delivery) return fail(409,'La livraison est en cours de mise à jour.');
    if (body?.kind === 'linkedin' && Object.entries(communication).some(([field,choices])=>!choices.includes(body.brief?.[field]))) {
      return fail(400,'Sélectionnez une cible, une offre et une zone du jeu de communication fictif.');
    }
    let result;
    try { result = buildService(body,body?.kind === 'linkedin' ? null : context(delivery), association ? 'collecte' : 'chantier'); }
    catch (e) {
      if (e.status === 400 || e.status === 409) return fail(e.status,e.message);
      throw e;
    }
    const saved = await db.prepare(`INSERT INTO service_drafts(run_id,kind,result,updated)
      SELECT r.id,?,?,? ${binding} AND r.id=? AND r.closed=0 AND r.published_revision=?
      ON CONFLICT(run_id,kind) DO UPDATE SET result=excluded.result,updated=excluded.updated RETURNING kind`)
      .bind(body.kind,JSON.stringify(result),new Date().toISOString(),...scope(),run.id,run.revision).first();
    if (!saved) return fail(409,'Le dossier a changé. Rouvrez-le avant de renouveler la demande.');
  }
  const rows = await db.prepare(`SELECT kind,result,updated FROM service_drafts
    WHERE run_id IN (SELECT r.id ${binding} AND r.id=?) ORDER BY updated DESC`).bind(...scope(),run.id).all();
  return {status:200,data:{communication,services:rows.results.map(r=>({kind:r.kind,result:JSON.parse(r.result),updated:r.updated}))}};
}
