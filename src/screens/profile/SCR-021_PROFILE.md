# SCR-021 — Profil & Paramètres

## Vue d'ensemble

Écran de profil et paramètres permettant à l'utilisateur de :
- Consulter et modifier son profil
- Gérer la sécurité (PIN, biométrie)
- Configurer les notifications
- Gérer les préférences de l'application
- Se déconnecter

## Fichiers créés

### Services
- `src/services/userService.ts` : Service de gestion du profil utilisateur
  - `getUserProfile()` : Récupérer le profil complet
  - `updateProfile()` : Mettre à jour le profil
  - `updateAvatar()` : Mettre à jour la photo de profil
  - `deleteAvatar()` : Supprimer la photo de profil
  - `updatePIN()` : Changer le code PIN
  - `updatePreferences()` : Mettre à jour les préférences
  - `toggleBiometric()` : Activer/désactiver la biométrie

### Database
Méthodes ajoutées à `src/services/database.ts` :
- `getCurrentUser()` : Récupérer l'utilisateur connecté
- `updateUser()` : Mettre à jour les données utilisateur
- `getUserPreferences()` : Récupérer les préférences
- `updateUserPreferences()` : Mettre à jour les préférences

### Écran
- `src/screens/profile/ProfileScreen.tsx` : Écran principal

## Structure de l'écran

### 1. Header visuel (fond vert #27AE60)
- **Avatar** (80px, centré)
  - Photo de profil si disponible (bordure blanche 3px)
  - Sinon : cercle vert foncé avec initiales blanches (32px)
  - Bouton appareil photo (cercle blanc 28px) en bas à droite
  
- **Nom complet** (blanc, gras, centré)

