/**
 * LoginScreen.tsx — SCR-003-B v4.0
 * Connexion avec numéro de téléphone + PIN à 6 chiffres.
 * PIN oublié → BottomSheet → OTP envoyé par email → SCR-004-B (purpose=pin_reset)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  ScrollView, StatusBar, Modal, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Colors, Fonts, Radius } from '../../constants/colors';
import * as authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

const APP_VERSION = '1.0.0';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

// ── Logo géométrique SVG-style ────────────────────────────────────────────────
function BrandMark({ size = 64 }: { size?: number }) {
  const thick = size * 0.065;
  const inner = size * 0.35;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Hexagone extérieur simulé par deux rectangles tournés */}
      <View style={{
        position: 'absolute',
        width: size * 0.72, height: size * 0.72,
        borderRadius: size * 0.18,
        borderWidth: thick,
        borderColor: 'rgba(255,255,255,0.9)',
        transform: [{ rotate: '15deg' }],
      }} />
      <View style={{
        position: 'absolute',
        width: size * 0.72, height: size * 0.72,
        borderRadius: size * 0.18,
        borderWidth: thick * 0.6,
        borderColor: 'rgba(255,255,255,0.3)',
        transform: [{ rotate: '60deg' }],
      }} />
      {/* C central */}
      <Text style={{
        fontFamily: Fonts.display,
        fontSize: size * 0.38,
        color: '#FFFFFF',
        lineHeight: size * 0.42,
        marginTop: 2,
      }}>C</Text>
    </View>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone]             = useState('');
  const [pin, setPin]                 = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lockTimer, setLockTimer]     = useState(0);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrPhone, setMigrPhone]     = useState('');
  const [migrOldPin, setMigrOldPin]   = useState('');
  const [migrNewPin, setMigrNewPin]   = useState('');
  const [migrConfirm, setMigrConfirm] = useState('');
  const [showMigrNew, setShowMigrNew] = useState(false);
  const [showMigrConf, setShowMigrConf] = useState(false);
  const [migrLoading, setMigrLoading] = useState(false);
  const [migrError, setMigrError]     = useState<string | null>(null);

  const setAuthData = useAuthStore(s => s.setAuthData);

  // ── Animations d'entrée ────────────────────────────────────────────────────
  const heroAnim  = useRef(new Animated.Value(0)).current;
  const formAnim  = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroAnim, {
          toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1, friction: 6, tension: 120, useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
      ]),
      Animated.timing(formAnim, {
        toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const heroTranslateY = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const formTranslateY = formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  // ── Countdown blocage ─────────────────────────────────────────────────────
  useEffect(() => {
    if (lockTimer <= 0) return;
    const interval = setInterval(() => {
      setLockTimer(prev => {
        if (prev <= 1) { setError(null); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockTimer]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Connexion ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    Keyboard.dismiss();
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ phone: '+243' + phone, pin });
      setAuthData(response);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.startsWith('INVALID_CREDENTIALS:')) {
        const remaining = msg.split(':')[1];
        setError(`PIN incorrect. Il vous reste ${remaining} tentative(s).`);
      } else if (msg.startsWith('ACCOUNT_LOCKED:')) {
        const minutes = parseInt(msg.split(':')[1] || '30', 10);
        setError(`Compte bloqué pendant ${minutes} minutes suite à trop de tentatives incorrectes.`);
        setLockTimer(minutes * 60);
      } else if (msg === 'USER_NOT_FOUND') {
        setError('Numéro non trouvé. Vérifiez ou inscrivez-vous.');
      } else if (msg === 'LEGACY_PIN_4_DIGITS') {
        setMigrPhone(phone);
        setMigrOldPin(pin);
        setMigrNewPin('');
        setMigrConfirm('');
        setMigrError(null);
        setShowMigrationModal(true);
      } else if (msg === 'LEGACY_ACCOUNT_NEEDS_PIN' || msg === 'LEGACY_ACCOUNT_NEEDS_MIGRATION') {
        setError("Ce compte n'a pas encore de PIN. Utilisez « PIN oublié » pour en définir un.");
      } else {
        setError(msg || 'Une erreur est survenue. Réessayez.');
      }
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Migration PIN 4 → 6 chiffres ─────────────────────────────────────────
  const handleMigration = async () => {
    setMigrError(null);
    if (migrNewPin.length !== 6) {
      setMigrError('Le nouveau PIN doit contenir exactement 6 chiffres.');
      return;
    }
    if (migrNewPin !== migrConfirm) {
      setMigrError('Les codes PIN ne correspondent pas.');
      return;
    }
    setMigrLoading(true);
    try {
      const response = await authService.migrateLegacyPin('+243' + migrPhone, migrOldPin, migrNewPin);
      setShowMigrationModal(false);
      setAuthData(response);
      Toast.show({ type: 'success', text1: 'PIN mis à jour !', text2: 'Votre compte utilise maintenant un PIN à 6 chiffres.' });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'INVALID_OLD_PIN') {
        setMigrError('Ancien PIN incorrect. Vérifiez et réessayez.');
      } else {
        setMigrError(msg || 'Erreur lors de la mise à jour. Réessayez.');
      }
    } finally {
      setMigrLoading(false);
    }
  };

  const isFormValid = phone.length === 9 && pin.length >= 4 && pin.length <= 6 && lockTimer === 0;

  // ── PIN oublié — envoi OTP email ─────────────────────────────────────────
  const handleForgotPIN = async () => {
    setForgotError(null);
    if (!/^[0-9]{9}$/.test(forgotPhone)) {
      setForgotError('Numéro invalide (9 chiffres requis après +243)');
      return;
    }
    setForgotLoading(true);
    try {
      await authService.requestPinReset('+243' + forgotPhone);
      setShowForgotModal(false);
      setForgotPhone('');
      Toast.show({ type: 'success', text1: 'Code envoyé !', text2: 'Vérifiez votre boîte mail.' });
      navigation.navigate('OTP', {
        phone: '+243' + forgotPhone,
        email: '***@***.***',
        purpose: 'pin_reset',
      });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'USER_NOT_FOUND') {
        setForgotError('Aucun compte associé à ce numéro.');
      } else if (msg.startsWith('RATE_LIMIT:')) {
        const secs = msg.split(':')[1];
        setForgotError(`Réessayez dans ${secs} secondes.`);
      } else {
        setForgotError(msg || "Impossible d'envoyer le code. Réessayez.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => { if (!showForgotModal) Keyboard.dismiss(); }} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

        {/* ── Zone héro ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.topSection, { opacity: heroAnim, transform: [{ translateY: heroTranslateY }] }]}>
          {/* Décoration géométrique d'arrière-plan */}
          <View style={styles.bgCircle1} />
          <View style={styles.bgCircle2} />

          <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
            <BrandMark size={72} />
          </Animated.View>

          <Text style={styles.appName}>ContribApp</Text>
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>Connectez-vous avec votre numéro et votre PIN</Text>
        </Animated.View>

        {/* ── Formulaire ────────────────────────────────────────────── */}
        <KeyboardAvoidingView
          style={styles.formWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[{ flex: 1 }, { opacity: formAnim, transform: [{ translateY: formTranslateY }] }]}>
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Pill indicateur */}
              <View style={styles.sheetPill} />

              <AppInput
                label="Numéro de téléphone"
                subLabel="Votre identifiant de connexion"
                subLabelColor={Colors.primary}
                prefix="+243"
                placeholder="97X XXX XXX"
                value={phone}
                onChangeText={v => { setPhone(v.replace(/\D/g, '')); setError(null); }}
                keyboardType="phone-pad"
                maxLength={9}
                autoFocus={!phone}
              />

              <AppInput
                label="Code PIN"
                placeholder="••••••"
                value={pin}
                onChangeText={v => { setPin(v.replace(/\D/g, '')); setError(null); }}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={6}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                    <Text style={styles.togglePin}>{showPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              {error && (
                <View style={styles.errorBox}>
                  <View style={styles.errorBar} />
                  <View style={styles.errorContent}>
                    <Text style={styles.errorBoxText}>{error}</Text>
                    {lockTimer > 0 && (
                      <>
                        <Text style={styles.timerText}>
                          Déblocage dans{' '}
                          <Text style={styles.timerBold}>{formatTimer(lockTimer)}</Text>
                        </Text>
                        <TouchableOpacity
                          style={{ marginTop: 8 }}
                          onPress={() => { setShowForgotModal(true); setForgotPhone(phone); }}
                        >
                          <Text style={styles.resetPinLink}>Réinitialiser mon PIN →</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}

              <AppButton
                title="Se connecter"
                onPress={handleLogin}
                disabled={!isFormValid}
                loading={isLoading}
                loadingText="Connexion en cours..."
                style={styles.loginButton}
              />

              <TouchableOpacity
                style={styles.forgotPinLink}
                onPress={() => { setShowForgotModal(true); setForgotPhone(phone); }}
              >
                <Text style={styles.forgotPinText}>PIN oublié ?</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerBtnText}>Créer un compte</Text>
              </TouchableOpacity>

              <Text style={styles.version}>ContribApp RDC v{APP_VERSION}</Text>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>

        {/* ── BottomSheet — PIN oublié ───────────────────────────────── */}
        <Modal visible={showForgotModal} transparent animationType="slide" onRequestClose={() => setShowForgotModal(false)}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowForgotModal(false); }}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.bottomSheet}>
                <View style={styles.bottomSheetHandle} />
                <Text style={styles.bottomSheetTitle}>Réinitialiser le PIN</Text>
                <Text style={styles.bottomSheetSubtitle}>
                  Entrez votre numéro de téléphone. Vous recevrez un code par email.
                </Text>

                <AppInput
                  label="Votre numéro de téléphone"
                  prefix="+243"
                  placeholder="97X XXX XXX"
                  value={forgotPhone}
                  onChangeText={v => { setForgotPhone(v.replace(/\D/g, '')); setForgotError(null); }}
                  keyboardType="phone-pad"
                  maxLength={9}
                  autoFocus
                />

                {forgotError && <Text style={styles.forgotErrorText}>{forgotError}</Text>}

                <AppButton
                  title="Recevoir le code par email"
                  onPress={handleForgotPIN}
                  loading={forgotLoading}
                  disabled={forgotPhone.length !== 9 || forgotLoading}
                  style={{ marginTop: 16 }}
                />

                <TouchableOpacity style={styles.cancelButton} onPress={() => { Keyboard.dismiss(); setShowForgotModal(false); setForgotError(null); }}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Modal migration PIN 4 → 6 chiffres ────────────────────── */}
        <Modal visible={showMigrationModal} transparent animationType="slide" onRequestClose={() => setShowMigrationModal(false)}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowMigrationModal(false); }}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.bottomSheet}>
                <View style={styles.bottomSheetHandle} />
                <Text style={styles.bottomSheetTitle}>Mise à jour du PIN requise</Text>
                <Text style={styles.bottomSheetSubtitle}>
                  Votre compte utilise un ancien PIN à 4 chiffres. Pour votre sécurité, choisissez un nouveau PIN à 6 chiffres.
                </Text>

                <AppInput
                  label="Nouveau PIN à 6 chiffres"
                  placeholder="••••••"
                  value={migrNewPin}
                  onChangeText={v => { setMigrNewPin(v.replace(/\D/g, '')); setMigrError(null); }}
                  secureTextEntry={!showMigrNew}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowMigrNew(!showMigrNew)}>
                      <Text style={styles.togglePin}>{showMigrNew ? 'Cacher' : 'Voir'}</Text>
                    </TouchableOpacity>
                  }
                />

                <AppInput
                  label="Confirmer le nouveau PIN"
                  placeholder="••••••"
                  value={migrConfirm}
                  onChangeText={v => { setMigrConfirm(v.replace(/\D/g, '')); setMigrError(null); }}
                  secureTextEntry={!showMigrConf}
                  keyboardType="numeric"
                  maxLength={6}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowMigrConf(!showMigrConf)}>
                      <Text style={styles.togglePin}>{showMigrConf ? 'Cacher' : 'Voir'}</Text>
                    </TouchableOpacity>
                  }
                />

                {migrError && <Text style={styles.forgotErrorText}>{migrError}</Text>}

                <AppButton
                  title="Mettre à jour mon PIN"
                  onPress={handleMigration}
                  loading={migrLoading}
                  disabled={migrNewPin.length !== 6 || migrConfirm.length !== 6 || migrLoading}
                  style={{ marginTop: 16 }}
                />

                <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowMigrationModal(false); setMigrError(null); }}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },

  // ── Héro ────────────────────────────────────────────────────
  topSection: {
    flex: 0.42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -80, right: -60,
  },
  bgCircle2: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.03)',
    bottom: 10, left: -50,
  },
  logoWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  appName: {
    fontFamily: Fonts.label,
    fontSize: 11, color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3.5, textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.display,
    color: '#FFFFFF', fontSize: 28,
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.body,
    color: 'rgba(255,255,255,0.65)', fontSize: 14,
    marginTop: 8, textAlign: 'center', lineHeight: 21,
  },

  // ── Formulaire ──────────────────────────────────────────────
  formWrapper: {
    flex: 0.58,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  formContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 40 },
  sheetPill: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginBottom: 24,
  },

  togglePin: {
    fontFamily: Fonts.title,
    color: Colors.primary, fontSize: 13,
  },

  // ── Erreur ──────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.lg,
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorBar: {
    width: 4, backgroundColor: Colors.error,
  },
  errorContent: { flex: 1, padding: 14 },
  errorBoxText: {
    fontFamily: Fonts.headline,
    color: Colors.onErrorContainer, fontSize: 13, marginBottom: 2,
  },
  timerText: {
    fontFamily: Fonts.body,
    color: Colors.error, fontSize: 13, marginTop: 4,
  },
  timerBold: { fontFamily: Fonts.headline },
  resetPinLink: {
    fontFamily: Fonts.headline,
    color: Colors.error, fontSize: 13,
  },

  loginButton: { marginTop: 8 },

  forgotPinLink: { marginTop: 18, alignItems: 'center' },
  forgotPinText: {
    fontFamily: Fonts.title,
    color: Colors.danger, fontSize: 14,
  },

  // ── Divider + bouton secondaire ──────────────────────────────
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 20, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.outlineVariant },
  dividerText: {
    fontFamily: Fonts.body,
    color: Colors.textMuted, fontSize: 13,
  },
  registerBtn: {
    height: 52, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  registerBtnText: {
    fontFamily: Fonts.headline,
    color: Colors.primary, fontSize: 15,
  },

  version: {
    fontFamily: Fonts.body,
    color: Colors.textMuted, fontSize: 11,
    textAlign: 'center', marginTop: 28,
  },

  // ── Modal ────────────────────────────────────────────────────
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7,30,39,0.5)',
  },
  modalKeyboardWrapper: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  bottomSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginBottom: 22,
  },
  bottomSheetTitle: {
    fontFamily: Fonts.display,
    fontSize: 20, color: Colors.textPrimary, marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20,
  },
  forgotErrorText: {
    fontFamily: Fonts.body,
    color: Colors.danger, fontSize: 13, marginTop: 4, marginBottom: 8,
  },
  cancelButton: { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  cancelText: {
    fontFamily: Fonts.title,
    color: Colors.textSecondary, fontSize: 15,
  },
});
