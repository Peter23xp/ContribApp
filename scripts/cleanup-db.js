/**
 * Script pour nettoyer la base de données
 * Usage: node scripts/cleanup-db.js
 */

const fs = require('fs');
const path = require('path');

// Chemins possibles de la base de données selon la plateforme
const dbPaths = {
  // Pour le développement avec Expo
  expo: path.join(process.env.HOME || process.env.USERPROFILE, 'Library', 'Application Support', 'Expo', 'contribapp.db'),
  // Chemin alternatif
  expoAlt: path.join(process.env.HOME || process.env.USERPROFILE, '.expo', 'contribapp.db'),
};

console.log('🗑️  Nettoyage de la base de données...\n');

let cleaned = false;

// Essayer de supprimer chaque chemin possible
Object.entries(dbPaths).forEach(([name, dbPath]) => {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`✅ Base de données supprimée: ${name}`);
      console.log(`   Chemin: ${dbPath}\n`);
      cleaned = true;
    }
  } catch (error) {
    console.log(`⚠️  Impossible de supprimer: ${name}`);
    console.log(`   Erreur: ${error.message}\n`);
  }
});

if (!cleaned) {
  console.log('ℹ️  Aucune base de données trouvée aux emplacements standards.\n');
  console.log('📍 Emplacements vérifiés:');
  Object.entries(dbPaths).forEach(([name, dbPath]) => {
    console.log(`   - ${name}: ${dbPath}`);
  });
  console.log('\n💡 La base de données sera recréée au prochain lancement de l\'app.\n');
} else {
  console.log('✨ Nettoyage terminé !');
  console.log('🚀 Relancez l\'application pour recréer la base avec des données fraîches.\n');
}
