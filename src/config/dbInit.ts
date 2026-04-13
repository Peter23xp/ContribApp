import { getLocalDB, USE_LOCAL_DB } from './database';

/**
 * Initialise les tables SQLite pour le développement.
 * Appelé UNE SEULE FOIS au démarrage de l'app (dans App.tsx).
 */
export async function initLocalDatabase(): Promise<void> {
  if (!USE_LOCAL_DB) return; // Ne rien faire en production

  const db = getLocalDB();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- TABLE : users
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      operator TEXT NOT NULL CHECK(operator IN ('airtel','orange','mpesa','mtn')),
      profile_photo_url TEXT,
      is_verified INTEGER DEFAULT 0,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- TABLE : groups
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      admin_uid TEXT NOT NULL,
      treasurer_uid TEXT NOT NULL,
      treasurer_phone TEXT NOT NULL,
      treasurer_operator TEXT NOT NULL,
      contribution_amount REAL NOT NULL,
      currency TEXT DEFAULT 'CDF',
      payment_deadline_day INTEGER NOT NULL,
      late_penalty_percent REAL DEFAULT 0,
      require_approval INTEGER DEFAULT 0,
      contributions_visible INTEGER DEFAULT 1,
      invite_code TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      member_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (admin_uid) REFERENCES users(uid)
    );

    -- TABLE : group_members
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      operator TEXT NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin','treasurer','member','auditor')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','removed')),
      joined_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (uid) REFERENCES users(uid),
      UNIQUE(group_id, uid)
    );

    -- TABLE : contributions
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      member_uid TEXT NOT NULL,
      member_name TEXT NOT NULL,
      period_month TEXT NOT NULL,
      amount_due REAL NOT NULL,
      amount_paid REAL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','late')),
      payment_method TEXT CHECK(payment_method IN ('airtel','orange','mpesa','mtn')),
      transaction_ref TEXT,
      aggregator_ref TEXT,
      paid_at TEXT,
      is_late INTEGER DEFAULT 0,
      penalty_amount REAL DEFAULT 0,
      receipt_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (member_uid) REFERENCES users(uid),
      UNIQUE(group_id, member_uid, period_month)
    );

    -- TABLE : notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_uid TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (recipient_uid) REFERENCES users(uid)
    );
  `);

  console.log('[DEV] SQLite initialisé avec succès');
}
