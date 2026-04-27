/**
 * OTPScreen.tsx — SCR-004-B v3.0
 * Vérification du code OTP reçu par EMAIL (plus par SMS).
 * 6 cases séparées, auto-focus, paste, timer 10min, shake sur erreur.
 *
 * Purposes :
 *  - 'registration' → appelle authService.verifyRegistrationOTP → crée le compte
 *  - 'pin_reset'    → appelle otpService.verifyOTP → navigue vers NewPINScreen
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  TouchableWithoutFeedback, Keyboard, ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import * as authService from '../../services/authService';
import * as otpService from '../../services/otpService';
import { useAuthStore } from '../../stores/authStore';

type OTPRouteProp  = RouteProp<AuthStackParamList, 'OTP'>;
type OTPNavProp    = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;

interface Props {
  route: OTPRouteProp;
  navigation: OTPNavProp;
}

const OTP_LENGTH = 6;
const OTP_TIMER_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN = 120;        // 2 minutes (rate limit otpService)

/** Masque un email : "jean@gmail.com" → "j***@gmail.com" */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return email[0] + '***' + email.slice(at);
}

export default function OTPScreen({ route, navigation }: Props) {
  const { phone, email, purpose, fullName } = route.params;

  const [otp, setOtp]               = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocused]  = useState(0);
  const [timer, setTimer]           = useState(OTP_TIMER_SECONDS);
  const [resendCooldown, setResend] = useState(0);
  const [isLoading, setLoading]     = useState(false);
  const [isResending, setResending] = useState(false);
  const [hasError, setHasError]     = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [isExpired, setExpired]     = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0.8)).current;

  const setAuthData = useAuthStore(s => s.setAuthData);

  // ── Animations ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Bounce de l'icône email au montage
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
    // Focus sur la première case
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Timer expiration OTP ──────────────────────────────────────────────────

  useEffect(() => {
    if (timer <= 0) { setExpired(true); return; }
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Cooldown renvoi ───────────────────────────────────────────────────────

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResend(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // ── Saisie OTP ────────────────────────────────────────────────────────────

  const handleChange = (text: string, index: number) => {
    // Gestion du paste (6 chiffres d'un coup)
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (digits.length === OTP_LENGTH) {
        const newOtp = digits.split('');
        setOtp(newOtp);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
        return;
      }
    }
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setHasError(false);
    setErrorMsg(null);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
    if (digit && index === OTP_LENGTH - 1) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newOtp = [...otp];
      if (!otp[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
        setFocused(index - 1);
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  // ── Vérification automatique quand les 6 cases sont remplies ─────────────

  useEffect(() => {
    if (otp.every(v => v !== '') && !isLoading) {
      const timeout = setTimeout(() => handleVerify(otp.join('')), 300);
      return () => clearTimeout(timeout);
    }
  }, [otp]);

  // ── Vérification OTP ──────────────────────────────────────────────────────

  const handleVerify = async (code: string) => {
    if (code.length !== OTP_LENGTH || isLoading) return;
    setLoading(true);
    setHasError(false);
    setErrorMsg(null);

    try {
      if (purpose === 'registration') {
        const response = await authService.verifyRegistrationOTP(phone, code);
        setAuthData(response);
        Toast.show({
          type: 'success',
          text1: 'Compte créé avec succès !',
          text2: `Bienvenue, ${response.fullName} !`,
        });
        // AppNavigator gère la redirection automatiquement
      } else {
        // pin_reset — vérifier l'OTP et naviguer vers NewPINScreen
        await otpService.verifyOTP(phone, 'pin_reset', code);
        navigation.replace('NewPIN', { phone, verifiedOtpCode: code });
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      triggerShake();
      setHasError(true);

      setTimeout(() => {
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setFocused(0);
      }, 800);

      if (msg === 'OTP_EXPIRED') {
        setExpired(true);
        setErrorMsg('Code expiré. Renvoyez un nouveau code.');
      } else if (msg === 'OTP_MAX_ATTEMPTS') {
        setMaxAttempts(true);
        setErrorMsg('Trop de tentatives incorrectes. Renvoyez un nouveau code.');
      } else if (msg.startsWith('OTP_INVALID:')) {
        const remaining = msg.split(':')[1];
        setErrorMsg(`Code incorrect. ${remaining} tentative(s) restante(s).`);
      } else if (msg === 'OTP_NOT_FOUND') {
        setErrorMsg('Code introuvable. Renvoyez un nouveau code.');
      } else {
        setErrorMsg('Erreur de vérification. Réessayez.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Renvoi OTP ────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setResending(true);
    try {
      await otpService.sendOTP(
        email,
        phone,
        fullName ?? 'Utilisateur',
        purpose
      );
      setTimer(OTP_TIMER_SECONDS);
      setResend(RESEND_COOLDOWN);
      setExpired(false);
      setMaxAttempts(false);
      setHasError(false);
      setErrorMsg(null);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Toast.show({
        type: 'success',
        text1: 'Nouveau code envoyé',
        text2: `Vérifiez ${maskEmail(email)}`,
      });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.startsWith('RATE_LIMIT:')) {
        const secs = msg.split(':')[1];
        setResend(parseInt(secs, 10));
        Toast.show({
          type: 'error',
          text1: 'Trop vite',
          text2: `Réessayez dans ${secs} secondes`,
        });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur', text2: "Impossible d'envoyer le code" });
      }
    } finally {
      setResending(false);
    }
  };

  // ── Header title ──────────────────────────────────────────────────────────
  const headerTitle = purpose === 'registration'
    ? 'Vérification du compte'
    : 'Réinitialisation du PIN';

  const handleBack = () => {
    if (purpose === 'registration') {
      navigation.navigate('Register');
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.body}>
            {/* Icône animée */}
            <Animated.View
              style={[styles.iconWrap, { transform: [{ scale: bounceAnim }] }]}
            >
              <Text style={styles.iconEmoji}>✉️</Text>
            </Animated.View>

            <Text style={styles.title}>Vérifiez votre email</Text>
            <Text style={styles.desc}>
              Nous avons envoyé un code à 6 chiffres à
            </Text>
            <Text style={styles.emailMasked}>{maskEmail(email)}</Text>
            <Text style={styles.spamNote}>
              Vérifiez aussi votre dossier spam si vous ne trouvez pas l&apos;email.
            </Text>

            {/* 6 cases OTP */}
            {!isExpired && !maxAttempts && (
              <>
                <Animated.View
                  style={[
                    styles.otpRow,
                    { transform: [{ translateX: shakeAnim }] }
                  ]}
                >
                  {otp.map((val, i) => (
                    <TextInput
                      key={i}
                      ref={ref => { inputRefs.current[i] = ref; }}
                      style={[
                        styles.otpBox,
                        focusedIndex === i && styles.otpBoxFocused,
                        val && !hasError && styles.otpBoxFilled,
                        hasError && styles.otpBoxError,
                      ]}
                      value={val}
                      onChangeText={t => handleChange(t, i)}
                      onKeyPress={e => handleKeyPress(e, i)}
                      onFocus={() => setFocused(i)}
                      onBlur={() => setFocused(-1)}
                      keyboardType="numeric"
                      maxLength={OTP_LENGTH} // autorise le paste
                      selectTextOnFocus
                      editable={!isLoading}
                    />
                  ))}
                </Animated.View>

                {isLoading && (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={Colors.primary} size="small" />
                    <Text style={styles.loadingText}>Vérification en cours...</Text>
                  </View>
                )}
              </>
            )}

            {/* Message d'erreur */}
            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            {/* Timer */}
            {!isExpired && !maxAttempts && (
              <View style={styles.timerRow}>
                {resendCooldown > 0 ? (
                  <Text style={styles.timerText}>
                    Code valable encore :{' '}
                    <Text style={styles.timerBold}>{formatTime(timer)}</Text>
                    {'\n'}
                    <Text style={styles.resendDisabled}>
                      Renvoyer disponible dans {resendCooldown}s
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.timerText}>
                    Code valable encore :{' '}
                    <Text style={styles.timerBold}>{formatTime(timer)}</Text>
                  </Text>
                )}
              </View>
            )}

            {/* Bouton Renvoyer */}
            <TouchableOpacity
              style={[
                styles.resendBtn,
                (resendCooldown > 0 || isResending) && styles.resendBtnDisabled,
              ]}
              onPress={handleResend}
              disabled={resendCooldown > 0 || isResending}
            >
              <Text style={[
                styles.resendBtnText,
                (resendCooldown > 0 || isResending) && styles.resendBtnTextDisabled,
              ]}>
                {isResending ? 'Envoi...' : 'Renvoyer un nouveau code'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backBtnText: { fontSize: 24, color: Colors.textPrimary, fontWeight: 'bold' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  body: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 28, paddingTop: 36, paddingBottom: 20,
  },

  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },

  title: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 10 },
  desc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emailMasked: {
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary,
    marginTop: 4, marginBottom: 8, textAlign: 'center',
  },
  spamNote: {
    fontSize: 12, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 18, marginBottom: 28, opacity: 0.8,
  },

  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  otpBox: {
    width: 52, height: 52, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    fontSize: 22, fontWeight: 'bold', textAlign: 'center',
    color: Colors.textPrimary, backgroundColor: '#F8F8F8',
  },
  otpBoxFocused: { borderColor: Colors.primary, backgroundColor: '#FFF' },
  otpBoxFilled:  { borderColor: Colors.accent, backgroundColor: '#FFF' },
  otpBoxError:   { borderColor: Colors.danger, backgroundColor: '#FFF3F3' },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },

  errorText: {
    color: Colors.danger, fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginBottom: 12, paddingHorizontal: 16,
  },

  timerRow: { marginBottom: 20, alignItems: 'center' },
  timerText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  timerBold: { fontWeight: 'bold', color: Colors.textPrimary },
  resendDisabled: { color: Colors.textSecondary, opacity: 0.6 },

  resendBtn: {
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: '#FFF',
  },
  resendBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.background },
  resendBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  resendBtnTextDisabled: { color: Colors.textSecondary },
});
