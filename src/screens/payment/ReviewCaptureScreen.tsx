import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { doc, getDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { approveContribution, rejectContribution, ContributionSubmission } from '../../services/contributionService';
import { CapturePreviewCard } from '../../components/payment/CapturePreviewCard';
import { ApprovalActionBar } from '../../components/payment/ApprovalActionBar';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { Ionicons } from '@expo/vector-icons';

export function ReviewCaptureScreen({ route, navigation }: any) {
  const { contributionId, readOnly = false } = route.params || {};

  const [contribution, setContribution] = useState<ContributionSubmission | null>(null);
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
        const data = snap.data() as ContributionSubmission;
        setContribution(data);
        
        // Setup default amount confirmed based on Gemini analysis or amount due
        if (!readOnly && data.status === 'pending_approval') {
          const defaultAmount = data.geminiAnalysis?.amount || data.amountDue;
          setAmountConfirmed(defaultAmount.toString());
        } else {
          setAmountConfirmed((data as any).amount_paid?.toString() || data.amountDue?.toString() || '0');
        }
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Erreur", "Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    const numAmount = parseInt(amountConfirmed, 10);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Erreur", "Veuillez saisir un montant valid.");
      return;
    }

    Alert.alert(
      "Approuver la contribution ?",
      `Vous confirmez que ${contribution?.memberName} a payé ${numAmount} CDF pour ${contribution?.periodMonth}. Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Confirmer", 
          onPress: async () => {
            setActionLoading(true);
            try {
              await approveContribution({
                contributionId,
                approvedBy: 'currentUserUid', // Mock
                approvedAt: new Date().toISOString(),
                amountPaid: numAmount,
                amountConfirmed: numAmount,
                status: 'approved'
              });
              Alert.alert("Succès", `Contribution approuvée ! ${contribution?.memberName} a été notifié.`);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Erreur", "Erreur lors de l'approbation.");
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleConfirmReject = async () => {
    const finalReason = rejectReason === 'Autre (préciser)' ? customReason : rejectReason;
    if (rejectReason === 'Autre (préciser)' && !customReason.trim()) {
      Alert.alert("Erreur", "Veuillez préciser la raison.");
      return;
    }

    setRejectModalVisible(false);
    setActionLoading(true);
    try {
      await rejectContribution(contributionId, finalReason, 'currentUserUid');
      Alert.alert("Succès", `Contribution rejetée. ${contribution?.memberName} a été notifié.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erreur", "Erreur lors du rejet.");
      setActionLoading(false);
    }
  };

  const handleSendInfoRequest = async () => {
    if (!infoMessage.trim()) return Alert.alert("Erreur", "Le message ne peut pas être vide.");

    setInfoModalVisible(false);
    setActionLoading(true);
    try {
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        userId: contribution?.memberUid,
        groupId: contribution?.groupId,
        type: 'info_requested',
        title: 'Information demandée',
        body: `La trésorière demande : ${infoMessage}`,
        createdAt: serverTimestamp(),
        read: false,
        relatedId: contributionId
      });
      Alert.alert("Succès", `Message envoyé à ${contribution?.memberName}`);
    } catch (e) {
      Alert.alert("Erreur", "Erreur lors de l'envoi du message.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingOverlay />;
  if (!contribution) return <View style={styles.container}><Text>Introuvable</Text></View>;

  const gemini = contribution.geminiAnalysis;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#000" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Vérification de contribution</Text>
        {!readOnly ? (
          <View style={styles.badgeOrange}><Text style={styles.badgeText}>À valider</Text></View>
        ) : (
          <View style={[styles.badgeOrange, { backgroundColor: contribution.status === 'rejected' ? '#F44336' : '#4CAF50' }]}>
            <Text style={styles.badgeText}>{contribution.status === 'rejected' ? "Rejetée" : "Approuvée"}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION MEMBRE */}
        <View style={styles.section}>
          <Text style={styles.memberTitle}>{contribution.memberName}</Text>
          <Text style={styles.lightText}>Contribution de {contribution.periodMonth}</Text>
          <Text style={styles.lightText}>Montant dû : {contribution.amountDue} CDF</Text>
          <Text style={styles.lightText}>Soumis le {new Date(contribution.submittedAt?.seconds * 1000 || contribution.submittedAt).toLocaleString()}</Text>
        </View>

        {/* SECTION CAPTURE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capture fournie</Text>
          <CapturePreviewCard 
            imageUrl={contribution.captureImageUrl || ''}
            geminiResult={null}
            isAnalyzing={false}
            status="pending"
          />
          <TouchableOpacity onPress={() => setIsZoomVisible(true)} style={styles.zoomButton}>
            <Ionicons name="expand" size={16} color="#666" />
            <Text style={styles.zoomText}>Voir en plein écran</Text>
          </TouchableOpacity>
        </View>

        {/* Modal simple plein écran */}
        <Modal visible={isZoomVisible} transparent={true} animationType="fade">
          <View style={styles.zoomModal}>
            <TouchableOpacity onPress={() => setIsZoomVisible(false)} style={styles.closeZoomBotton}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: contribution.captureImageUrl || '' }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        </Modal>

        {/* SECTION ANALYSE GEMINI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="sparkles" size={16} color="#9C27B0" /> Analyse par l'IA</Text>
          <View style={styles.tableBlock}>
            <View style={styles.tableRow}><Text style={styles.tableCellHead}>Champ</Text><Text style={styles.tableCellHead}>Détecté</Text><Text style={styles.tableCellHead}>Attendu</Text></View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Montant</Text>
              <Text style={styles.tableCell}>{gemini?.amount || '-'} CDF</Text>
              <Text style={styles.tableCell}>{contribution.amountDue} CDF</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Opérateur</Text>
              <Text style={styles.tableCell}>{gemini?.operator || '-'}</Text>
              <Text style={styles.tableCell}>-</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Référence</Text>
              <Text style={styles.tableCell}>{gemini?.transactionRef || '-'}</Text>
              <Text style={styles.tableCell}>-</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Date</Text>
              <Text style={styles.tableCell}>{gemini?.detectedDate || '-'}</Text>
              <Text style={styles.tableCell}>-</Text>
            </View>
          </View>
          
          {gemini?.warningFlags && gemini.warningFlags.length > 0 && (
            <View style={styles.flagsContainer}>
              {gemini.warningFlags.map((f: string) => (
                <View key={f} style={styles.warningFlag}><Text style={styles.warningFlagText}>⚠ {f}</Text></View>
              ))}
            </View>
          )}

          <View style={{ marginTop: 12 }}>
             <Text style={styles.lightText}>Confiance IA : {gemini?.confidence || 0}%</Text>
             <View style={styles.progressBg}>
               <View style={[styles.progressFill, { width: `${gemini?.confidence || 0}%`, backgroundColor: (gemini?.confidence || 0) >= 85 ? '#4CAF50' : (gemini?.confidence || 0) >= 60 ? '#FF9800' : '#F44336' }]} />
             </View>
          </View>
        </View>

        {/* MESSAGE MEMBRE */}
        {(contribution as any).member_note && (
          <View style={styles.noteSection}>
            <Ionicons name="chatbubble-outline" size={20} color="#E65100" />
            <Text style={styles.noteText}>{(contribution as any).member_note}</Text>
          </View>
        )}

        {/* SECTION MONTANT */}
        {!readOnly && (
          <View style={styles.section}>
            <AppInput 
              label="Montant à confirmer (CDF)"
              value={amountConfirmed}
              onChangeText={setAmountConfirmed}
              keyboardType="number-pad"
            />
            <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Ce montant sera enregistré comme contribution approuvée</Text>
          </View>
        )}

      </ScrollView>

      {/* ActionBar if not readOnly */}
      {!readOnly && (
        <ApprovalActionBar 
          onApprove={handleApprove}
          onReject={() => setRejectModalVisible(true)}
          onRequestInfo={() => setInfoModalVisible(true)}
          isLoading={actionLoading}
          geminiConfidence={gemini?.confidence || 0}
        />
      )}

      {/* REJECT MODAL */}
      <Modal visible={rejectModalVisible} transparent={true} animationType="slide">
         <View style={styles.modalBg}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Pourquoi rejetez-vous cette capture ?</Text>
             {['Capture illisible ou floue', 'Montant incorrect', "Ce n'est pas une confirmation de paiement", "Transaction déjà enregistrée", 'Autre (préciser)'].map(reason => (
               <TouchableOpacity key={reason} onPress={() => setRejectReason(reason)} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                 <Ionicons name={rejectReason === reason ? 'radio-button-on' : 'radio-button-off'} size={20} color="#F44336" />
                 <Text style={{ marginLeft: 8 }}>{reason}</Text>
               </TouchableOpacity>
             ))}
             {rejectReason === 'Autre (préciser)' && (
               <AppInput label="Raison du rejet" placeholder="Précisez la raison..." value={customReason} onChangeText={setCustomReason} />
             )}
             <View style={{ flexDirection: 'row', marginTop: 16 }}>
               <AppButton title="Annuler" onPress={() => setRejectModalVisible(false)} variant="outline" style={{ flex: 1, marginRight: 8 }} />
               <AppButton title="Confirmer le rejet" onPress={handleConfirmReject} variant="solid" style={{ flex: 1, backgroundColor: '#F44336' }} />
             </View>
           </View>
         </View>
      </Modal>

      {/* INFO MODAL */}
      <Modal visible={infoModalVisible} transparent={true} animationType="slide">
         <View style={styles.modalBg}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Message pour {contribution.memberName}</Text>
             <AppInput label="Message" placeholder="Votre message..." value={infoMessage} onChangeText={setInfoMessage} multiline />
             <View style={{ flexDirection: 'row', marginTop: 16 }}>
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
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  badgeOrange: { backgroundColor: '#FF9800', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  section: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, elevation: 1 },
  memberTitle: { fontSize: 18, fontWeight: 'bold' },
  lightText: { color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  zoomButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, marginTop: 8 },
  zoomText: { marginLeft: 8, color: '#666', fontWeight: 'bold' },
  tableBlock: { marginTop: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8 },
  zoomModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeZoomBotton: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 },
  tableCellHead: { flex: 1, fontWeight: 'bold', color: '#666' },
  tableCell: { flex: 1, fontSize: 13 },
  flagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  warningFlag: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  warningFlagText: { color: '#E65100', fontSize: 12 },
  progressBg: { height: 8, backgroundColor: '#eee', borderRadius: 4, marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  noteSection: { flexDirection: 'row', backgroundColor: '#FFF9C4', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  noteText: { marginLeft: 8, fontStyle: 'italic', flex: 1, color: '#F57F17' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 }
});
