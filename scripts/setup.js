const fs = require('fs');
const path = require('path');

const screens = [
  { path: 'src/screens/auth/SplashScreen.tsx', id: 'SCR-001', name: 'Splash Screen' },
  { path: 'src/screens/auth/RegisterScreen.tsx', id: 'SCR-002', name: 'Register Screen' },
  { path: 'src/screens/auth/LoginScreen.tsx', id: 'SCR-003', name: 'Login Screen' },
  { path: 'src/screens/auth/OTPScreen.tsx', id: 'SCR-004', name: 'OTP Screen' },
  { path: 'src/screens/dashboard/AdminDashboard.tsx', id: 'SCR-005', name: 'Dashboard Admin' },
  { path: 'src/screens/dashboard/TreasurerDashboard.tsx', id: 'SCR-006', name: 'Dashboard Trésorier' },
  { path: 'src/screens/dashboard/MemberDashboard.tsx', id: 'SCR-007', name: 'Dashboard Membre' },
  { path: 'src/screens/payment/PayContributionScreen.tsx', id: 'SCR-010', name: 'Payer Contribution' },
  { path: 'src/screens/payment/PaymentConfirmScreen.tsx', id: 'SCR-011', name: 'Confirmation Paiement' },
  { path: 'src/screens/payment/ReceiptScreen.tsx', id: 'SCR-012', name: 'Reçu' },
  { path: 'src/screens/group/GroupConfigScreen.tsx', id: 'SCR-013', name: 'Configuration Groupe' },
  { path: 'src/screens/group/MembersScreen.tsx', id: 'SCR-014', name: 'Membres du Groupe' },
  { path: 'src/screens/group/InviteScreen.tsx', id: 'SCR-015', name: 'Inviter Membres' },
  { path: 'src/screens/group/GroupDetailsScreen.tsx', id: 'SCR-016', name: 'Détails Groupe' },
  { path: 'src/screens/history/FullHistoryScreen.tsx', id: 'SCR-017', name: 'Historique Complet' },
  { path: 'src/screens/history/MyHistoryScreen.tsx', id: 'SCR-018', name: 'Mon Historique' },
  { path: 'src/screens/reports/ReportsScreen.tsx', id: 'SCR-019', name: 'Rapports' },
  { path: 'src/screens/reports/PublicReportsScreen.tsx', id: 'SCR-020', name: 'Rapports Publics' },
  { path: 'src/screens/profile/ProfileScreen.tsx', id: 'SCR-021', name: 'Mon Profil' },
  { path: 'src/screens/notifications/NotificationsScreen.tsx', id: 'SCR-022', name: 'Notifications' },
];

const screenTemplate = (id, name) => "import React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\nimport { Colors } from '../../constants/colors';\n\nexport default function " + path.basename(name).replace(/\s+/g, '').replace('é', 'e') + "() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>" + id + " — " + name + "</Text>\n      {/* TODO: implémenter selon SSD ContribApp RDC */}\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: {\n    flex: 1,\n    backgroundColor: Colors.background,\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n  text: {\n    color: Colors.textPrimary,\n    fontSize: 16,\n  },\n});\n";

screens.forEach(s => {
  const fullPath = path.join(__dirname, '..', s.path);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, screenTemplate(s.id, s.name));
});

const components = [
  'src/components/common/AppButton.tsx',
  'src/components/common/AppInput.tsx',
  'src/components/common/StatusBadge.tsx',
  'src/components/common/OperatorSelector.tsx',
  'src/components/common/LoadingOverlay.tsx',
  'src/components/common/OfflineBanner.tsx',
  'src/components/common/ConfirmModal.tsx',
  'src/components/common/ToastNotification.tsx',
  'src/components/dashboard/CollectionCard.tsx',
  'src/components/dashboard/MembersProgressCard.tsx',
  'src/components/dashboard/LateMembers.tsx',
  'src/components/dashboard/MonthlyBarChart.tsx',
  'src/components/payment/PaymentStepIndicator.tsx',
  'src/components/payment/OperatorInstructions.tsx',
];

const componentTemplate = (name) => "import React from 'react';\nimport { View, Text } from 'react-native';\n\nexport function " + name + "() {\n  return <View><Text>" + name + " Component</Text></View>;\n}\n";

components.forEach(c => {
  const fullPath = path.join(__dirname, '..', c);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, componentTemplate(path.basename(c, '.tsx')));
});

const stores = [
  'src/stores/groupStore.ts',
  'src/stores/paymentStore.ts',
  'src/stores/notificationStore.ts',
];

stores.forEach(s => {
  const fullPath = path.join(__dirname, '..', s);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "import { create } from 'zustand';\n\nexport const use" + path.basename(s, '.ts').replace('Store', 'Store') + " = create((set) => ({}));\n");
});

const services = [
  'src/services/authService.ts',
  'src/services/groupService.ts',
  'src/services/contributionService.ts',
  'src/services/notificationService.ts',
  'src/services/storageService.ts',
];

services.forEach(s => {
  const fullPath = path.join(__dirname, '..', s);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "// TODO: implémenter service\nexport const dummyService = async () => {};\n");
});

const hooks = [
  'src/hooks/useAuth.ts',
  'src/hooks/useGroup.ts',
  'src/hooks/usePayment.ts',
  'src/hooks/useNetworkStatus.ts',
  'src/hooks/useNotifications.ts',
];

hooks.forEach(h => {
  const fullPath = path.join(__dirname, '..', h);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "export const " + path.basename(h, '.ts') + " = () => {};\n");
});

const types = [
  'src/types/user.types.ts',
  'src/types/group.types.ts',
  'src/types/contribution.types.ts',
  'src/types/api.types.ts',
];

types.forEach(t => {
  const fullPath = path.join(__dirname, '..', t);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "// TODO: types definitions\n");
});

const utils = [
  'src/utils/formatCurrency.ts',
  'src/utils/formatDate.ts',
  'src/utils/validatePhone.ts',
  'src/utils/errorHandler.ts',
];

utils.forEach(u => {
  const fullPath = path.join(__dirname, '..', u);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "export const " + path.basename(u, '.ts') + " = () => {};\n");
});

// Logs images
const logosDir = path.join(__dirname, '..', 'src/assets/logos');
fs.mkdirSync(logosDir, { recursive: true });
const emptyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
['airtel', 'orange', 'mpesa', 'mtn'].forEach(op => fs.writeFileSync(path.join(logosDir, op + '.png'), emptyPng));
