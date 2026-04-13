/**
 * SCR-010 — Payer ma Contribution
 * PayContributionScreen.tsx
 *
 * Rôle : Membre uniquement
 * 3 étapes : Opérateur → Confirmation → Validation opérateur
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, {
    useCallback, useEffect, useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';

import { AppInput } from '../../components/common/AppInput';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import { OperatorInstructionBlock } from '../../components/payment/OperatorInstructionBlock';
import { PaymentStepIndicator } from '../../components/payment/PaymentStepIndicator';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OPERATORS } from '../../constants/operators';
import {
    checkCurrentMonthStatus,
    initiatePayment,
    pollTransactionStatus,
    type CurrentMonthStatus,
    type TxStatus,
} from '../../services/contributionService';
import * as db from '../../services/database';
import { useAuthStore } from '../../stores/authStore';

// ─── Types ───────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type Operator = 'airtel' | 'orange' | 'mpesa' | 'mtn';

interface Props {
  navigation: any;
  route?: { params?: { amount?: number; includePenalty?: boolean } };
}

// ─── Helpers ─────────────────────────────────────────────────

const PHONE_PATTERNS: Record<Operator, RegExp[]> = {
  airtel: [/^\+24397/, /^\+24398/],
  orange: [/^\+24389/, /^\+24384/],
  mpesa:  [/^\+24381/, /^\+24382/, /^\+24383/],
  mtn:    [/^\+24390/, /^\+24391/],
};

function validatePhone(phone: string, operator: Operator | null): string | null {
  if (!phone.trim()) return 'Numéro requis';
  if (!operator)     return null;
  const patterns = PHONE_PATTERNS[operator];
  const isValid  = patterns.some(p => p.test(phone.replace(/\s/g, '')));
  return isValid ? null : `Format invalide pour ${operator.toUpperCase()}`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ─── Étape 1 ─────────────────────────────────────────────────

interface Step1Props {
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  includePenalty: boolean;
  selectedOperator: Operator | null;
  onSelectOperator: (op: Operator) => void;
  payerPhone: string;
  onChangePhone: (v: string) => void;
  phoneError: string | null;
  treasurerName: string;
  treasurerOperator: string;
  onContinue: () => void;
  canContinue: boolean;
}

function Step1Content({
  baseAmount, penaltyAmount, totalAmount, includePenalty,
  selectedOperator, onSelectOperator,
  payerPhone, onChangePhone, phoneError,
  treasurerName, treasurerOperator,
  onContinue, canContinue,
}: Step1Props) {
  return (
    <ScrollView
      contentContainerStyle={s.stepScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Carte montant */}
      <View style={[s.amountCard, includePenalty && s.amountCardLate]}>
        {includePenalty ? (
          <>
            <View style={s.amountRow}>
              <Text style={s.amountRowLabel}>Montant de base</Text>
              <Text style={s.amountRowValue}>{baseAmount.toLocaleString('fr-FR')} CDF</Text>
            </View>
            <View style={s.amountRow}>
              <View style={s.amountPenaltyLabel}>
                <MaterialCommunityIcons name="alert" size={12} color={Colors.error} />
                <Text style={[s.amountRowLabel, { color: Colors.error }]}>Pénalité de retard</Text>
              </View>
              <Text style={[s.amountRowValue, { color: Colors.error }]}>
                +{penaltyAmount.toLocaleString('fr-FR')} CDF
              </Text>
            </View>
            <View style={s.amountDivider} />
            <Text style={s.amountTotalLabel}>TOTAL À PAYER</Text>
            <Text style={[s.amountTotal, { color: Colors.error }]}>
              {totalAmount.toLocaleString('fr-FR')} CDF
            </Text>
          </>
        ) : (
          <>
            <Text style={s.amountLabel}>MONTANT À PAYER</Text>
            <Text style={[s.amountTotal, { color: Colors.secondary }]}>
              {totalAmount.toLocaleString('fr-FR')} CDF
            </Text>
            <Text style={s.amountMonth}>{currentMonthLabel()}</Text>
          </>
        )}
      </View>

      {/* Sélecteur opérateur */}
      <Text style={s.sectionLabel}>Opérateur Mobile Money</Text>
      <OperatorSelector value={selectedOperator} onChange={onSelectOperator as any} />

      {/* Numéro de téléphone */}
      <View style={{ marginTop: 8 }}>
        <AppInput
          label="Numéro Mobile Money à débiter"
          value={payerPhone}
          onChangeText={onChangePhone}
          keyboardType="phone-pad"
          placeholder="+243 9X XXX XXXX"
          error={phoneError ?? undefined}
          autoCorrect={false}
        />
      </View>

      {/* Note bénéficiaire */}
      <View style={s.infoBox}>
        <MaterialCommunityIcons name="information-outline" size={16} color={Colors.tertiary} />
        <Text style={s.infoText}>
          Les fonds seront envoyés directement au compte de{' '}
          <Text style={s.infoBold}>{treasurerName}</Text>{' '}
          ({treasurerOperator})
        </Text>
      </View>

      {/* Bouton continuer */}
      <TouchableOpacity
        style={[s.primaryBtn, !canContinue && s.primaryBtnDisabled]}
        onPress={onContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        <Text style={s.primaryBtnText}>Continuer</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" />
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Étape 2 ─────────────────────────────────────────────────

interface Step2Props {
  baseAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  operator: Operator;
  payerPhone: string;
  treasurerName: string;
  treasurerOperator: string;
  checkboxChecked: boolean;
  onToggleCheckbox: () => void;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function Step2Content({
  baseAmount, penaltyAmount, totalAmount,
  operator, payerPhone,
  treasurerName, treasurerOperator,
  checkboxChecked, onToggleCheckbox,
  onConfirm, onBack, isSubmitting,
}: Step2Props) {
  const op = OPERATORS.find(o => o.id === operator);

  const rows: Array<{ label: string; value: string; isTotal?: boolean; isRed?: boolean }> = [
    { label: 'Montant', value: `${baseAmount.toLocaleString('fr-FR')} CDF` },
    { label: 'Opérateur', value: op?.name ?? operator },
    { label: 'Numéro débité', value: payerPhone },
    { label: 'Bénéficiaire', value: `${treasurerName} — ${treasurerOperator}` },
    { label: 'Mois concerné', value: currentMonthLabel() },
    ...(penaltyAmount > 0
      ? [{ label: 'Pénalité', value: `+${penaltyAmount.toLocaleString('fr-FR')} CDF`, isRed: true }]
      : []),
    { label: 'TOTAL', value: `${totalAmount.toLocaleString('fr-FR')} CDF`, isTotal: true },
  ];

  return (
    <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={s.step2Title}>Récapitulez votre paiement</Text>

      {/* Tableau récap */}
      <View style={s.summaryTable}>
        {rows.map((row, i) => (
          <View
            key={i}
            style={[
              s.summaryRow,
              row.isTotal && s.summaryRowTotal,
              i < rows.length - 1 && s.summaryRowBorder,
            ]}
          >
            <Text style={[s.summaryLabel, row.isTotal && s.summaryLabelTotal]}>
              {row.label}
            </Text>
            <Text style={[
              s.summaryValue,
              row.isTotal && s.summaryValueTotal,
              row.isRed  && { color: Colors.error },
            ]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Checkbox consentement */}
      <TouchableOpacity style={s.checkboxRow} onPress={onToggleCheckbox} activeOpacity={0.7}>
        <View style={[s.checkbox, checkboxChecked && s.checkboxChecked]}>
          {checkboxChecked && (
            <MaterialCommunityIcons name="check" size={14} color="#FFF" />
          )}
        </View>
        <Text style={s.checkboxText}>
          Je confirme que ces informations sont correctes et j'autorise ce débit.
        </Text>
      </TouchableOpacity>

      {/* Bouton confirmer */}
      <TouchableOpacity
        style={[s.primaryBtn, s.primaryBtnLarge, (!checkboxChecked || isSubmitting) && s.primaryBtnDisabled]}
        onPress={onConfirm}
        disabled={!checkboxChecked || isSubmitting}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="lock" size={16} color="#FFF" />
            <Text style={s.primaryBtnText}>CONFIRMER ET PAYER</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Lien retour */}
      <TouchableOpacity style={s.backLink} onPress={onBack}>
        <MaterialCommunityIcons name="arrow-left" size={14} color={Colors.primary} />
        <Text style={s.backLinkText}>Modifier</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Étape 3 ─────────────────────────────────────────────────

interface Step3Props {
  operator: Operator;
  txStatus: TxStatus | null;
  errorMessage?: string;
  onRetry: () => void;
  navigation: any;
}

function Step3Content({ operator, txStatus, errorMessage, onRetry, navigation }: Step3Props) {
  if (txStatus === 'failed') {
    return (
      <View style={s.resultBlock}>
        <View style={[s.resultIcon, { backgroundColor: Colors.errorContainer }]}>
          <MaterialCommunityIcons name="close-circle" size={52} color={Colors.error} />
        </View>
        <Text style={s.resultTitle}>Paiement échoué</Text>
        <Text style={s.resultMsg}>
          {errorMessage ?? 'Une erreur est survenue lors du traitement de votre paiement.'}
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={onRetry} activeOpacity={0.85}>
          <MaterialCommunityIcons name="refresh" size={16} color="#FFF" />
          <Text style={s.primaryBtnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.outlineBtn} onPress={() => navigation.navigate('Accueil')} activeOpacity={0.8}>
          <Text style={s.outlineBtnText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (txStatus === 'timeout') {
    return (
      <View style={s.resultBlock}>
        <View style={[s.resultIcon, { backgroundColor: '#FFF3E0' }]}>
          <MaterialCommunityIcons name="clock-outline" size={52} color={Colors.warning} />
        </View>
        <Text style={s.resultTitle}>La confirmation prend du temps.</Text>
        <Text style={s.resultMsg}>
          Votre requête est peut-être en cours de traitement. Vérifiez dans "Historique" si la
          transaction a été traitée avant de réessayer.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('Historique')} activeOpacity={0.85}>
          <MaterialCommunityIcons name="history" size={16} color="#FFF" />
          <Text style={s.primaryBtnText}>Vérifier mon historique</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.outlineBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={s.outlineBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Status pending — attente confirmation
  return (
    <View style={s.pendingBlock}>
      <OperatorInstructionBlock operator={operator} timerSeconds={120} onRetry={onRetry} />
      <View style={s.pendingStatus}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={s.pendingStatusText}>
          En attente de confirmation de {OPERATORS.find(o => o.id === operator)?.name ?? operator}…
        </Text>
      </View>
    </View>
  );
}

// ─── Écran principal ─────────────────────────────────────────

export default function PayContributionScreen({ navigation, route }: Props) {
  const user   = useAuthStore(s => s.user);
  const group  = db.getGroupForMember(user?.id ?? '');

  // Paramètres optionnels de navigation
  const navAmount        = route?.params?.amount ?? group?.monthly_amount ?? 0;
  const navIncludePenalty = route?.params?.includePenalty ?? false;
  const penaltyAmount    = navIncludePenalty ? (group?.penalty_amount ?? 0) : 0;
  const totalAmount      = navAmount + penaltyAmount;

  // ── États ──
  const [checkStatus,      setCheckStatus]      = useState<CurrentMonthStatus | null>(null);
  const [checkLoading,     setCheckLoading]      = useState(true);
  const [isOffline,        setIsOffline]         = useState(false);

  const [currentStep,      setCurrentStep]       = useState<Step>(1);
  const [selectedOperator, setSelectedOperator]  = useState<Operator | null>(null);
  const [payerPhone,       setPayerPhone]        = useState(user?.phone ?? '');
  const [phoneError,       setPhoneError]        = useState<string | null>(null);
  const [checkboxChecked,  setCheckboxChecked]   = useState(false);
  const [showCancelModal,  setShowCancelModal]   = useState(false);
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  const [txId,      setTxId]      = useState<string | null>(null);
  const [txStatus,  setTxStatus]  = useState<TxStatus | null>(null);
  const [txError,   setTxError]   = useState<string | undefined>(undefined);

  // Anti double-tap : timestamp du dernier déclenchement
  const lastSubmitRef  = useRef<number>(0);
  // Ref intervalle polling — jamais deux en même temps
  const pollingRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timeout 120s
  const timeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Réseau ──
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOffline(!(s.isConnected ?? true)));
    return unsub;
  }, []);

  // ── Vérification initiale (déjà payé ?) ──
  useEffect(() => {
    async function check() {
      if (!group?.id || !user?.id) { setCheckLoading(false); return; }
      try {
        const result = await checkCurrentMonthStatus(group.id, user.id);
        setCheckStatus(result);
      } catch {
        // En cas d'erreur réseau, on laisse passer (offline géré séparément)
      } finally {
        setCheckLoading(false);
      }
    }
    check();
  }, [group?.id, user?.id]);

  // ── Cleanup polling ──
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── Validation téléphone ──
  const handlePhoneChange = (val: string) => {
    setPayerPhone(val);
    setPhoneError(validatePhone(val, selectedOperator));
  };
  const handleSelectOperator = (op: Operator) => {
    setSelectedOperator(op);
    setPhoneError(validatePhone(payerPhone, op));
  };

  const canContinueStep1 = selectedOperator !== null && payerPhone.trim().length > 5 && !phoneError;

  // ── Bouton retour ──
  const handleBack = () => {
    if (currentStep === 3) return; // désactivé pendant la validation
    if (currentStep === 1 || currentStep === 2) {
      setShowCancelModal(true);
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigation.goBack();
  };

  // ── Passage à l'étape 2 ──
  const handleContinueToStep2 = () => {
    const err = validatePhone(payerPhone, selectedOperator);
    if (err) { setPhoneError(err); return; }
    setCurrentStep(2);
  };

  // ── Paiement : initiation + polling ──
  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await pollTransactionStatus(id);
        if (res.status !== 'pending') {
          clearInterval(pollingRef.current!);
          clearTimeout(timeoutRef.current!);
          pollingRef.current  = null;
          setTxStatus(res.status);
          if (res.status === 'confirmed') {
            // Navigation replace → SCR-011
            navigation.replace('PaymentConfirm', { txId: id });
          } else {
            setTxError(res.errorMessage);
          }
        }
      } catch {
        // Ignorer erreurs de polling isolées
      }
    }, 5000);

    // Timeout 120s
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setTxStatus(s => s === 'pending' ? 'timeout' : s);
    }, 120 * 1000);
  }, [navigation]);

  const handleConfirm = useCallback(async () => {
    // Anti double-tap : 30 secondes minimum entre deux déclenchements
    const now = Date.now();
    if (now - lastSubmitRef.current < 30000) {
      Toast.show({ type: 'info', text1: 'Patientez', text2: 'Un paiement est déjà en cours.' });
      return;
    }
    lastSubmitRef.current = now;

    if (!selectedOperator || !group?.id || !user?.id) return;
    setIsSubmitting(true);
    setCurrentStep(3);
    setTxStatus('pending');

    try {
      const res = await initiatePayment({
        group_id:    group.id,
        member_id:   user.id,
        amount:      totalAmount,
        operator:    selectedOperator,
        payer_phone: payerPhone,
      });
      setTxId(res.txId);
      setIsSubmitting(false);
      startPolling(res.txId);
    } catch (err: any) {
      setIsSubmitting(false);
      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter = err.response?.headers?.['retry-after'] ?? '30';
        setCurrentStep(2);
        setTxStatus(null);
        Toast.show({
          type: 'error',
          text1: 'Trop de tentatives',
          text2: `Attendez ${retryAfter} secondes avant de réessayer.`,
        });
      } else {
        setCurrentStep(2);
        setTxStatus(null);
        Toast.show({
          type: 'error',
          text1: 'Erreur de connexion',
          text2: err?.response?.data?.message ?? 'Impossible de lancer le paiement.',
        });
      }
    }
  }, [selectedOperator, group?.id, user?.id, totalAmount, payerPhone, startPolling]);

  // ── Réessayer ──
  const handleRetry = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTxId(null);
    setTxStatus(null);
    setTxError(undefined);
    setIsSubmitting(false);
    setCheckboxChecked(false);
    lastSubmitRef.current = 0;
    setCurrentStep(1);
  };

  // ─── GARDE-FOUS ──────────────────────────────────────────

  // 1. Chargement vérification initiale
  if (checkLoading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // 2. Hors-ligne
  if (isOffline) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <MaterialCommunityIcons name="wifi-off" size={56} color={Colors.outlineVariant} />
        <Text style={s.gatekeeperTitle}>Connexion requise</Text>
        <Text style={s.gatekeeperSub}>
          Paiement impossible sans connexion internet. Veuillez vous connecter puis réessayer.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={s.primaryBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Déjà payé ce mois
  if (checkStatus?.alreadyPaid) {
    return (
      <View style={[s.container, { justifyContent: 'center', padding: 24 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
        <View style={s.alreadyPaidCard}>
          <MaterialCommunityIcons name="check-circle" size={64} color="#27AE60" />
          <Text style={s.alreadyPaidTitle}>Déjà payé !</Text>
          <Text style={s.alreadyPaidSub}>
            Vous avez déjà payé pour {currentMonthLabel()}.
          </Text>
          <Text style={s.alreadyPaidDetail}>
            Montant : {(checkStatus.amount ?? 0).toLocaleString('fr-FR')} CDF{' '}
            {checkStatus.paidAt
              ? `| Date : ${new Date(checkStatus.paidAt).toLocaleDateString('fr-FR')}`
              : ''}
          </Text>
          {checkStatus.txId && (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => navigation.navigate('Receipt', { txId: checkStatus.txId })}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={16} color="#FFF" />
              <Text style={s.primaryBtnText}>Voir mon reçu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.outlineBtn} onPress={() => navigation.navigate('Accueil')}>
            <Text style={s.outlineBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── RENDER PRINCIPAL ────────────────────────────────────

  const treasurerName    = group?.treasurer_name    ?? 'Trésorière';
  const treasurerOpName  = OPERATORS.find(o => o.id === group?.treasurer_operator)?.name
    ?? group?.treasurer_operator ?? 'Mobile Money';

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ════════ HEADER ════════ */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.backBtn, currentStep === 3 && s.backBtnDisabled]}
          onPress={handleBack}
          disabled={currentStep === 3}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={currentStep === 3 ? Colors.outlineVariant : Colors.onSurface}
          />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payer ma contribution</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={s.stepIndicatorWrap}>
        <PaymentStepIndicator
          currentStep={currentStep}
          steps={['Opérateur', 'Confirmation', 'Validation']}
        />
      </View>

      {/* ════════ CORPS SELON ÉTAPE ════════ */}
      {currentStep === 1 && (
        <Step1Content
          baseAmount={navAmount}
          penaltyAmount={penaltyAmount}
          totalAmount={totalAmount}
          includePenalty={navIncludePenalty}
          selectedOperator={selectedOperator}
          onSelectOperator={handleSelectOperator}
          payerPhone={payerPhone}
          onChangePhone={handlePhoneChange}
          phoneError={phoneError}
          treasurerName={treasurerName}
          treasurerOperator={treasurerOpName}
          onContinue={handleContinueToStep2}
          canContinue={canContinueStep1}
        />
      )}

      {currentStep === 2 && selectedOperator && (
        <Step2Content
          baseAmount={navAmount}
          penaltyAmount={penaltyAmount}
          totalAmount={totalAmount}
          operator={selectedOperator}
          payerPhone={payerPhone}
          treasurerName={treasurerName}
          treasurerOperator={treasurerOpName}
          checkboxChecked={checkboxChecked}
          onToggleCheckbox={() => setCheckboxChecked(v => !v)}
          onConfirm={handleConfirm}
          onBack={() => setCurrentStep(1)}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === 3 && selectedOperator && (
        <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false}>
          <Step3Content
            operator={selectedOperator}
            txStatus={txStatus}
            errorMessage={txError}
            onRetry={handleRetry}
            navigation={navigation}
          />
        </ScrollView>
      )}

      {/* ════════ MODAL ANNULATION ════════ */}
      {showCancelModal && (
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color={Colors.warning} style={{ marginBottom: 8 }} />
            <Text style={s.modalTitle}>Annuler le paiement ?</Text>
            <Text style={s.modalMsg}>
              Vos données saisies seront perdues. Voulez-vous quitter cet écran ?
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowCancelModal(false)}>
                <Text style={s.modalBtnCancelText}>Continuer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={confirmCancel}>
                <Text style={s.modalBtnConfirmText}>Oui, annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
    shadowColor: Colors.onSurface, shadowOpacity: 0.04,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  backBtnDisabled: { opacity: 0.4 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface,
  },

  // Step indicator wrapper
  stepIndicatorWrap: {
    paddingHorizontal: 24, paddingVertical: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '30',
  },

  // Scroll content
  stepScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // ─── Étape 1 ───────────────────────────────────────────────

  // Carte montant
  amountCard: {
    backgroundColor: Colors.secondaryContainer + '40',
    borderRadius: Radius.xl, padding: 20, marginBottom: 24,
    borderWidth: 1.5, borderColor: Colors.secondary + '40',
    alignItems: 'center',
  },
  amountCardLate: {
    backgroundColor: Colors.errorContainer + '30',
    borderColor: Colors.error + '50',
  },
  amountLabel: {
    fontFamily: Fonts.label, fontSize: 11, fontWeight: '700',
    color: Colors.secondary, letterSpacing: 1.2, marginBottom: 8,
  },
  amountTotal: {
    fontFamily: Fonts.display, fontSize: 36, letterSpacing: -1, marginBottom: 4,
  },
  amountMonth: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginBottom: 6,
  },
  amountRowLabel: { fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant },
  amountRowValue: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface },
  amountPenaltyLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountDivider: {
    width: '100%', height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant, marginVertical: 10,
  },
  amountTotalLabel: {
    fontFamily: Fonts.label, fontSize: 11, fontWeight: '700',
    color: Colors.error, letterSpacing: 1, marginBottom: 4,
  },

  sectionLabel: {
    fontFamily: Fonts.title, fontSize: 13, color: Colors.onSurfaceVariant,
    marginBottom: 10, letterSpacing: 0.3,
  },

  // Info box bénéficiaire
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg, padding: 14, marginBottom: 24, marginTop: 4,
  },
  infoText: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 18 },
  infoBold: { fontFamily: Fonts.title, color: Colors.onSurface },

  // ─── Étape 2 ───────────────────────────────────────────────

  step2Title: {
    fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface,
    textAlign: 'center', marginBottom: 20,
  },
  summaryTable: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, overflow: 'hidden',
    marginBottom: 20, ...Shadow.card,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
  },
  summaryRowTotal: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingVertical: 16,
  },
  summaryLabel: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, flex: 1 },
  summaryLabelTotal: { fontFamily: Fonts.headline, color: Colors.onSurface },
  summaryValue: { fontFamily: Fonts.title, fontSize: 13, color: Colors.onSurface, textAlign: 'right', flex: 1 },
  summaryValueTotal: { fontFamily: Fonts.display, fontSize: 18, color: Colors.secondary },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 4, marginBottom: 24,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: Radius.sm,
    borderWidth: 2, borderColor: Colors.outlineVariant,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxText: {
    flex: 1, fontFamily: Fonts.body, fontSize: 13,
    color: Colors.onSurfaceVariant, lineHeight: 18,
  },
  backLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 16,
  },
  backLinkText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },

  // ─── Étape 3 ───────────────────────────────────────────────

  pendingBlock: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  pendingStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg,
  },
  pendingStatusText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.onSurfaceVariant },

  // Blocs résultat (failed / timeout)
  resultBlock: {
    alignItems: 'center', gap: 16,
    paddingHorizontal: 8, paddingTop: 20,
  },
  resultIcon: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface, textAlign: 'center',
  },
  resultMsg: {
    fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant,
    textAlign: 'center', lineHeight: 20,
  },

  // ─── Boutons ───────────────────────────────────────────────

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 15, borderRadius: Radius.lg, gap: 8,
    shadowColor: Colors.primary, shadowOpacity: 0.22,
    shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
    width: '100%',
  },
  primaryBtnLarge: { paddingVertical: 18 },
  primaryBtnDisabled: { backgroundColor: Colors.surfaceContainerHigh, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { fontFamily: Fonts.headline, fontSize: 15, color: '#FFF' },

  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.outlineVariant,
    paddingVertical: 14, borderRadius: Radius.lg, width: '100%',
  },
  outlineBtnText: { fontFamily: Fonts.title, fontSize: 14, color: Colors.onSurfaceVariant },

  // ─── États gardiens ────────────────────────────────────────

  gatekeeperTitle: {
    fontFamily: Fonts.headline, fontSize: 20, color: Colors.onSurface,
    marginTop: 16, textAlign: 'center',
  },
  gatekeeperSub: {
    fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted,
    textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 20,
  },

  // Déjà payé
  alreadyPaidCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl, padding: 32,
    alignItems: 'center', gap: 12, ...Shadow.card,
    borderWidth: 1.5, borderColor: '#27AE60' + '40',
  },
  alreadyPaidTitle: {
    fontFamily: Fonts.display, fontSize: 26, color: '#1B5E20',
  },
  alreadyPaidSub: {
    fontFamily: Fonts.body, fontSize: 15, color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  alreadyPaidDetail: {
    fontFamily: Fonts.title, fontSize: 13, color: Colors.textMuted,
    textAlign: 'center',
  },

  // ─── Modal annulation ──────────────────────────────────────

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.55)',
    justifyContent: 'center', padding: 24,
  },
  modal: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl, padding: 28, alignItems: 'center', gap: 8,
  },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  modalMsg: {
    fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant,
    textAlign: 'center', lineHeight: 20, marginBottom: 8,
  },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center',
  },
  modalBtnCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant },
  modalBtnConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.error, alignItems: 'center',
  },
  modalBtnConfirmText: { fontFamily: Fonts.headline, color: '#FFF' },
});
