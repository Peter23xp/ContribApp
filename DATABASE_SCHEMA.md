# Schéma de Base de Données SQLite

## Vue d'ensemble
Ce document décrit le schéma de la base de données locale SQLite utilisée par l'application ContribApp.

## Tables

### 1. `users`
Stocke les informations des utilisateurs.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  operator TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  profile_photo_url TEXT,
  role TEXT DEFAULT 'member',
  is_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Colonnes :**
- `id` : Identifiant unique (généré par le backend)
- `full_name` : Nom complet de l'utilisateur
- `phone` : Numéro de téléphone (format international, ex: +243970000000)
- `operator` : Opérateur mobile ('airtel', 'orange', 'mpesa', 'mtn')
- `pin_hash` : Hash SHA-256 du code PIN
- `profile_photo_url` : URL de la photo de profil (optionnel)
- `role` : Rôle ('admin', 'treasurer', 'member', 'auditor')
- `is_verified` : Statut de vérification (0 = non vérifié, 1 = vérifié)
- `created_at` : Date de création

### 2. `otp_codes`
Stocke les codes OTP pour la vérification.

```sql
CREATE TABLE otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  context TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Colonnes :**
- `id` : Identifiant auto-incrémenté
- `phone` : Numéro de téléphone associé
- `code` : Code OTP (6 chiffres)
- `context` : Contexte ('register', 'resend', 'login')
- `attempts` : Nombre de tentatives de vérification
- `expires_at` : Date d'expiration (2 minutes après création)
- `used` : Statut d'utilisation (0 = non utilisé, 1 = utilisé)
- `created_at` : Date de création

**Règles :**
- Maximum 3 tentatives par OTP
- Expiration après 2 minutes
- Un seul OTP actif par numéro (les anciens sont marqués comme utilisés)

### 3. `groups`
Stocke les informations des groupes de contribution.

```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_amount REAL NOT NULL,
  admin_id TEXT NOT NULL,
  due_day INTEGER DEFAULT 25,
  invite_code TEXT UNIQUE,
  currency TEXT DEFAULT 'CDF',
  penalty_enabled INTEGER DEFAULT 0,
  penalty_type TEXT DEFAULT 'fixed',
  penalty_amount REAL DEFAULT 0,
  require_approval INTEGER DEFAULT 0,
  payments_visible INTEGER DEFAULT 1,
  photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Colonnes :**
- `id` : Identifiant unique du groupe
- `name` : Nom du groupe
- `description` : Description (optionnel)
- `monthly_amount` : Montant mensuel de contribution
- `admin_id` : ID de l'administrateur
- `due_day` : Jour d'échéance (1-31)
- `invite_code` : Code d'invitation unique
- `currency` : Devise ('CDF', 'USD')
- `penalty_enabled` : Pénalités activées (0 = non, 1 = oui)
- `penalty_type` : Type de pénalité ('fixed', 'percentage')
- `penalty_amount` : Montant de la pénalité
- `require_approval` : Approbation requise pour rejoindre (0 = non, 1 = oui)
- `payments_visible` : Paiements visibles par tous (0 = non, 1 = oui)
- `photo_url` : URL de la photo du groupe (optionnel)
- `created_at` : Date de création

### 4. `group_members`
Associe les utilisateurs aux groupes.

```sql
CREATE TABLE group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now'))
);
```

**Colonnes :**
- `id` : Identifiant unique de l'association
- `group_id` : ID du groupe
- `user_id` : ID de l'utilisateur
- `role` : Rôle dans le groupe ('admin', 'treasurer', 'member', 'auditor')
- `joined_at` : Date d'adhésion

**Contraintes :**
- Un utilisateur ne peut rejoindre un groupe qu'une seule fois
- Foreign keys vers `groups.id` et `users.id`

### 5. `contributions`
Stocke les contributions mensuelles.

