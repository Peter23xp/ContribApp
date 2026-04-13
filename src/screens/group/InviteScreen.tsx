/**
 * SCR-015 — Inviter des Membres
 * InviteScreen.tsx
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, FlatList, ActivityIndicator,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import { InvitationRow, type InvitationData } from '../../components/common/InvitationRow';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import {
  fetchInviteCode, regenerateInviteCode,
  sendSmsInvite, fetchPendingInvitations, cancelInvitation,
  type InviteCode, type PendingInvitation,
} from '../../services/groupService';

export default function InviteScreen({ navigation }: any) {
  const groupId = "todo-use-actual-id"; // Assuming route.params.groupId or store
  
  const [inviteData, setInviteData] = useState<InviteCode | null>(null);
  const [pending, setPending] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [smsPhone, setSmsPhone] = useState('');
  const [smsOperator, setSmsOperator] = useState<'airtel' | 'orange' | 'mpesa' | 'mtn' | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsPhoneErr, setSmsPhoneErr] = useState('');

  const [confirmData, setConfirmData] = useState<{message: string; action: () => void; destructive?: boolean} | null>(null);

  const qrRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [code, invitations] = await Promise.all([
        fetchInviteCode(groupId),
        fetchPendingInvitations(groupId),
      ]);
      setInviteData(code);
      setPending(invitations);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger les données.' });
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions Code ──
  const handleCopy = async () => {
    if (!inviteData) return;
    await Clipboard.setStringAsync(inviteData.code);
    Toast.show({ type: 'success', text1: 'Code copié !' });
  };

  const handleShareLink = async () => {
    if (!inviteData) return;
    try {
      await Share.share({
        message: `Rejoins notre groupe sur ContribApp avec le code ${inviteData.code} : ${inviteData.link}`
      });
    } catch (e) {}
  };

  const handleRegenerate = () => {
    setConfirmData({
      message: "Régénérer le code ? L'ancien code sera invalide et les invitations en attente seront annulées.",
      destructive: true,
      action: async () => {
        try {
          const newCode = await regenerateInviteCode(groupId);
          setInviteData(newCode);
          Toast.show({ type: 'success', text1: 'Nouveau code généré', text2: 'L\'ancien code est invalide.' });
        } catch {
          Toast.show({ type: 'error', text1: 'Erreur', text2: 'Régénération échouée.' });
        }
      }
    });
  };

  // ── Actions QR ──
  const getQrBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (qrRef.current?.toDataURL) {
        qrRef.current.toDataURL((data: string) => resolve(data));
      } else {
        reject(new Error("QR ref missing"));
      }
    });
  };

  const handleSaveQr = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission requise', text2: 'Activez-la dans les réglages.' });
      return;
    }
    try {
      const data = await getQrBase64();
      const filePath = FileSystem.cacheDirectory + 'qr_invite.png';
      await FileSystem.writeAsStringAsync(filePath, data, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(filePath);
      Toast.show({ type: 'success', text1: 'QR Code sauvegardé dans votre galerie' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de sauvegarder l\'image.' });
    }
  };

  const handleShareQr = async () => {
    try {
      const data = await getQrBase64();
      const filePath = FileSystem.cacheDirectory + 'qr_invite_share.png';
      await FileSystem.writeAsStringAsync(filePath, data, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(filePath, { dialogTitle: 'Voici le QR code pour rejoindre notre groupe ContribApp' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de partager l\'image.' });
    }
  };

  // ── Actions SMS ──
  const handleSendSms = async () => {
    const phone = smsPhone.trim();
    if (!phone || phone.length < 10) {
      setSmsPhoneErr('Numéro invalide (format : +243...)');
      return;
    }
    setSendingSms(true);
    setSmsPhoneErr('');
    try {
      await sendSmsInvite(groupId, phone);
      setSmsPhone('');
      const invitations = await fetchPendingInvitations(groupId);
      setPending(invitations);
      Toast.show({ type: 'success', text1: `Invitation envoyée à ${phone}` });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        Toast.show({ type: 'error', text1: 'Ce numéro est déjà membre du groupe.' });
      } else if (status === 429) {
        Toast.show({ type: 'error', text1: 'Limite d\'invitations atteinte. Réessayez plus tard.' });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur', text2: 'L\'invitation n\'a pas pu être envoyée.' });
      }
    } finally {
      setSendingSms(false);
    }
  };

  // ── Actions Liste ──
  const requestCancelInvitation = (inv: InvitationData) => {
    setConfirmData({
      message: `Annuler l'invitation envoyée à ${inv.phone} ?`,
      action: async () => {
        const previous = [...pending];
        setPending(prev => prev.filter(i => i.id !== inv.id));
        try {
          await cancelInvitation(groupId, inv.id);
        } catch {
          setPending(previous);
          Toast.show({ type: 'error', text1: 'Impossible d\'annuler l\'invitation.' });
        }
      }
    });
  };

  if (isLoading) {
    return (
      <View style={s.loadingCenter}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ════ HEADER ════ */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Inviter des membres</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        
        {/* ════ SECTION 1 : Code ════ */}
        <Text style={s.sectionTitle}>Code d'invitation</Text>
        <View style={s.codeCard}>
          <View style={s.codeRow}>
            <Text style={s.codeText}>{inviteData?.code ?? '——————'}</Text>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
              <MaterialCommunityIcons name="content-copy" size={20} color={Colors.primary} />
              <Text style={s.copyTxt}>Copier</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.shareBtn} onPress={handleShareLink} activeOpacity={0.8}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color={Colors.primary} />
            <Text style={s.shareBtnText}>Partager le lien</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.regenBtn} onPress={handleRegenerate} activeOpacity={0.8}>
            <Text style={s.regenBtnText}>Régénérer le code</Text>
          </TouchableOpacity>
        </View>

        {/* ════ SECTION 2 : QR Code ════ */}
        <Text style={s.sectionTitle}>QR Code du groupe</Text>
        <View style={s.qrCard}>
          {inviteData ? (
            <QRCode
              value={inviteData.link ?? inviteData.code}
              size={200}
              color={Colors.primary}
              backgroundColor="#FFFFFF"
              getRef={(ref: any) => { qrRef.current = ref; }}
            />
          ) : (
            <View style={s.qrPlaceholder} />
          )}
          <Text style={s.qrHint}>Scannez pour rejoindre le groupe</Text>

          <View style={s.qrActions}>
            <AppButton title="Télécharger le QR Code" onPress={handleSaveQr} />
            <TouchableOpacity style={s.qrShareBtn} onPress={handleShareQr} activeOpacity={0.8}>
              <MaterialCommunityIcons name="share-variant-outline" size={18} color={Colors.primary} />
              <Text style={s.qrShareBtnText}>Partager le QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ════ SECTION 3 : SMS ════ */}
        <Text style={s.sectionTitle}>Inviter par SMS</Text>
        <View style={s.smsCard}>
          <AppInput
            label="Numéro de téléphone"
            value={smsPhone}
            onChangeText={(v) => { setSmsPhone(v); setSmsPhoneErr(''); }}
            placeholder="+243 9X XXX XXXX"
            keyboardType="phone-pad"
            error={smsPhoneErr}
            disabled={sendingSms}
          />
          <AppButton 
            title="Envoyer l'invitation SMS" 
            onPress={handleSendSms} 
            loading={sendingSms}
            disabled={sendingSms || smsPhone.trim().length === 0}
          />
        </View>

        {/* ════ SECTION 4 : En attente ════ */}
        <Text style={s.sectionTitle}>Invitations en attente ({pending.length})</Text>
        <View style={s.listCard}>
          {pending.length === 0 ? (
            <Text style={s.emptyHint}>Aucune invitation en attente.</Text>
          ) : (
            pending.map(inv => (
              <InvitationRow 
                key={inv.id} 
                invitation={inv as any} 
                onCancelPress={(i) => requestCancelInvitation(i as any)} 
              />
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ConfirmModal global */}
      <ConfirmModal
        visible={!!confirmData}
        message={confirmData?.message || ''}
        isDestructive={confirmData?.destructive}
        onConfirm={() => {
          confirmData?.action();
          setConfirmData(null);
        }}
        onCancel={() => setConfirmData(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '40',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceContainerHigh,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.onSurface, flex: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.primary, marginLeft: 4, marginBottom: 8, marginTop: 16 },

  codeCard: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.xl, padding: 20, marginBottom: 12,
    alignItems: 'center',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  codeText: { fontFamily: 'Courier', fontSize: 32, fontWeight: '700', letterSpacing: 4, color: Colors.onSurface },
  copyBtn: { alignItems: 'center', gap: 2, padding: 6 },
  copyTxt: { fontFamily: Fonts.label, fontSize: 10, color: Colors.primary, fontWeight: '700' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary, width: '100%', justifyContent: 'center'
  },
  shareBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.primary },
  regenBtn: { marginTop: 16, padding: 8 },
  regenBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.error },

  qrCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 24, marginBottom: 12,
    alignItems: 'center', ...Shadow.card,
  },
  qrPlaceholder: { width: 200, height: 200, backgroundColor: Colors.surfaceContainerHigh, borderRadius: 10 },
  qrHint: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginVertical: 16 },
  qrActions: { width: '100%', gap: 12 },
  qrShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.outlineVariant
  },
  qrShareBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.primary },

  smsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadow.card,
  },

  listCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.card,
  },
  emptyHint: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center', padding: 24 },
});
