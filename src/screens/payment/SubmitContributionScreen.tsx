import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const storeUid = useAuthStore((s) => s.uid);
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



  const initScreen = useCallback(async () => {
    setIsInitializing(true);

    try {
      const params = route?.params ?? {};
      const uid = params.memberUid ?? storeUid ?? '';
      const memberName = params.memberName ?? storeUser?.fullName ?? '';
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
  }, [route?.params, storeGroup, storeUser?.fullName, storeUid]);

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
  const isAuthenticatedForSubmission = !!storeUid;

  const copyToClipboard = async (text: string) => {
    if (!text) {
      Alert.alert('Information', 'Aucun numéro disponible pour le moment.');
      return;
    }

    await Clipboard.setStringAsync(text);
    Alert.alert('Succès', 'Numéro copié.');
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
      mediaTypes: 'images',
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
        Alert.alert('Image non valide', "Cette image ne semble pas être une confirmation de paiement Mobile Money. Veuillez soumettre la capture de confirmation reçue après votre transfert.");
        setCaptureImage(null);
        setGeminiResult(null);
      } else if (result.confidence < 40) {
        Alert.alert('Capture peu lisible', "L'image est difficile à analyser. Essayez une capture plus nette ou mieux éclairée.");
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      if (msg === 'GEMINI_API_KEY_MISSING') {
        setAnalysisError("Clé API Gemini absente. Vérifiez EXPO_PUBLIC_GEMINI_API_KEY dans .env.");
      } else if (msg === 'GEMINI_API_KEY_INVALID') {
        setAnalysisError("Clé API Gemini invalide ou expirée. Vérifiez votre compte Google AI Studio.");
      } else if (msg === 'GEMINI_QUOTA_EXCEEDED') {
        setAnalysisError("Quota Gemini dépassé. La trésorière examinera la capture manuellement.");
      } else {
        setAnalysisError("Analyse IA indisponible. La trésorière examinera la capture manuellement.");
      }
      console.warn('[Gemini]', msg);
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
      console.warn('[SubmitContribution] upload failed:', uploadMessage);
      setIsSubmitting(false);

      if (uploadMessage.includes('CLOUDFLARE_WORKER_URL_MISSING')) {
        Alert.alert(
          'Configuration incomplète',
          "L'URL du Worker Cloudflare est absente. Vérifiez vos variables d'environnement."
        );
      } else if (uploadMessage.includes('CLOUDFLARE_UPLOAD_SECRET_MISSING')) {
        Alert.alert(
          'Configuration incomplète',
          "Le secret d'upload Cloudflare est absent. Vérifiez EXPO_PUBLIC_CF_UPLOAD_SECRET dans votre .env."
        );
      } else if (uploadMessage.includes('FILE_NOT_FOUND')) {
        Alert.alert(
          'Fichier introuvable',
          "L'image sélectionnée est introuvable sur l'appareil. Veuillez en choisir une autre."
        );
      } else if (uploadMessage.includes('UPLOAD_FAILED')) {
        Alert.alert(
          'Échec de l\'envoi',
          "L'image n'a pas pu être envoyée. Vérifiez votre connexion et réessayez."
        );
      } else {
        Alert.alert(
          'Erreur d\'upload',
          `Impossible d'envoyer l'image : ${uploadMessage}. Réessayez.`
        );
      }
      return;
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
        'Succès',
        captureImageUrl
          ? 'Capture soumise. En attente de validation par la trésorière.'
          : 'Soumission enregistrée. La trésorière examinera votre dossier.'
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
        Alert.alert('Erreur', "Impossible d'enregistrer la soumission. Vérifiez votre connexion et réessayez.");
      }
      console.error('[SubmitContribution] submitCapture error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitializing) {
    return <LoadingOverlay />;
  }

  // ── STATUS: PAID ─────────────────────────────────────────────────────
  if (normalizedStatus === 'paid') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={[styles.statusBanner, { paddingTop: Math.max(insets.top + 16, 48) }]}>
          <View style={styles.statusIconRing}>
            <Ionicons name="checkmark-circle" size={44} color={Colors.primary} />
          </View>
          <View style={styles.statusBannerText}>
            <Text style={styles.statusBannerLabel}>STATUT</Text>
            <Text style={styles.statusBannerTitle}>Contribution validée</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.statusBody}>
          <View style={styles.statusDetailCard}>
            <View style={styles.statusAccentBar} />
            <View style={styles.statusDetailInner}>
              <View style={styles.statusDetailRow}>
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Montant</Text>
                  <Text style={[styles.statusDetailValue, { color: Colors.statusPaid }]}>{amount.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.statusDetailUnit}>CDF</Text>
                </View>
                <View style={styles.statusDetailDivider} />
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Période</Text>
                  <Text style={styles.statusDetailValue}>{periodMonth}</Text>
                </View>
                <View style={styles.statusDetailDivider} />
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Décision</Text>
                  <Text style={[styles.statusDetailValue, { color: Colors.statusPaid }]}>Approuvé</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statusInfoBox}>
            <View style={[styles.statusInfoIcon, { backgroundColor: Colors.statusPaid + '20' }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={Colors.statusPaid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusInfoTitle, { color: Colors.statusPaid }]}>Paiement confirmé</Text>
              <Text style={styles.statusInfoText}>
                Votre trésorière a confirmé la réception de ce paiement. Aucune action requise.
              </Text>
            </View>
          </View>

          <AppButton
            title="Retour au tableau de bord"
            onPress={() => navigation.navigate('Accueil')}
            variant="solid"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </View>
    );
  }

  // ── STATUS: PENDING ───────────────────────────────────────────────────
  if (normalizedStatus === 'pending_approval') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#7B5300" />
        <View style={[styles.statusBannerPending, { paddingTop: Math.max(insets.top + 16, 48) }]}>
          <View style={[styles.statusIconRing, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
            <Ionicons name="hourglass-outline" size={38} color="#7B5300" />
          </View>
          <View style={styles.statusBannerText}>
            <Text style={[styles.statusBannerLabel, { color: 'rgba(255,255,255,0.7)' }]}>STATUT</Text>
            <Text style={styles.statusBannerTitle}>En cours de vérification</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.statusBody}>
          <View style={styles.statusDetailCard}>
            <View style={[styles.statusAccentBar, { backgroundColor: Colors.statusPending }]} />
            <View style={styles.statusDetailInner}>
              <View style={styles.statusDetailRow}>
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Montant</Text>
                  <Text style={[styles.statusDetailValue, { color: Colors.statusPending }]}>{amount.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.statusDetailUnit}>CDF</Text>
                </View>
                <View style={styles.statusDetailDivider} />
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Période</Text>
                  <Text style={styles.statusDetailValue}>{periodMonth}</Text>
                </View>
                <View style={styles.statusDetailDivider} />
                <View style={styles.statusDetailItem}>
                  <Text style={styles.statusDetailLabel}>Statut</Text>
                  <Text style={[styles.statusDetailValue, { color: Colors.statusPending }]}>En attente</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Suivi de la validation</Text>
            <View style={styles.timelineStep}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.statusPaid }]}>
                <Ionicons name="checkmark" size={12} color="#FFF" />
              </View>
              <View style={styles.timelineConnector} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStepTitle}>Capture soumise</Text>
                <Text style={styles.timelineStepDesc}>Votre preuve de paiement a été reçue.</Text>
              </View>
            </View>
            <View style={styles.timelineStep}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.statusPending }]}>
                <Ionicons name="time-outline" size={12} color="#FFF" />
              </View>
              <View style={styles.timelineConnectorDashed} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStepTitle}>Vérification en cours</Text>
                <Text style={styles.timelineStepDesc}>La trésorière examine votre capture.</Text>
              </View>
            </View>
            <View style={[styles.timelineStep, { opacity: 0.45 }]}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1.5, borderColor: Colors.outlineVariant }]}>
                <Ionicons name="ellipsis-horizontal" size={10} color={Colors.textMuted} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineStepTitle, { color: Colors.textMuted }]}>Validation finale</Text>
                <Text style={styles.timelineStepDesc}>Vous recevrez une notification dès l'approbation.</Text>
              </View>
            </View>
          </View>

          <AppButton
            title="Soumettre une nouvelle capture"
            onPress={() => setStatus(null)}
            variant="outline"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </View>
    );
  }

  // ── MAIN FLOW ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      {isSubmitting ? <LoadingOverlay /> : null}

      {/* Top Banner Header */}
      <View style={[styles.topBanner, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBannerBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <View style={styles.topBannerCenter}>
          <Text style={styles.topBannerEyebrow}>Cotisation mensuelle</Text>
          <Text style={styles.topBannerTitle}>Soumettre ma contribution</Text>
        </View>
        <View style={styles.topBannerLogo}>
          <Text style={styles.topBannerLogoText}>C</Text>
        </View>
      </View>

      <OfflineBanner />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Amount Hero Strip ── */}
        <View style={styles.amountHeroStrip}>
          <View style={styles.amountHeroAccent} />
          <View style={styles.amountHeroInner}>
            <View style={styles.amountHeroLeft}>
              <Text style={styles.amountHeroLabel}>Montant à payer</Text>
              <Text style={styles.amountHeroValue}>{amount.toLocaleString('fr-FR')} <Text style={styles.amountHeroCurrency}>CDF</Text></Text>
            </View>
            <View style={styles.amountHeroChips}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{periodMonth}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '30' }]}>
                <Text style={[styles.chipText, { color: Colors.primary }]}>{operatorTreasurer.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Step Indicator ── */}
        <PaymentStepIndicator currentStep={currentStep as 1 | 2 | 3} steps={['Instructions', 'Capture', 'Envoi']} />

        {/* ═══════════════ STEP 1 ═══════════════ */}
        {currentStep === 1 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEyebrow}>Étape 1 sur 3</Text>
            <Text style={styles.stepHeading}>Effectuez le paiement</Text>

            {/* Treasurer Card */}
            <View style={styles.treasurerHeroCard}>
              <View style={styles.treasurerHeroTop}>
                <View style={styles.treasurerAvatarCircle}>
                  <Text style={styles.treasurerAvatarLetter}>{(treasurerName[0] ?? 'T').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.treasurerHeroLabel}>Envoyez le paiement à</Text>
                  <Text style={styles.treasurerHeroName}>{treasurerName}</Text>
                </View>
              </View>
              <View style={styles.treasurerDivider} />
              <Text style={styles.treasurerPhoneDisplay}>{treasurerNumber || 'Numéro indisponible'}</Text>
              <View style={styles.treasurerFooter}>
                <View style={styles.operatorPill}>
                  <Ionicons name="phone-portrait-outline" size={13} color={Colors.primary} />
                  <Text style={styles.operatorPillText}>{operatorTreasurer.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyBtn, !treasurerNumber && { opacity: 0.4 }]}
                  onPress={() => copyToClipboard(treasurerNumber)}
                  disabled={!treasurerNumber}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={15} color="#FFF" />
                  <Text style={styles.copyBtnText}>Copier</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsHeading}>Comment procéder</Text>
              {[
                `Ouvrez votre application ${operatorTreasurer} (Mobile Money).`,
                `Envoyez ${amount.toLocaleString('fr-FR')} CDF au numéro ${treasurerNumber || 'du trésorier'}.`,
                `Attendez la confirmation SMS ou écran de la transaction.`,
                `Faites une capture d'écran de la confirmation reçue.`,
                `Revenez ici et soumettez la capture à l'étape suivante.`,
              ].map((text, i) => (
                <View key={i} style={styles.instructionRow}>
                  <View style={styles.instructionBullet}>
                    <Text style={styles.instructionBulletText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{text}</Text>
                </View>
              ))}
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
              title="J'ai effectué le paiement →"
              onPress={() => setCurrentStep(2)}
              variant="solid"
              disabled={!groupId || !memberUid || !amount}
            />
          </View>
        ) : null}

        {/* ═══════════════ STEP 2 ═══════════════ */}
        {currentStep === 2 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEyebrow}>Étape 2 sur 3</Text>
            <Text style={styles.stepHeading}>Ajoutez la capture</Text>

            {!captureImage ? (
              <TouchableOpacity style={styles.uploadZone} onPress={handlePickImage} activeOpacity={0.85}>
                <View style={styles.uploadIconWrap}>
                  <Ionicons name="camera" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>Ajouter la capture de paiement</Text>
                <Text style={styles.uploadSub}>Appuyez pour prendre une photo ou choisir depuis la galerie</Text>
                <View style={styles.uploadChip}>
                  <Ionicons name="image-outline" size={13} color={Colors.primary} />
                  <Text style={styles.uploadChipText}>Galerie / Appareil photo</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.previewContainer}>
                <CapturePreviewCard
                  imageUrl={captureImage.uri}
                  geminiResult={geminiResult}
                  isAnalyzing={isAnalyzing}
                  status="pending"
                />
                {!isAnalyzing ? (
                  <TouchableOpacity style={styles.changeCapturePill} onPress={handlePickImage} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={14} color={Colors.primary} />
                    <Text style={styles.changeCapturePillText}>Changer la capture</Text>
                  </TouchableOpacity>
                ) : null}
                {analysisError ? (
                  <View style={styles.analysisErrorCard}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.statusPending} />
                    <Text style={styles.analysisError}>{analysisError}</Text>
                  </View>
                ) : null}
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
                title="Continuer vers l'envoi"
                onPress={() => setCurrentStep(3)}
                variant="solid"
                disabled={!captureImage || isAnalyzing || !isAuthenticatedForSubmission}
              />
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backLink}>
                <Ionicons name="arrow-back" size={14} color={Colors.primary} />
                <Text style={styles.backLinkText}>Retour aux instructions</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ═══════════════ STEP 3 ═══════════════ */}
        {currentStep === 3 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepEyebrow}>Étape 3 sur 3</Text>
            <Text style={styles.stepHeading}>Confirmer l'envoi</Text>

            <CapturePreviewCard
              imageUrl={captureImage?.uri || ''}
              geminiResult={geminiResult}
              isAnalyzing={isAnalyzing}
              status="pending"
            />

            {geminiResult ? (
              <View style={[styles.matchCard, { borderLeftColor: geminiResult.amount === amount ? Colors.statusPaid : Colors.statusPending }]}>
                <View style={styles.matchCardIcon}>
                  <Ionicons
                    name={geminiResult.amount === amount ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={geminiResult.amount === amount ? Colors.statusPaid : Colors.statusPending}
                  />
                </View>
                <Text style={[styles.matchCardText, { color: geminiResult.amount === amount ? Colors.statusPaid : Colors.statusPending }]}>
                  {geminiResult.amount === amount
                    ? `Montant confirmé : ${geminiResult.amount} CDF correspond au montant attendu.`
                    : `Montant détecté : ${geminiResult.amount || 'N/A'} CDF — attendu : ${amount} CDF. La trésorière vérifiera.`}
                </Text>
              </View>
            ) : null}

            <View style={styles.noteSection}>
              <Text style={styles.noteSectionLabel}>MESSAGE POUR LA TRÉSORIÈRE</Text>
              <AppInput
                label=""
                placeholder="Ex : J'ai payé en deux fois, voici la première partie…"
                value={memberNote}
                onChangeText={setMemberNote}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.reviewInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
              <Text style={styles.reviewInfoText}>
                Votre capture sera examinée par la trésorière. Vous recevrez une notification après validation.
              </Text>
            </View>

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
              <TouchableOpacity onPress={() => setCurrentStep(2)} style={styles.backLink}>
                <Ionicons name="arrow-back" size={14} color={Colors.primary} />
                <Text style={styles.backLinkText}>Modifier la capture</Text>
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

  // ── Top Banner ──
  topBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBannerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBannerCenter: {
    flex: 1,
  },
  topBannerEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  topBannerTitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
  },
  topBannerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBannerLogoText: {
    fontFamily: Fonts.display,
    fontSize: 18,
    color: Colors.primary,
  },

  scrollContent: {
    paddingBottom: 48,
  },

  // ── Amount Hero Strip ──
  amountHeroStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    margin: 16,
    marginBottom: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    ...Shadow.card,
  },
  amountHeroAccent: {
    width: 5,
    backgroundColor: Colors.gold,
  },
  amountHeroInner: {
    flex: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountHeroLeft: {
    gap: 4,
  },
  amountHeroLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountHeroValue: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.gold,
  },
  amountHeroCurrency: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  amountHeroChips: {
    gap: 6,
    alignItems: 'flex-end',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.goldMuted,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  chipText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.onSurface,
    fontWeight: '600',
  },

  // ── Step Container ──
  stepContainer: {
    padding: 16,
    paddingTop: 20,
    gap: 16,
  },
  stepEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  stepHeading: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.onSurface,
    marginTop: -8,
    lineHeight: 32,
  },

  // ── Treasurer Hero Card ──
  treasurerHeroCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    overflow: 'hidden',
    ...Shadow.card,
  },
  treasurerHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    paddingBottom: 14,
  },
  treasurerAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.gold + '50',
  },
  treasurerAvatarLetter: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.primary,
  },
  treasurerHeroLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  treasurerHeroName: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginTop: 2,
  },
  treasurerDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant + '40',
    marginHorizontal: 18,
  },
  treasurerPhoneDisplay: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 2,
  },
  treasurerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  operatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.full,
  },
  operatorPillText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
  },
  copyBtnText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },

  // ── Instructions Card ──
  instructionsCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: 18,
    gap: 12,
  },
  instructionsHeading: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  instructionBulletText: {
    fontFamily: Fonts.headline,
    fontSize: 11,
    color: '#FFF',
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 21,
  },

  // ── Warning Card ──
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF3CD',
    borderColor: '#FFCC80',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
  },
  warningText: {
    flex: 1,
    color: '#7B3F00',
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Upload Zone ──
  uploadZone: {
    borderWidth: 2,
    borderColor: Colors.gold + '60',
    borderStyle: 'dashed',
    borderRadius: Radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: Colors.goldMuted + '40',
    gap: 10,
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    textAlign: 'center',
  },
  uploadSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.full,
    marginTop: 4,
  },
  uploadChipText: {
    fontFamily: Fonts.label,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },

  // ── Preview ──
  previewContainer: {
    gap: 10,
  },
  changeCapturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '08',
  },
  changeCapturePillText: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.primary,
  },
  analysisErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.statusPending + '30',
  },
  analysisError: {
    flex: 1,
    color: Colors.statusPending,
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Auth warning ──
  authWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: Radius.lg,
    padding: 12,
    gap: 10,
  },
  authWarningText: {
    flex: 1,
    color: '#7B3F00',
    fontSize: 13,
    fontFamily: Fonts.headline,
  },

  // ── Match Card (Step 3) ──
  matchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLowest,
    borderLeftWidth: 4,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
  },
  matchCardIcon: {
    marginTop: 1,
  },
  matchCardText: {
    flex: 1,
    fontFamily: Fonts.headline,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Note Section ──
  noteSection: {
    gap: 6,
  },
  noteSectionLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 2,
  },

  // ── Review Info ──
  reviewInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.info + '10',
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.info + '20',
  },
  reviewInfoText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.info,
    lineHeight: 19,
  },

  // ── Actions Block ──
  actionsBlock: {
    gap: 4,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  backLinkText: {
    fontFamily: Fonts.title,
    fontSize: 14,
    color: Colors.primary,
  },

  // ── Status Screens ──
  statusBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusBannerPending: {
    backgroundColor: '#7B5300',
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusBannerText: {
    flex: 1,
  },
  statusBannerLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  statusBannerTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  statusBody: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  statusDetailCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadow.card,
  },
  statusAccentBar: {
    width: 5,
    backgroundColor: Colors.statusPaid,
  },
  statusDetailInner: {
    flex: 1,
    padding: 20,
  },
  statusDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusDetailDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.outlineVariant + '60',
    marginHorizontal: 8,
  },
  statusDetailLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statusDetailValue: {
    fontFamily: Fonts.display,
    fontSize: 16,
    color: Colors.onSurface,
  },
  statusDetailUnit: {
    fontFamily: Fonts.label,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '30',
    ...Shadow.card,
  },
  statusInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusInfoTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    marginBottom: 4,
  },
  statusInfoText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  // ── Timeline Card (Pending) ──
  timelineCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    ...Shadow.card,
    gap: 0,
  },
  timelineTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    position: 'relative',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  timelineConnector: {
    position: 'absolute',
    left: 13,
    top: 28,
    width: 2,
    height: 28,
    backgroundColor: Colors.statusPaid + '40',
  },
  timelineConnectorDashed: {
    position: 'absolute',
    left: 13,
    top: 28,
    width: 2,
    height: 28,
    backgroundColor: Colors.outlineVariant,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineStepTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    marginBottom: 2,
  },
  timelineStepDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
