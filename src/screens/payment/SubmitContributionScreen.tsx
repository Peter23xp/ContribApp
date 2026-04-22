import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '../../config/firebase';
import { getMemberContributionStatus, submitContribution } from '../../services/contributionService';
import { analyzePaymentCapture, GeminiAnalysis } from '../../services/geminiService';
import { uploadFile } from '../../services/storageService';
import * as dbService from '../../services/database';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { CapturePreviewCard } from '../../components/payment/CapturePreviewCard';
import { PaymentStepIndicator } from '../../components/payment/PaymentStepIndicator';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { OfflineBanner } from '../../components/common/OfflineBanner';

type ResolvedData = {
  amount: number;
  groupId: string;
  memberUid: string;
  memberName: string;
  periodMonth: string;
  treasurerName: string;
  treasurerNumber: string;
  operatorTreasurer: string;
};

function normalizeContributionStatus(status?: string | null): 'paid' | 'pending_approval' | 'rejected' | 'unknown' {
  const normalized = (status ?? '').toString().trim().toLowerCase();

  if (['paid', 'paye', 'paye_partiel', 'paye_total', 'approved', 'approuve'].includes(normalized)) {
    return 'paid';
  }

  if (['pending_approval', 'pending', 'en_attente', 'submitted'].includes(normalized)) {
    return 'pending_approval';
  }

  if (['rejected', 'failed', 'echec'].includes(normalized)) {
    return 'rejected';
  }

  return 'unknown';
}

