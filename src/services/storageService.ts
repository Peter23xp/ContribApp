import * as FileSystem from 'expo-file-system/legacy';
import { CLOUDFLARE_CONFIG } from '../config/cloudflare';

/**
 * SERVICE DE STOCKAGE — Cloudflare R2
 *
 * Architecture :
 * App mobile → Cloudflare Worker (génère URL pré-signée) → Upload direct vers R2
 *
 * Le Cloudflare Worker vérifie le token Firebase avant de générer l'URL pré-signée.
 * Ainsi, seuls les utilisateurs authentifiés peuvent uploader.
 */

// NOTE : Firebase Auth est supprimé (v3.0).
// Le Cloudflare Worker peut être mis à jour pour accepter un sessionToken Firestore
// à la place du JWT Firebase. En attendant, l'upload ne requiert plus de token Firebase.
async function getUidForUpload(): Promise<string> {
  try {
    const { getLocalSession } = await import('./authService');
    const session = await getLocalSession();
    return session?.uid ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// Types de fichiers autorisés
type FileCategory = 'profile_photos' | 'group_photos' | 'receipts' | 'reports';

interface UploadResult {
  url: string;       // URL publique du fichier uploadé
  key: string;       // Clé R2 (chemin dans le bucket)
}



export async function uploadFile(
  localUri: string,
  category: FileCategory,
  fileName?: string
): Promise<UploadResult> {
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) throw new Error('FILE_NOT_FOUND');

  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const contentType = mimeTypes[extension] ?? 'application/octet-stream';

  const uid = await getUidForUpload();
  const timestamp = Date.now();
  const finalFileName = fileName ?? `${uid}_${timestamp}.${extension}`;

  const workerUrl = CLOUDFLARE_CONFIG.workerUrl;
  if (!workerUrl) throw new Error('CLOUDFLARE_WORKER_URL_MISSING');

  const key = `${category}/${finalFileName}`;
  const uploadUrl = `${workerUrl}/upload/${key}`;

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('R2 Upload Error:', uploadResponse.status, errorText);
    throw new Error(`UPLOAD_FAILED (${uploadResponse.status})`);
  }

  const result = await uploadResponse.json();
  return { url: result.url, key: result.key };
}

/**
 * Supprimer un fichier de R2 (via le Worker)
 */
export async function deleteFile(key: string): Promise<void> {
  const workerUrl = CLOUDFLARE_CONFIG.workerUrl;
  if (!workerUrl) return;

  await fetch(`${workerUrl}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
}

/**
 * Upload une photo de profil
 */
export async function uploadProfilePhoto(localUri: string): Promise<string> {
  const { url } = await uploadFile(localUri, 'profile_photos');
  return url;
}

/**
 * Upload un PDF de reçu
 */
export async function uploadReceipt(localUri: string, contributionId: string): Promise<string> {
  const { url } = await uploadFile(localUri, 'receipts', `receipt_${contributionId}.pdf`);
  return url;
}

/**
 * Upload un rapport mensuel (PDF ou Excel)
 */
export async function uploadReport(
  localUri: string,
  groupId: string,
  month: string,
  format: 'pdf' | 'xlsx'
): Promise<string> {
  const { url } = await uploadFile(
    localUri,
    'reports',
    `report_${groupId}_${month}.${format}`
  );
  return url;
}