```sql
CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  amount REAL NOT NULL,
  penalty_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'EN_ATTENTE',
  operator TEXT,
  tx_id TEXT,
  paid_at TEXT,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Colonnes :**
- `id` : Identifiant unique de la contribution
- `group_id` : ID du groupe
- `user_id` : ID de l'utilisateur
- `month` : Mois concerné (format: YYYY-MM)
- `amount` : Montant de base
- `penalty_amount` : Montant de la pénalité
- `status` : Statut ('EN_ATTENTE', 'PAYE', 'EN_RETARD', 'ECHEC', 'PARTIEL')
- `operator` : Opérateur utilisé pour le paiement
- `tx_id` : ID de la transaction
- `paid_at` : Date de paiement
- `due_date` : Date d'échéance
- `created_at` : Date de création

**Statuts :**
- `EN_ATTENTE` : En attente de paiement
- `PAYE` : Payé avec succès
- `EN_RETARD` : En retard (après la date d'échéance)
- `ECHEC` : Paiement échoué
- `PARTIEL` : Paiement partiel

## Index Recommandés

Pour optimiser les performances, créer les index suivants :

```sql
-- Index sur les numéros de téléphone
CREATE INDEX idx_users_phone ON users(phone);

-- Index sur les OTP actifs
CREATE INDEX idx_otp_phone_used ON otp_codes(phone, used);

-- Index sur les codes d'invitation
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

-- Index sur les membres de groupe
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- Index sur les contributions
CREATE INDEX idx_contributions_group_month ON contributions(group_id, month);
CREATE INDEX idx_contributions_user_month ON contributions(user_id, month);
CREATE INDEX idx_contributions_status ON contributions(status);
```

## Migrations

### Migration Initiale
Toutes les tables sont créées automatiquement au premier lancement via `initDatabase()` dans `src/services/database.ts`.

### Migrations Futures
Pour ajouter de nouvelles colonnes, utiliser la structure suivante :

```typescript
try {
  db.execSync(`ALTER TABLE table_name ADD COLUMN new_column TYPE`);
  console.log('[DB] ✅ Migration : colonne new_column ajoutée');
} catch (_) {
  // Colonne déjà présente
}
```

## Nettoyage des Données

### Supprimer les OTP expirés
```sql
DELETE FROM otp_codes 
WHERE used = 1 OR datetime(expires_at) < datetime('now');
```

### Supprimer les contributions anciennes (optionnel)
```sql
-- Garder seulement les 12 derniers mois
DELETE FROM contributions 
WHERE datetime(created_at) < datetime('now', '-12 months');
```

## Sauvegarde et Restauration

### Emplacement de la base de données
La base de données SQLite est stockée localement sur l'appareil :
- **iOS** : `~/Library/Application Support/Expo/contribapp.db`
- **Android** : `/data/data/[package]/databases/contribapp.db`

### Sauvegarde
Pour sauvegarder la base de données, utiliser `expo-file-system` :

```typescript
import * as FileSystem from 'expo-file-system';

const dbPath = `${FileSystem.documentDirectory}SQLite/contribapp.db`;
const backupPath = `${FileSystem.documentDirectory}backup_${Date.now()}.db`;

await FileSystem.copyAsync({
  from: dbPath,
  to: backupPath
});
```

## Synchronisation avec le Backend

⚠️ **Important** : Cette base de données SQLite est utilisée pour le stockage local et le mode hors-ligne. En production, toutes les données doivent être synchronisées avec le backend.

### Stratégie de Synchronisation
1. **Lecture** : Toujours privilégier les données du backend quand disponible
2. **Écriture** : Enregistrer localement puis synchroniser avec le backend
3. **Conflit** : Le backend fait autorité en cas de conflit
4. **Hors-ligne** : Utiliser les données locales et synchroniser à la reconnexion

## Sécurité

### Données Sensibles
- ✅ Les PINs sont hashés avec SHA-256
- ✅ Les tokens JWT sont stockés dans SecureStore (pas dans SQLite)
- ⚠️ Les OTP sont stockés en clair (temporairement, pour 2 minutes)

### Recommandations
1. Ne jamais stocker de mots de passe en clair
2. Chiffrer la base de données en production (SQLCipher)
3. Nettoyer régulièrement les OTP expirés
4. Limiter les tentatives de connexion

## Maintenance

### Vérifier l'intégrité
```sql
PRAGMA integrity_check;
```

### Optimiser la base
```sql
VACUUM;
ANALYZE;
```

### Statistiques
```sql
-- Nombre d'utilisateurs
SELECT COUNT(*) FROM users;

-- Nombre de groupes
SELECT COUNT(*) FROM groups;

-- Contributions par statut
SELECT status, COUNT(*) FROM contributions GROUP BY status;
```
