# Système de Seed - ContribApp

## 📖 Vue d'ensemble

Le système de seed crée automatiquement des données de test au premier lancement de l'application. Cela permet de tester l'application immédiatement sans avoir à créer manuellement des comptes et des groupes.

## 🎯 Données Créées

### Utilisateurs (7)
- 1 Admin
- 1 Trésorière
- 5 Membres

### Groupe (1)
- Nom : "Groupe de Développement"
- Code : DEV2026
- Montant : 50 000 CDF/mois

### Contributions (7)
- 4 payées
- 2 en attente
- 1 en retard

## ⚙️ Configuration

### Activer le Seed (Par défaut)

Le seed est activé par défaut dans `src/services/database.ts` :

```typescript
// Seed automatique en développement
try {
  const { seedDevelopmentData } = await import('./seedData');
  await seedDevelopmentData();
} catch (error) {
  console.log('[DB] ℹ️  Seed ignoré ou déjà effectué');
}
```

### Désactiver le Seed

Pour désactiver le seed automatique, commentez ces lignes dans `src/services/database.ts` :

```typescript
// Seed automatique en développement
// try {
//   const { seedDevelopmentData } = await import('./seedData');
//   await seedDevelopmentData();
// } catch (error) {
//   console.log('[DB] ℹ️  Seed ignoré ou déjà effectué');
// }
```

## 🔄 Réinitialiser les Données

### Méthode 1 : Supprimer la Base de Données

1. Fermez l'application
2. Supprimez le fichier de base de données :
   - **iOS** : `~/Library/Application Support/Expo/contribapp.db`
   - **Android** : `/data/data/[package]/databases/contribapp.db`
3. Relancez l'application

### Méthode 2 : Utiliser la Fonction de Reset

Ajoutez ce code temporairement dans votre application :

```typescript
import { resetAndSeed } from './src/services/seedData';

// Dans un bouton ou au démarrage
await resetAndSeed();
```

### Méthode 3 : Reset Manuel

```typescript
import { resetAllData } from './src/services/seedData';

// Supprimer toutes les données
resetAllData();
```

## 🎨 Personnaliser les Données

### Modifier les Utilisateurs

Éditez `src/services/seedData.ts` :

```typescript
const users = [
  {
    id: 'usr_custom_001',
    full_name: 'Votre Nom',
    phone: '+243900000000',
    operator: 'airtel',
    pin_hash: defaultPinHash,
    role: 'admin',
    is_verified: 1,
  },
  // Ajoutez plus d'utilisateurs...
];
```

### Modifier le Groupe

```typescript
const groupId = 'grp_custom_001';
const inviteCode = 'CUSTOM2026';

db.runSync(
  `INSERT INTO groups (...)`,
  [
    groupId,
    'Mon Groupe Personnalisé',
    'Description personnalisée',
    100000, // Montant personnalisé
    // ...
  ]
);
```

### Modifier les Contributions

```typescript
const contributions = [
  { userId: 'usr_custom_001', status: 'PAYE', paidAt: new Date().toISOString() },
  { userId: 'usr_custom_002', status: 'EN_ATTENTE', paidAt: null },
  // ...
];
```

## 🔐 Sécurité

### PIN par Défaut

Le PIN par défaut est `123456` pour tous les comptes de test. Il est hashé avec SHA-256 :

```typescript
const defaultPinHash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  '123456'
);
```

### Changer le PIN par Défaut

Pour utiliser un autre PIN par défaut :

```typescript
const defaultPinHash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  'VOTRE_PIN_ICI'
);
```

## 📊 Vérifier le Seed

### Logs de Seed

Lors du seed, vous verrez ces logs dans la console :

```
[SEED] 🌱 Création des données de développement...
[SEED] ✅ 7 utilisateurs créés
[SEED] ✅ Groupe créé (Code: DEV2026)
[SEED] ✅ 7 membres ajoutés au groupe
[SEED] ✅ 7 contributions créées pour 2026-04

╔════════════════════════════════════════════════════════╗
║  🎉 DONNÉES DE DÉVELOPPEMENT CRÉÉES AVEC SUCCÈS !     ║
╠════════════════════════════════════════════════════════╣
║  📱 Comptes de test disponibles :                     ║
║  ...                                                   ║
╚════════════════════════════════════════════════════════╝
```

### Vérifier dans la Base de Données

Vous pouvez vérifier les données avec des requêtes SQL :

```typescript
import { getDB } from './database';

const db = getDB();

// Compter les utilisateurs
const users = db.getAllSync('SELECT COUNT(*) as count FROM users');
console.log('Utilisateurs:', users[0].count);

// Compter les groupes
const groups = db.getAllSync('SELECT COUNT(*) as count FROM groups');
console.log('Groupes:', groups[0].count);

// Compter les contributions
const contribs = db.getAllSync('SELECT COUNT(*) as count FROM contributions');
console.log('Contributions:', contribs[0].count);
```

## 🐛 Dépannage

### Le Seed ne se Lance pas

**Problème** : Aucun log de seed dans la console

**Solutions** :
1. Vérifiez que le code de seed n'est pas commenté dans `database.ts`
2. Supprimez la base de données et relancez
3. Vérifiez les erreurs dans la console

### Données Déjà Présentes

**Problème** : Message "Données déjà présentes, seed ignoré"

**Explication** : Le seed vérifie si des utilisateurs existent déjà. Si oui, il ne crée pas de nouvelles données.

**Solution** : Utilisez `resetAndSeed()` pour forcer la recréation.

### Erreur lors du Seed

**Problème** : Erreur pendant la création des données

**Solutions** :
1. Vérifiez que toutes les tables existent
2. Vérifiez les contraintes de clés étrangères
3. Supprimez la base de données et relancez

## 💡 Bonnes Pratiques

### En Développement
- ✅ Gardez le seed activé
- ✅ Utilisez les comptes de test
- ✅ Réinitialisez régulièrement pour tester

### En Production
- ❌ Désactivez le seed
- ❌ Ne créez pas de données de test
- ✅ Laissez les utilisateurs créer leurs propres comptes

## 🔄 Workflow Recommandé

1. **Développement Initial**
   - Seed activé
   - Données de test complètes
   - Tests rapides

2. **Tests Utilisateurs**
   - Seed activé
   - Données réalistes
   - Scénarios variés

3. **Pré-Production**
   - Seed désactivé
   - Données réelles
   - Tests finaux

4. **Production**
   - Seed désactivé
   - Pas de données de test
   - Utilisateurs réels

## 📚 Ressources

- **seedData.ts** : Code source du seed
- **database.ts** : Initialisation de la DB
- **MODE_LOCAL.md** : Guide d'utilisation
- **DATABASE_SCHEMA.md** : Schéma de la DB

## 🎯 Résumé

Le système de seed permet de :
- ✅ Tester l'application immédiatement
- ✅ Avoir des données réalistes
- ✅ Gagner du temps en développement
- ✅ Démontrer l'application facilement
- ✅ Former les utilisateurs avec des exemples

**Note** : N'oubliez pas de désactiver le seed en production !
