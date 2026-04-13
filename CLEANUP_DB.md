# 🗑️ Guide de Nettoyage de la Base de Données

## 🎯 Pourquoi Nettoyer la DB ?

Vous devez nettoyer la base de données si :
- ✅ Vous voulez recommencer avec des données fraîches
- ✅ Vous avez des données corrompues
- ✅ Vous voulez tester le seed à nouveau
- ✅ Vous voulez supprimer toutes les données de test

## 🚀 Méthodes de Nettoyage

### Méthode 1 : Script NPM (Recommandé)

La méthode la plus simple :

```bash
npm run cleanup-db
```

Ce script :
- ✅ Trouve automatiquement la base de données
- ✅ La supprime proprement
- ✅ Affiche un message de confirmation

Ensuite, relancez l'application :

```bash
npm start
```

Les données de test seront recréées automatiquement !

### Méthode 2 : Depuis l'Application

1. Ajoutez le composant DevMenu dans un écran :

```typescript
import { DevMenu } from '../components/dev/DevMenu';

// Dans votre écran
<DevMenu />
```

2. Utilisez les boutons :
   - **Réinitialiser avec Seed** : Supprime et recrée les données
   - **Supprimer Toutes les Données** : Supprime tout sans recréer

3. Redémarrez l'application

### Méthode 3 : Manuellement

#### Sur iOS (Simulateur)

```bash
# Trouver la base de données
find ~/Library/Developer/CoreSimulator -name "contribapp.db"

# Supprimer
rm ~/Library/Application\ Support/Expo/contribapp.db
```

#### Sur Android (Émulateur)

```bash
# Se connecter à l'émulateur
adb shell

# Trouver l'app
cd /data/data/

# Supprimer la DB
rm -rf /data/data/[package]/databases/contribapp.db
```

#### Sur Expo Go

Désinstallez et réinstallez l'application.

### Méthode 4 : Depuis le Code

Créez un fichier temporaire `cleanup.ts` :

```typescript
import { resetAndSeed, resetAllData } from './src/services/seedData';

// Option 1 : Réinitialiser avec seed
await resetAndSeed();

// Option 2 : Supprimer tout
resetAllData();
```

## 📊 Que se Passe-t-il Après ?

### Après le Nettoyage

1. La base de données est supprimée
2. Au prochain lancement, elle est recréée vide
3. Le seed automatique crée les données de test

### Données Recréées

- ✅ 7 utilisateurs (Admin, Trésorière, 5 Membres)
- ✅ 1 groupe "Groupe de Développement"
- ✅ 7 contributions (4 payées, 2 en attente, 1 en retard)
- ✅ Code d'invitation : DEV2026

## 🔍 Vérifier le Nettoyage

### Logs à Surveiller

Après le nettoyage et le redémarrage, vous devriez voir :

```
[SEED] 🌱 Création des données de développement...
[SEED] ✅ 7 utilisateurs créés
[SEED] ✅ Groupe créé (Code: DEV2026)
[SEED] ✅ 7 membres ajoutés au groupe
[SEED] ✅ 7 contributions créées pour 2026-04

╔════════════════════════════════════════════════════════╗
║  🎉 DONNÉES DE DÉVELOPPEMENT CRÉÉES AVEC SUCCÈS !     ║
╚════════════════════════════════════════════════════════╝
```

### Tester la Connexion

Essayez de vous connecter avec :
- **Téléphone** : `+243970123456`
- **PIN** : `123456`

Si ça fonctionne, le nettoyage a réussi ! ✅

## ⚠️ Attention

### Données Perdues

Le nettoyage supprime **TOUTES** les données :
- ❌ Tous les utilisateurs
- ❌ Tous les groupes
- ❌ Toutes les contributions
- ❌ Tout l'historique

**C'est irréversible !**

### En Production

⚠️ **NE JAMAIS** nettoyer la base de données en production !

Cette fonctionnalité est **uniquement pour le développement**.

## 🐛 Problèmes Courants

### "Permission denied"

**Problème** : Impossible de supprimer la DB

**Solution** :
1. Fermez complètement l'application
2. Réessayez le nettoyage
3. Si ça persiste, redémarrez votre ordinateur

### "Database not found"

**Problème** : La DB n'existe pas

**Solution** : C'est normal ! Lancez simplement l'app, elle sera créée.

### Le Seed ne se Lance pas

**Problème** : Pas de données après le nettoyage

**Solution** :
1. Vérifiez les logs de la console
2. Vérifiez que le seed est activé dans `database.ts`
3. Supprimez complètement l'app et réinstallez

### Données Anciennes Persistent

**Problème** : Les anciennes données sont toujours là

**Solution** :
1. Assurez-vous d'avoir fermé l'app
2. Nettoyez le cache Expo : `expo start -c`
3. Supprimez manuellement la DB

## 💡 Conseils

### Développement Quotidien

- 🔄 Nettoyez la DB chaque matin pour des données fraîches
- 📊 Testez différents scénarios en modifiant le seed
- 🎯 Gardez des sauvegardes si vous avez des données importantes

### Tests

- ✅ Nettoyez avant chaque série de tests
- ✅ Vérifiez que le seed fonctionne
- ✅ Testez avec différents rôles

### Débogage

- 🔍 Nettoyez si vous avez des erreurs bizarres
- 🔍 Vérifiez les logs après le nettoyage
- 🔍 Testez la connexion avec les comptes de test

## 📚 Commandes Utiles

```bash
# Nettoyer la DB
npm run cleanup-db

# Lancer l'app avec cache nettoyé
expo start -c

# Voir les logs
expo start --clear

# Réinstaller les dépendances
rm -rf node_modules && npm install
```

## 🎉 Résumé

Pour nettoyer la base de données :

1. **Fermez l'application**
2. **Exécutez** : `npm run cleanup-db`
3. **Relancez** : `npm start`
4. **Connectez-vous** avec un compte de test

C'est tout ! Les données fraîches sont prêtes. ✨

---

**Note** : Le nettoyage est instantané et les données sont recréées automatiquement au prochain lancement.
