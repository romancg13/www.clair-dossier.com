import { supabase } from './supabase';
import { sanitizeText, validateDocumentFile } from './security';

const documentBucket = 'case-documents';
const signedUrlTtlSeconds = 300;

export async function uploadCaseDocument(caseId: string, file: File) {
  const validationError = validateDocumentFile(file);
  if (validationError) return { ok: false, message: validationError };
  if (!supabase) return { ok: false, message: 'Une erreur est survenue. Veuillez réessayer.' };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    if (userError) console.error('Erreur session upload document', userError);
    return { ok: false, message: 'Accès refusé.' };
  }

  const safeCaseId = sanitizeText(caseId, 80);
  const safeName = sanitizeText(file.name, 180).replace(/[^\w.\- ]+/g, '_');
  const path = `${userData.user.id}/${safeCaseId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(documentBucket).upload(path, file, {
    cacheControl: '0',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) {
    console.error('Erreur upload document Supabase', uploadError);
    return { ok: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
  }

  const { error: insertError } = await supabase.from('documents').insert({
    case_id: safeCaseId,
    owner_id: userData.user.id,
    file_path: path,
    file_name: safeName,
    confidentiality: 'private',
  });
  if (insertError) {
    console.error('Erreur métadonnées document Supabase', insertError);
    await supabase.storage.from(documentBucket).remove([path]);
    return { ok: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
  }

  return { ok: true, message: 'Document envoyé.', path };
}

export async function createDocumentSignedUrl(filePath: string) {
  if (!supabase) return { ok: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
  const { data, error } = await supabase.storage
    .from(documentBucket)
    .createSignedUrl(filePath, signedUrlTtlSeconds);
  if (error || !data?.signedUrl) {
    if (error) console.error('Erreur signed URL document', error);
    return { ok: false, message: 'Une erreur est survenue. Veuillez réessayer.' };
  }
  return { ok: true, url: data.signedUrl };
}
