/**
 * SCR-012 — Reçu de Paiement
 * PaymentReceiptScreen.tsx
 *
 * Accessible depuis : SCR-011, SCR-007, SCR-009, SCR-017/018
 * Rôles : Membre ET Trésorière
 */
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing    from 'expo-sharing';
import NetInfo          from '@react-native-community/netinfo';
import Toast            from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { ReceiptDocument }    from '../../components/payment/ReceiptDocument';
import {
  fetchReceiptDetail,
  type ReceiptDetail,
} from '../../services/contributionService';

import * as Print from 'expo-print';

// ─── Helpers ─────────────────────────────────────────────────

function safeFilename(receiptNumber: string): string {
  return `recu_${receiptNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(amount: number) {
  if (amount === undefined || amount === null) return '0';
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function generatePdfHtml(r: ReceiptDetail) {
  const dateStr = formatDate(r.paidAt);
  const formattedAmount = formatCurrency(r.amount);
  const formattedPenalty = r.penaltyAmount ? formatCurrency(r.penaltyAmount) : '0';

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #004d40; padding-bottom: 20px; }
          .title { font-size: 28px; font-weight: bold; color: #004d40; margin: 0 0 10px 0; }
          .subtitle { font-size: 16px; color: #666; margin: 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          .label { font-size: 14px; color: #666; font-weight: bold; }
          .value { font-size: 16px; font-weight: bold; color: #333; }
          .total-box { background-color: #f0fdf4; border: 2px solid #004d40; padding: 20px; text-align: center; margin-top: 30px; border-radius: 8px; }
          .total-label { font-size: 18px; color: #004d40; margin-bottom: 10px; font-weight: bold; }
          .total-value { font-size: 32px; font-weight: bold; color: #004d40; }
          .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Reçu de Contribution</h1>
          <p class="subtitle">${r.groupName || ''}</p>
        </div>
        
        <div class="row">
          <span class="label">N° de reçu :</span>
          <span class="value">${r.receiptNumber || ''}</span>
        </div>
        <div class="row">
          <span class="label">Date du paiement :</span>
          <span class="value">${dateStr}</span>
        </div>
        <div class="row">
          <span class="label">Membre :</span>
          <span class="value">${r.memberName || ''}</span>
        </div>
        <div class="row">
          <span class="label">Période :</span>
          <span class="value">${r.period || ''}</span>
        </div>
        <div class="row">
          <span class="label">Opérateur :</span>
          <span class="value" style="text-transform: capitalize;">${r.operator || ''}</span>
        </div>
        <div class="row">
          <span class="label">Réf. transaction :</span>
          <span class="value">${r.txReference || ''}</span>
        </div>
        <div class="row">
          <span class="label">Trésorière :</span>
          <span class="value">${r.treasurerName || ''}</span>
        </div>

        <div class="total-box">
          <div class="total-label">Montant Payé</div>
          <div class="total-value">${formattedAmount} ${r.currency || ''}</div>
          ${r.penaltyAmount && r.penaltyAmount > 0 ? `<div style="color: #d32f2f; margin-top: 5px; font-size: 14px;">(Inclut ${formattedPenalty} ${r.currency} de pénalité)</div>` : ''}
        </div>
        
        <div class="footer">
          Généré par ContribApp • Le ${formatDate(new Date().toISOString())}
        </div>
      </body>
    </html>
  `;
}

// ─── LoadingOverlay ──────────────────────────────────────────

// ─── LoadingOverlay ──────────────────────────────────────────

function LoadingOverlay({ message }: { message: string }) {
  return (
    <View style={s.overlay}>
      <View style={s.overlayCard}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.overlayText}>{message}</Text>
      </View>
    </View>
  );
}

// ─── Écran principal ─────────────────────────────────────────

