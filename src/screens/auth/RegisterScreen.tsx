/**
 * RegisterScreen.tsx — v4.1 Onboarding multi-étapes
 * Fix clavier : hero animé (collapse), card flex:1, KAV racine.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import * as authService from '../../services/authService';
import { MobileOperator } from '../../services/authService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PREFIXES = ['81','82','83','84','85','89','90','91','97','98','99'];

const STEPS = [
  {
    icon: 'account-outline' as const,
    label: 'Identité',
    title: 'Qui êtes-vous ?',
    subtitle: 'Votre nom, numéro et opérateur Mobile Money.',
  },
  {
    icon: 'email-outline' as const,
    label: 'Email',
    title: 'Votre adresse email',
    subtitle: 'Uniquement pour recevoir vos codes de vérification.',
  },
  {
    icon: 'lock-outline' as const,
    label: 'PIN',
    title: 'Code secret PIN',
    subtitle: 'Choisissez un PIN à 6 chiffres. Ne le partagez jamais.',
  },
] as const;

// Hauteurs du hero (hors insets.top)
const TOPBAR_H  = 64;
const HERO_BODY_H = 168;

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [step, setStep]               = useState(0);
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [operator, setOperator]       = useState<MobileOperator | null>(null);
  const [email, setEmail]             = useState('');
  const [pin, setPin]                 = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [isLoading, setIsLoading]     = useState(false);

  // ── Animation slide/fade entre étapes ──────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  // ── Animation collapse du hero quand clavier visible ───────────────────
  const kbAnim = useRef(new Animated.Value(0)).current; // 0=fermé 1=ouvert

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const dur  = Platform.OS === 'ios' ? 270 : 180;

    const s1 = Keyboard.addListener(show, () =>
      Animated.timing(kbAnim, { toValue: 1, duration: dur, useNativeDriver: false }).start()
    );
    const s2 = Keyboard.addListener(hide, () =>
      Animated.timing(kbAnim, { toValue: 0, duration: dur, useNativeDriver: false }).start()
    );
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // Hero height : plein → compact (topbar seulement)
  const heroH = kbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TOPBAR_H + HERO_BODY_H + insets.top, TOPBAR_H + insets.top],
  });
  // Corps du hero (icône + textes) : fade out quand clavier
  const bodyOpacity = kbAnim.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const bodyTranslateY = kbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });

  // ── Transition entre étapes ─────────────────────────────────────────────
  const transitionTo = (nextStep: number) => {
    const dir = nextStep > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -28 * dir, duration: 160, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,          duration: 160, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(28 * dir);
      setStep(nextStep);
      setErrors({});
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const validateStep = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (fullName.trim().length < 3) e.fullName = 'Minimum 3 caractères';
      if (!/^[0-9]{9}$/.test(phone))  e.phone = '9 chiffres requis après +243';
      else if (!PHONE_PREFIXES.some(p => phone.startsWith(p))) e.phone = 'Préfixe non reconnu';
      if (!operator)                   e.operator = 'Sélectionnez votre opérateur';
    } else if (step === 1) {
      if (!EMAIL_REGEX.test(email))    e.email = 'Adresse email invalide';
    } else {
      if (pin.length !== 6)            e.pin = 'Le PIN doit contenir exactement 6 chiffres';
      if (pin !== confirmPin)          e.confirmPin = 'Les codes PIN ne correspondent pas';
    }
    return e;
  };

  const isStepValid = () => Object.keys(validateStep()).length === 0;

  // ── Soumission ──────────────────────────────────────────────────────────
  const handleNext = async () => {
    Keyboard.dismiss();
    const errs = validateStep();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (step < 2) { transitionTo(step + 1); return; }

    setIsLoading(true);
    try {
      await authService.register({
        fullName: fullName.trim(),
        phone: '+243' + phone,
        email: email.trim(),
        operator: operator!,
        pin,
      });
      Toast.show({ type: 'success', text1: 'Code envoyé !', text2: `Vérifiez votre boîte mail : ${email.trim()}` });
      navigation.navigate('OTP', {
        phone: '+243' + phone,
        email: email.trim(),
        purpose: 'registration',
        fullName: fullName.trim(),
      });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'PHONE_ALREADY_EXISTS') {
        transitionTo(0); setErrors({ phone: 'Ce numéro est déjà inscrit.' });
      } else if (msg === 'EMAIL_ALREADY_EXISTS') {
        transitionTo(1); setErrors({ email: 'Cet email est déjà utilisé.' });
      } else if (msg.startsWith('RATE_LIMIT:')) {
        Toast.show({ type: 'error', text1: 'Trop rapide', text2: `Réessayez dans ${msg.split(':')[1]} secondes` });
      } else if (msg.startsWith('EMAIL_SEND_FAILED') || msg === 'INVALID_EMAIL') {
        transitionTo(1);
        Toast.show({ type: 'error', text1: "Échec d'envoi email", text2: msg.length > 20 ? msg.slice(0, 80) : "Vérifiez votre email ou réessayez." });
      } else if (msg === 'EMAILJS_QUOTA_EXCEEDED') {
        Toast.show({ type: 'error', text1: 'Service indisponible', text2: 'Quota email atteint. Réessayez plus tard.' });
      } else if (msg === 'EMAILJS_NOT_CONFIGURED') {
        Toast.show({ type: 'error', text1: 'Config manquante', text2: 'EmailJS non configuré. Vérifiez les variables .env.' });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur', text2: msg || 'Erreur réseau. Réessayez.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 0) { navigation.navigate('Login'); return; }
    transitionTo(step - 1);
  };

  const current = STEPS[step];

  return (
    // KAV à la racine — gère le push global sur iOS
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── HERO (hauteur animée) ──────────────────────────────────────── */}
      <Animated.View style={[s.hero, { height: heroH }]}>

        {/* Top bar — toujours visible */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.onPrimary} />
          </TouchableOpacity>

          <View style={s.progressRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.progressSeg,
                  i < step   && s.progressDone,
                  i === step && s.progressActive,
                ]}
              />
            ))}
          </View>

          <Text style={s.stepCount}>{step + 1}/{STEPS.length}</Text>
        </View>

        {/* Corps du hero — disparaît avec le clavier */}
        <Animated.View
          style={[
            s.heroBody,
            { opacity: bodyOpacity, transform: [{ translateY: bodyTranslateY }] },
          ]}
          pointerEvents="none"
        >
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name={current.icon} size={30} color={Colors.onPrimary} />
          </View>
          <Text style={s.heroLabel}>{current.label}</Text>
          <Text style={s.heroTitle}>{current.title}</Text>
          <Text style={s.heroSub}>{current.subtitle}</Text>
        </Animated.View>
      </Animated.View>

      {/* ── CARTE FORMULAIRE (flex:1 — prend tout l'espace restant) ──── */}
      <View style={s.card}>

        {/* Contenu scrollable */}
        <Animated.View style={[s.scrollWrapper, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          <ScrollView
            contentContainerStyle={s.cardScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Étape 0 : Identité ──────────────────────────────── */}
            {step === 0 && (
              <>
                <AppInput
                  label="Nom complet *"
                  placeholder="Ex : Jean-Pierre Kabila"
                  value={fullName}
                  onChangeText={v => { setFullName(v); setErrors(e => ({ ...e, fullName: '' })); }}
                  error={errors.fullName}
                  autoFocus
                />
                <AppInput
                  label="Numéro de téléphone *"
                  subLabel="Ce numéro sera votre identifiant de connexion"
                  subLabelColor={Colors.primary}
                  prefix="+243"
                  placeholder="97X XXX XXX"
                  value={phone}
                  onChangeText={v => { setPhone(v.replace(/\D/g, '')); setErrors(e => ({ ...e, phone: '' })); }}
                  keyboardType="phone-pad"
                  maxLength={9}
                  error={errors.phone}
                />
                <Text style={s.fieldLabel}>Opérateur Mobile Money *</Text>
                <Text style={s.fieldSub}>Pour recevoir et envoyer vos contributions</Text>
                <OperatorSelector
                  value={operator}
                  onChange={v => { setOperator(v); setErrors(e => ({ ...e, operator: '' })); }}
                />
                {errors.operator ? <Text style={s.errorText}>{errors.operator}</Text> : null}
              </>
            )}

            {/* ── Étape 1 : Email ─────────────────────────────────── */}
            {step === 1 && (
              <>
                <View style={s.infoBox}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.tertiary} />
                  <Text style={s.infoText}>
                    Votre email reste confidentiel — aucun autre membre ne le verra.
                  </Text>
                </View>
                <AppInput
                  label="Adresse email *"
                  placeholder="exemple@gmail.com"
                  value={email}
                  onChangeText={v => { setEmail(v.trim()); setErrors(e => ({ ...e, email: '' })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  error={errors.email}
                />
                <View style={s.checkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                  <Text style={s.checkText}>Code de vérification à la création du compte</Text>
                </View>
                <View style={s.checkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                  <Text style={s.checkText}>Réinitialisation du PIN si oublié</Text>
                </View>
              </>
            )}

            {/* ── Étape 2 : PIN ───────────────────────────────────── */}
            {step === 2 && (
              <>
                <View style={[s.infoBox, s.infoBoxGreen]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.secondary} />
                  <Text style={s.infoText}>
                    Votre PIN est chiffré et jamais transmis en clair.
                  </Text>
                </View>

                <AppInput
                  label="Code PIN à 6 chiffres *"
                  placeholder="••••••"
                  value={pin}
                  onChangeText={v => { setPin(v.replace(/\D/g, '')); setErrors(e => ({ ...e, pin: '' })); }}
                  secureTextEntry={!showPin}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                  error={errors.pin}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPin(p => !p)}>
                      <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  }
                />

                {/* Indicateur de progression PIN */}
                <View style={s.pinMeter}>
                  {[0,1,2,3,4,5].map(i => (
                    <View
                      key={i}
                      style={[
                        s.pinDot,
                        i < pin.length && s.pinDotFilled,
                        pin.length === 6 && s.pinDotComplete,
                      ]}
                    />
                  ))}
                </View>

                <AppInput
                  label="Confirmer le code PIN *"
                  placeholder="••••••"
                  value={confirmPin}
                  onChangeText={v => { setConfirmPin(v.replace(/\D/g, '')); setErrors(e => ({ ...e, confirmPin: '' })); }}
                  secureTextEntry={!showConfirm}
                  keyboardType="numeric"
                  maxLength={6}
                  error={errors.confirmPin}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowConfirm(p => !p)}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  }
                />

                {pin.length === 6 && confirmPin.length === 6 && pin === confirmPin && (
                  <View style={s.matchBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
                    <Text style={s.matchText}>Les deux codes correspondent</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>

        {/* ── CTA épinglé en bas ───────────────────────────────────── */}
        <View style={[s.ctaArea, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <AppButton
            title={step < 2 ? 'Continuer' : 'Créer mon compte'}
            onPress={handleNext}
            disabled={!isStepValid() || isLoading}
            loading={isLoading}
            loadingText={step < 2 ? 'Vérification...' : 'Création en cours...'}
          />
          {step === 0 && (
            <TouchableOpacity style={s.loginLink} onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLinkText}>
                Déjà un compte ?{' '}
                <Text style={s.loginLinkBold}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // ── Hero ───────────────────────────────────────────────────────────────
  hero: {
    overflow: 'hidden',
    backgroundColor: Colors.primary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressDone: {
    backgroundColor: Colors.primaryFixed,
  },
  progressActive: {
    backgroundColor: Colors.onPrimary,
  },
  stepCount: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    minWidth: 28,
    textAlign: 'right',
  },
  heroBody: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroLabel: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: Colors.primaryFixed,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.onPrimary,
    marginBottom: 6,
    lineHeight: 30,
  },
  heroSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 18,
  },

  // ── Carte formulaire ────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...Shadow.fab,
  },
  scrollWrapper: {
    flex: 1,
  },
  cardScroll: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 12,
  },

  // ── Champs spéciaux ─────────────────────────────────────────────────────
  fieldLabel: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  fieldSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  errorText: {
    fontFamily: Fonts.body,
    color: Colors.danger,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },

  // ── Info box ────────────────────────────────────────────────────────────
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '50',
  },
  infoBoxGreen: {
    backgroundColor: Colors.secondaryContainer + '30',
    borderColor: Colors.secondary + '30',
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },

  // ── Checks ──────────────────────────────────────────────────────────────
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  checkText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // ── PIN meter ───────────────────────────────────────────────────────────
  pinMeter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -8,
    marginBottom: 18,
  },
  pinDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
  },
  pinDotFilled: {
    backgroundColor: Colors.primaryContainer,
  },
  pinDotComplete: {
    backgroundColor: Colors.secondary,
  },

  // ── Match badge ──────────────────────────────────────────────────────────
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 8,
  },
  matchText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.secondary,
  },

  // ── CTA ──────────────────────────────────────────────────────────────────
  ctaArea: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant + '30',
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLinkBold: {
    fontFamily: Fonts.headline,
    color: Colors.primary,
  },
});
