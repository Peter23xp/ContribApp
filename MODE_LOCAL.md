# Mode Local - ContribApp

## 🎯 Vue d'ensemble

L'application fonctionne maintenant **100% en local** avec SQLite, sans dépendre d'une API externe. Toutes les données sont stockées localement sur l'appareil.

## 🚀 Démarrage Rapide

### 1. Installation
```bash
npm install
```

### 2. Lancement
```bash
npm start
```

### 3. Données de Test

Au premier lancement, l'application crée automatiquement des données de test :

#### 👑 Compte Admin
- **Téléphone** : `+243970123456`
- **PIN** : `123456`
- **Rôle** : Administrateur du groupe

#### 💰 Compte Trésorière
- **Téléphone** : `+243890234567`
- **PIN** : `123456`
- **Rôle** : Trésorière du groupe

#### 👤 Compte Membre (Jean)
- **Téléphone** : `+243810345678`
- **PIN** : `123456`
- **Rôle** : Membre simple

#### 👥 Autres Membres
- Sarah : `+243900456789` (PIN: 123456)
- Patrick : `+243970567890` (PIN: 123456)
- Esther : `+243890678901` (PIN: 123456)
- David : `+243810789012` (PIN: 123456)

### 4. Groupe de Test

**Nom** : Groupe de Développement  
**Code d'invitation** : `DEV2026`  
**Montant mensuel** : 50 000 CDF  
**Échéance** : 25 du mois  
**Pénalité** : 5 000 CDF (activée)

## 📊 État des Contributions

Les données de test incluent des contributions variées :
- ✅ **4 membres** ont payé (Marie, Grace, Jean, Esther)
- ⏳ **2 membres** en attente (Sarah, David)
- ⚠️ **1 membre** en retard (Patrick)

## 🔧 Fonctionnalités Disponibles

### ✅ Fonctionnent en Local

1. **Authentification**
   - Inscription avec OTP (affiché dans la console)
   - Connexion avec PIN
   - Connexion biométrique
   - Gestion des sessions

