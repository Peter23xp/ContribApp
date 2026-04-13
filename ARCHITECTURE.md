# Architecture de l'Application ContribApp

## Vue d'ensemble

ContribApp est une application mobile React Native (Expo) pour la gestion de contributions de groupe en RDC. L'architecture suit une approche modulaire avec séparation claire des responsabilités.

## Stack Technique

### Frontend
- **Framework** : React Native 0.81.5
- **Runtime** : Expo SDK 54
- **Langage** : TypeScript 5.9
- **Navigation** : React Navigation 7
- **State Management** : Zustand 5.0
- **Base de données locale** : expo-sqlite 16
- **Stockage sécurisé** : expo-secure-store 15
- **HTTP Client** : Axios 1.15

### Backend (À implémenter)
- API RESTful
- Authentification JWT
- Intégration Mobile Money
- Service SMS/OTP
- Stockage de fichiers (S3 ou équivalent)

## Structure du Projet

```
contribapp/
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── common/         # Composants génériques
│   │   ├── dashboard/      # Composants du tableau de bord
│   │   └── payment/        # Composants de paiement
│   ├── constants/          # Constantes et configuration
│   │   ├── colors.ts       # Thème et couleurs
│   │   ├── config.ts       # Configuration app
│   │   └── operators.ts    # Opérateurs Mobile Money
│   ├── hooks/              # Custom React Hooks
│   │   ├── useAuth.ts
│   │   ├── useGroup.ts
│   │   ├── useNetworkStatus.ts
│   │   ├── useNotifications.ts
│   │   └── usePayment.ts
│   ├── navigation/         # Configuration de navigation
│   │   ├── AppNavigator.tsx
│   │   ├── AppTabNavigator.tsx
│   │   └── AuthNavigator.tsx
│   ├── screens/            # Écrans de l'application
│   │   ├── auth/          # Authentification
│   │   ├── dashboard/     # Tableaux de bord
│   │   ├── group/         # Gestion de groupe
│   │   ├── history/       # Historique
│   │   ├── notifications/ # Notifications
│   │   ├── payment/       # Paiements
│   │   ├── profile/       # Profil utilisateur
│   │   └── reports/       # Rapports
│   ├── services/           # Services et logique métier
│   │   ├── api.ts         # Client HTTP
│   │   ├── authService.ts # Service d'authentification
│   │   ├── contributionService.ts # Service de contributions
│   │   ├── database.ts    # Service SQLite
│   │   ├── groupService.ts # Service de groupe
│   │   ├── notificationService.ts # Service de notifications
│   │   └── storageService.ts # Service de stockage
│   ├── stores/             # State management (Zustand)
│   │   ├── authStore.ts
│   │   ├── groupStore.ts
│   │   ├── notificationStore.ts
│   │   └── paymentStore.ts
│   ├── types/              # Définitions TypeScript
│   │   ├── api.types.ts
│   │   ├── contribution.types.ts
│   │   ├── group.types.ts
│   │   └── user.types.ts
│   └── utils/              # Utilitaires
│       ├── errorHandler.ts
│       ├── formatCurrency.ts
│       ├── formatDate.ts
│       └── validatePhone.ts
├── assets/                 # Ressources statiques
│   └── images/            # Images et logos
├── .env                    # Variables d'environnement (local)
├── .env.example           # Template des variables
├── App.tsx                # Point d'entrée
├── app.json               # Configuration Expo
└── package.json           # Dépendances

```

## Flux de Données

### 1. Authentification

```
User Input → AuthScreen → authService → API Backend
                              ↓
                         SecureStore (tokens)
                              ↓
                         authStore (state)
                              ↓
                         Navigation
```

### 2. Gestion de Groupe

```
User Action → GroupScreen → groupService → API Backend
                                ↓
                           SQLite (cache)
                                ↓
                           groupStore (state)
                                ↓
                           UI Update
```

### 3. Paiement Mobile Money

```
User Input → PaymentScreen → contributionService → API Backend
                                      ↓
                              Mobile Money API
                                      ↓
                              Polling Status
                                      ↓
                              Receipt Screen
```

## Couches de l'Application

### 1. Présentation (UI)
- **Responsabilité** : Affichage et interaction utilisateur
- **Technologies** : React Native, React Navigation
- **Composants** :
  - Screens : Écrans complets
  - Components : Composants réutilisables
  - Navigation : Configuration des routes

### 2. Logique Métier (Services)
- **Responsabilité** : Logique applicative et règles métier
- **Technologies** : TypeScript, Axios
- **Services** :
  - authService : Authentification et autorisation
  - groupService : Gestion des groupes
  - contributionService : Gestion des contributions
  - notificationService : Notifications push

### 3. État Global (State Management)
- **Responsabilité** : Gestion de l'état partagé
- **Technologies** : Zustand
- **Stores** :
  - authStore : État d'authentification
  - groupStore : État des groupes
  - paymentStore : État des paiements
  - notificationStore : État des notifications

