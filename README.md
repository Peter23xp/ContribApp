# ContribApp - Application de Gestion de Contributions

Application mobile React Native (Expo) pour la gestion de contributions de groupe en RDC.

## 🚀 Démarrage Rapide

```bash
# Installation
npm install

# Lancement
npm start

# Nettoyer la base de données (optionnel)
npm run cleanup-db
```

### Comptes de Test

| Rôle | Téléphone | PIN |
|------|-----------|-----|
| Admin | `+243970123456` | `123456` |
| Trésorière | `+243890234567` | `123456` |
| Membre | `+243810345678` | `123456` |

**Code du groupe** : `DEV2026`

## ✨ Fonctionnalités

- ✅ Authentification avec OTP
- ✅ Gestion de groupes de contribution
- ✅ Paiements Mobile Money (simulés)
- ✅ Tableaux de bord par rôle (Admin, Trésorière, Membre)
- ✅ Historique des paiements
- ✅ Calcul automatique des pénalités
- ✅ Notifications et rappels
- ✅ Mode hors-ligne avec SQLite

## 🎯 Mode Local

L'application fonctionne **100% en local** avec SQLite, sans dépendre d'une API externe.

Au premier lancement, des données de test sont créées automatiquement :
- 7 utilisateurs avec différents rôles
- 1 groupe de développement
- Contributions variées (payées, en attente, en retard)

**Voir** : [DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md) pour plus de détails.

## 📚 Documentation

- **[DEMARRAGE_RAPIDE.md](DEMARRAGE_RAPIDE.md)** - Guide de démarrage en 3 étapes
- **[MODE_LOCAL.md](MODE_LOCAL.md)** - Guide complet du mode local
- **[FINAL_SUMMARY.md](FINAL_SUMMARY.md)** - Résumé des fonctionnalités
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture de l'application
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Schéma de la base de données

## 🛠️ Stack Technique

- **Framework** : React Native 0.81.5
- **Runtime** : Expo SDK 54
- **Langage** : TypeScript 5.9
- **Navigation** : React Navigation 7
- **State Management** : Zustand 5.0
- **Base de données** : expo-sqlite 16
- **Stockage sécurisé** : expo-secure-store 15

## 📱 Scénarios de Test

### En tant qu'Admin
1. Voir les statistiques du groupe
2. Gérer les membres
3. Envoyer des rappels
4. Voir la progression

### En tant que Trésorière
1. Voir tous les paiements
2. Valider les contributions
3. Exporter les rapports

### En tant que Membre
1. Voir son statut
2. Payer sa contribution
3. Consulter l'historique

## 🔐 Sécurité

- PINs hashés avec SHA-256
- Tokens stockés dans SecureStore
- OTP avec expiration (2 minutes)
- Validation des données

## 🎨 Design

L'application utilise le design system "The Sovereign Ledger" avec :
- Palette de couleurs cohérente
- Typographie Manrope
- Composants Material Design 3
- Animations fluides

## 🐛 Dépannage

### Pas de données au démarrage
Supprimez la base de données et relancez l'application.

### OTP introuvable
L'OTP est affiché dans la console de développement.

### Erreur de connexion
Vérifiez le format du téléphone (international : +243...)

## 📄 Licence

Propriétaire - Tous droits réservés

## 👥 Équipe

Développé pour la gestion de contributions de groupe en RDC.

---

**Note** : Cette version fonctionne en mode local. Les paiements Mobile Money sont simulés.
