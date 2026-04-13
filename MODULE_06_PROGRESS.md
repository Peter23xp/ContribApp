# Module 06 — Profil & Notifications — Progression

## ✅ Composants partagés créés

### 1. SettingsRow (`src/components/common/SettingsRow.tsx`)
Ligne de paramètre polyvalente avec 4 types :
- `navigate` : icône + label + chevron (›)
- `toggle` : icône + label + Switch natif
- `destructive` : label rouge centré (actions critiques)
- `info` : icône + label + valeur en gris (lecture seule)

**Props** :
```typescript
{
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  type: 'navigate' | 'toggle' | 'destructive' | 'info';
  value?: boolean | string | null;
  onPress?: () => void;
  disabled?: boolean;
  subtitle?: string;
}
```

### 2. NotificationItem (`src/components/common/NotificationItem.tsx`)
Ligne de notification avec :
- Icône type dans cercle coloré (7 types)
- Titre + corps + timestamp relatif
- Point bleu si non lu
- Swipe gauche pour supprimer
- Tap pour marquer comme lu et naviguer

**Types de notifications** :
- `PAIEMENT_RECU` / `PAIEMENT_CONFIRME` : pièce, vert
- `RAPPEL_ECHEANCE` / `RETARD` : cloche, orange
- `NOUVEAU_MEMBRE` : personne+, bleu
- `RAPPORT_PRET` : document, violet
- `SYSTEME` : info, gris

### 3. PINInputRow (`src/components/common/PINInputRow.tsx`)
Champ de saisie PIN avec :
- Label flottant (style AppInput)
- 6 caractères max, clavier numérique
- Masquage avec points (••••••)
- Bouton œil pour afficher/masquer
- Message d'erreur sous le champ

**Documentation** : `src/components/common/MODULE_06_COMPONENTS.md`

---

## ✅ SCR-021 — Profil & Paramètres (Prompts 1-6 COMPLETS)

### Services créés

#### `src/services/userService.ts`
Service de gestion du profil utilisateur :
- `getUserProfile()` : Récupérer le profil complet
- `updateProfile()` : Mettre à jour le profil
- `updateAvatar()` : Mettre à jour la photo de profil
- `deleteAvatar()` : Supprimer la photo de profil
- `updatePIN()` : Changer le code PIN
- `updatePreferences()` : Mettre à jour les préférences
- `toggleBiometric()` : Activer/désactiver la biométrie
- `logout()` : Déconnexion

#### Méthodes ajoutées à `src/services/database.ts`
- `getCurrentUser()` : Récupérer l'utilisateur connecté
- `updateUser()` : Mettre à jour les données utilisateur
- `getUserPreferences()` : Récupérer les préférences
- `updateUserPreferences()` : Mettre à jour les préférences

### Écrans créés

#### `src/screens/profile/ProfileScreen.tsx` (COMPLET)
Écran de profil et paramètres avec :