### 4. Persistance (Data Layer)
- **Responsabilité** : Stockage et récupération des données
- **Technologies** : SQLite, SecureStore, AsyncStorage
- **Composants** :
  - database.ts : Base de données locale
  - SecureStore : Tokens et données sensibles
  - AsyncStorage : Préférences utilisateur

### 5. Communication (API Layer)
- **Responsabilité** : Communication avec le backend
- **Technologies** : Axios, REST API
- **Composants** :
  - api.ts : Client HTTP configuré
  - Interceptors : Gestion des tokens et erreurs

## Patterns et Principes

### 1. Separation of Concerns
Chaque couche a une responsabilité unique et bien définie.

### 2. Dependency Injection
Les services sont injectés dans les composants via hooks.

### 3. Single Source of Truth
L'état global est géré par Zustand, évitant la duplication.

### 4. Offline-First
Les données sont d'abord stockées localement puis synchronisées.

### 5. Error Handling
Gestion centralisée des erreurs avec messages utilisateur clairs.

## Sécurité

### 1. Authentification
- JWT tokens stockés dans SecureStore
- Refresh token automatique
- Expiration des sessions

### 2. Données Sensibles
- PINs hashés avec SHA-256
- Pas de stockage de mots de passe en clair
- Chiffrement des communications (HTTPS)

### 3. Validation
- Validation côté client ET serveur
- Sanitization des inputs
- Protection contre les injections

### 4. Permissions
- Contrôle d'accès basé sur les rôles (RBAC)
- Vérification des permissions avant chaque action

## Performance

### 1. Optimisations React
- Mémoization avec useMemo et useCallback
- Lazy loading des écrans
- Virtualisation des listes longues

### 2. Optimisations Réseau
- Cache des requêtes
- Compression des données
- Pagination des listes

### 3. Optimisations Base de Données
- Index sur les colonnes fréquemment requêtées
- Requêtes optimisées
- Nettoyage régulier des données obsolètes

### 4. Optimisations Images
- Compression des images
- Lazy loading
- Cache des images

## Mode Hors-ligne

### 1. Stratégie
- **Read** : Données locales si hors-ligne
- **Write** : Queue des actions, sync à la reconnexion
- **Conflict** : Backend fait autorité

### 2. Implémentation
```typescript
// Détection du statut réseau
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    syncPendingActions();
  }
});

// Queue des actions
const pendingActions = [];
if (isOffline) {
  pendingActions.push(action);
} else {
  await executeAction(action);
}
```

### 3. Indicateurs UI
- Banner "Hors-ligne" en haut de l'écran
- Désactivation des actions nécessitant le réseau
- Messages explicites à l'utilisateur

## Tests

### 1. Tests Unitaires
- Services : Logique métier
- Utils : Fonctions utilitaires
- Stores : State management

### 2. Tests d'Intégration
- Flux complets (auth, payment, etc.)
- Interaction entre services
- Synchronisation online/offline

### 3. Tests E2E
- Parcours utilisateur complets
- Tests sur devices réels
- Tests de régression

## Déploiement

### 1. Environnements
- **Development** : Développement local
- **Staging** : Tests pré-production
- **Production** : Application en production

### 2. Configuration
Variables d'environnement par environnement :
```bash
# Development
EXPO_PUBLIC_API_URL=http://localhost:3000/v1

# Staging
EXPO_PUBLIC_API_URL=https://staging-api.example.com/v1

# Production
EXPO_PUBLIC_API_URL=https://api.example.com/v1
```

### 3. Build
```bash
# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android
```

### 4. Distribution
- **Android** : Google Play Store
- **iOS** : Apple App Store
- **OTA Updates** : Expo Updates pour les mises à jour rapides

## Monitoring et Analytics

### 1. Crash Reporting
- Sentry pour le tracking des erreurs
- Logs structurés
- Alertes en temps réel

### 2. Analytics
- Événements utilisateur
- Métriques de performance
- Taux de conversion

### 3. Logs
```typescript
// Structure des logs
console.log('[Service] Action : Details');
console.error('[Error] Context : Message');
```

## Évolutions Futures

### 1. Fonctionnalités
- [ ] Chat de groupe
- [ ] Prêts entre membres
- [ ] Investissements collectifs
- [ ] Rapports avancés
- [ ] Export comptable

### 2. Technique
- [ ] Migration vers Expo Router
- [ ] Implémentation de GraphQL
- [ ] Chiffrement de la base de données
- [ ] Biométrie avancée
- [ ] Mode sombre

### 3. Performance
- [ ] Code splitting
- [ ] Optimisation des bundles
- [ ] Service Workers (web)
- [ ] Prefetching intelligent

## Ressources

### Documentation
- [React Native](https://reactnative.dev/)
- [Expo](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Zustand](https://github.com/pmndrs/zustand)

### Outils
- [Expo Dev Tools](https://docs.expo.dev/workflow/development-mode/)
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
- [Flipper](https://fbflipper.com/)

### Communauté
- [Expo Discord](https://chat.expo.dev/)
- [React Native Community](https://www.reactnative.dev/community/overview)
