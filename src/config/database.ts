import * as SQLite from 'expo-sqlite';

// Base de données SQLite locale (développement uniquement)
let _db: SQLite.SQLiteDatabase | null = null;

export function getLocalDB(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('contributapp_dev.db');
  }
  return _db;
}

export const USE_LOCAL_DB = process.env.EXPO_PUBLIC_USE_LOCAL_DB === 'true';
