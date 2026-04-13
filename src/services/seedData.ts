/**
 * seedData.ts
 * Données de seed pour le développement local
 * Permet de tester l'application sans backend
 */
import * as Crypto from 'expo-crypto';
import { getCurrentMonthKey, getDB } from './database';

/**
 * Créer des données de test pour le développement
 */
export async function seedDevelopmentData(): Promise<void> {
  const db = getDB();
  
  // Vérifier si des données existent déjà
  const existingUsers = db.getAllSync<any>('SELECT COUNT(*) as count FROM users');
  if (existingUsers[0]?.count > 0) {
    console.log('[SEED] ⏭️  Données déjà présentes, seed ignoré');
    return;
  }

  console.log('[SEED] 🌱 Création des données de développement...');

  // Hash du PIN par défaut "123456"
  const defaultPinHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    '123456'
  );

  // ─── Créer des utilisateurs ──────────────────────────────────────
  const users = [
    {
      id: 'usr_admin_001',
      full_name: 'Peter Akilimali',
      phone: '+243974473513',
      operator: 'airtel',
      pin_hash: defaultPinHash,
      role: 'admin',
      is_verified: 1,
    },
    {
      id: 'usr_treasurer_001',
      full_name: 'Jeannette Ndaba',
      phone: '+243890234567',
      operator: 'orange',
      pin_hash: defaultPinHash,
      role: 'treasurer',
      is_verified: 1,
    },
    {
      id: 'usr_member_001',
      full_name: 'Jean Mukendi',
      phone: '+243810345678',
      operator: 'mpesa',
      pin_hash: defaultPinHash,
      role: 'member',
      is_verified: 1,
    },
    {
      id: 'usr_member_002',
      full_name: 'Sarah Mbuyi',
      phone: '+243900456789',
      operator: 'mtn',
      pin_hash: defaultPinHash,
      role: 'member',
      is_verified: 1,
    },
    {
      id: 'usr_member_003',
      full_name: 'Patrick Kalala',
      phone: '+243970567890',
      operator: 'airtel',
      pin_hash: defaultPinHash,
      role: 'member',
      is_verified: 1,
    },
    {
      id: 'usr_member_004',
      full_name: 'Esther Nkulu',
      phone: '+243890678901',
      operator: 'orange',
      pin_hash: defaultPinHash,
      role: 'member',
      is_verified: 1,
    },
    {
      id: 'usr_member_005',
      full_name: 'David Kasongo',
      phone: '+243810789012',
      operator: 'mpesa',
      pin_hash: defaultPinHash,
      role: 'member',
      is_verified: 1,
    },
  ];

  for (const user of users) {
    db.runSync(
      `INSERT INTO users (id, full_name, phone, operator, pin_hash, role, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.full_name, user.phone, user.operator, user.pin_hash, user.role, user.is_verified]
    );
  }
  console.log(`[SEED] ✅ ${users.length} utilisateurs créés`);

  // ─── Créer un groupe ─────────────────────────────────────────────
  const groupId = 'grp_dev_001';
  const inviteCode = 'DEV2026';
  
  db.runSync(
    `INSERT INTO groups (
      id, name, description, monthly_amount, admin_id, due_day, invite_code,
      currency, penalty_enabled, penalty_type, penalty_amount, 
      require_approval, payments_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      groupId,
      'Groupe de Développement',
      'Groupe de test pour le développement de l\'application',
      50000, // 50 000 CDF par mois
      'usr_admin_001',
      25, // Échéance le 25 du mois
      inviteCode,
      'CDF',
      1, // Pénalités activées
      'fixed',
      5000, // 5 000 CDF de pénalité
      0, // Pas d'approbation requise
      1, // Paiements visibles
    ]
  );
  console.log(`[SEED] ✅ Groupe créé (Code: ${inviteCode})`);

  // ─── Ajouter les membres au groupe ───────────────────────────────
  const memberRoles = [
    { userId: 'usr_admin_001', role: 'admin' },
    { userId: 'usr_treasurer_001', role: 'treasurer' },
    { userId: 'usr_member_001', role: 'member' },
    { userId: 'usr_member_002', role: 'member' },
    { userId: 'usr_member_003', role: 'member' },
    { userId: 'usr_member_004', role: 'member' },
    { userId: 'usr_member_005', role: 'member' },
  ];

  for (const { userId, role } of memberRoles) {
    const memberId = `gm_${userId}_${groupId}`;
    db.runSync(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES (?, ?, ?, ?)`,
      [memberId, groupId, userId, role]
    );
  }
  console.log(`[SEED] ✅ ${memberRoles.length} membres ajoutés au groupe`);

  // ─── Créer des contributions pour le mois en cours ───────────────
  const currentMonth = getCurrentMonthKey();
  const contributions = [
    { userId: 'usr_admin_001', status: 'PAYE', paidAt: new Date().toISOString() },
    { userId: 'usr_treasurer_001', status: 'PAYE', paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { userId: 'usr_member_001', status: 'PAYE', paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { userId: 'usr_member_002', status: 'EN_ATTENTE', paidAt: null },
    { userId: 'usr_member_003', status: 'EN_RETARD', paidAt: null },
    { userId: 'usr_member_004', status: 'PAYE', paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { userId: 'usr_member_005', status: 'EN_ATTENTE', paidAt: null },
  ];

  for (const contrib of contributions) {
    const contribId = `ctb_${contrib.userId}_${currentMonth}`;
    const penaltyAmount = contrib.status === 'EN_RETARD' ? 5000 : 0;
    
    db.runSync(
      `INSERT INTO contributions (
        id, group_id, user_id, month, amount, penalty_amount, 
        status, operator, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contribId,
        groupId,
        contrib.userId,
        currentMonth,
        50000,
        penaltyAmount,
        contrib.status,
        contrib.status === 'PAYE' ? 'airtel' : null,
        contrib.paidAt,
      ]
    );
  }
  console.log(`[SEED] ✅ ${contributions.length} contributions créées pour ${currentMonth}`);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  🎉 DONNÉES DE DÉVELOPPEMENT CRÉÉES AVEC SUCCÈS !     ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  📱 Comptes de test disponibles :                     ║');
  console.log('║                                                        ║');
  console.log('║  👑 Admin:                                             ║');
  console.log('║     Tél: +243970123456                                 ║');
  console.log('║     PIN: 123456                                        ║');
  console.log('║                                                        ║');
  console.log('║  💰 Trésorière:                                        ║');
  console.log('║     Tél: +243890234567                                 ║');
  console.log('║     PIN: 123456                                        ║');
  console.log('║                                                        ║');
  console.log('║  👤 Membre (Jean):                                     ║');
  console.log('║     Tél: +243810345678                                 ║');
  console.log('║     PIN: 123456                                        ║');
  console.log('║                                                        ║');
  console.log('║  📊 Groupe: "Groupe de Développement"                 ║');
  console.log('║     Code invitation: DEV2026                           ║');
  console.log('║     Montant mensuel: 50 000 CDF                        ║');
  console.log('║     Échéance: 25 du mois                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

/**
 * Réinitialiser toutes les données (pour les tests)
 */
export function resetAllData(): void {
  const db = getDB();
  
  console.log('[SEED] 🗑️  Suppression de toutes les données...');
  
  db.runSync('DELETE FROM contributions');
  db.runSync('DELETE FROM group_members');
  db.runSync('DELETE FROM groups');
  db.runSync('DELETE FROM otp_codes');
  db.runSync('DELETE FROM users');
  
  console.log('[SEED] ✅ Toutes les données supprimées');
}

/**
 * Réinitialiser et recréer les données
 */
export async function resetAndSeed(): Promise<void> {
  resetAllData();
  await seedDevelopmentData();
}
