const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ⚠️ PRÉREQUIS :
// 1. npm install firebase-admin
// 2. Télécharger votre clé de compte de service depuis la console Firebase
//    (Paramètres du projet > Comptes de service > Générer une nouvelle clé privée)
// 3. Placer le fichier .json téléchargé à la racine du projet sous le nom "serviceAccountKey.json"

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Erreur : Le fichier serviceAccountKey.json est introuvable à la racine de votre projet !");
  console.error("Veuillez le télécharger depuis la console Firebase (Paramètres > Comptes de service).");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestUser() {
  const phone = '+243902238740'; // Remplacez par le numéro souhaité
  const fullName = 'Peter Akilimali';
  
  try {
    console.log(`Création du compte pour le numéro ${phone}...`);
    
    // 1. Créer l'utilisateur dans Firebase Auth
    // Firebase va lui créer un super "uid" qu'on va récupérer
    const userRecord = await admin.auth().createUser({
      phoneNumber: phone,
      displayName: fullName,
    });
    
    console.log('✅ Utilisateur Auth créé avec succès. UID:', userRecord.uid);

    // 2. Créer son profil dans Firestore
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      full_name: fullName,
      phone: phone,
      role: 'admin', // Vous pouvez mettre 'member' ou 'treasurer'
      status: 'active',
      created_at: new Date().toISOString()
    });
    console.log('✅ Document Firestore utilisateur créé avec succès !');

    // 3. Optionnel : Si vous avez une collection statique ou de groupe par défaut,
    //    vous pouvez vous l'assigner ici.
    
    console.log('\nCréation terminée. Vous pouvez injecter ce user manuellement ou utiliser le "Numéro de test".');
    process.exit(0);

  } catch (error) {
    console.error("❌ Erreur lors de la création de l'utilisateur :");
    console.error(error.message);
    process.exit(1);
  }
}

createTestUser();
