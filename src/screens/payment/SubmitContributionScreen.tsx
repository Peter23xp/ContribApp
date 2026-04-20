import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
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
import { db } from '../../config/firebase'; // needed for auth or get current user if needed, assumed passed via props or context

// Mock/Hooks for demo (navigation, route, currentUser, etc. should be adapted to the actual app)
export function SubmitContributionScreen({ route, navigation }: any) {
  const { amount = 5000, includePenalty = false, groupId = 'testGroup', memberUid = 'user123', memberName = 'John Doe', periodMonth = '2026-04' } = route.params || {};

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

  const operatorTreasurer = 'mpesa'; // Mock treasurer operator
  const treasurerName = 'Jeanne Trésorière';
  const treasurerNumber = '0812345678';
  
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const currentStatus = await getMemberContributionStatus(groupId, memberUid, periodMonth);
      setStatus(currentStatus);
    } catch (e) {
      console.log(e);
    } finally {
      setIsInitializing(false);
    }
  };

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
    setLoadingMessage("Upload de la capture en cours...");

    try {
      const fileName = `${groupId}_${memberUid}_${periodMonth}_${Date.now()}.jpg`;
      const uploadResult = await uploadFile(captureImage.uri, 'receipts' as any, fileName);
      const urlR2 = uploadResult.url;

      setLoadingMessage("Enregistrement de la contribution...");

      await submitContribution({
        groupId,
        memberUid,
        memberName,
        periodMonth,
        amountDue: amount,
        currency: 'CDF',
        captureImageUrl: urlR2,
        captureImagePath: fileName,
        geminiAnalysis: geminiResult || { confidence: 0, warningFlags: ['analyse_echouee'], rawText: '', isPaymentProof: true, amount: null, currency: null, operator: null, transactionRef: null, detectedDate: null, recipientPhone: null, senderPhone: null },
        submittedAt: new Date(),
        status: 'pending_approval'
      });

      Alert.alert("Succès", "Capture soumise ! En attente de validation par la trésorière.");
      navigation.reset({ index: 0, routes: [{ name: 'MemberDashboard' }] });
    } catch (error) {
      Alert.alert("Erreur", "Une erreur est survenue lors de la soumission.");
      console.log(error);
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#000" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.statusCardPaid}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
          <Text style={styles.statusTitle}>Déjà approuvée</Text>
          <AppButton title="Voir le reçu" onPress={() => navigation.navigate('PaymentReceiptScreen')} variant="solid" />
        </View>
      </View>
    );
  }

  if (status?.status === 'pending_approval') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
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
      
      <View style={styles.header}>
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

            <View style={{ marginTop: 24 }}>
              <AppButton 
                title="Continuer →" 
                onPress={() => setCurrentStep(3)} 
                variant="solid" 
                disabled={!captureImage || isAnalyzing} 
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

            <View style={{ marginTop: 24 }}>
              <AppButton title="Soumettre la capture" onPress={submitCapture} variant="solid" />
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomColor: '#eee', borderBottomWidth: 1 },
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
});
