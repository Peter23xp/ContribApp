import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking, Image, Platform
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
// Needs expo-media-library and expo-sharing for saving but avoiding complex setup if not installed
// import * as MediaLibrary from 'expo-media-library';
// import * as Sharing from 'expo-sharing';
// import * as FileSystem from 'expo-file-system';

import { Colors, Fonts, Radius } from '../../constants/colors';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { ToastNotification } from '../../components/common/ToastNotification';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';

import { useAuthStore } from '../../stores/authStore';
import { getGroup, regenerateInviteCode, sendSmsInvite, fetchPendingInvitations, cancelInvitation } from '../../services/groupService';

export default function InviteHubScreen({ navigation, route }: any) {
  const { inviteCode: paramsInviteCode, groupId: paramsGroupId } = route.params || {};
  const { user, groupId: storeGroupId } = useAuthStore();
  const actGroupId = paramsGroupId || storeGroupId;

  const [isLoading, setIsLoading] = useState(!paramsInviteCode);
  const [inviteCode, setInviteCode] = useState(paramsInviteCode || '');
  const [groupName, setGroupName] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  
  const [phoneToInvite, setPhoneToInvite] = useState('');
  const [invitedList, setInvitedList] = useState<any[]>([]);

  const [toastMessage, setToastMessage] = useState<{message: string, type: 'success' | 'error' | 'warning'} | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!actGroupId) return;

    const loadData = async () => {
      try {
        const group = await getGroup(actGroupId);
        if (group) {
          if (!inviteCode) setInviteCode(group.invite_code);
          setGroupName(group.name);
          setMemberCount(group.member_count || 1);
        }
        
        const pending = await fetchPendingInvitations(actGroupId);
        setInvitedList(pending);
      } catch (err) {
        showToast("Erreur de chargement", "error");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [actGroupId]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    showToast("Copié !", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Invitation — ${groupName}`,
        message: `Rejoins notre groupe de contribution "${groupName}" sur ContribApp RDC !\n\nCode : ${inviteCode}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleWhatsApp = async () => {
    const message = encodeURIComponent(`Rejoins notre groupe "${groupName}" sur ContribApp ! Code : ${inviteCode}`);
    try {
      await Linking.openURL(`whatsapp://send?text=${message}`);
    } catch (e) {
      showToast("WhatsApp non installé", "warning");
    }
  };

  const handleRegenerate = async () => {
    // In actual code, use ConfirmModal
    try {
      setIsLoading(true);
      const res = await regenerateInviteCode(actGroupId, user?.id);
      setInviteCode(res.code);
      showToast("Nouveau code généré", "warning");
    } catch (err) {
      showToast("Erreur lors de la génération", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phoneToInvite) return;
    try {
      setIsLoading(true);
      await sendSmsInvite(actGroupId, phoneToInvite);
      showToast(`Invitation envoyée au ${phoneToInvite}`, "success");
      setPhoneToInvite('');
      const pending = await fetchPendingInvitations(actGroupId);
      setInvitedList(pending);
    } catch (err) {
      showToast("Erreur lors de l'envoi", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      await cancelInvitation(actGroupId, invitationId);
      showToast("Invitation annulée", "success");
      setInvitedList(prev => prev.filter(i => i.id !== invitationId));
    } catch (err) {
      showToast("Erreur lors de l'annulation", "error");
    }
  };

  const handleFinish = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      })
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Top App Bar (référence AdminDashboard) ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <View>
            <Text style={styles.topBarTitle}>Inviter des membres</Text>
            <Text style={styles.headerSubtitle}>{memberCount} membres dans le groupe</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        
        {/* Section 1: Code & Lien */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Code d'invitation</Text>
            <View style={styles.badgeActive}><Text style={styles.badgeActiveText}>Actif</Text></View>
          </View>
          
          <Text style={styles.codeText}>{inviteCode || '...'}</Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={24} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Copier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Partager</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleWhatsApp}>
              <FontAwesome name="whatsapp" size={24} color="#25D366" />
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          <TouchableOpacity onPress={handleRegenerate}>
            <Text style={styles.regenerateText}>Régénérer le code</Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: QR Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QR Code</Text>
          <View style={styles.qrContainer}>
            {inviteCode ? (
              <QRCode
                value={`contributapp://join?code=${inviteCode}&group=${actGroupId}`}
                size={180}
              />
            ) : (
              <View style={{ width: 180, height: 180, backgroundColor: '#EEE' }} />
            )}
          </View>
          <Text style={styles.qrNote}>Faites scanner ce code pour rejoindre directement le groupe</Text>
          {/* Omitted save/share QR code for brevity as they require native libs setup */}
        </View>

        {/* Section 3: Inviter par SMS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inviter directement par SMS</Text>
          <Text style={styles.sectionSubtitle}>Un SMS avec le code d'invitation sera envoyé automatiquement</Text>

          <View style={{ marginTop: 12 }}>
            <AppInput
              label="Numéro de téléphone"
              placeholder="+243..."
              value={phoneToInvite}
              onChangeText={setPhoneToInvite}
              keyboardType="phone-pad"
            />
            <AppButton 
              title="Envoyer l'invitation" 
              onPress={handleSendSMS} 
              style={{ marginTop: 12 }} 
            />
          </View>
        </View>

        {/* Section 4: Invitations envoyées */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitations envoyées ({invitedList.length})</Text>
          
          {invitedList.length === 0 ? (
            <Text style={styles.emptyText}>Aucune invitation envoyée pour l'instant.</Text>
          ) : (
            invitedList.map((inv) => (
              <View key={inv.id} style={styles.inviteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invitePhone}>{inv.phone}</Text>
                  <Text style={styles.inviteTime}>Il y a quelques instants</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.statusText, { color: '#E65100' }]}>En attente</Text>
                </View>
                <TouchableOpacity onPress={() => handleCancelInvite(inv.id)} style={{ marginLeft: 12 }}>
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        <AppButton 
          title="Aller au tableau de bord →" 
          onPress={handleFinish} 
        />
        <Text style={styles.footerText}>Vous pouvez inviter plus de membres à tout moment depuis le menu Groupe</Text>
      </View>

      {isLoading && <LoadingOverlay message="Chargement..." />}
      {toastMessage && <View style={styles.toastWrap}><ToastNotification message={toastMessage.message} type={toastMessage.type as any} onHide={() => setToastMessage(null)} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  // ── Top App Bar (référence AdminDashboard) ──
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 12,
    shadowColor: Colors.onSurface, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.onSurface },
  topBarBtn: { padding: 8, borderRadius: Radius.full },

  headerSubtitle: { fontFamily: Fonts.body, fontSize: 11, color: Colors.onSurfaceVariant, marginTop: -2 },
  scroll: { flex: 1, padding: 16 },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: '#666', marginTop: -4 },
  badgeActive: { backgroundColor: '#E8F8EF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeActiveText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold' },
  codeText: { fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4, textAlign: 'center', marginVertical: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  actionBtn: { alignItems: 'center' },
  actionBtnText: { fontSize: 12, marginTop: 4, color: '#444' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 16 },
  regenerateText: { color: Colors.error, fontSize: 14, textAlign: 'center' },
  qrContainer: { alignItems: 'center', marginVertical: 20 },
  qrNote: { fontSize: 13, color: '#666', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 12 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  invitePhone: { fontSize: 14, fontWeight: 'bold' },
  inviteTime: { fontSize: 12, color: '#999', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  footer: { backgroundColor: '#FFF', padding: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  footerText: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 12 },
  toastWrap: { position: 'absolute', top: 110, left: 20, right: 20 },
});
