import * as FileSystem from 'expo-file-system/legacy';
import { CLOUDFLARE_CONFIG } from '../config/cloudflare';
import { auth } from '../config/firebase';
import { User } from 'firebase/auth';

/**
 * SERVICE DE STOCKAGE — Cloudflare R2
 *
 * Architecture :
 * App mobile → Cloudflare Worker (génère URL pré-signée) → Upload direct vers R2
 *
 * Le Cloudflare Worker vérifie le token Firebase avant de générer l'URL pré-signée.
 * Ainsi, seuls les utilisateurs authentifiés peuvent uploader.
 */

/**
 * Attend que Firebase Auth ait résolu son état de session (évite la race condition
 * au démarrage où auth.currentUser est null avant l'hydratation).
 * Ensuite force le refresh du token JWT pour éviter les tokens expirés (>1h).
 */
async function getAuthToken(): Promise<string> {
  // 1. Attendre la résolution de l'état Auth (onAuthStateChanged wrappé en Promise)
  const user = await new Promise<User | null>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubscribe();
      resolve(u);
    });
  });

  if (!user) {
    throw new Error('FIREBASE_SESSION_REQUIRED');
  }

  // 2. Forcer le refresh du token JWT (évite les tokens expirés après 1 heure)
  const token = await user.getIdToken(true);
  if (!token) {
    throw new Error('FIREBASE_SESSION_REQUIRED');
  }

  return token;
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

  const uid = auth.currentUser?.uid ?? 'unknown';
  const timestamp = Date.now();
  const finalFileName = fileName ?? `${uid}_${timestamp}.${extension}`;

  const workerUrl = CLOUDFLARE_CONFIG.workerUrl;
  if (!workerUrl) throw new Error('CLOUDFLARE_WORKER_URL_MISSING');

  const token = await getAuthToken();
  const key = `${category}/${finalFileName}`;
  const uploadUrl = `${workerUrl}/upload/${key}`;

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Authorization': `Bearer ${token}`,
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
  const token = await getAuthToken();

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
