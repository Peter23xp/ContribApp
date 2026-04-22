import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { doc, getDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../../config/firebase';
import { approveContribution, rejectContribution, ContributionSubmission } from '../../services/contributionService';
import { CapturePreviewCard } from '../../components/payment/CapturePreviewCard';
import { ApprovalActionBar } from '../../components/payment/ApprovalActionBar';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

function toMillis(value: any): number {
  if (!value) {
    return 0;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeContribution(raw: any): any {
  return {
    ...raw,
    memberName: raw.member_name ?? raw.memberName ?? 'Membre inconnu',
    memberUid: raw.member_uid ?? raw.memberUid ?? '',
    groupId: raw.group_id ?? raw.groupId ?? '',
    periodMonth: raw.period_month ?? raw.periodMonth ?? '-',
    amountDue: Number(raw.amount_due ?? raw.amountDue ?? raw.amount ?? 0),
    amountPaid: Number(raw.amount_paid ?? raw.amountPaid ?? raw.amount ?? 0),
    captureImageUrl: raw.capture_image_url ?? raw.captureImageUrl ?? '',
    submittedAt: raw.created_at ?? raw.submittedAt ?? raw.updated_at,
    status: raw.status ?? 'pending_approval',
    geminiAnalysis: raw.gemini_analysis ?? raw.geminiAnalysis ?? null,
    memberNote: raw.member_note ?? raw.memberNote ?? '',
  };
}

function normalizeStatus(status?: string | null): 'pending' | 'approved' | 'rejected' | 'needs_review' {
  const normalized = (status ?? '').toString().trim().toLowerCase();

  if (['paid', 'paye', 'approved', 'approuve'].includes(normalized)) {
    return 'approved';
  }

  if (['rejected', 'failed', 'echec', 'rejete'].includes(normalized)) {
    return 'rejected';
  }

  if (['pending_approval', 'pending', 'en_attente', 'submitted'].includes(normalized)) {
    return 'pending';
  }

  return 'needs_review';
}

export function ReviewCaptureScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { contributionId, readOnly = false } = route.params || {};
  const storeUser = useAuthStore((s) => s.user);

  const [contribution, setContribution] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [amountConfirmed, setAmountConfirmed] = useState('');
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('Capture illisible ou floue');
  const [customReason, setCustomReason] = useState('');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    fetchContribution();
  }, [contributionId]);

  const fetchContribution = async () => {
    try {
      const docRef = doc(db, 'contributions', contributionId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = normalizeContribution(snap.data());
        setContribution(data);

        if (!readOnly && normalizeStatus(data.status) === 'pending') {
          const defaultAmount = data.geminiAnalysis?.amount || data.amountDue;
          setAmountConfirmed(String(defaultAmount || ''));
        } else {
          setAmountConfirmed(String(data.amountPaid || data.amountDue || '0'));
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Erreur', 'Impossible de charger les donnees de contribution.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    const approverUid = auth.currentUser?.uid ?? storeUser?.id ?? '';
    const numAmount = parseInt(amountConfirmed, 10);
    if (!auth.currentUser?.uid) {
      Alert.alert('Session requise', "La session Firebase du tresorier n'est pas active. Reconnectez-vous puis reessayez.");
      return;
    }

    if (!numAmount || numAmount <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un montant valide.');
      return;
    }

    Alert.alert(
      'Approuver la contribution ?',
      `Vous confirmez que ${contribution?.memberName} a paye ${numAmount} CDF pour ${contribution?.periodMonth}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setActionLoading(true);
            try {
              await approveContribution({
                contributionId,
                approvedBy: approverUid,
                approvedAt: new Date().toISOString(),
                amountPaid: numAmount,
                amountConfirmed: numAmount,
                status: 'approved',
              });
              Alert.alert('Succes', `Contribution approuvee. ${contribution?.memberName} a ete notifie.`);
              navigation.goBack();
            } catch (error) {
              console.error('[ReviewCapture] approve error:', error);
              const message = error instanceof Error ? error.message : '';
              if (message.includes('permission') || message.includes('Missing or insufficient permissions')) {
                Alert.alert('Permission refusee', "Le compte courant n'a pas les droits Firebase necessaires pour approuver cette contribution.");
              } else {
                Alert.alert('Erreur', "Erreur lors de l'approbation. Consultez le log pour le detail.");
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmReject = async () => {
    const rejectorUid = auth.currentUser?.uid ?? storeUser?.id ?? '';
    const finalReason = rejectReason === 'Autre (preciser)' ? customReason : rejectReason;
    if (!auth.currentUser?.uid) {
      Alert.alert('Session requise', "La session Firebase du tresorier n'est pas active. Reconnectez-vous puis reessayez.");
      return;
    }
    if (rejectReason === 'Autre (preciser)' && !customReason.trim()) {
      Alert.alert('Erreur', 'Veuillez preciser la raison.');
      return;
    }

    setRejectModalVisible(false);
    setActionLoading(true);
    try {
      await rejectContribution(contributionId, finalReason, rejectorUid);
      Alert.alert('Succes', `Contribution rejetee. ${contribution?.memberName} a ete notifie.`);
      navigation.goBack();
    } catch (error) {
      console.error('[ReviewCapture] reject error:', error);
      Alert.alert('Erreur', 'Erreur lors du rejet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInfoRequest = async () => {
    if (!infoMessage.trim()) {
      Alert.alert('Erreur', 'Le message ne peut pas etre vide.');
      return;
    }

    setInfoModalVisible(false);
    setActionLoading(true);
    try {
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        recipient_uid: contribution?.memberUid,
        group_id: contribution?.groupId,
        type: 'info_requested',
        title: 'Information demandee',
        body: `La tresoriere demande : ${infoMessage}`,
        created_at: serverTimestamp(),
        is_read: false,
        related_id: contributionId,
      });
      Alert.alert('Succes', `Message envoye a ${contribution?.memberName}.`);
    } catch (error) {
      Alert.alert('Erreur', "Erreur lors de l'envoi du message.");
    } finally {
      setActionLoading(false);
    }
  };

  const statusVariant = useMemo(() => normalizeStatus(contribution?.status), [contribution?.status]);
  const submittedLabel = useMemo(() => {
    const millis = toMillis(contribution?.submittedAt);
    return millis ? new Date(millis).toLocaleString('fr-FR') : 'Date indisponible';
  }, [contribution?.submittedAt]);

  if (loading) {
    return <LoadingOverlay />;
  }

  if (!contribution) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Contribution introuvable</Text>
      </View>
    );
  }

  const gemini = contribution.geminiAnalysis;
  const confidence = Number(gemini?.confidence ?? 0);
  const confidenceColor = confidence >= 85 ? Colors.statusPaid : confidence >= 60 ? Colors.statusPending : Colors.error;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification de contribution</Text>
        <View
          style={[
            styles.statusBadge,
            statusVariant === 'approved'
              ? styles.statusBadgeApproved
              : statusVariant === 'rejected'
              ? styles.statusBadgeRejected
              : styles.statusBadgePending,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {statusVariant === 'approved' ? 'Approuvee' : statusVariant === 'rejected' ? 'Rejetee' : 'A valider'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, !readOnly && { paddingBottom: 180 }]}>
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Membre</Text>
          <Text style={styles.memberTitle}>{contribution.memberName}</Text>
          <Text style={styles.lightText}>Contribution de {contribution.periodMonth}</Text>
          <Text style={styles.lightText}>Montant attendu : {contribution.amountDue.toLocaleString('fr-FR')} CDF</Text>
          <Text style={styles.lightText}>Soumis le {submittedLabel}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Capture fournie</Text>
            {contribution.captureImageUrl ? (
              <TouchableOpacity onPress={() => setIsZoomVisible(true)} style={styles.zoomButton}>
                <Ionicons name="expand" size={16} color={Colors.primary} />
                <Text style={styles.zoomText}>Plein ecran</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <CapturePreviewCard
            imageUrl={contribution.captureImageUrl || ''}
            geminiResult={null}
            isAnalyzing={false}
            status={statusVariant}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analyse IA</Text>

          <View style={styles.analysisGrid}>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisLabel}>Montant detecte</Text>
              <Text style={styles.analysisValue}>{gemini?.amount != null ? `${gemini.amount} CDF` : '-'}</Text>
            </View>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisLabel}>Confiance</Text>
              <Text style={[styles.analysisValue, { color: confidenceColor }]}>{confidence}%</Text>
            </View>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisLabel}>Operateur</Text>
              <Text style={styles.analysisValue}>{gemini?.operator ? gemini.operator.toUpperCase() : '-'}</Text>
            </View>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisLabel}>Reference</Text>
              <Text style={styles.analysisMono}>{gemini?.transactionRef || '-'}</Text>
            </View>
          </View>

          <Text style={styles.lightText}>Date detectee : {gemini?.detectedDate || '-'}</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.min(Math.max(confidence, 0), 100)}%`, backgroundColor: confidenceColor }]} />
          </View>

          {gemini?.warningFlags?.length ? (
            <View style={styles.flagsContainer}>
              {gemini.warningFlags.map((flag: string) => (
                <View key={flag} style={styles.warningFlag}>
                  <Text style={styles.warningFlagText}>{flag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {contribution.memberNote ? (
          <View style={styles.noteSection}>
            <Ionicons name="chatbubble-outline" size={20} color="#E65100" />
            <Text style={styles.noteText}>{contribution.memberNote}</Text>
          </View>
        ) : null}

        {!readOnly ? (
          <View style={styles.section}>
            <AppInput
              label="Montant a confirmer (CDF)"
              value={amountConfirmed}
              onChangeText={setAmountConfirmed}
              keyboardType="number-pad"
            />
            <Text style={styles.helperText}>Ce montant sera enregistre comme contribution approuvee.</Text>
          </View>
        ) : null}
      </ScrollView>

      {!readOnly ? (
        <ApprovalActionBar
          onApprove={handleApprove}
          onReject={() => setRejectModalVisible(true)}
          onRequestInfo={() => setInfoModalVisible(true)}
          isLoading={actionLoading}
          geminiConfidence={confidence}
        />
      ) : null}

      <Modal visible={isZoomVisible} transparent animationType="fade">
        <View style={styles.zoomModal}>
          <TouchableOpacity onPress={() => setIsZoomVisible(false)} style={[styles.closeZoomButton, { top: Math.max(insets.top, 16) }]}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {contribution.captureImageUrl ? (
            <Image source={{ uri: contribution.captureImageUrl }} style={styles.zoomImage} resizeMode="contain" />
          ) : (
            <View style={styles.zoomEmptyState}>
              <Text style={styles.zoomEmptyText}>Aucune capture disponible pour cet envoi.</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <Text style={styles.modalTitle}>Pourquoi rejeter cette capture ?</Text>
            {['Capture illisible ou floue', 'Montant incorrect', "Ce n'est pas une confirmation de paiement", 'Transaction deja enregistree', 'Autre (preciser)'].map((reason) => (
              <TouchableOpacity key={reason} onPress={() => setRejectReason(reason)} style={styles.reasonRow}>
                <Ionicons name={rejectReason === reason ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.error} />
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}
            {rejectReason === 'Autre (preciser)' ? (
              <AppInput label="Raison du rejet" placeholder="Precisez la raison..." value={customReason} onChangeText={setCustomReason} />
            ) : null}
            <View style={styles.modalButtons}>
              <AppButton title="Annuler" onPress={() => setRejectModalVisible(false)} variant="outline" style={{ flex: 1, marginRight: 8 }} />
              <AppButton title="Confirmer le rejet" onPress={handleConfirmReject} variant="solid" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={infoModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <Text style={styles.modalTitle}>Message pour {contribution.memberName}</Text>
            <AppInput label="Message" placeholder="Votre message..." value={infoMessage} onChangeText={setInfoMessage} multiline />
            <View style={styles.modalButtons}>
              <AppButton title="Annuler" onPress={() => setInfoModalVisible(false)} variant="outline" style={{ flex: 1, marginRight: 8 }} />
              <AppButton title="Envoyer" onPress={handleSendInfoRequest} variant="solid" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  notFoundText: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    marginHorizontal: 8,
  },
  statusBadge: {
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  statusBadgePending: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeApproved: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusBadgeText: {
    fontFamily: Fonts.headline,
    fontSize: 11,
    color: Colors.onSurface,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.label,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  memberTitle: {
    fontSize: 22,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  lightText: {
    color: Colors.textSecondary,
    marginTop: 6,
    fontFamily: Fonts.body,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  zoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  zoomText: {
    color: Colors.primary,
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
  analysisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  analysisCard: {
    width: '47%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
  },
  analysisLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  analysisValue: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
  },
  analysisMono: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.onSurface,
  },
  progressBg: {
    height: 8,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  warningFlag: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  warningFlagText: {
    color: '#E65100',
    fontSize: 12,
    fontFamily: Fonts.headline,
  },
  noteSection: {
    flexDirection: 'row',
    backgroundColor: '#FFF9C4',
    padding: 14,
    borderRadius: Radius.xl,
    marginBottom: 16,
    alignItems: 'center',
  },
  noteText: {
    marginLeft: 8,
    flex: 1,
    color: '#7A5C00',
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    fontFamily: Fonts.body,
  },
  zoomModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  closeZoomButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '100%',
  },
  zoomEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  zoomEmptyText: {
    color: '#FFFFFF',
    fontFamily: Fonts.headline,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  reasonText: {
    marginLeft: 8,
    fontFamily: Fonts.body,
    color: Colors.onSurface,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
});
