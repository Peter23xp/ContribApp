/**
 * dbInit.ts — Initialisation de la base de données
 * 
 * En production, Firestore ne nécessite pas d'initialisation de schéma.
 * Ce fichier est un no-op.
 */
export async function initLocalDatabase(): Promise<void> {
  // No-op : Firestore est utilisé
  console.log('[DB] Firestore mode — pas d\'initialisation nécessaire');
}
