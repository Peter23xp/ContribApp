import * as FileSystem from 'expo-file-system/legacy';
import { CLOUDFLARE_CONFIG } from '../config/cloudflare';
import { auth } from '../config/firebase';

/**
 * SERVICE DE STOCKAGE — Cloudflare R2
 * 
 * Architecture :
 * App mobile → Cloudflare Worker (génère URL pré-signée) → Upload direct vers R2
 * 
 * Le Cloudflare Worker vérifie le token Firebase avant de générer l'URL pré-signée.
 * Ainsi, seuls les utilisateurs authentifiés peuvent uploader.
 */

// Types de fichiers autorisés
type FileCategory = 'profile_photos' | 'group_photos' | 'receipts' | 'reports';

interface UploadResult {
  url: string;       // URL publique du fichier uploadé
  key: string;       // Clé R2 (chemin dans le bucket)
}



/**
 * Obtient une URL pré-signée depuis le Cloudflare Worker
 */
async function getPresignedUrl(
  fileName: string,
  contentType: string,
  category: FileCategory
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const response = await fetch(`${CLOUDFLARE_CONFIG.workerUrl}/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName, contentType, category }),
  });

  if (!response.ok) throw new Error('PRESIGN_FAILED');
  return response.json();
}

/**
 * Upload un fichier local (URI expo) vers Cloudflare R2
 */
export async function uploadFile(
  localUri: string,
  category: FileCategory,
  fileName?: string
): Promise<UploadResult> {
  // Lire les infos du fichier
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) throw new Error('FILE_NOT_FOUND');

  // Déterminer le type MIME
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const contentType = mimeTypes[extension] ?? 'application/octet-stream';

  // Nom de fichier unique
  const uid = auth.currentUser?.uid ?? 'unknown';
  const timestamp = Date.now();
  const finalFileName = fileName ?? `${uid}_${timestamp}.${extension}`;

  // Obtenir l'URL pré-signée
  const { uploadUrl, publicUrl, key } = await getPresignedUrl(
    finalFileName,
    contentType,
    category
  );

  // Upload direct vers R2 (PUT avec le fichier en body)
  const uploadResponse = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
    uploadType: 1, // FileSystemUploadType.BINARY_CONTENT = 1
  });

  if (uploadResponse.status !== 200) throw new Error('UPLOAD_FAILED');

  return { url: publicUrl, key };
}

/**
 * Supprimer un fichier de R2 (via le Worker)
 */
export async function deleteFile(key: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  await fetch(`${CLOUDFLARE_CONFIG.workerUrl}/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
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
