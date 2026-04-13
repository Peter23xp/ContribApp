/**
 * Script TypeScript pour réinitialiser la base de données
 * À utiliser dans l'application
 */

import { resetAndSeed } from '../src/services/seedData';

export async function resetDatabase() {
  console.log('🔄 Réinitialisation de la base de données...\n');
  
  try {
    await resetAndSeed();
    console.log('\n✅ Base de données réinitialisée avec succès !');
    console.log('🎉 Nouvelles données de test créées.\n');
    return true;
  } catch (error) {
    console.error('\n❌ Erreur lors de la réinitialisation:', error);
    return false;
  }
}

// Si exécuté directement
if (require.main === module) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
