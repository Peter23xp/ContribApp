import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (!_db) _db = SQLite.openDatabaseSync('contribapp.db');
  return _db;
};

export const initDatabase = async (): Promise<void> => {
  const db = getDB();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
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
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      context TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      monthly_amount REAL NOT NULL,
      admin_id TEXT NOT NULL,
      due_day INTEGER DEFAULT 25,
      invite_code TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS contributions (
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
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Migration : ajouter invite_code si colonne absente (base existante) ─
  try {
    db.execSync(`ALTER TABLE groups ADD COLUMN invite_code TEXT`);
    console.log('[DB] ✅ Migration : colonne invite_code ajoutée');
  } catch (_) {
    // Colonne déjà présente — normal au 2ème démarrage
  }

  // ── Migration : ajouter due_date aux contributions existantes ─────────
  try {
    db.execSync(`ALTER TABLE contributions ADD COLUMN due_date TEXT`);
  } catch (_) { /* déjà présente */ }

  // ── Migration : Module 04 GroupConfig Columns ────────────────────────────
  try { db.execSync(`ALTER TABLE groups ADD COLUMN currency TEXT DEFAULT 'CDF'`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN penalty_enabled INTEGER DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN penalty_type TEXT DEFAULT 'fixed'`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN penalty_amount REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN require_approval INTEGER DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN payments_visible INTEGER DEFAULT 1`); } catch (_) {}
  try { db.execSync(`ALTER TABLE groups ADD COLUMN photo_url TEXT`); } catch (_) {}

  // Seed automatique en développement
  // Créer des données de test au premier lancement
  try {
    const { seedDevelopmentData } = await import('./seedData');
    await seedDevelopmentData();
  } catch (error) {
    console.log('[DB] ℹ️  Seed ignoré ou déjà effectué');
  }

  console.log('[DB] ✅ Base de données SQLite initialisée');
};

// ─── Utilisateurs ─────────────────────────────────────────────────────────────
export const findUserByPhone = (phone: string): any | null => {
  return getDB().getFirstSync<any>('SELECT * FROM users WHERE phone = ?', [phone]) ?? null;
};

export const findUserById = (id: string): any | null => {
  return getDB().getFirstSync<any>('SELECT * FROM users WHERE id = ?', [id]) ?? null;
};

export const createUser = (user: {
  id: string; full_name: string; phone: string;
  operator: string; pin_hash: string; profile_photo_url?: string;
}): void => {
  getDB().runSync(
    `INSERT INTO users (id, full_name, phone, operator, pin_hash, profile_photo_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.full_name, user.phone, user.operator, user.pin_hash, user.profile_photo_url ?? null]
  );
};

export const markUserAsVerified = (phone: string): void => {
  getDB().runSync('UPDATE users SET is_verified = 1 WHERE phone = ?', [phone]);
};

// ─── Groupes ──────────────────────────────────────────────────────────────────
export const getGroupForAdmin = (adminId: string): any | null => {
  return getDB().getFirstSync<any>('SELECT * FROM groups WHERE admin_id = ?', [adminId]) ?? null;
};

export const getGroupForMember = (userId: string): any | null => {
  return getDB().getFirstSync<any>(`
    SELECT g.* FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    LIMIT 1
  `, [userId]) ?? null;
};

export const getMembersOfGroup = (groupId: string): any[] => {
  return getDB().getAllSync<any>(`
    SELECT u.*, gm.role as member_role FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `, [groupId]);
};

export const getAllGroups = (): any[] => {
  return getDB().getAllSync<any>('SELECT * FROM groups ORDER BY created_at DESC');
};

export const getGroupByInviteCode = (code: string): any | null => {
  return getDB().getFirstSync<any>(
    'SELECT * FROM groups WHERE invite_code = ?',
    [code.trim().toUpperCase()]
  ) ?? null;
};

export const isAlreadyMember = (userId: string, groupId: string): boolean => {
  const row = getDB().getFirstSync<any>(
    'SELECT id FROM group_members WHERE user_id = ? AND group_id = ?',
    [userId, groupId]
  );
  return !!row;
};

export const joinGroup = (userId: string, groupId: string): void => {
  const db = getDB();
  const memberId = 'gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  db.runSync(
    `INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'member')`,
    [memberId, groupId, userId]
  );
  // Créer automatiquement une contribution EN_ATTENTE pour le mois en cours
  const month = getCurrentMonthKey();
  const existing = db.getFirstSync<any>(
    'SELECT id FROM contributions WHERE user_id = ? AND group_id = ? AND month = ?',
    [userId, groupId, month]
  );
  if (!existing) {
    const group = db.getFirstSync<any>('SELECT * FROM groups WHERE id = ?', [groupId]);
    const contribId = 'ctb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    db.runSync(
      `INSERT INTO contributions (id, group_id, user_id, month, amount, status)
       VALUES (?, ?, ?, ?, ?, 'EN_ATTENTE')`,
      [contribId, groupId, userId, month, group?.monthly_amount ?? 0]
    );
    console.log(`[DB] ✅ Contribution EN_ATTENTE créée pour ${userId} dans ${groupId} (${month})`);
  }
  console.log(`[DB] ✅ ${userId} a rejoint le groupe ${groupId}`);
};

// ─── Contributions ────────────────────────────────────────────────────────────
export const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getContributionsForMonth = (groupId: string, month?: string): any[] => {
  const m = month ?? getCurrentMonthKey();
  return getDB().getAllSync<any>(
    'SELECT c.*, u.full_name, u.phone, u.operator as user_operator FROM contributions c JOIN users u ON c.user_id = u.id WHERE c.group_id = ? AND c.month = ?',
    [groupId, m]
  );
};

export const getMemberContribution = (userId: string, groupId: string, month?: string): any | null => {
  const m = month ?? getCurrentMonthKey();
  return getDB().getFirstSync<any>(
    'SELECT * FROM contributions WHERE user_id = ? AND group_id = ? AND month = ?',
    [userId, groupId, m]
  ) ?? null;
};

export const getRecentPaymentsForMember = (userId: string, limit = 3): any[] => {
  return getDB().getAllSync<any>(
    `SELECT * FROM contributions WHERE user_id = ? AND status = 'PAYE' ORDER BY paid_at DESC LIMIT ?`,
    [userId, limit]
  );
};

export const getRecentPaymentsForGroup = (groupId: string, limit = 5): any[] => {
  return getDB().getAllSync<any>(`
    SELECT c.*, u.full_name FROM contributions c
    JOIN users u ON c.user_id = u.id
    WHERE c.group_id = ? AND c.status = 'PAYE'
    ORDER BY c.paid_at DESC LIMIT ?
  `, [groupId, limit]);
};

// ─── OTP ──────────────────────────────────────────────────────────────────────
export const generateOTP = (): string => {
  // TODO: La génération d'OTP devrait être gérée par le backend
  // Cette implémentation locale est temporaire pour le développement
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOTP = (phone: string, code: string, context: string): void => {
  const db = getDB();
  db.runSync('UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0', [phone]);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  db.runSync(
    `INSERT INTO otp_codes (phone, code, context, expires_at) VALUES (?, ?, ?, ?)`,
    [phone, code, context, expiresAt]
  );
  // En production, l'OTP serait envoyé par SMS via un service externe
  console.log('\n╔════════════════════════════════════╗');
  console.log(`║  📱 OTP POUR ${phone}`);
  console.log(`║  🔑 CODE : ${code}`);
  console.log(`║  📋 CONTEXTE : ${context}`);
  console.log(`║  ⏱  Expire dans 2 minutes`);
  console.log('╚════════════════════════════════════╝\n');
};

export const verifyOTPCode = (phone: string, code: string): { valid: boolean; reason?: string } => {
  const db = getDB();
  const otp = db.getFirstSync<any>(
    `SELECT * FROM otp_codes WHERE phone = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (!otp) return { valid: false, reason: 'OTP_NOT_FOUND' };
  if (new Date(otp.expires_at) < new Date()) {
    db.runSync('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);
    return { valid: false, reason: 'OTP_EXPIRED' };
  }
  if (otp.attempts >= 3) return { valid: false, reason: 'MAX_ATTEMPTS' };
  if (otp.code !== code) {
    db.runSync('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
    return { valid: false, reason: 'INVALID_OTP' };
  }
  db.runSync('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);
  return { valid: true };
};

// ─── User Profile & Preferences ───────────────────────────────────────────────

export const getCurrentUser = (): any | null => {
  // Récupérer l'utilisateur actuellement connecté
  // En mode local, on prend le dernier utilisateur vérifié
  return getDB().getFirstSync<any>(
    'SELECT * FROM users WHERE is_verified = 1 ORDER BY created_at DESC LIMIT 1'
  ) ?? null;
};

export const updateUser = (userId: string, updates: Partial<{
  full_name: string;
  phone: string;
  operator: string;
  profile_photo_url: string | null;
  pin_hash: string;
  biometric_enabled: boolean;
  last_login: string;
}>): void => {
  const db = getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.full_name !== undefined) {
    fields.push('full_name = ?');
    values.push(updates.full_name);
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }
  if (updates.operator !== undefined) {
    fields.push('operator = ?');
    values.push(updates.operator);
  }
  if (updates.profile_photo_url !== undefined) {
    fields.push('profile_photo_url = ?');
    values.push(updates.profile_photo_url);
  }
  if (updates.pin_hash !== undefined) {
    fields.push('pin_hash = ?');
    values.push(updates.pin_hash);
  }
  if (updates.biometric_enabled !== undefined) {
    // Ajouter la colonne si elle n'existe pas
    try {
      db.execSync('ALTER TABLE users ADD COLUMN biometric_enabled INTEGER DEFAULT 0');
    } catch (_) { /* déjà présente */ }
    fields.push('biometric_enabled = ?');
    values.push(updates.biometric_enabled ? 1 : 0);
  }
  if (updates.last_login !== undefined) {
    // Ajouter la colonne si elle n'existe pas
    try {
      db.execSync('ALTER TABLE users ADD COLUMN last_login TEXT');
    } catch (_) { /* déjà présente */ }
    fields.push('last_login = ?');
    values.push(updates.last_login);
  }

  if (fields.length === 0) return;

  values.push(userId);
  db.runSync(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const getUserPreferences = (userId: string): any | null => {
  // Créer la table preferences si elle n'existe pas
  const db = getDB();
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        push_enabled INTEGER DEFAULT 1,
        sms_reminders INTEGER DEFAULT 1,
        sms_confirmation INTEGER DEFAULT 0,
        monthly_report INTEGER DEFAULT 1,
        language TEXT DEFAULT 'fr',
        currency TEXT DEFAULT 'CDF'
      )
    `);
  } catch (_) { /* déjà créée */ }

  return db.getFirstSync<any>(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  ) ?? null;
};

export const updateUserPreferences = (userId: string, prefs: {
  pushEnabled?: boolean;
  smsReminders?: boolean;
  smsConfirmation?: boolean;
  monthlyReport?: boolean;
  language?: 'fr' | 'en';
  currency?: 'CDF' | 'USD';
}): void => {
  const db = getDB();
  
  // Vérifier si les préférences existent
  const existing = getUserPreferences(userId);
  
  if (!existing) {
    // Créer les préférences
    db.runSync(
      `INSERT INTO user_preferences (user_id, push_enabled, sms_reminders, sms_confirmation, monthly_report, language, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        prefs.pushEnabled !== undefined ? (prefs.pushEnabled ? 1 : 0) : 1,
        prefs.smsReminders !== undefined ? (prefs.smsReminders ? 1 : 0) : 1,
        prefs.smsConfirmation !== undefined ? (prefs.smsConfirmation ? 1 : 0) : 0,
        prefs.monthlyReport !== undefined ? (prefs.monthlyReport ? 1 : 0) : 1,
        prefs.language ?? 'fr',
        prefs.currency ?? 'CDF',
      ]
    );
  } else {
    // Mettre à jour les préférences
    const fields: string[] = [];
    const values: any[] = [];

    if (prefs.pushEnabled !== undefined) {
      fields.push('push_enabled = ?');
      values.push(prefs.pushEnabled ? 1 : 0);
    }
    if (prefs.smsReminders !== undefined) {
      fields.push('sms_reminders = ?');
      values.push(prefs.smsReminders ? 1 : 0);
    }
    if (prefs.smsConfirmation !== undefined) {
      fields.push('sms_confirmation = ?');
      values.push(prefs.smsConfirmation ? 1 : 0);
    }
    if (prefs.monthlyReport !== undefined) {
      fields.push('monthly_report = ?');
      values.push(prefs.monthlyReport ? 1 : 0);
    }
    if (prefs.language !== undefined) {
      fields.push('language = ?');
      values.push(prefs.language);
    }
    if (prefs.currency !== undefined) {
      fields.push('currency = ?');
      values.push(prefs.currency);
    }

    if (fields.length > 0) {
      values.push(userId);
      db.runSync(`UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`, values);
    }
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = (page = 1, limit = 30): any[] => {
  const db = getDB();
  
  // Créer la table si elle n'existe pas
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        navigation_target TEXT,
        navigation_params TEXT
      )
    `);
  } catch (_) { /* déjà créée */ }

  const offset = (page - 1) * limit;
  const notifications = db.getAllSync<any>(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  return notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at,
    navigationTarget: n.navigation_target,
    navigationParams: n.navigation_params ? JSON.parse(n.navigation_params) : undefined,
  }));
};

export const getUnreadNotificationsCount = (): number => {
  const db = getDB();
  const result = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'
  );
  return result?.count ?? 0;
};

export const markNotificationAsRead = (id: string): void => {
  const db = getDB();
  db.runSync('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
};

export const markAllNotificationsAsRead = (): void => {
  const db = getDB();
  db.runSync('UPDATE notifications SET is_read = 1');
};

export const deleteNotification = (id: string): void => {
  const db = getDB();
  db.runSync('DELETE FROM notifications WHERE id = ?', [id]);
};

export const deleteReadNotifications = (): void => {
  const db = getDB();
  db.runSync('DELETE FROM notifications WHERE is_read = 1');
};

export const createNotification = (notification: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  navigationTarget?: string;
  navigationParams?: Record<string, any>;
}): void => {
  const db = getDB();
  db.runSync(
    `INSERT INTO notifications (id, user_id, type, title, body, navigation_target, navigation_params)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.id,
      notification.userId,
      notification.type,
      notification.title,
      notification.body,
      notification.navigationTarget ?? null,
      notification.navigationParams ? JSON.stringify(notification.navigationParams) : null,
    ]
  );
};
