// Connexion directe d'une messagerie — implémentation Supabase de `MailStore`
// (rôle serveur). Partagée par mail-oauth et mail-sync. Le client Supabase est
// reçu en paramètre : ce fichier n'importe aucune dépendance externe.
//
// Les jetons ne quittent ce module que déchiffrés EN MÉMOIRE, pour un appel
// immédiat au fournisseur : ils ne sont jamais journalisés ni renvoyés.

import { sanitizeInboundName } from './inbound-email.ts';
import { bareAddress, decryptToken, encryptToken, type DossierContext, type MailMessage } from './mail-connect.ts';
import { MailTransient, type MailConnection, type MailStore, type MailTokens, type MessageOutcome } from './mail-sync-core.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

const BUCKET = 'documents';
export const CONNECTION_COLUMNS =
  'id,user_id,provider,address,status,import_since,scope_label,dossier_id,sync_cursor,subscription_id,watch_expires_at';
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 10 * 60_000;

export function createMailStore(db: Db, env: { tokenKey: string; inboundDomain: string }): MailStore {
  return {
    async loadTokens(conn: MailConnection): Promise<MailTokens | null> {
      const { data } = await db
        .from('mail_connection_tokens')
        .select('refresh_token_enc,access_token_enc,access_expires_at')
        .eq('connection_id', conn.id)
        .maybeSingle();
      if (!data) return null;
      const refreshToken = await decryptToken(env.tokenKey, data.refresh_token_enc, conn.id);
      let accessToken: string | null = null;
      if (data.access_token_enc) {
        try {
          accessToken = await decryptToken(env.tokenKey, data.access_token_enc, conn.id);
        } catch {
          accessToken = null;
        }
      }
      return { refreshToken, accessToken, accessExpiresAtMs: data.access_expires_at ? Date.parse(data.access_expires_at) : null };
    },

    async saveTokens(conn: MailConnection, tokens: MailTokens): Promise<void> {
      const { error } = await db.from('mail_connection_tokens').upsert(
        {
          connection_id: conn.id,
          refresh_token_enc: await encryptToken(env.tokenKey, tokens.refreshToken, conn.id),
          access_token_enc: tokens.accessToken ? await encryptToken(env.tokenKey, tokens.accessToken, conn.id) : null,
          access_expires_at: tokens.accessExpiresAtMs ? new Date(tokens.accessExpiresAtMs).toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'connection_id' },
      );
      if (error) throw new MailTransient('enregistrement des jetons impossible');
    },

    async eraseTokens(conn: MailConnection): Promise<void> {
      await db.from('mail_connection_tokens').delete().eq('connection_id', conn.id);
    },

    async updateConnection(id: string, patch: Record<string, unknown>): Promise<void> {
      const { error } = await db.from('mail_connections').update(patch).eq('id', id);
      if (error) throw new MailTransient(`mise à jour de la connexion : ${String(error.message ?? '').slice(0, 200)}`);
    },

    async logEvent(conn: MailConnection, type: string, detail: string | null): Promise<void> {
      await db.from('mail_connection_events').insert({ connection_id: conn.id, user_id: conn.user_id, type: type.slice(0, 60), detail: detail?.slice(0, 500) ?? null });
    },

    async claimMessage(conn: MailConnection, messageId: string): Promise<string | null> {
      const ins = await db
        .from('mail_messages')
        .insert({ connection_id: conn.id, user_id: conn.user_id, provider: conn.provider, message_id: messageId })
        .select('id')
        .maybeSingle();
      if (!ins.error && ins.data) return ins.data.id as string;
      // Déjà connu : reprise seulement d'un échec passager (tentatives bornées)
      // ou d'une prise en charge restée en suspens.
      const { data: row } = await db
        .from('mail_messages')
        .select('id,status,attempts,updated_at')
        .eq('user_id', conn.user_id)
        .eq('provider', conn.provider)
        .eq('message_id', messageId)
        .maybeSingle();
      if (!row) throw new MailTransient('prise en charge du message impossible');
      const stale = row.status === 'received' && Date.now() - Date.parse(row.updated_at) > STALE_CLAIM_MS;
      if (!((row.status === 'error' || stale) && row.attempts < MAX_ATTEMPTS)) return null;
      const upd = await db
        .from('mail_messages')
        .update({ status: 'received', attempts: row.attempts + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('attempts', row.attempts)
        .select('id')
        .maybeSingle();
      return upd.data ? (upd.data.id as string) : null;
    },

    async finishMessage(rowId: string, outcome: MessageOutcome): Promise<void> {
      const { error } = await db.from('mail_messages').update({ ...outcome, updated_at: new Date().toISOString() }).eq('id', rowId);
      if (error) throw new MailTransient('enregistrement du message impossible');
    },

    async hasReception(conn: MailConnection): Promise<boolean> {
      const { data } = await db.rpc('mail_connection_has_reception', { p_connection: conn.id });
      return data === true;
    },

    async dossierContext(conn: MailConnection, msg: MailMessage): Promise<DossierContext> {
      const { data: dossiers } = await db
        .from('dossiers')
        .select('id,title,status')
        .eq('user_id', conn.user_id)
        .is('deleted_at', null)
        .limit(500);
      const all = ((dossiers ?? []) as { id: string; title: string | null; status: string }[]);
      // Clôture : dernier événement de cycle de vie, à défaut statut « archive »
      // (même règle que public.dossier_is_closed).
      const closed = new Map<string, boolean>();
      if (all.length) {
        const { data: events } = await db
          .from('dossier_events')
          .select('dossier_id,type,created_at')
          .in('dossier_id', all.map((d) => d.id))
          .in('type', ['dossier_cloture', 'dossier_rouvert'])
          .order('created_at', { ascending: true });
        for (const e of (events ?? []) as { dossier_id: string; type: string }[]) closed.set(e.dossier_id, e.type === 'dossier_cloture');
      }
      const openDossiers = all.filter((d) => !(closed.has(d.id) ? closed.get(d.id) : d.status === 'archive')).map((d) => ({ id: d.id, title: d.title }));

      let threadDossierId: string | null = null;
      if (msg.threadId) {
        const { data: prior } = await db
          .from('mail_messages')
          .select('dossier_id')
          .eq('connection_id', conn.id)
          .eq('thread_id', msg.threadId)
          .not('dossier_id', 'is', null)
          .in('status', ['stored', 'queued', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(1);
        threadDossierId = (prior?.[0]?.dossier_id as string | undefined) ?? null;
      }

      const inboundAddressDossiers: Record<string, string> = {};
      if (env.inboundDomain) {
        const { data: addrs } = await db.from('inbound_addresses').select('local_part,dossier_id').eq('user_id', conn.user_id).is('revoked_at', null);
        for (const a of (addrs ?? []) as { local_part: string; dossier_id: string }[]) inboundAddressDossiers[a.local_part] = a.dossier_id;
      }

      const senderDossierIds: string[] = [];
      const sender = bareAddress(msg.from);
      if (sender) {
        const { data: classified } = await db
          .from('mail_messages')
          .select('from_addr,dossier_id')
          .eq('user_id', conn.user_id)
          .not('classified_at', 'is', null)
          .not('dossier_id', 'is', null)
          .order('classified_at', { ascending: false })
          .limit(200);
        for (const r of (classified ?? []) as { from_addr: string | null; dossier_id: string }[]) {
          if (bareAddress(r.from_addr) === sender) senderDossierIds.push(r.dossier_id);
        }
      }

      return { connectionDossierId: conn.dossier_id, threadDossierId, inboundAddressDossiers, inboundDomain: env.inboundDomain, senderDossierIds, openDossiers };
    },

    /** Même dépôt vérifié que la réception par e-mail : objet envoyé puis ligne
     *  insérée ; objet retiré si l'insertion échoue. Le déclencheur existant
     *  documents_ai_enqueue met l'analyse en file si le dossier est activé. */
    async storePiece(dossierId: string, userId: string, fileName: string, bytes: Uint8Array, contentType: string | null): Promise<boolean> {
      const path = `${userId}/${dossierId}/mail-${Date.now()}-${sanitizeInboundName(fileName)}`;
      const up = await db.storage.from(BUCKET).upload(path, bytes as unknown as ArrayBuffer, {
        contentType: contentType ?? 'application/octet-stream',
        upsert: false,
      });
      if (up.error) return false;
      const ins = await db
        .from('dossier_documents')
        .insert({ dossier_id: dossierId, user_id: userId, file_path: path, file_name: fileName.slice(0, 200), kind: 'piece', size_bytes: bytes.byteLength })
        .select('id')
        .maybeSingle();
      if (ins.error || !ins.data) {
        await db.storage.from(BUCKET).remove([path]);
        return false;
      }
      return true;
    },

    async logDossierEvent(dossierId: string, userId: string, label: string): Promise<void> {
      await db.from('dossier_events').insert({ dossier_id: dossierId, user_id: userId, type: 'email_recu', label: label.slice(0, 300) });
    },
  };
}