export default function PaymentReceiptScreen({ navigation, route }: any) {
  const txId: string = route?.params?.txId ?? '';

  const [receipt,    setReceipt]    = useState<ReceiptDetail | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isOffline,  setIsOffline]  = useState(false);
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);

  // ── Réseau ──
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  // ── Chargement ──
  useEffect(() => {
    async function load() {
      if (!txId) { setIsLoading(false); setFetchError(true); return; }
      try {
        const data = await fetchReceiptDetail(txId);
        setReceipt(data);
      } catch {
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [txId]);

  // ── Action partage (déclenchable depuis icône header OU bouton bas) ──
  const handleShare = useCallback(async () => {
    if (!receipt) return;
    setOverlayMsg('Préparation du partage…');
    try {
      const html = generatePdfHtml(receipt);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le reçu',
      });
    } catch (err: any) {
      console.error('Share PDF Error:', err);
      Toast.show({ type: 'error', text1: 'Partage échoué', text2: err.message || 'Impossible de générer le fichier PDF.' });
    } finally {
      setOverlayMsg(null);
    }
  }, [receipt]);

  // ── Téléchargement PDF ──
  const handleDownload = useCallback(async () => {
    if (!receipt) return;
    setOverlayMsg('Génération du PDF…');
    try {
      const html = generatePdfHtml(receipt);
      const { uri } = await Print.printToFileAsync({ html });
      
      const filename = safeFilename(receipt.receiptNumber);
      const destPath = ((FileSystem as any).documentDirectory ?? '') + filename;
      
      await FileSystem.copyAsync({ from: uri, to: destPath });

      Toast.show({
        type: 'success',
        text1: 'PDF sauvegardé',
        text2: 'Votre reçu est dans vos documents.',
      });

      // Proposer ouverture immédiate
      setOverlayMsg(null);
      await Sharing.shareAsync(destPath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Ouvrir le reçu PDF',
      });
    } catch (err: any) {
      console.error('Download PDF Error:', err);
      Toast.show({ type: 'error', text1: 'Téléchargement échoué', text2: err.message || 'Impossible de générer le PDF. Réessayez.' });
    } finally {
      setOverlayMsg(null);
    }
  }, [receipt]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ════════ HEADER ════════ */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reçu de contribution</Text>
        <TouchableOpacity
          style={[s.headerBtn, isOffline && { opacity: 0.4 }]}
          onPress={handleShare}
          disabled={isOffline || !!overlayMsg}
        >
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ════════ CORPS ════════ */}
      {isLoading ? (
        <View style={s.centerBlock}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadingText}>Chargement du reçu…</Text>
        </View>
      ) : fetchError ? (
        <View style={s.centerBlock}>
          <MaterialCommunityIcons name="file-alert-outline" size={56} color={Colors.outlineVariant} />
          <Text style={s.errorTitle}>Reçu introuvable.</Text>
          <Text style={s.errorSub}>
            Ce reçu n'est pas disponible ou a expiré.
          </Text>
          <TouchableOpacity style={s.errorBtn} onPress={() => navigation.goBack()}>
            <Text style={s.errorBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      ) : receipt ? (
        <>
          {/* Document reçu */}
          <ReceiptDocument
            receiptData={{
              receiptNumber:    receipt.receiptNumber,
              txId:             receipt.txId,
              groupName:        receipt.groupName,
              period:           receipt.period,
              memberName:       receipt.memberName,
              memberPhone:      receipt.memberPhone || '',
              operator:         receipt.operator,
              baseAmount:       receipt.baseAmount ?? receipt.amount,
              penaltyAmount:    receipt.penaltyAmount ?? 0,
              totalAmount:      receipt.totalAmount ?? receipt.amount,
              treasurerName:    receipt.treasurerName || '',
              treasurerAccount: receipt.treasurerAccount || '',
              paidAt:           receipt.paidAt,
            }}
          />

          {/* ════════ BOUTONS STICKY ════════ */}
          <View style={s.actionsBar}>
            {isOffline && (
              <Text style={s.offlineHint}>
                Téléchargement et partage indisponibles hors-ligne
              </Text>
            )}

            {/* Télécharger PDF */}
            <TouchableOpacity
              style={[s.downloadBtn, isOffline && s.btnDisabled]}
              onPress={handleDownload}
              disabled={isOffline || !!overlayMsg}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="download"
                size={18}
                color={isOffline ? Colors.textMuted : '#FFFFFF'}
              />
              <Text style={[s.downloadBtnText, isOffline && s.btnTextDisabled]}>
                Télécharger PDF
              </Text>
            </TouchableOpacity>

            {/* Partager */}
            <TouchableOpacity
              style={[s.shareBtn, isOffline && s.btnDisabled]}
              onPress={handleShare}
              disabled={isOffline || !!overlayMsg}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={18}
                color={isOffline ? Colors.textMuted : Colors.primary}
              />
              <Text style={[s.shareBtnText, isOffline && s.btnTextDisabled]}>
                Partager
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {/* ════════ LOADING OVERLAY PDF ════════ */}
      {overlayMsg && <LoadingOverlay message={overlayMsg} />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceContainerLow },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
    shadowColor: Colors.onSurface, shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface,
  },

  // Chargement / erreur centrés
  centerBlock: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, gap: 12,
  },
  loadingText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  errorTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface, textAlign: 'center' },
  errorSub:   { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  errorBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.outlineVariant,
    marginTop: 4,
  },
  errorBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.onSurfaceVariant },

  // Barre d'actions sticky (bas)
  actionsBar: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant + '50',
    gap: 10,
    ...Shadow.fab,
  },
  offlineHint: {
    fontFamily: Fonts.body, fontSize: 11,
    color: Colors.warning, textAlign: 'center',
  },

  // Bouton Télécharger (plein vert)
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    shadowColor: Colors.primary, shadowOpacity: 0.2,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  downloadBtnText: {
    fontFamily: Fonts.headline, fontSize: 15, color: '#FFFFFF',
  },

  // Bouton Partager (outline vert)
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, gap: 10,
    borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  shareBtnText: {
    fontFamily: Fonts.headline, fontSize: 15, color: Colors.primary,
  },

  // États désactivés
  btnDisabled: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderColor: Colors.outlineVariant, shadowOpacity: 0, elevation: 0,
  },
  btnTextDisabled: { color: Colors.textMuted },

  // Overlay PDF
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 32, alignItems: 'center', gap: 16,
    ...Shadow.fab,
  },
  overlayText: {
    fontFamily: Fonts.title, fontSize: 14, color: Colors.onSurface,
  },
});
