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

  // ── Seed : groupe par défaut ────────────────────────────────────────────
  const DEFAULT_GROUP_ID = 'grp_meilleure_promo_001';
  const existingGroup = getDB().getFirstSync<any>(
    'SELECT id FROM groups WHERE id = ?', [DEFAULT_GROUP_ID]
  );
  if (!existingGroup) {
    db.runSync(
      `INSERT INTO groups (id, name, description, monthly_amount, admin_id, due_day, invite_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_GROUP_ID,
        'Meilleure Promotion',
        'Groupe de tontine solidaire pour la meilleure promotion !',
        12500,
        'system',
        25,
        'PROMO2026',
      ]
    );
    console.log('[DB] ✅ Groupe par défaut "Meilleure Promotion" créé (code: PROMO2026)');
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
  const memberId = 'gm_' + Math.random().toString(36).slice(2, 11);
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
    const contribId = 'ctb_' + Math.random().toString(36).slice(2, 11);
    db.runSync(
      `INSERT INTO contributions (id, group_id, user_id, month, amount, status)
       VALUES (?, ?, ?, ?, ?, 'EN_ATTENTE')`,
      [contribId, groupId, userId, month, group?.monthly_amount ?? 12500]
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
export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const saveOTP = (phone: string, code: string, context: string): void => {
  const db = getDB();
  db.runSync('UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0', [phone]);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  db.runSync(
    `INSERT INTO otp_codes (phone, code, context, expires_at) VALUES (?, ?, ?, ?)`,
    [phone, code, context, expiresAt]
  );
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