- **Badge rôle** (coloré, centré)
  - Administrateur : doré (#D4AF37)
  - Trésorière : bleu (Colors.tertiary)
  - Membre : vert clair (Colors.secondary)
  - Auditeur : orange (Colors.warning)

- **Numéro de téléphone** (blanc semi-transparent)

### 2. Section "Mon Profil"
```typescript
- Modifier le profil (navigate) → EditProfile
  Subtitle: "Nom, téléphone, opérateur"
- Numéro de téléphone (info) → affiche le numéro
- Opérateur mobile (info) → affiche l'opérateur
```

### 3. Section "Sécurité"
```typescript
- Changer le code PIN (navigate) → ChangePIN
  Subtitle: "Modifier votre code de sécurité"
- Authentification biométrique (toggle)
  Subtitle: "Utiliser Face ID / Touch ID"
- Dernière connexion (info) → date + ville
```

### 4. Section "Notifications"
```typescript
- Notifications push (toggle)
  Subtitle: "Recevoir les alertes de paiement"
- Rappels SMS (toggle)
  Subtitle: "Rappels d'échéance par SMS"
- Confirmation SMS (toggle)
  Subtitle: "Confirmation de paiement par SMS"
- Rapport mensuel (toggle)
  Subtitle: "Recevoir le rapport mensuel"
```

### 5. Section "Application"
```typescript
- Langue (navigate) → LanguageSettings
  Subtitle: "Français" ou "English"
- Devise (navigate) → CurrencySettings
  Subtitle: "CDF" ou "USD"
- Version de l'app (info) → "1.0.0"
- Aide & Support (navigate) → Support
- Conditions d'utilisation (navigate) → Terms
- Politique de confidentialité (navigate) → Privacy
```

### 6. Bouton de déconnexion
```typescript
- Se déconnecter (destructive)
  → Affiche une confirmation Alert
  → Appelle logout() du store
```

## Gestion de la photo de profil

### ActionSheet (iOS) / Alert (Android)
Options disponibles :
1. **Prendre une photo**
   - Demande permission caméra
   - Lance `ImagePicker.launchCameraAsync()`
   - Aspect ratio 1:1, qualité 0.8

2. **Choisir dans la galerie**
   - Demande permission galerie
   - Lance `ImagePicker.launchImageLibraryAsync()`
   - Aspect ratio 1:1, qualité 0.8

3. **Supprimer la photo** (si photo existante)
   - Appelle `userService.deleteAvatar()`
   - Affiche toast de confirmation

### Upload
- Appelle `userService.updateAvatar(uri)`
- Affiche LoadingOverlay "Mise à jour..."
- Recharge le profil après succès
- Affiche toast de confirmation

## API Endpoints (Mode local)

### GET /api/v1/users/me
Retourne :
```typescript
{
  id: string;
  fullName: string;
  phone: string;
  operator: MobileOperator;
  avatar: string | null;
  role: 'admin' | 'treasurer' | 'member' | 'auditor';
  preferences: {
    pushEnabled: boolean;
    smsReminders: boolean;
    smsConfirmation: boolean;
    monthlyReport: boolean;
    language: 'fr' | 'en';
    currency: 'CDF' | 'USD';
  };
  biometricEnabled: boolean;
  lastLogin: {
    date: string;  // ISO 8601
    city: string;
  } | null;
}
```

### PUT /api/v1/users/me
Payload :
```typescript
{
  fullName?: string;
  phone?: string;
  operator?: MobileOperator;
}
```

### PUT /api/v1/users/me/avatar
Payload : FormData avec image

### DELETE /api/v1/users/me/avatar
Pas de payload

### PUT /api/v1/users/me/pin
Payload :
```typescript
{
  currentPin: string;
  newPin: string;
}
```

### PUT /api/v1/users/me/preferences
Payload :
```typescript
{
  pushEnabled?: boolean;
  smsReminders?: boolean;
  smsConfirmation?: boolean;
  monthlyReport?: boolean;
  language?: 'fr' | 'en';
  currency?: 'CDF' | 'USD';
}
```

## États de chargement

1. **Chargement initial** : `LoadingOverlay "Chargement du profil..."`
2. **Mise à jour photo** : `LoadingOverlay "Mise à jour..."`
3. **Erreurs** : Toast avec message d'erreur

## Toasts

### Succès
- Photo mise à jour : "Photo mise à jour" / "Votre photo de profil a été modifiée"
- Photo supprimée : "Photo supprimée" / "Votre photo de profil a été supprimée"
- Déconnexion : "Déconnecté" / "À bientôt !"

### Erreurs
- Chargement profil : "Erreur" / "Impossible de charger le profil"
- Mise à jour photo : "Erreur" / "Impossible de mettre à jour la photo"
- Suppression photo : "Erreur" / "Impossible de supprimer la photo"
- Préférences : "Erreur" / "Impossible de mettre à jour les préférences"
- Permission caméra : "Permission refusée" / "Accès à la caméra requis"
- Permission galerie : "Permission refusée" / "Accès à la galerie requis"

## Navigation

### Écrans à créer (Prompt 2)
- `EditProfile` : Modifier le profil (nom, téléphone, opérateur)
- `ChangePIN` : Changer le code PIN
- `LanguageSettings` : Choisir la langue
- `CurrencySettings` : Choisir la devise
- `Support` : Aide & Support
- `Terms` : Conditions d'utilisation
- `Privacy` : Politique de confidentialité

## Dépendances

### Packages
- `expo-image-picker` : Sélection d'images
- `expo-secure-store` : Stockage sécurisé
- `react-native-toast-message` : Notifications toast

### Composants
- `LoadingOverlay` : Overlay de chargement
- `SettingsRow` : Ligne de paramètre (nouveau composant Module 06)

### Services
- `userService` : Gestion du profil
- `authStore` : Store d'authentification

## Prochaines étapes

1. Créer les écrans de navigation (EditProfile, ChangePIN, etc.)
2. Implémenter la gestion de la langue
3. Implémenter la gestion de la devise
4. Ajouter les écrans d'aide et de support
5. Ajouter les écrans de conditions et de confidentialité
