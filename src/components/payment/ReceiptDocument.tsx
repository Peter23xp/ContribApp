/**
 * ReceiptDocument — Composant Module 03 PAIEMENT (SCR-012)
 * Rendu d'un reçu de contribution en mode aperçu (ScrollView),
 * avec filigrane diagonal "PAYÉ" et QR Code.
 * Les boutons Télécharger/Partager sont gérés par l'écran parent.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OPERATORS } from '../../constants/operators';

export interface ReceiptData {
  receiptNumber: string;
  txId: string;
  groupName: string;
  period: string;
  memberName: string;
  memberPhone: string;
  operator: 'airtel' | 'orange' | 'mpesa' | 'mtn';
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  treasurerName: string;
  treasurerAccount: string;
  paidAt: string;       // ISO 8601
}

interface Props {
  receiptData: ReceiptData;
}

// ─── helpers ────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatAmount(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0 });
}

// ─── Sous-composants ────────────────────────────────────────

function SectionDivider() {
  return <View style={styles.divider} />;
}

function RowInfo({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.monoText]}>{value}</Text>
    </View>
  );
}

// ─── Composant principal ─────────────────────────────────────

export function ReceiptDocument({ receiptData }: Props) {
  const {
    receiptNumber, txId, groupName, period,
    memberName, memberPhone, operator,
    baseAmount, penaltyAmount, totalAmount,
    treasurerName, treasurerAccount, paidAt,
  } = receiptData;

  const op = OPERATORS.find((o) => o.id === operator);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ══ Page reçu ══════════════════════════════════════════ */}
      <View style={styles.receiptPage}>

        {/* ── Filigrane diagonal "PAYÉ" ── */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Text style={styles.watermarkText}>PAYÉ</Text>
        </View>

        {/* ── En-tête ── */}
        <View style={styles.headerSection}>
          <View style={styles.headerLogoRow}>
            <MaterialCommunityIcons name="bank" size={30} color={Colors.primary} />
            <Text style={styles.appName}>ContribApp</Text>
          </View>
          <Text style={styles.receiptTitle}>REÇU DE CONTRIBUTION</Text>
          <Text style={styles.receiptDate}>{formatDateTime(paidAt)}</Text>
        </View>

        <SectionDivider />

        {/* ── Numéro de reçu + QR Code ── */}
        <View style={styles.receiptIdSection}>
          <View style={styles.receiptIdBlock}>
            <Text style={styles.fieldLabel}>N° REÇU</Text>
            <Text style={styles.receiptNumber}>{receiptNumber}</Text>
            <Text style={styles.fieldLabel} style={{ marginTop: 6 }}>RÉFÉRENCE TX</Text>
            <Text style={styles.txIdText}>{txId}</Text>
          </View>
          <View style={styles.qrBlock}>
            <QRCode
              value={txId}
              size={100}
              color={Colors.onSurface}
              backgroundColor="#FFFFFF"
            />
            <Text style={styles.qrCaption}>Scanner pour vérifier</Text>
          </View>
        </View>

        <SectionDivider />

        {/* ── Section Groupe ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GROUPE</Text>
          <RowInfo label="Nom du groupe" value={groupName} />
          <RowInfo label="Période"        value={period} />
        </View>

        <SectionDivider />

        {/* ── Section Payeur ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYEUR</Text>
          <RowInfo label="Nom"       value={memberName} />
          <RowInfo label="Téléphone" value={memberPhone} mono />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Opérateur</Text>
            <View style={styles.opCell}>
              {op?.logo && (
                <Image source={op.logo} style={styles.opLogoSmall} resizeMode="contain" />
              )}
              <Text style={styles.infoValue}>{op?.name ?? operator}</Text>
            </View>
          </View>
        </View>

        <SectionDivider />

        {/* ── Section Paiement ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DÉTAIL DU PAIEMENT</Text>
          <RowInfo
            label="Montant de base"
            value={`${formatAmount(baseAmount)} CDF`}
          />
          {penaltyAmount > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pénalité de retard</Text>
              <Text style={[styles.infoValue, { color: Colors.error }]}>
                + {formatAmount(penaltyAmount)} CDF
              </Text>
            </View>
          )}
          {/* Ligne total */}
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL PAYÉ</Text>
            <Text style={styles.totalValue}>{formatAmount(totalAmount)} CDF</Text>
          </View>
        </View>

        <SectionDivider />

        {/* ── Section Bénéficiaire ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BÉNÉFICIAIRE</Text>
          <RowInfo label="Trésorière"     value={treasurerName} />
          <RowInfo label="Compte récepteur" value={treasurerAccount} mono />
        </View>

        {/* ── Pied de page ── */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check" size={14} color={Colors.secondary} />
          <Text style={styles.footerText}>
            Ce reçu est authentifié par ContribApp RDC. Toute reproduction non autorisée est interdite.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.surfaceContainerLow },
  scrollContent: { padding: 16, paddingBottom: 32 },

  receiptPage: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
    position: 'relative',
  },

  // ── Filigrane ──
  watermarkContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
    transform: [{ rotate: '-30deg' }],
  },
  watermarkText: {
    fontFamily: Fonts.display,
    fontSize: 96,
    color: '#27AE60',
    opacity: 0.07,
    letterSpacing: 8,
  },

  // ── Header ──
  headerSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: Colors.surfaceContainerLow,
    zIndex: 1,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  appName: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.primary,
  },
  receiptTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    letterSpacing: 2,
    marginBottom: 4,
  },
  receiptDate: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant + '70',
    marginHorizontal: 24,
    zIndex: 1,
  },

  // ── ID + QR ──
  receiptIdSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    zIndex: 1,
  },
  receiptIdBlock: { flex: 1, gap: 2, marginRight: 16 },
  fieldLabel: {
    fontFamily: Fonts.label,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  receiptNumber: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
  },
  txIdText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  qrBlock: { alignItems: 'center', gap: 6 },
  qrCaption: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Colors.textMuted,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
    zIndex: 1,
  },
  sectionTitle: {
    fontFamily: Fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
  },
  infoValue: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.onSurface,
    textAlign: 'right',
    flex: 1,
  },
  monoText: {
    fontFamily: 'Courier',
    letterSpacing: 0.3,
  },
  opCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  opLogoSmall: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
  },

  // ── Total ──
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant + '80',
  },
  totalLabel: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
  },
  totalValue: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: Colors.secondary,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.surfaceContainerLow,
    zIndex: 1,
  },
  footerText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 14,
  },
});
