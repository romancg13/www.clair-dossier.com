export const USER_ROLES = [
  'client_particulier',
  'client_entreprise',
  'avocat',
  'collaborateur',
  'admin_cabinet',
  'super_admin',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const privateRedirectPatterns = [
  /^\/dashboard$/,
  /^\/mes-dossiers$/,
  /^\/dossier\/[a-zA-Z0-9_-]+$/,
  /^\/documents$/,
  /^\/messages$/,
  /^\/paiements$/,
  /^\/abonnement$/,
  /^\/parametres$/,
  /^\/creer-dossier$/,
  /^\/tarifs$/,
];

export const publicFormTables = ['contact_requests', 'demo_requests', 'newsletter_subscribers'] as const;
export type PublicFormTable = (typeof publicFormTables)[number];

export function sanitizeText(value: FormDataEntryValue | string | null | undefined, maxLength = 1000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(email: string) {
  return email.length <= 254 && emailPattern.test(email);
}

export function validatePassword(password: string) {
  if (password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre.';
  }
  return '';
}

export function getSafeRedirect(rawRedirect: string | null, fallback = '/dashboard') {
  const redirect = sanitizeText(rawRedirect, 180);
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) return fallback;
  return privateRedirectPatterns.some((pattern) => pattern.test(redirect)) ? redirect : fallback;
}

export function isPublicFormTable(table: string): table is PublicFormTable {
  return (publicFormTables as readonly string[]).includes(table);
}

export function isHoneypotFilled(formData: FormData) {
  return sanitizeText(formData.get('company_website'), 200).length > 0;
}

const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];
const blockedExtensions = ['exe', 'js', 'sh', 'php', 'html', 'htm', 'bat', 'cmd', 'ps1', 'jar', 'msi'];
const allowedMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const maxDocumentBytes = 10 * 1024 * 1024;

export function validateDocumentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.includes(extension) || blockedExtensions.includes(extension)) {
    return 'Type de fichier refusé. Formats autorisés : PDF, PNG, JPG, JPEG, DOC, DOCX.';
  }
  if (file.size <= 0 || file.size > maxDocumentBytes) {
    return 'Le fichier doit être non vide et inférieur à 10 Mo.';
  }
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return 'Le type MIME du fichier est refusé.';
  }
  return '';
}