**1. Header visuel (fond vert #27AE60)**
- Avatar 80px (photo ou initiales)
- Bouton appareil photo (ActionSheet iOS / Alert Android)
- Nom complet en blanc gras
- Badge rôle coloré (Admin doré, Trésorière bleu, Membre vert, Auditeur orange)
- Numéro de téléphone en blanc semi-transparent

**2. Section "Mon Profil"**
- Nom complet (navigate → BottomSheet)
- Opérateur Mobile Money (navigate → BottomSheet)
- Numéro Mobile Money (info, non modifiable)
- Modifier mon code PIN (navigate → ChangePINScreen)

**3. Section "Sécurité"**
- Empreinte digitale / Face ID (toggle avec vérification)
- Dernière connexion (info)

**4. Section "Notifications"**
- Notifications push (toggle avec permissions)
- Rappels par SMS (toggle)
- Confirmation de paiement par SMS (toggle)
- Rapport mensuel automatique (toggle)

**5. Section "Application"**
- Langue (navigate → BottomSheet)
- Devise d'affichage (navigate → BottomSheet)
- Version de l'application (info)
- Aide & Support (navigate, placeholder)
- Conditions d'utilisation (navigate, placeholder)
- Politique de confidentialité (navigate, placeholder)

**6. Bouton de déconnexion**
- Se déconnecter (destructive avec confirmation)

#### `src/screens/profile/ChangePINScreen.tsx` (NOUVEAU)
Écran de changement de PIN avec :
- Header avec bouton retour
- 3 champs PINInputRow (ancien, nouveau, confirmation)
- Validation en temps réel
- Hachage SHA-256 côté client
- Conseils de sécurité
- Feedback utilisateur complet

### Fonctionnalités implémentées

✅ **Prompt 1** : Structure générale et header profil
✅ **Prompt 2** : Section "Mon Profil" avec BottomSheets
✅ **Prompt 3** : Sous-écran Changement de PIN
✅ **Prompt 4** : Section "Sécurité" avec biométrie
✅ **Prompt 5** : Section "Notifications" avec permissions
✅ **Prompt 6** : Section "Application" et déconnexion

### BottomSheet Modals (4)

1. **Modifier le nom**
   - AppInput pré-rempli
   - Validation min 3 caractères
   - Sauvegarde avec feedback

2. **Changer d'opérateur**
   - OperatorSelector (4 tuiles)
   - Confirmation avec feedback

3. **Changer la langue**
   - 2 options radio (Français, English)
   - Sauvegarde immédiate

4. **Changer la devise**
   - 2 options radio (CDF, USD)
   - Sauvegarde immédiate

### Intégrations

✅ **expo-image-picker** : Sélection d'images
✅ **expo-local-authentication** : Biométrie
✅ **expo-notifications** : Notifications push
✅ **expo-constants** : Version de l'app
✅ **expo-crypto** : Hachage SHA-256
✅ **expo-secure-store** : Stockage sécurisé

**Documentation** : 
- `src/screens/profile/SCR-021_PROFILE.md` (Prompt 1)
- `src/screens/profile/SCR-021_COMPLETE.md` (Prompts 2-6)

---

## ✅ SCR-022 — Centre de Notifications (Prompts 1-4 COMPLETS)

### Fichiers créés

#### `src/stores/notificationStore.ts` (NOUVEAU)
Store Zustand pour les notifications :
- Liste des notifications
- Compteur de non lues (badge)
- Actions CRUD (set, add, markAsRead, remove, etc.)

#### `src/services/notificationService.ts` (NOUVEAU)
Service de gestion des notifications :
- `getNotifications()` : Récupération avec pagination
- `markAsRead()` : Marquer comme lue
- `markAllAsRead()` : Marquer toutes comme lues
- `deleteNotification()` : Supprimer une notification
- `deleteReadNotifications()` : Supprimer toutes les lues
- `initializePushNotifications()` : Initialiser push
- `registerNotificationListeners()` : Enregistrer listeners
- `unregisterNotificationListeners()` : Nettoyer listeners
- `setBadgeCount()` : Mettre à jour badge app
- `getNavigationTarget()` : Helper de navigation

#### `src/screens/notifications/NotificationCenterScreen.tsx` (NOUVEAU)
Écran centre de notifications avec :

**Header** :
- Bouton retour
- Titre "Notifications"
- Bouton "Tout lire" (si unreadCount > 0)

**Barre de filtres** (5 chips) :
- Toutes
- Non lues (avec compteur)
- Paiements
- Rappels
- Système

**Liste** :
- FlatList de NotificationItem
- Groupées par date (Aujourd'hui, Hier, [date])
- Pull to refresh
- Infinite scroll (pagination 30/page)
- Empty states

**Actions** :
- Tap → marquer lu + naviguer
- Swipe → supprimer (optimistic update)
- "Tout lire" → marquer toutes comme lues
- "Effacer les lues" → supprimer toutes les lues

**Polling** :
- Toutes les 60 secondes
- Uniquement si écran au premier plan
- Arrêt automatique si arrière-plan

#### Méthodes ajoutées à `src/services/database.ts`
- Table `notifications` créée automatiquement
- `getNotifications()` : Récupérer avec pagination
- `getUnreadNotificationsCount()` : Compteur non lues
- `markNotificationAsRead()` : Marquer comme lue
- `markAllNotificationsAsRead()` : Marquer toutes comme lues
- `deleteNotification()` : Supprimer une notification
- `deleteReadNotifications()` : Supprimer toutes les lues
- `createNotification()` : Créer une notification

### Fonctionnalités implémentées

✅ **Prompt 1** : Structure et filtres
- Header avec bouton "Tout lire"
- Barre de filtres (5 types)
- Liste groupée par date
- Empty states

✅ **Prompt 2** : Chargement, polling et badge
- Chargement initial avec pagination
- Polling toutes les 60s (premier plan uniquement)
- Filtrage local côté client
- Gestion du badge global
- useFocusEffect pour démarrer/arrêter polling

✅ **Prompt 3** : Actions sur les notifications
- Tap : marquer lu + naviguer vers écran cible
- Swipe : supprimer avec optimistic update
- Bouton "Tout lire" avec LoadingOverlay
- Bouton "Effacer les notifications lues" avec confirmation

✅ **Prompt 4** : Intégration push notifications
- Service notificationService.ts complet
- Initialisation push notifications
- Listeners (reçues au premier plan, tappées)
- Badge applicatif (icône app)
- Nettoyage des listeners
- Navigation helper par type

### Navigation par type de notification

| Type | Écran cible | Description |
|------|-------------|-------------|
| PAIEMENT_RECU | Historique | Trésorière voit paiement reçu |
| PAIEMENT_CONFIRME | PaymentReceipt | Membre voit confirmation |
| RAPPEL_ECHEANCE | Payer | Rappel avant échéance |
| RETARD | Payer | Alerte retard de paiement |
| NOUVEAU_MEMBRE | MemberManagement | Admin voit nouveau membre |
| RAPPORT_PRET | Rapports | Rapport mensuel disponible |
| SYSTEME | null | Pas de navigation |

### Intégrations

✅ **expo-notifications** : Notifications push
✅ **zustand** : Store de notifications
✅ **react-native-gesture-handler** : Swipe gestures
✅ **@react-navigation/native** : useFocusEffect

**Documentation** : `src/screens/notifications/SCR-022_COMPLETE.md`

---

## 🎯 Statut global

### ✅ Terminé
- Composants partagés Module 06 (3/3)
- SCR-021 Profil & Paramètres — Prompts 1-6 (COMPLET)
- SCR-022 Centre de Notifications — Prompts 1-4 (COMPLET)

### 🎉 Module 06 TERMINÉ !

**Tous les écrans et fonctionnalités du Module 06 sont implémentés et fonctionnels.**

---

## 📦 Dépendances utilisées

### Packages Expo
- `expo-image-picker` : Sélection d'images ✅ installé
- `expo-secure-store` : Stockage sécurisé ✅ installé
- `expo-local-authentication` : Biométrie ✅ installé

### Packages React Native
- `react-native-gesture-handler` : Swipe gestures ✅ installé
- `react-native-toast-message` : Notifications toast ✅ installé

### Composants créés
- `SettingsRow` : Ligne de paramètre polyvalente
- `NotificationItem` : Ligne de notification
- `PINInputRow` : Champ de saisie PIN

### Services créés
- `userService` : Gestion du profil utilisateur
- Méthodes database : préférences et profil

---

## 🔍 Validation

### Tests de compilation
✅ `src/components/common/SettingsRow.tsx` : No diagnostics
✅ `src/components/common/NotificationItem.tsx` : No diagnostics
✅ `src/components/common/PINInputRow.tsx` : No diagnostics
✅ `src/services/userService.ts` : No diagnostics
✅ `src/services/database.ts` : No diagnostics
✅ `src/screens/profile/ProfileScreen.tsx` : No diagnostics
✅ `src/screens/profile/ChangePINScreen.tsx` : No diagnostics
✅ `src/stores/notificationStore.ts` : No diagnostics
✅ `src/services/notificationService.ts` : No diagnostics
✅ `src/screens/notifications/NotificationCenterScreen.tsx` : No diagnostics

### Exports
✅ Tous les composants exportés depuis `src/components/common/index.ts`
✅ Types TypeScript exportés

---

## 📝 Notes techniques

### Mode local (développement)
- Les données sont stockées dans SQLite local
- Les préférences sont dans la table `user_preferences`
- Les photos sont stockées comme URI locales
- Pas d'appel API réel (mock avec database.ts)

### Migration base de données
- Colonnes ajoutées automatiquement si absentes :
  - `users.biometric_enabled`
  - `users.last_login`
  - Table `user_preferences` créée si absente

### Gestion des permissions
- Caméra : `ImagePicker.requestCameraPermissionsAsync()`
- Galerie : `ImagePicker.requestMediaLibraryPermissionsAsync()`
- Feedback utilisateur si permission refusée

### Design system
- Couleurs : `Colors` de `src/constants/colors.ts`
- Typographie : `Fonts` (Manrope)
- Rayons : `Radius` (sm, md, lg, xl, xxl, full)
- Ombres : `Shadow` (card, fab)
