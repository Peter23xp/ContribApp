/**
 * LoginScreen.tsx — SCR-003-B v3.0
 * Connexion avec numéro de téléphone (username) + PIN à 6 chiffres.
 * Aucun OTP à la connexion directe — uniquement numéro + PIN.
 * PIN oublié → BottomSheet → OTP envoyé par email → SCR-004-B (purpose=pin_reset)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  ScrollView, StatusBar, Modal, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Colors } from '../../constants/colors';
import * as authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

// App version (lecture depuis app.json via expo-constants si disponible)
const APP_VERSION = '1.0.0';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone]             = useState('');
  const [pin, setPin]                 = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lockTimer, setLockTimer]     = useState(0); // secondes restantes de blocage

  // BottomSheet PIN oublié
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const setAuthData = useAuthStore(s => s.setAuthData);

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
      const response = await authService.login({
        phone: '+243' + phone,
        pin,
      });

      setAuthData(response);

      // Navigation selon le rôle
      // AppNavigator gère la redirection automatiquement via isAuthenticated
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
      } else {
        setError(msg || 'Une erreur est survenue. Réessayez.');
      }
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Formulaire valide ─────────────────────────────────────────────────────
  const isFormValid = phone.length === 9 && pin.length === 6 && lockTimer === 0;

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
      Toast.show({
        type: 'success',
        text1: 'Code envoyé !',
        text2: 'Vérifiez votre boîte mail.',
      });
      // On a besoin de l'email — requestPinReset récupère l'email depuis Firestore
      // Pour naviguer vers OTP, on cherche l'email via le numéro
      // (Il est récupéré dans requestPinReset mais non retourné — on navigue sans email affiché)
      navigation.navigate('OTP', {
        phone: '+243' + forgotPhone,
        email: '***@***.***', // l'OTP est envoyé, l'email sera masqué
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

        {/* Zone haute */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>💰</Text>
          </View>
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>
            Connectez-vous avec votre numéro et votre PIN
          </Text>
        </View>

        {/* Formulaire */}
        <KeyboardAvoidingView
          style={styles.formWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppInput
              label="Numéro de téléphone"
              subLabel="Votre identifiant de connexion"
              subLabelColor={Colors.primary}
              prefix="+243"
              placeholder="97X XXX XXX"
              value={phone}
              onChangeText={v => {
                setPhone(v.replace(/\D/g, ''));
                setError(null);
              }}
              keyboardType="phone-pad"
              maxLength={9}
              autoFocus={!phone}
            />

            <AppInput
              label="Code PIN à 6 chiffres"
              placeholder="••••••"
              value={pin}
              onChangeText={v => {
                setPin(v.replace(/\D/g, ''));
                setError(null);
              }}
              secureTextEntry={!showPin}
              keyboardType="numeric"
              maxLength={6}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                  <Text style={styles.togglePin}>{showPin ? 'Cacher' : 'Voir'}</Text>
                </TouchableOpacity>
              }
            />

            {/* Message d'erreur dynamique */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{error}</Text>
                {lockTimer > 0 && (
                  <>
                    <Text style={styles.timerText}>
                      Déblocage dans{' '}
                      <Text style={styles.timerBold}>{formatTimer(lockTimer)}</Text>
                    </Text>
                    <TouchableOpacity
                      style={{ marginTop: 8 }}
                      onPress={() => {
                        setShowForgotModal(true);
                        setForgotPhone(phone);
                      }}
                    >
                      <Text style={styles.resetPinLink}>Réinitialiser mon PIN →</Text>
                    </TouchableOpacity>
                  </>
                )}
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

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerLinkText}>
                Pas encore de compte ?{' '}
                <Text style={styles.registerLinkBold}>S&apos;inscrire →</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.version}>ContribApp RDC v{APP_VERSION}</Text>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* BottomSheet — PIN oublié */}
        <Modal
          visible={showForgotModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowForgotModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowForgotModal(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
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
              onChangeText={v => {
                setForgotPhone(v.replace(/\D/g, ''));
                setForgotError(null);
              }}
              keyboardType="phone-pad"
              maxLength={9}
              autoFocus
            />

            {forgotError && (
              <Text style={styles.forgotErrorText}>{forgotError}</Text>
            )}

            <AppButton
              title="Recevoir le code par email"
              onPress={handleForgotPIN}
              loading={forgotLoading}
              disabled={forgotPhone.length !== 9 || forgotLoading}
              style={{ marginTop: 16 }}
            />

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setShowForgotModal(false); setForgotError(null); }}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },

  topSection: {
    flex: 0.38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  logoIcon: { fontSize: 38 },
  title: { color: '#FFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.75)', fontSize: 14,
    marginTop: 6, textAlign: 'center', lineHeight: 20,
  },

  formWrapper: {
    flex: 0.62,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  formContent: { flexGrow: 1, padding: 28, paddingBottom: 40 },

  togglePin: { color: Colors.primary, fontWeight: '600', fontSize: 13 },

  errorBox: {
    backgroundColor: '#FDECEA',
    borderWidth: 1, borderColor: '#F5B7B1',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  errorBoxText: { color: '#C0392B', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  timerText: { color: '#E74C3C', fontSize: 13, marginTop: 4 },
  timerBold: { fontWeight: 'bold' },
  resetPinLink: { color: '#E74C3C', fontWeight: '700', fontSize: 13 },

  loginButton: { marginTop: 8 },

  forgotPinLink: { marginTop: 20, alignItems: 'center' },
  forgotPinText: { color: Colors.danger, fontSize: 15, fontWeight: '600' },

  registerLink: { marginTop: 20, alignItems: 'center' },
  registerLinkText: { color: Colors.textSecondary, fontSize: 14 },
  registerLinkBold: { color: Colors.primary, fontWeight: '700' },

  version: {
    color: Colors.textSecondary, fontSize: 11,
    textAlign: 'center', marginTop: 32, opacity: 0.7,
  },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  bottomSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8,
  },
  bottomSheetSubtitle: {
    fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 19,
  },
  forgotErrorText: { color: Colors.danger, fontSize: 13, marginTop: 4, marginBottom: 8 },
  cancelButton: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