2. **Gestion de Groupe**
   - Créer un groupe
   - Modifier les paramètres
   - Inviter des membres (code d'invitation)
   - Gérer les rôles
   - Suspendre/Retirer des membres

3. **Contributions**
   - Voir le statut de sa contribution
   - Historique des paiements
   - Progression du groupe
   - Calcul automatique des pénalités

4. **Tableaux de Bord**
   - Dashboard Admin
   - Dashboard Trésorière
   - Dashboard Membre
   - Statistiques en temps réel

5. **Paiements (Simulés)**
   - Initiation de paiement
   - Simulation de confirmation
   - Génération de reçus

### ⚠️ Simulées (Pas de vraie intégration)

1. **Paiements Mobile Money**
   - Les paiements sont simulés localement
   - Pas de vraie connexion aux opérateurs
   - Confirmation automatique après 2 secondes

2. **Envoi de SMS/OTP**
   - Les OTP sont affichés dans la console
   - Pas d'envoi réel de SMS

3. **Notifications Push**
   - Les rappels sont loggés dans la console
   - Pas de vraies notifications

4. **Export Excel/PDF**
   - Génération d'URLs fictives
   - Pas de vrais fichiers générés

## 🗄️ Base de Données

### Emplacement
- **iOS** : `~/Library/Application Support/Expo/contribapp.db`
- **Android** : `/data/data/[package]/databases/contribapp.db`

### Réinitialiser les Données

Pour supprimer toutes les données et recommencer :

```typescript
import { resetAndSeed } from './src/services/seedData';

// Dans votre code
await resetAndSeed();
```

Ou supprimer manuellement la base de données et relancer l'app.

## 🔍 Débogage

### Voir les OTP dans la Console

Lors de l'inscription ou de la connexion, l'OTP est affiché dans la console :

```
╔════════════════════════════════════╗
║  📱 OTP POUR +243970123456         ║
║  🔑 CODE : 123456                  ║
║  📋 CONTEXTE : register            ║
║  ⏱  Expire dans 2 minutes          ║
╚════════════════════════════════════╝
```

### Logs des Opérations

Toutes les opérations importantes sont loggées :

```
[SEED] 🌱 Création des données de développement...
[SEED] ✅ 7 utilisateurs créés
[SEED] ✅ Groupe créé (Code: DEV2026)
[LOCAL] Initiation paiement: { txId: 'tx_...', ... }
[LOCAL] Vérification statut transaction: tx_...
```

## 📱 Scénarios de Test

### Scénario 1 : Membre qui Paie

1. Se connecter avec Jean (`+243810345678`, PIN: `123456`)
2. Voir le dashboard membre
3. Cliquer sur "PAYER MAINTENANT"
4. Choisir un opérateur
5. Entrer le numéro de téléphone
6. Confirmer le paiement
7. Attendre la confirmation (2 secondes)
8. Voir le reçu

### Scénario 2 : Admin qui Gère

1. Se connecter avec Marie (`+243970123456`, PIN: `123456`)
2. Voir le dashboard admin
3. Voir la liste des membres
4. Envoyer des rappels
5. Voir les statistiques

### Scénario 3 : Nouveau Membre

1. Créer un nouveau compte (inscription)
2. Entrer l'OTP affiché dans la console
3. Rejoindre le groupe avec le code `DEV2026`
4. Voir sa contribution à payer

## 🔐 Sécurité

### PINs Hashés
Tous les PINs sont hashés avec SHA-256 avant stockage.

### Tokens Locaux
Les tokens JWT sont générés localement et stockés dans SecureStore.

### Données Sensibles
- Les PINs ne sont jamais stockés en clair
- Les tokens sont dans SecureStore (chiffré)
- Les OTP expirent après 2 minutes

## 🎨 Personnalisation

### Modifier les Données de Seed

Éditez `src/services/seedData.ts` pour :
- Ajouter plus d'utilisateurs
- Changer les montants
- Modifier les statuts de paiement
- Créer plusieurs groupes

### Désactiver le Seed Automatique

Dans `src/services/database.ts`, commentez :

```typescript
// Seed automatique en développement
// try {
//   const { seedDevelopmentData } = await import('./seedData');
//   await seedDevelopmentData();
// } catch (error) {
//   console.log('[DB] ℹ️  Seed ignoré ou déjà effectué');
// }
```

## 🚧 Limitations du Mode Local

1. **Pas de synchronisation** entre appareils
2. **Pas de backup** automatique
3. **Paiements simulés** (pas de vraie intégration Mobile Money)
4. **SMS simulés** (OTP dans la console)
5. **Pas de notifications** push réelles
6. **Pas d'export** Excel/PDF réel

## 🔄 Migration vers Production

Pour passer en production avec un vrai backend :

1. Implémenter les endpoints API (voir `CLEANUP_REPORT.md`)
2. Configurer l'URL de l'API dans `.env`
3. Remplacer les implémentations locales par des appels API
4. Intégrer les vraies APIs Mobile Money
5. Configurer un service SMS pour les OTP
6. Implémenter les notifications push

## 📚 Documentation Complémentaire

- **ARCHITECTURE.md** : Architecture de l'application
- **DATABASE_SCHEMA.md** : Schéma de la base de données
- **CLEANUP_REPORT.md** : Rapport de nettoyage des données mockées

## 💡 Conseils

1. **Utilisez les logs** pour comprendre ce qui se passe
2. **Testez tous les rôles** (admin, trésorière, membre)
3. **Réinitialisez les données** si nécessaire
4. **Explorez les différents états** (payé, en attente, en retard)

## 🐛 Problèmes Courants

### L'OTP ne s'affiche pas
- Vérifiez la console de développement
- L'OTP est affiché dans les logs

### Pas de données au démarrage
- Supprimez la base de données et relancez
- Vérifiez que le seed s'est bien exécuté

### Erreur de connexion
- Vérifiez le numéro de téléphone (format international)
- Vérifiez le PIN (123456 par défaut)
- Assurez-vous que l'utilisateur est vérifié

## 🎉 Profitez de l'Application !

L'application est maintenant prête à être utilisée en mode local. Toutes les fonctionnalités principales sont disponibles sans dépendre d'un backend externe.
