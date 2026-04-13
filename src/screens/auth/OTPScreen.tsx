import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated, Keyboard,
    KeyboardAvoidingView, Platform,
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
import { Colors } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator'; // On créera ça juste après
import * as authService from '../../services/authService';
import { useAuthStore } from '../../stores/authStore';

type OTPScreenRouteProp = RouteProp<AuthStackParamList, 'OTP'>;
type OTPScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OTP'>;

interface Props {
  route: OTPScreenRouteProp;
  navigation: OTPScreenNavigationProp;
}

export default function OTPScreen({ route, navigation }: Props) {
  const { phone, context } = route.params;

  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(120);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const inputRefs = Array.from({ length: 6 }, () => useRef<TextInput>(null));
  
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Masked phone ex: +243 97 *** ** 89
  const maskedPhone = phone.slice(0, -3).replace(/\d/g, '*') + phone.slice(-3);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleVerify = async () => {
    const otpCode = otpValues.join('');
    if (otpCode.length !== 6) return;

    setIsLoading(true);
    setHasError(false);
    setError(null);
    try {
      const response = await authService.verifyOTP(phone, otpCode);
      await useAuthStore.getState().setAuth(response.user, response.role, {
        access: response.access_token,
        refresh: response.refresh_token,
      });
      Toast.show({ type: 'success', text1: 'Téléphone vérifié !', text2: 'Bienvenue sur ContribApp' });
      
      if (context === 'reset_pin') {
        navigation.replace('SetNewPIN', { phone });
      }
    } catch (err: any) {
      setHasError(true);
      setOtpValues(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
      setAttemptsLeft(prev => prev - 1);
      
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 8, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -8, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 8, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true })
      ]).start();

      if (err.message === 'OTP_EXPIRED') {
        setError('Code expiré. Veuillez en demander un nouveau.');
      } else if (err.message === 'MAX_ATTEMPTS') {
        setError('Trop de tentatives. Un nouveau code est requis.');
        setTimer(0);
      } else if (err.message === 'INVALID_OTP') {
        setError(`Code incorrect. ${attemptsLeft - 1} tentative(s) restante(s).`);
      } else {
        setError('Erreur de vérification. Réessayez.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authService.resendOTP(phone);
      setTimer(120);
      setHasError(false);
      setError(null);
      setOtpValues(['', '', '', '', '', '']);
      setAttemptsLeft(3);
      inputRefs[0].current?.focus();
      Toast.show({ type: 'success', text1: 'Code renvoyé !', text2: `SMS envoyé au ${phone}` });
    } catch (err: any) {
      if (err.message === 'RESEND_LIMIT') {
        Toast.show({ type: 'error', text1: 'Limite atteinte', text2: 'Attendez avant de renvoyer.' });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur', text2: err.message });
      }
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (otpValues.every(v => v !== '')) {
      const timeout = setTimeout(() => {
        handleVerify();
      }, 300);
      return () => clearTimeout(timeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpValues]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otpValues];
    newOtp[index] = text;
    setOtpValues(newOtp);

    if (text && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
    if (text && index === 5) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = ({ nativeEvent }: any, index: number) => {
    if (nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
      const newOtp = [...otpValues];
      newOtp[index - 1] = '';
      setOtpValues(newOtp);
      inputRefs[index - 1].current?.focus();
    }
  };

  const isFormComplete = otpValues.every(v => v !== '');

  const [focusedIndex, setFocusedIndex] = useState(-1);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vérification</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.body}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>✉️</Text>
            </View>
            <Text style={styles.title}>Code de vérification</Text>
            <Text style={styles.subtitle}>
              Nous avons envoyé un code SMS au{"\n"}
              <Text style={styles.phoneText}>{maskedPhone}</Text>
            </Text>

            <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnimation }] }]}>
              {otpValues.map((val, index) => {
                const isFocused = focusedIndex === index;
                const isFilled = val !== '';
                return (
                  <TextInput
                    key={index}
                    ref={inputRefs[index]}
                    style={[
                      styles.otpBox,
                      isFocused && styles.otpBoxFocused,
                      isFilled && !isFocused && !hasError && styles.otpBoxFilled,
                      hasError && styles.otpBoxError
                    ]}
                    value={val}
                    onChangeText={(t) => handleChange(t, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => { setFocusedIndex(index); setHasError(false); setError(null); }}
                    onBlur={() => setFocusedIndex(-1)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                  />
                )
              })}
            </Animated.View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.timerContainer}>
              {timer > 0 ? (
                <Text style={styles.timerText}>Renvoyer le code dans <Text style={styles.timerBold}>{formatTimer(timer)}</Text></Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={isResending}>
                  <Text style={styles.resendButtonText}>
                    {isResending ? 'Renvoi...' : 'Renvoyer le code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <AppButton
              title="Vérifier"
              onPress={handleVerify}
              disabled={!isFormComplete || isLoading}
              loading={isLoading}
              loadingText="Vérification..."
              style={styles.verifyButton}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  backButton: { width: 40 },
  backButtonText: { color: '#FFF', fontSize: 24 },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20
  },
  iconText: { fontSize: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  phoneText: { fontWeight: 'bold', color: Colors.textPrimary },
  otpContainer: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 24 },
  otpBox: {
    width: 48, height: 48,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12,
    fontSize: 22, textAlign: 'center',
    color: Colors.textPrimary,
    backgroundColor: '#FFF'
  },
  otpBoxFocused: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
  otpBoxFilled: { borderColor: Colors.accent },
  otpBoxError: { borderColor: Colors.danger },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  timerContainer: { marginBottom: 32 },
  timerText: { color: Colors.textSecondary, fontSize: 14 },
  timerBold: { fontWeight: 'bold', color: Colors.textPrimary },
  resendButtonText: { color: Colors.primary, fontSize: 15, fontWeight: 'bold' },
  verifyButton: { width: '100%' }
});
