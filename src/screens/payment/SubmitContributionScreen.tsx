import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Platform, StatusBar } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { getMemberContributionStatus, submitContribution } from '../../services/contributionService';
import { analyzePaymentCapture, GeminiAnalysis } from '../../services/geminiService';
import { uploadFile } from '../../services/storageService';
import { CapturePreviewCard } from '../../components/payment/CapturePreviewCard';
import { PaymentStepIndicator } from '../../components/payment/PaymentStepIndicator';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../stores/authStore';
import * as dbService from '../../services/database';

export function SubmitContributionScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();

  // ── Auth store ────────────────────────────────────────────────────────────
  const storeUser  = useAuthStore(s => s.user);
  const storeGroup = useAuthStore(s => s.groupId);

  // ── Données chargées depuis Firestore ──────────────────────────────────────
  const [resolvedData, setResolvedData] = useState<{
    amount: number;
    groupId: string;
    memberUid: string;
    memberName: string;
    periodMonth: string;
    treasurerName: string;
    treasurerNumber: string;
    operatorTreasurer: string;
  } | null>(null);

  // ── État Auth Firebase (listener temps réel) ─────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe; // nettoyage au démontage
  }, []);

  const [status, setStatus] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isInitializing, setIsInitializing] = useState(true);

  const [captureImage, setCaptureImage] = useState<{ uri: string; base64: string } | null>(null);
  const [geminiResult, setGeminiResult] = useState<GeminiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const [memberNote, setMemberNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // ── Résolution des données (params > store + Firestore) ───────────────────
  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    try {
      // 1. Paramètres reçus via navigation (priorité maximale)
      const p = route?.params ?? {};

      const uid        = p.memberUid   ?? storeUser?.id    ?? '';
      const name       = p.memberName  ?? storeUser?.full_name ?? '';
      const month      = p.periodMonth ?? dbService.getCurrentMonthKey();
      const gIdParam   = p.groupId;

      // 2. Charger le groupe depuis Firestore si pas fourni
      let group: any = null;
      if (gIdParam) {
        group = await dbService.getGroupById(gIdParam);
      } else {
        // Récupérer le groupe du membre (via active_group_id)
        group = uid ? await dbService.getGroupForMember(uid) : null;
      }

      const gId = group?.id ?? gIdParam ?? storeGroup ?? '';

      // 3. Montant : params > contribution en cours > groupe
      //    On utilise || (pas ??) pour que 0 tombe aussi sur le fallback suivant
      const groupAmount = group?.contribution_amount || group?.monthly_amount || 0;
      let finalAmount = p.amount ? Number(p.amount) : 0;
      if (!finalAmount && gId && uid) {
        const contrib = await dbService.getMemberContribution(uid, gId, month);
        finalAmount = contrib?.amount || contrib?.amount_due || 0;
      }
      // Toujours utiliser le montant du groupe en dernier recours
      if (!finalAmount) {
        finalAmount = groupAmount;
      }


      // 4. Infos trésorière depuis le groupe
      const treasurer = group?.treasurer_phone ?? group?.treasurerPhone ?? '';
      const tName     = group?.treasurer_name  ?? group?.treasurerName  ?? 'Trésorière';
      const tOp       = group?.operator        ?? group?.treasurer_operator ?? 'mobile_money';

      // 5. Statut actuel de la contribution
      if (gId && uid) {
        try {
          const currentStatus = await getMemberContributionStatus(gId, uid, month);
          setStatus(currentStatus);
        } catch (_) {}
      }

      setResolvedData({
        amount: finalAmount,
        groupId: gId,
        memberUid: uid,
        memberName: name,
        periodMonth: month,
        treasurerName: tName,
        treasurerNumber: treasurer,
        operatorTreasurer: tOp,
      });
    } catch (err) {
      console.error('[SubmitContribution] initScreen error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  // Raccourcis pour éviter les nullchecks répétés dans le JSX
  const amount            = resolvedData?.amount            ?? 0;
  const groupId           = resolvedData?.groupId           ?? '';
  const memberUid         = resolvedData?.memberUid         ?? '';
  const memberName        = resolvedData?.memberName        ?? '';
  const periodMonth       = resolvedData?.periodMonth       ?? dbService.getCurrentMonthKey();
  const treasurerName     = resolvedData?.treasurerName     ?? 'Trésorière';
  const treasurerNumber   = resolvedData?.treasurerNumber   ?? '';
  const operatorTreasurer = resolvedData?.operatorTreasurer ?? 'mobile_money';



  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Succès", "Numéro copié !");
  };

  const handlePickImage = () => {
    Alert.alert(
      "Ajouter une capture",
      "Choisissez une option",
      [
        { text: "Prendre une photo", onPress: () => pickImage('camera') },
        { text: "Choisir depuis la galerie", onPress: () => pickImage('gallery') },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
      allowsEditing: true,
    };

    let result;
    if (source === 'camera') {
      await ImagePicker.requestCameraPermissionsAsync();
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setCaptureImage({ uri: asset.uri, base64: asset.base64 || '' });
      analyzeImage(asset.base64 || '');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzePaymentCapture(base64, amount, 'CDF', operatorTreasurer);
      setGeminiResult(result);
      
      if (!result.isPaymentProof) {
        Alert.alert("Erreur", "Cette image ne semble pas être une confirmation de paiement Mobile Money.");
        setCaptureImage(null);
        setGeminiResult(null);
      } else if (result.confidence < 40) {
        Alert.alert("Attention", "La capture est difficile à lire. Essayez une image plus nette.");
      }
    } catch (error: any) {
      setAnalysisError("Analyse IA indisponible. La trésorière examinera la capture manuellement.");
      console.log("Gemini Error", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitCapture = async () => {
    if (!captureImage) return;

    setIsSubmitting(true);
    setLoadingMessage('Upload de la capture en cours...');

    let captureImageUrl: string | undefined;
    let captureImagePath: string | undefined;

    // ── Upload R2 (optionnel : si indisponible, on continue sans image) ──────
    try {
      const fileName = `${groupId}_${memberUid}_${periodMonth}_${Date.now()}.jpg`;
      const uploadResult = await uploadFile(captureImage.uri, 'receipts' as any, fileName);
      captureImageUrl  = uploadResult.url;
      captureImagePath = fileName;
    } catch (uploadError: any) {
      console.warn('[SubmitContribution] Upload R2 échoué, on continue sans image :', uploadError?.message ?? uploadError);
      // On ne bloque pas la soumission — la trésorière sera informée via member_note
    }

    setLoadingMessage('Enregistrement de la contribution...');

    try {
      await submitContribution({
        groupId,
        memberUid,
        memberName,
        periodMonth,
        amountDue: amount,
        currency: 'CDF',
        captureImageUrl,
        captureImagePath,
        memberNote: captureImageUrl
          ? memberNote
          : `[Image non uploadée] ${memberNote}`.trim(),
        geminiAnalysis: geminiResult || {
          confidence: 0,
          warningFlags: ['analyse_echouee'],
          rawText: '',
          isPaymentProof: true,
          amount: null,
          currency: null,
          operator: null,
          transactionRef: null,
          detectedDate: null,
          recipientPhone: null,
          senderPhone: null,
        },
        submittedAt: new Date(),
        status: 'pending_approval',
      });

      Alert.alert(
        'Succès',
        captureImageUrl
          ? 'Capture soumise ! En attente de validation par la trésorière.'
          : 'Soumission enregistrée (image en attente). La trésorière examinera votre dossier.'
      );
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error: any) {
      const code = error?.message ?? '';
      if (code === 'ALREADY_PAID') {
        Alert.alert('Déjà validée', 'Votre contribution de ce mois a déjà été approuvée.');
      } else if (code === 'ALREADY_PENDING') {
        Alert.alert('Déjà soumise', 'Une capture est déjà en cours de vérification pour ce mois.');
      } else if (code.startsWith('NOT_AUTHENTICATED')) {
        Alert.alert(
          '🔒 Session expirée',
          'Votre session a expiré. Veuillez vous déconnecter puis vous reconnecter pour soumettre votre contribution.',
          [{ text: 'OK' }]
        );
        console.error('[SubmitContribution] submitCapture error — session expirée :', error);
      } else {
        Alert.alert('Erreur', 'Impossible d\'enregistrer la soumission. Vérifiez votre connexion et réessayez.');
        console.error('[SubmitContribution] submitCapture error:', code, error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isInitializing) {
    return <LoadingOverlay />;
  }

  if (status?.status === 'paid') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#000" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.statusCardPaid}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
          <Text style={styles.statusTitle}>Déjà approuvée</Text>
          <AppButton title="Voir le reçu" onPress={() => navigation.navigate('Receipt', { txId: '' })} variant="solid" />
        </View>
      </View>
    );
  }

  if (status?.status === 'pending_approval') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#000" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.statusCardPending}>
          <Ionicons name="time" size={48} color="#FF9800" />
          <Text style={styles.statusTitle}>En attente de validation</Text>
          <Text style={styles.statusDesc}>Votre capture a été soumise et est en cours de vérification par la trésorière.</Text>
          <AppButton title="Soumettre une nouvelle capture" onPress={() => setStatus(null)} variant="outline" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {isSubmitting && <LoadingOverlay />}
      
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#000" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
        <View style={{width: 24}} />
      </View>

      <PaymentStepIndicator currentStep={currentStep as 1 | 2 | 3} steps={['Instructions', 'Capture', 'Envoi']} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentStep === 1 && (
          <View>
            <View style={styles.amountCard}>
              <Text style={styles.amountDueText}>{amount} CDF</Text>
              <Text style={styles.amountDetailText}>Mois concerné : {periodMonth}</Text>
            </View>

            <View style={styles.treasurerCard}>
              <View style={styles.treasurerRow}>
                <Ionicons name="information-circle" size={24} color="#2196F3" />
                <Text style={styles.treasurerCardTitle}>Envoyez le paiement à :</Text>
              </View>
              <Text style={styles.treasurerName}>{treasurerName}</Text>
              <Text style={styles.treasurerNumber}>{treasurerNumber}</Text>
              <AppButton title="Copier le numéro" onPress={() => copyToClipboard(treasurerNumber)} variant="outline" style={{ marginTop: 8 }} />
              <Text style={styles.treasurerOpCenter}>{operatorTreasurer.toUpperCase()}</Text>
            </View>

            <View style={styles.instructionsCard}>
              <Text style={styles.instructionLine}>1. Ouvrez votre application Mobile Money ({operatorTreasurer})</Text>
              <Text style={styles.instructionLine}>2. Envoyez {amount} CDF au numéro {treasurerNumber}</Text>
              <Text style={styles.instructionLine}>3. Attendez la confirmation de la transaction</Text>
              <Text style={styles.instructionLine}>4. Faites une capture d'écran de l'alerte/SMS de confirmation</Text>
              <Text style={styles.instructionLine}>5. Revenez ici et soumettez la capture</Text>
            </View>

            <AppButton title="J'ai effectué le paiement →" onPress={() => setCurrentStep(2)} variant="solid" />
          </View>
        )}

        {currentStep === 2 && (
          <View>
            {!captureImage ? (
              <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage}>
                <Ionicons name="camera" size={48} color="#9E9E9E" />
                <Text style={styles.imagePickerText}>Appuyez pour ajouter la capture</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <CapturePreviewCard 
                  imageUrl={captureImage.uri}
                  geminiResult={geminiResult}
                  isAnalyzing={isAnalyzing}
                  status="pending"
                />
                {!isAnalyzing && (
                  <TouchableOpacity onPress={handlePickImage}>
                    <Text style={styles.changeImageText}>Changer la capture</Text>
                  </TouchableOpacity>
                )}
                {analysisError && <Text style={{ color: '#F44336', marginTop: 8 }}>{analysisError}</Text>}
              </View>
            )}

            {!currentUser && (
              <View style={styles.authWarningBanner}>
                <Ionicons name="warning-outline" size={18} color="#7B3F00" />
                <Text style={styles.authWarningText}>
                  Session inactive. Reconnectez-vous pour pouvoir soumettre.
                </Text>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <AppButton 
                title="Continuer →" 
                onPress={() => setCurrentStep(3)} 
                variant="solid" 
                disabled={!captureImage || isAnalyzing || !currentUser} 
              />
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ marginTop: 12 }}>
                <Text style={styles.changeImageText}>← Retour aux instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentStep === 3 && (
          <View>
            <CapturePreviewCard 
              imageUrl={captureImage?.uri!}
              geminiResult={geminiResult}
              isAnalyzing={isAnalyzing}
              status="pending"
            />

            {geminiResult && (
              <View style={[styles.matchCard, { backgroundColor: geminiResult.amount === amount ? '#E8F5E9' : '#FFF3E0' }]}>
                {geminiResult.amount === amount ? (
                  <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Le montant détecté ({geminiResult.amount} CDF) correspond au montant dû ({amount} CDF).</Text>
                ) : (
                  <Text style={{ color: '#FF9800', fontWeight: 'bold' }}>⚠ Montant détecté : {geminiResult.amount || 'N/A'} CDF - Montant dû : {amount} CDF. La trésorière vérifiera la différence.</Text>
                )}
              </View>
            )}

            <View style={styles.infoNoteCard}>
              <Ionicons name="information-circle" size={24} color="#0D47A1" />
              <Text style={{ color: '#0D47A1', flex: 1, marginLeft: 8 }}>Votre capture sera examinée par la trésorière. Vous recevrez une notification dès validation.</Text>
            </View>

            <AppInput
              label="Message pour la trésorière (optionnel)"
              placeholder="Ex: J'ai payé en deux fois, voici la première partie..."
              value={memberNote}
              onChangeText={setMemberNote}
              multiline
              maxLength={200}
            />

            {!currentUser && (
              <View style={styles.authWarningBanner}>
                <Ionicons name="warning-outline" size={18} color="#7B3F00" />
                <Text style={styles.authWarningText}>
                  Session inactive. Reconnectez-vous pour pouvoir soumettre.
                </Text>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <AppButton
                title="Soumettre la capture"
                onPress={submitCapture}
                variant="solid"
                disabled={isSubmitting || !currentUser}
              />
              <TouchableOpacity onPress={() => setCurrentStep(2)} style={{ marginTop: 12 }}>
                <Text style={styles.changeImageText}>← Modifier la capture</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  statusCardPaid: { padding: 24, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', margin: 16, borderRadius: 12 },
  statusCardPending: { padding: 24, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', margin: 16, borderRadius: 12 },
  statusTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 12 },
  statusDesc: { textAlign: 'center', color: '#666', marginBottom: 20 },
  
  amountCard: { backgroundColor: '#E8F5E9', padding: 24, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  amountDueText: { fontSize: 32, fontWeight: 'bold', color: '#4CAF50' },
  amountDetailText: { color: '#4CAF50', marginTop: 8 },
  
  treasurerCard: { backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginBottom: 16 },
  treasurerRow: { flexDirection: 'row', alignItems: 'center' },
  treasurerCardTitle: { marginLeft: 8, color: '#1976D2', fontWeight: 'bold' },
  treasurerName: { fontWeight: 'bold', fontSize: 16, marginTop: 12, textAlign: 'center' },
  treasurerNumber: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  treasurerOpCenter: { textAlign: 'center', marginTop: 12, color: '#666', fontWeight: 'bold' },
  
  instructionsCard: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, marginBottom: 24 },
  instructionLine: { paddingVertical: 4, color: '#333' },
  
  imagePickerArea: { width: '100%', height: 200, borderWidth: 2, borderColor: '#BDBDBD', borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  imagePickerText: { color: '#9E9E9E', marginTop: 12, fontWeight: 'bold' },
  changeImageText: { textAlign: 'center', color: '#757575', marginTop: 12, fontWeight: 'bold' },
  
  matchCard: { padding: 12, borderRadius: 8, marginVertical: 12 },
  infoNoteCard: { flexDirection: 'row', backgroundColor: '#BBDEFB', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  authWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  authWarningText: {
    flex: 1,
    color: '#7B3F00',
    fontSize: 13,
    fontWeight: '600',
  },
});