export function SubmitContributionScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const storeUser = useAuthStore((s) => s.user);
  const storeGroup = useAuthStore((s) => s.groupId);

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [resolvedData, setResolvedData] = useState<ResolvedData | null>(null);
  const [status, setStatus] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isInitializing, setIsInitializing] = useState(true);
  const [captureImage, setCaptureImage] = useState<{ uri: string; base64: string } | null>(null);
  const [geminiResult, setGeminiResult] = useState<GeminiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [memberNote, setMemberNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const initScreen = useCallback(async () => {
    setIsInitializing(true);

    try {
      const params = route?.params ?? {};
      const uid = params.memberUid ?? storeUser?.id ?? currentUser?.uid ?? '';
      const memberName = params.memberName ?? storeUser?.full_name ?? '';
      const periodMonth = params.periodMonth ?? dbService.getCurrentMonthKey();

      let group = null;
      if (params.groupId) {
        group = await dbService.getGroupById(params.groupId);
      } else if (uid) {
        group = await dbService.getGroupForMember(uid);
      }

      const groupId = group?.id ?? params.groupId ?? storeGroup ?? '';
      const groupAmount = Number(group?.contribution_amount ?? group?.monthly_amount ?? 0);

      let amount = params.amount ? Number(params.amount) : 0;
      if (!amount && uid && groupId) {
        const contribution = await dbService.getMemberContribution(uid, groupId, periodMonth);
        amount = Number(contribution?.amount ?? contribution?.amount_due ?? 0);
      }
      if (!amount) {
        amount = groupAmount;
      }

      const treasurerName = group?.treasurer_name ?? group?.treasurerName ?? 'Tresoriere';
      const treasurerNumber = group?.treasurer_phone ?? group?.treasurerPhone ?? '';
      const operatorTreasurer = group?.treasurer_operator ?? group?.operator ?? 'mobile_money';

      if (uid && groupId) {
        try {
          const currentStatus = await getMemberContributionStatus(groupId, uid, periodMonth);
          setStatus(currentStatus);
        } catch (error) {
          console.log('[SubmitContribution] status lookup skipped:', error);
          setStatus(null);
        }
      } else {
        setStatus(null);
      }

      setResolvedData({
        amount,
        groupId,
        memberUid: uid,
        memberName,
        periodMonth,
        treasurerName,
        treasurerNumber,
        operatorTreasurer,
      });
    } catch (error) {
      console.error('[SubmitContribution] initScreen error:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [currentUser?.uid, route?.params, storeGroup, storeUser?.full_name, storeUser?.id]);

  useEffect(() => {
    initScreen();
  }, [initScreen]);

  useFocusEffect(
    useCallback(() => {
      initScreen();
    }, [initScreen])
  );

  const amount = resolvedData?.amount ?? 0;
  const groupId = resolvedData?.groupId ?? '';
  const memberUid = resolvedData?.memberUid ?? '';
  const memberName = resolvedData?.memberName ?? '';
  const periodMonth = resolvedData?.periodMonth ?? dbService.getCurrentMonthKey();
  const treasurerName = resolvedData?.treasurerName ?? 'Tresoriere';
  const treasurerNumber = resolvedData?.treasurerNumber ?? '';
  const operatorTreasurer = resolvedData?.operatorTreasurer ?? 'mobile_money';
  const normalizedStatus = normalizeContributionStatus(status?.status);
  const isAuthenticatedForSubmission = !!(currentUser?.uid || storeUser?.id);

  const copyToClipboard = async (text: string) => {
    if (!text) {
      Alert.alert('Information', 'Aucun numero disponible pour le moment.');
      return;
    }

    await Clipboard.setStringAsync(text);
    Alert.alert('Succes', 'Numero copie.');
  };

  const handlePickImage = () => {
    Alert.alert('Ajouter une capture', 'Choisissez une option', [
      { text: 'Prendre une photo', onPress: () => pickImage('camera') },
      { text: 'Choisir depuis la galerie', onPress: () => pickImage('gallery') },
      { text: 'Annuler', style: 'cancel' },
    ]);
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

    if (!result.canceled && result.assets?.length) {
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
        Alert.alert('Erreur', "Cette image ne semble pas etre une confirmation de paiement Mobile Money.");
        setCaptureImage(null);
        setGeminiResult(null);
      } else if (result.confidence < 40) {
        Alert.alert('Attention', "La capture est difficile a lire. Essayez une image plus nette.");
      }
    } catch (error: any) {
      setAnalysisError("Analyse IA indisponible. La tresoriere examinera la capture manuellement.");
      console.log('Gemini Error', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitCapture = async () => {
    if (!captureImage || !groupId || !memberUid) {
      Alert.alert('Erreur', 'Les informations de contribution sont incompletes.');
      return;
    }

    setIsSubmitting(true);

    let captureImageUrl: string | undefined;
    let captureImagePath: string | undefined;

    try {
      const fileName = `${groupId}_${memberUid}_${periodMonth}_${Date.now()}.jpg`;
      const uploadResult = await uploadFile(captureImage.uri, 'receipts' as any, fileName);
      captureImageUrl = uploadResult.url;
      captureImagePath = fileName;
    } catch (uploadError: any) {
      const uploadMessage = uploadError?.message ?? String(uploadError);
      console.warn('[SubmitContribution] upload skipped:', uploadMessage);

      if (uploadMessage.includes('FIREBASE_SESSION_REQUIRED')) {
        Alert.alert(
          'Session Firebase requise',
          "L'image ne peut pas etre envoyee vers R2 car cette connexion par PIN n'a pas cree de session Firebase active."
        );
      } else if (uploadMessage.includes('CLOUDFLARE_WORKER_URL_MISSING')) {
        Alert.alert(
          'Configuration Cloudflare incomplete',
          "L'URL du Worker Cloudflare est absente de l'environnement charge par l'application."
        );
      } else if (uploadMessage.includes('PRESIGN_FAILED')) {
        Alert.alert(
          'Signature R2 refusee',
          "Le Worker Cloudflare a refuse de signer l'upload. Verifiez le token Firebase, l'URL du Worker et la reponse du Worker."
        );
      }
    }

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
        memberNote: captureImageUrl ? memberNote : `[Image non uploadee] ${memberNote}`.trim(),
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
        'Succes',
        captureImageUrl
          ? 'Capture soumise. En attente de validation par la tresoriere.'
          : 'Soumission enregistree. La tresoriere examinera votre dossier.'
      );
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error: any) {
      const code = error?.message ?? '';

      if (code === 'ALREADY_PAID') {
        Alert.alert('Deja validee', 'Votre contribution de ce mois a deja ete approuvee.');
      } else if (code === 'ALREADY_PENDING') {
        Alert.alert('Deja soumise', 'Une capture est deja en cours de verification pour ce mois.');
      } else if (code.startsWith('NOT_AUTHENTICATED')) {
        Alert.alert(
          'Session expiree',
          'Votre session a expire. Veuillez vous deconnecter puis vous reconnecter pour soumettre votre contribution.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Erreur', "Impossible d'enregistrer la soumission. Verifiez votre connexion et reessayez.");
      }
      console.error('[SubmitContribution] submitCapture error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitializing) {
    return <LoadingOverlay />;
  }

  if (normalizedStatus === 'paid') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>Paiement membre</Text>
            <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.statusCardPaid}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.statusPaid} />
          <Text style={styles.statusTitle}>Contribution deja approuvee</Text>
          <Text style={styles.statusDesc}>
            Votre paiement de ce mois est deja valide. Aucun nouvel envoi n'est necessaire.
          </Text>
          <AppButton title="Retour au tableau de bord" onPress={() => navigation.navigate('Accueil')} variant="solid" />
        </View>
      </View>
    );
  }

  if (normalizedStatus === 'pending_approval') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>Paiement membre</Text>
            <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.statusCardPending}>
          <Ionicons name="time" size={48} color={Colors.statusPending} />
          <Text style={styles.statusTitle}>Capture deja soumise</Text>
          <Text style={styles.statusDesc}>
            Votre capture est en cours de verification par la tresoriere.
          </Text>
          <AppButton title="Soumettre une nouvelle capture" onPress={() => setStatus(null)} variant="outline" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {isSubmitting ? <LoadingOverlay /> : null}

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>Paiement membre</Text>
          <Text style={styles.headerTitle}>Soumettre ma contribution</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <PaymentStepIndicator currentStep={currentStep as 1 | 2 | 3} steps={['Instructions', 'Capture', 'Envoi']} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Montant</Text>
            <Text style={styles.heroMetricValue}>{amount.toLocaleString('fr-FR')} CDF</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Periode</Text>
            <Text style={styles.heroMetricValue}>{periodMonth}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Operateur</Text>
            <Text style={styles.heroMetricValue}>{operatorTreasurer.toUpperCase()}</Text>
          </View>
        </View>

        {currentStep === 1 ? (
          <View>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionEyebrow}>Paiement manuel assiste</Text>
              <Text style={styles.sectionTitle}>Suivez les etapes puis envoyez votre capture.</Text>
            </View>

            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Montant attendu</Text>
              <Text style={styles.amountDueText}>{amount.toLocaleString('fr-FR')} CDF</Text>
              <Text style={styles.amountDetailText}>Periode : {periodMonth}</Text>
            </View>

            <View style={styles.treasurerCard}>
              <View style={styles.treasurerRow}>
                <Ionicons name="information-circle" size={24} color={Colors.info} />
                <Text style={styles.treasurerCardTitle}>Envoyez le paiement a</Text>
              </View>
              <Text style={styles.treasurerName}>{treasurerName}</Text>
              <Text style={styles.treasurerNumber}>{treasurerNumber || 'Numero indisponible'}</Text>
              <AppButton
                title="Copier le numero"
                onPress={() => copyToClipboard(treasurerNumber)}
                variant="outline"
                style={{ marginTop: 8 }}
                disabled={!treasurerNumber}
              />
              <Text style={styles.treasurerOpCenter}>{operatorTreasurer.toUpperCase()}</Text>
            </View>

            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Instructions</Text>
              <Text style={styles.instructionLine}>1. Ouvrez votre application Mobile Money ({operatorTreasurer}).</Text>
              <Text style={styles.instructionLine}>
                2. Envoyez {amount.toLocaleString('fr-FR')} CDF au numero {treasurerNumber || 'du tresorier'}.
              </Text>
              <Text style={styles.instructionLine}>3. Attendez la confirmation de la transaction.</Text>
              <Text style={styles.instructionLine}>
                4. Faites une capture d'ecran de l'alerte ou du SMS de confirmation.
              </Text>
              <Text style={styles.instructionLine}>5. Revenez ici et soumettez la capture.</Text>
            </View>

            {!groupId || !memberUid || !amount ? (
              <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                <Text style={styles.warningText}>
                  Les informations de contribution ne sont pas encore chargees. Revenez apres synchronisation du groupe.
                </Text>
              </View>
            ) : null}

            <AppButton
              title="J'ai effectue le paiement"
              onPress={() => setCurrentStep(2)}
              variant="solid"
              disabled={!groupId || !memberUid || !amount}
            />
          </View>
        ) : null}

        {currentStep === 2 ? (
          <View>
            {!captureImage ? (
              <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage}>
                <Ionicons name="camera" size={48} color={Colors.textMuted} />
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
                {!isAnalyzing ? (
                  <TouchableOpacity onPress={handlePickImage}>
                    <Text style={styles.changeImageText}>Changer la capture</Text>
                  </TouchableOpacity>
                ) : null}
                {analysisError ? <Text style={styles.analysisError}>{analysisError}</Text> : null}
              </View>
            )}

            {!isAuthenticatedForSubmission ? (
              <View style={styles.authWarningBanner}>
                <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                <Text style={styles.authWarningText}>
                  Session inactive. Reconnectez-vous pour pouvoir soumettre.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsBlock}>
              <AppButton
                title="Continuer"
                onPress={() => setCurrentStep(3)}
                variant="solid"
                disabled={!captureImage || isAnalyzing || !isAuthenticatedForSubmission}
              />
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ marginTop: 12 }}>
                <Text style={styles.changeImageText}>Retour aux instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {currentStep === 3 ? (
          <View>
            <CapturePreviewCard
              imageUrl={captureImage?.uri || ''}
              geminiResult={geminiResult}
              isAnalyzing={isAnalyzing}
              status="pending"
            />

            {geminiResult ? (
              <View
                style={[
                  styles.matchCard,
                  { backgroundColor: geminiResult.amount === amount ? '#E8F5E9' : '#FFF3E0' },
                ]}
              >
                {geminiResult.amount === amount ? (
                  <Text style={styles.matchOkText}>
                    Le montant detecte ({geminiResult.amount} CDF) correspond au montant attendu ({amount} CDF).
                  </Text>
                ) : (
                  <Text style={styles.matchWarnText}>
                    Montant detecte : {geminiResult.amount || 'N/A'} CDF. Montant attendu : {amount} CDF. La tresoriere verifiera la difference.
                  </Text>
                )}
              </View>
            ) : null}

            <View style={styles.infoNoteCard}>
              <Ionicons name="information-circle" size={24} color={Colors.info} />
              <Text style={styles.infoNoteText}>
                Votre capture sera examinee par la tresoriere. Vous recevrez une notification apres validation.
              </Text>
            </View>

            <AppInput
              label="Message pour la tresoriere (optionnel)"
              placeholder="Ex: J'ai paye en deux fois, voici la premiere partie..."
              value={memberNote}
              onChangeText={setMemberNote}
              multiline
              maxLength={200}
            />

            {!isAuthenticatedForSubmission ? (
              <View style={styles.authWarningBanner}>
                <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                <Text style={styles.authWarningText}>
                  Session inactive. Reconnectez-vous pour pouvoir soumettre.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsBlock}>
              <AppButton
                title="Soumettre la capture"
                onPress={submitCapture}
                variant="solid"
                disabled={isSubmitting || !isAuthenticatedForSubmission || !captureImage}
              />
              <TouchableOpacity onPress={() => setCurrentStep(2)} style={{ marginTop: 12 }}>
                <Text style={styles.changeImageText}>Modifier la capture</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
  },
  headerTextBlock: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.label,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: Colors.onSurface,
  },
  headerSpacer: {
    width: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    padding: 14,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '45',
    ...Shadow.card,
  },
  heroMetric: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
  },
  heroMetricLabel: {
    fontSize: 10,
    fontFamily: Fonts.label,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroMetricValue: {
    fontSize: 13,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  sectionIntro: {
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.label,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 30,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  statusCardPaid: {
    padding: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: Radius.xl,
    ...Shadow.card,
  },
  statusCardPending: {
    padding: 24,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: Radius.xl,
    ...Shadow.card,
  },
  statusTitle: {
    fontSize: 20,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    marginVertical: 12,
    textAlign: 'center',
  },
  statusDesc: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
  amountCard: {
    backgroundColor: Colors.primary,
    padding: 24,
    borderRadius: Radius.xl,
    marginBottom: 16,
    ...Shadow.card,
  },
  amountLabel: {
    fontSize: 12,
    fontFamily: Fonts.label,
    color: '#BFE8E0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountDueText: {
    fontSize: 32,
    fontFamily: Fonts.display,
    color: Colors.onPrimary,
    marginTop: 10,
  },
  amountDetailText: {
    color: '#BFE8E0',
    marginTop: 8,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  treasurerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  treasurerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  treasurerCardTitle: {
    marginLeft: 8,
    color: Colors.info,
    fontFamily: Fonts.headline,
  },
  treasurerName: {
    fontFamily: Fonts.title,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    color: Colors.onSurface,
  },
  treasurerNumber: {
    fontSize: 24,
    fontFamily: Fonts.display,
    textAlign: 'center',
    marginTop: 8,
    color: Colors.primary,
  },
  treasurerOpCenter: {
    textAlign: 'center',
    marginTop: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.headline,
  },
  instructionsCard: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    marginBottom: 10,
  },
  instructionLine: {
    paddingVertical: 4,
    color: Colors.textPrimary,
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3CD',
    borderColor: '#FFCC80',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    color: '#7B3F00',
    fontFamily: Fonts.body,
    lineHeight: 19,
  },
  imagePickerArea: {
    width: '100%',
    height: 220,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
  },
  imagePickerText: {
    color: Colors.textMuted,
    marginTop: 12,
    fontFamily: Fonts.headline,
  },
  changeImageText: {
    textAlign: 'center',
    color: Colors.primary,
    marginTop: 12,
    fontFamily: Fonts.headline,
  },
  analysisError: {
    color: Colors.error,
    marginTop: 8,
    fontFamily: Fonts.body,
  },
  matchCard: {
    padding: 12,
    borderRadius: Radius.lg,
    marginVertical: 12,
  },
  matchOkText: {
    color: Colors.statusPaid,
    fontFamily: Fonts.headline,
  },
  matchWarnText: {
    color: Colors.statusPending,
    fontFamily: Fonts.headline,
  },
  infoNoteCard: {
    flexDirection: 'row',
    backgroundColor: '#DCEEFF',
    padding: 12,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginBottom: 16,
  },
  infoNoteText: {
    color: Colors.info,
    flex: 1,
    marginLeft: 8,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  authWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: Radius.lg,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  authWarningText: {
    flex: 1,
    color: '#7B3F00',
    fontSize: 13,
    fontFamily: Fonts.headline,
  },
  actionsBlock: {
    marginTop: 12,
  },
});
