# Composants partagés Module 06 — Profil & Notifications

## Vue d'ensemble

Ce document décrit les 3 composants partagés créés pour le Module 06 (SCR-021 et SCR-022).

---

## 1. SettingsRow

**Fichier** : `src/components/common/SettingsRow.tsx`

### Description
Ligne de paramètre polyvalente avec 4 types différents pour couvrir tous les cas d'usage des écrans de paramètres.

### Props

```typescript
interface Props {
  icon?:      keyof typeof Ionicons.glyphMap;  // Nom icône Ionicons
  label:      string;                          // Texte principal
  type:       'navigate' | 'toggle' | 'destructive' | 'info';
  value?:     boolean | string | null;         // Valeur (toggle ou info)
  onPress?:   () => void;                      // Callback
  disabled?:  boolean;                         // Désactivé (défaut: false)
  subtitle?:  string;                          // Texte explicatif sous le label
}
```

### Types de rendu

#### `navigate`
- Icône gauche + label + chevron droit (›)
- Toute la ligne est touchable
- Usage : navigation vers un sous-écran

#### `toggle`
- Icône gauche + label + Switch natif iOS/Android
- Le Switch est à droite
- Usage : paramètres booléens (activer/désactiver)

#### `destructive`
- Label rouge centré, pas d'icône
- Usage : actions critiques (déconnexion, suppression compte)

#### `info`
- Icône gauche + label + valeur en gris à droite
- Non touchable (lecture seule)
- Usage : affichage d'informations (version app, etc.)

### Exemple d'utilisation

```tsx
import { SettingsRow } from '../../components/common';

// Navigation
<SettingsRow
  icon="person-outline"
  label="Modifier le profil"
  type="navigate"
  onPress={() => navigation.navigate('EditProfile')}
  subtitle="Nom, téléphone, photo"
/>

// Toggle
<SettingsRow
  icon="notifications-outline"
  label="Notifications push"
  type="toggle"
  value={notificationsEnabled}
  onPress={setNotificationsEnabled}
  subtitle="Recevoir les alertes de paiement"
/>

// Info
<SettingsRow
  icon="information-circle-outline"
  label="Version de l'app"
  type="info"
  value="1.0.0"
/>

// Destructive
<SettingsRow
  label="Se déconnecter"
  type="destructive"
  onPress={handleLogout}
/>
```

---

## 2. NotificationItem

**Fichier** : `src/components/common/NotificationItem.tsx`

### Description
Ligne de notification avec icône type, titre, corps, timestamp relatif, point bleu si non lu, et swipe pour supprimer.

### Props

```typescript
interface Props {
  notification:     Notification;
  onPress:          (notification: Notification) => void;
  onSwipeDelete:    (notification: Notification) => void;
}

interface Notification {
  id:                 string;
  type:               NotificationType;
  title:              string;
  body:               string;
  isRead:             boolean;
  createdAt:          string;  // ISO 8601
  navigationTarget?:  string;  // nom de l'écran
  navigationParams?:  Record<string, any>;
}

type NotificationType =
  | 'PAIEMENT_RECU'
  | 'PAIEMENT_CONFIRME'
  | 'RAPPEL_ECHEANCE'
  | 'RETARD'
  | 'NOUVEAU_MEMBRE'
  | 'RAPPORT_PRET'
  | 'SYSTEME';
```

### Fonctionnalités

- **Icônes par type** :
  - `PAIEMENT_RECU` / `PAIEMENT_CONFIRME` : pièce de monnaie, vert
  - `RAPPEL_ECHEANCE` / `RETARD` : cloche, orange
  - `NOUVEAU_MEMBRE` : personne+, bleu
  - `RAPPORT_PRET` : document, violet
  - `SYSTEME` : info, gris

- **Fond** : bleu clair (#EBF5FB) si non lu, blanc si lu
- **Point bleu** : 8px à droite si non lu (disparaît au tap)
- **Timestamp relatif** : "il y a 5 min", "hier", "12 Jan"
- **Swipe gauche** : bouton rouge "Supprimer"
- **Tap** : appelle `onPress()` qui doit marquer comme lu ET naviguer

### Exemple d'utilisation

```tsx
import { NotificationItem } from '../../components/common';

const notification = {
  id: '1',
  type: 'PAIEMENT_RECU',
  title: 'Paiement reçu',
  body: 'Jean Dupont a payé 50 000 CDF pour Janvier 2024',
  isRead: false,
  createdAt: '2024-01-15T10:30:00Z',
  navigationTarget: 'PaymentDetails',
  navigationParams: { paymentId: '123' },
};

<NotificationItem
  notification={notification}
  onPress={(notif) => {
    // 1. Marquer comme lu
    markAsRead(notif.id);
    // 2. Naviguer
    if (notif.navigationTarget) {
      navigation.navigate(notif.navigationTarget, notif.navigationParams);
    }
  }}
  onSwipeDelete={(notif) => {
    deleteNotification(notif.id);
  }}
/>
```

---

## 3. PINInputRow

**Fichier** : `src/components/common/PINInputRow.tsx`

### Description
Champ de saisie PIN avec label flottant, 6 points masqués, clavier numérique, et bouton œil pour afficher/masquer.

### Props

```typescript
interface Props {
  label:        string;
  value:        string;
  onChange:     (value: string) => void;
  showToggle?:  boolean;        // Afficher le bouton œil (défaut: true)
  error?:       string | null;  // Message d'erreur
  disabled?:    boolean;        // Désactivé (défaut: false)
}
```

### Fonctionnalités

- **Clavier numérique uniquement** : `keyboardType="number-pad"`
- **6 caractères max** : `maxLength={6}`
- **Masquage** : `secureTextEntry` (points •••••• par défaut)
- **Toggle visibilité** : bouton œil à droite (si `showToggle=true`)
- **Message d'erreur** : affiché en rouge sous le champ
- **Style cohérent** : identique à `AppInput`

### Exemple d'utilisation

```tsx
import { PINInputRow } from '../../components/common';

const [pin, setPin] = useState('');
const [pinError, setPinError] = useState<string | null>(null);

<PINInputRow
  label="Code PIN actuel"
  value={pin}
  onChange={(value) => {
    setPin(value);
    setPinError(null);
  }}
  error={pinError}
  showToggle={true}
/>
```

---

## Intégration

Tous les composants sont exportés depuis `src/components/common/index.ts` :

```typescript
export { SettingsRow }            from './SettingsRow';
export { NotificationItem }       from './NotificationItem';
export type { Notification, NotificationType } from './NotificationItem';
export { PINInputRow }            from './PINInputRow';
```

## Dépendances

- `react-native-gesture-handler` : pour le swipe dans `NotificationItem`
- `@expo/vector-icons` : pour les icônes Ionicons
- Composants de base : `AppInput`, `AppButton` (pour cohérence de style)

## Prochaines étapes

Ces composants sont maintenant prêts à être utilisés dans :
- **SCR-021** : Profil & Paramètres (utilise `SettingsRow` et `PINInputRow`)
- **SCR-022** : Centre de Notifications (utilise `NotificationItem`)
