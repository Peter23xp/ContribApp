/**
 * SCR-015 — Invitations
 * InviteMembersScreen.tsx
 *
 * Rôle : Admin uniquement
 * Navigation : depuis SCR-014 via le FAB "+"
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, FlatList, ActivityIndicator,
  Clipboard, Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { AppInput }  from '../../components/common/AppInput';
import {
  fetchInviteCode, regenerateInviteCode,
  sendSmsInvite, fetchPendingInvitations,
  type InviteCode, type PendingInvitation,
} from '../../services/groupService';
import { useAuthStore } from '../../stores/authStore';
import * as db from '../../services/database';

// ─── Helpers ─────────────────────────────────────────────────

function formatPhone(phone: string): string {
  return phone.length > 6
    ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
    : phone;
}
function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60));
  if (diff < 60) return `il y a ${diff} min`;
  if (diff < 1440) return `il y a ${Math.round(diff / 60)} h`;
  return `il y a ${Math.round(diff / 1440)} j`;
}

// ─── Sub-composant : ligne invitation ──────────────────────────

function InviteRow({ inv }: { inv: PendingInvitation }) {
  return (
    <View style={s.inviteRow}>
      <View style={s.inviteAvatar}>
        <MaterialCommunityIcons name="phone-outline" size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.invitePhone}>{formatPhone(inv.phone)}</Text>
        <Text style={s.inviteTime}>Envoyé {timeAgo(inv.sentAt)}</Text>
      </View>
      <View style={s.pendingChip}>
        <Text style={s.pendingChipText}>En attente</Text>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────

export default function InviteMembersScreen({ navigation }: any) {
  const user  = useAuthStore(s => s.user);
  const group = db.getGroupForAdmin(user?.id ?? '');

  const [inviteCode,   setInviteCode]   = useState<InviteCode | null>(null);
  const [pending,      setPending]      = useState<PendingInvitation[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [smsPhone,     setSmsPhone]     = useState('');
  const [smsPhoneErr,  setSmsPhoneErr]  = useState('');
  const [sendingSms,   setSendingSms]   = useState(false);
  const [savingQr,     setSavingQr]     = useState(false);
  const qrRef = React.useRef<any>(null);

  // ── Chargement initial ──
  const loadData = useCallback(async () => {
    if (!group?.id) { setIsLoading(false); return; }
    try {
      const [code, invitations] = await Promise.all([
        fetchInviteCode(group.id),
        fetchPendingInvitations(group.id),
      ]);
      setInviteCode(code);
      setPending(invitations);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger le code.' });
    } finally {
      setIsLoading(false);
    }
  }, [group?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Copier le code ──
  const handleCopy = () => {
    if (!inviteCode) return;
    Clipboard.setString(inviteCode.code);
    Toast.show({ type: 'success', text1: 'Copié !', text2: `Code "${inviteCode.code}" copié dans le presse-papiers.` });
  };

  // ── Régénérer le code ──
  const handleRegenerate = () => {
    Alert.alert(
      'Régénérer le code',
      'L\'ancien code sera invalidé immédiatement. Les membres qui l\'ont reçu devront utiliser le nouveau code.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Régénérer', style: 'destructive',
          onPress: async () => {
            if (!group?.id) return;
            setRegenerating(true);
            try {
              const newCode = await regenerateInviteCode(group.id);
              setInviteCode(newCode);
              Toast.show({ type: 'success', text1: 'Code régénéré', text2: 'L\'ancien code est invalide.' });
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur', text2: 'Régénération échouée.' });
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
    );
  };

  // ── Télécharger le QR ──
  const handleSaveQr = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission refusée', text2: 'Autorisez l\'accès à la galerie.' });
      return;
    }
    setSavingQr(true);
    try {
      // Capturer le SVG en base64 via la ref du QRCode
      if (qrRef.current?.toDataURL) {
        qrRef.current.toDataURL(async (data: string) => {
          const filePath = (FileSystem as any).cacheDirectory + 'qr_invite.png';
          await FileSystem.writeAsStringAsync(filePath, data, {
            encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64',
          });
          await MediaLibrary.saveToLibraryAsync(filePath);
          Toast.show({ type: 'success', text1: 'QR Code sauvegardé', text2: 'Enregistré dans votre galerie.' });
          setSavingQr(false);
        });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de sauvegarder l\'image.' });
      setSavingQr(false);
    }
  };

  // ── Envoyer invitation SMS ──
  const handleSendSms = async () => {
    const phone = smsPhone.trim();
    if (!phone || phone.length < 10) {
      setSmsPhoneErr('Numéro invalide (format : +243...)');
      return;
    }
    if (!group?.id) return;
    setSendingSms(true);
    setSmsPhoneErr('');
    try {
      await sendSmsInvite(group.id, phone);
      setSmsPhone('');
      // Recharger la liste des invitations en attente
      const invitations = await fetchPendingInvitations(group.id);
      setPending(invitations);
      Toast.show({ type: 'success', text1: 'Invitation envoyée', text2: `SMS envoyé à ${phone}` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'L\'invitation n\'a pas pu être envoyée.' });
    } finally {
      setSendingSms(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────

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

      {isLoading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ════ SECTION 1 : Code d'invitation ════ */}
          <Text style={s.sectionTitle}>Code d'invitation</Text>
          <View style={s.codeCard}>
            <Text style={s.codeText}>{inviteCode?.code ?? '——————'}</Text>

            <View style={s.codeBtns}>
              <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
                <MaterialCommunityIcons name="content-copy" size={16} color={Colors.primary} />
                <Text style={s.copyBtnText}>Copier le code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.regenBtn}
                onPress={handleRegenerate}
                disabled={regenerating}
                activeOpacity={0.8}
              >
                {regenerating ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="refresh" size={16} color={Colors.error} />
                    <Text style={s.regenBtnText}>Régénérer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.infoBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={13} color={Colors.warning} />
              <Text style={s.infoText}>Régénérer invalide l'ancien code immédiatement.</Text>
            </View>
          </View>

          {/* ════ SECTION 2 : QR Code ════ */}
          <Text style={s.sectionTitle}>QR Code</Text>
          <View style={s.qrCard}>
            {inviteCode ? (
              <QRCode
                value={inviteCode.link ?? inviteCode.code}
                size={180}
                color={Colors.primary}
                backgroundColor="#FFFFFF"
                getRef={(ref: any) => { qrRef.current = ref; }}
              />
            ) : (
              <View style={s.qrPlaceholder}>
                <MaterialCommunityIcons name="qrcode" size={80} color={Colors.outlineVariant} />
              </View>
            )}
            <TouchableOpacity
              style={[s.qrDownloadBtn, savingQr && { opacity: 0.6 }]}
              onPress={handleSaveQr}
              disabled={savingQr || !inviteCode}
              activeOpacity={0.82}
            >
              {savingQr ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialCommunityIcons name="download" size={16} color={Colors.primary} />
              )}
              <Text style={s.qrDownloadBtnText}>
                {savingQr ? 'Sauvegarde…' : 'Télécharger l\'image'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ════ SECTION 3 : Inviter par SMS ════ */}
          <Text style={s.sectionTitle}>Inviter par téléphone</Text>
          <View style={s.smsCard}>
            <AppInput
              label="Numéro de téléphone"
              value={smsPhone}
              onChangeText={v => { setSmsPhone(v); setSmsPhoneErr(''); }}
              placeholder="+243 9X XXX XXXX"
              keyboardType="phone-pad"
              error={smsPhoneErr}
            />
            <TouchableOpacity
              style={[s.smsBtn, sendingSms && s.smsBtnDisabled]}
              onPress={handleSendSms}
              disabled={sendingSms}
              activeOpacity={0.85}
            >
              {sendingSms ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="message-text-outline" size={18} color="#FFF" />
                  <Text style={s.smsBtnText}>Envoyer invitation SMS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ════ SECTION 4 : Liste d'attente ════ */}
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Invitations en attente</Text>
            <Text style={s.pendingCount}>{pending.length}</Text>
          </View>

          {pending.length === 0 ? (
            <View style={s.pendingEmpty}>
              <MaterialCommunityIcons name="email-check-outline" size={36} color={Colors.outlineVariant} />
              <Text style={s.pendingEmptyText}>Aucune invitation en attente</Text>
            </View>
          ) : (
            <View style={s.pendingList}>
              {pending.map(inv => <InviteRow key={inv.id} inv={inv} />)}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '40',
    shadowColor: Colors.onSurface, shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.onSurface, flex: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  sectionTitle: {
    fontFamily: Fonts.headline, fontSize: 15, color: Colors.primary,
    marginBottom: 12, marginTop: 4,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pendingCount: {
    fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurfaceVariant,
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full,
  },

  // Code card
  codeCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 20, marginBottom: 24,
    alignItems: 'center', gap: 16, ...Shadow.card,
  },
  codeText: {
    fontFamily: 'Courier', fontSize: 32,
    color: Colors.primary, letterSpacing: 6, fontWeight: '700',
  },
  codeBtns: { flexDirection: 'row', gap: 12 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  copyBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.error + '60',
  },
  regenBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.error },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 8, width: '100%',
  },
  infoText: { flex: 1, fontFamily: Fonts.body, fontSize: 11, color: Colors.warning, lineHeight: 15 },

  // QR card
  qrCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 24, marginBottom: 24,
    alignItems: 'center', gap: 20, ...Shadow.card,
  },
  qrPlaceholder: {
    width: 180, height: 180, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg,
  },
  qrDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  qrDownloadBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },

  // SMS card
  smsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 16, marginBottom: 24,
    ...Shadow.card,
  },
  smsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: Radius.lg, backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOpacity: 0.2,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  smsBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh, shadowOpacity: 0, elevation: 0 },
  smsBtnText: { fontFamily: Fonts.headline, fontSize: 14, color: '#FFF' },

  // Pending invitations
  pendingEmpty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  pendingEmptyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  pendingList: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.card, marginBottom: 8,
  },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '40',
  },
  inviteAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  invitePhone: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  inviteTime:  { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  pendingChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, backgroundColor: Colors.warning + '20',
  },
  pendingChipText: { fontFamily: Fonts.label, fontSize: 10, fontWeight: '700', color: Colors.warning },
});
