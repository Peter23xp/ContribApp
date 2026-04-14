import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Colors } from '../../constants/colors';
import * as authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';

import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockTimer, setLockTimer] = useState(0);       // secondes
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowListener = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
    });
    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync('last_phone').then(saved => {
      if (saved) {
        setPhone(saved);
      }
    });

    LocalAuthentication.hasHardwareAsync().then(available => {
      LocalAuthentication.isEnrolledAsync().then(enrolled => {
        setBiometricAvailable(available && enrolled);
      });
    });

    SecureStore.getItemAsync('biometric_enabled').then(enabled => {
      setBiometricEnabled(enabled === 'true');
    });
  }, []);

  useEffect(() => {
    let interval: any;
    if (lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            setError(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockTimer]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ 
        phone: '+243' + phone, 
        pin 
      });
      
      await SecureStore.setItemAsync('last_phone', phone);
      await useAuthStore.getState().setAuth(response.user, response.role);
    } catch (err: any) {
      setPin(''); // Vider le PIN
      if (err.message === 'INVALID_CREDENTIALS') {
        setError('Numéro ou PIN incorrect. Vérifiez vos informations.');
      } else if (err.message === 'ACCOUNT_LOCKED') {
        const minutes = err.unlock_at || 15;
        setError(`Compte bloqué. Réessayez dans ${minutes} minutes.`);
        setLockTimer(minutes * 60);
      } else if (err.message === 'TOO_MANY_ATTEMPTS') {
        setError('Trop de tentatives. Patientez 30 secondes.');
      } else {
        setError(err?.message || 'Une erreur est survenue. Réessayez.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const { success } = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Identifiez-vous pour accéder à ContribApp',
      fallbackLabel: 'Utiliser le PIN',
    });
    if (success) {
      const savedPhone = await SecureStore.getItemAsync('last_phone');
      const biometricToken = await SecureStore.getItemAsync('biometric_token');
      if (savedPhone && biometricToken) {
        setIsLoading(true);
        setError(null);
        try {
          const response = await authService.loginWithBiometric('+243' + savedPhone, biometricToken);
          await useAuthStore.getState().setAuth(response.user, response.role);
        } catch (err: any) {
          setError("Erreur d'authentification biométrique.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setError("Aucun jeton biométrique trouvé. Connectez-vous par PIN d'abord.");
      }
    }
  };

  const handleForgotPIN = async () => {
    if (!/^[0-9]{9}$/.test(forgotPhone)) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Numéro invalide (9 chiffres)' });
      return;
    }
    setForgotLoading(true);
    try {
      await authService.resendOTP('+243' + forgotPhone);
      setShowForgotModal(false);
      (navigation as any).navigate('OTP', { phone: '+243' + forgotPhone, context: 'reset_pin' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: error.message });
    } finally {
      setForgotLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isFormInvalid = phone.length !== 9 || pin.length < 4;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        
        {/* Zone Haute (Dynamique) */}
        <View style={[styles.topSection, isKeyboardVisible && { flex: 0.15 }]}>
          {!isKeyboardVisible && (
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>💰</Text>
            </View>
          )}
          <Text style={[styles.title, isKeyboardVisible && { marginTop: 0, fontSize: 18 }]}>
            Bienvenue sur ContribApp
          </Text>
          {!isKeyboardVisible && (
            <Text style={styles.subtitle}>Connectez-vous pour continuer</Text>
          )}
        </View>

        {/* Zone Formulaire (S'étend si le clavier est haut) */}
        <KeyboardAvoidingView 
          style={[styles.keyboardView, isKeyboardVisible && { flex: 0.85 }]} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formWrapper}>
            <ScrollView 
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <AppInput
                label="Numéro de téléphone"
                prefix="+243"
                placeholder="9XXXXXXXX"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={9}
                autoFocus={!phone}
                onSubmitEditing={() => pinRef.current?.focus()}
              />

              <AppInput
                ref={pinRef}
                label="Code PIN"
                placeholder="******"
                value={pin}
                onChangeText={setPin}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={4}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                    <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>
                      {showPin ? 'Cacher' : 'Voir'}
                    </Text>
                  </TouchableOpacity>
                }
              />

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{error}</Text>
                </View>
              )}

              {biometricAvailable && biometricEnabled && (
                <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin}>
                  <Text style={styles.biometricBtnText}>🖐 Connexion par empreinte / Face ID</Text>
                </TouchableOpacity>
              )}

              <AppButton 
                title="Se connecter"
                onPress={handleLogin}
                disabled={isFormInvalid || lockTimer > 0}
                loading={isLoading}
                loadingText="Connexion en cours..."
                style={styles.submitButton}
              />
              
              {lockTimer > 0 && (
                <Text style={styles.timerText}>Compte débloqué dans {formatTimer(lockTimer)}</Text>
              )}

              <TouchableOpacity style={styles.linkMargin} onPress={() => setShowForgotModal(true)}>
                <Text style={styles.linkText}>Code PIN oublié ?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkMargin} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.linkText}>Pas encore de compte ? S'inscrire</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Modal Forgot PIN */}
        <Modal visible={showForgotModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Réinitialiser mon PIN</Text>
              <Text style={styles.modalText}>
                Entrez votre numéro de téléphone. Vous recevrez un code SMS pour créer un nouveau PIN.
              </Text>
              
              <AppInput
                label="Numéro de téléphone"
                prefix="+243"
                placeholder="9XXXXXXXX"
                value={forgotPhone}
                onChangeText={setForgotPhone}
                keyboardType="phone-pad"
                maxLength={9}
              />

              <AppButton 
                title="Envoyer le code SMS"
                onPress={handleForgotPIN}
                loading={forgotLoading}
                disabled={forgotPhone.length !== 9}
                style={{ marginTop: 16 }}
              />
              
              <TouchableOpacity 
                style={[styles.linkMargin, { alignSelf: 'center', marginTop: 20 }]} 
                onPress={() => setShowForgotModal(false)}
              >
                <Text style={[styles.linkText, { color: Colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  topSection: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center'
  },
  logoText: { fontSize: 35 },
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginTop: 16 },
  subtitle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, marginTop: 4 },
  keyboardView: { flex: 0.6 },
  formWrapper: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  formContent: {
    flexGrow: 1,
    padding: 28,
  },
  errorBox: {
    backgroundColor: '#FDECEA', padding: 12, borderRadius: 8,
    marginBottom: 16, borderWidth: 1, borderColor: '#F5B7B1'
  },
  errorBoxText: { color: '#C0392B', fontSize: 13, textAlign: 'center' },
  biometricBtn: {
    padding: 14, borderWidth: 1, borderColor: Colors.primary, borderRadius: 8,
    alignItems: 'center', marginBottom: 16
  },
  biometricBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  submitButton: { marginTop: 8 },
  timerText: { color: Colors.danger, textAlign: 'center', marginTop: 8, fontWeight: 'bold' },
  linkMargin: { marginTop: 24, alignItems: 'center' },
  linkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', padding: 20
  },
  modalContent: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  modalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center' },
});
