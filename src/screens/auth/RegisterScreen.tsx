/**
 * RegisterScreen.tsx — SCR-002-B v3.0
 * Nouveau flux : numéro = username | email = destinataire OTP | PIN à 6 chiffres.
 * Un seul écran avec sections (plus de multi-step numérotés).
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Keyboard, TouchableWithoutFeedback,
  SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import * as authService from '../../services/authService';
import { MobileOperator } from '../../services/authService';
import { Colors } from '../../constants/colors';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_VALID_PREFIXES = ['81','82','83','84','85','89','90','91','97','98','99'];

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [operator, setOperator]       = useState<MobileOperator | null>(null);
  const [pin, setPin]                 = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const scrollRef = useRef<ScrollView>(null);

  // ── Validation en temps réel ────────────────────────────────────────────────
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 3) errs.fullName = 'Minimum 3 caractères';
    if (!/^[0-9]{9}$/.test(phone)) {
      errs.phone = '9 chiffres requis après +243';
    } else if (!PHONE_VALID_PREFIXES.some(p => phone.startsWith(p))) {
      errs.phone = 'Préfixe non reconnu';
    }
    if (!EMAIL_REGEX.test(email)) errs.email = 'Adresse email invalide';
    if (!operator) errs.operator = 'Sélectionnez votre opérateur';
    if (pin.length !== 6) errs.pin = 'Le PIN doit contenir 6 chiffres';
    if (pin !== confirmPin) errs.confirmPin = 'Les codes PIN ne correspondent pas';
    return errs;
  };

  const isFormValid = Object.keys(validate()).length === 0;

  const handleFieldChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    setter(value);
    // Effacer l'erreur du champ correspondant au fur et à mesure
    setErrors(prev => ({ ...prev }));
  };

  // ── Soumission ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setIsLoading(true);
    try {
      await authService.register({
        fullName: fullName.trim(),
        phone: '+243' + phone,
        email: email.trim(),
        operator: operator!,
        pin,
      });

      Toast.show({
        type: 'success',
        text1: 'Code envoyé !',
        text2: `Vérifiez votre boîte mail : ${email.trim()}`,
      });

      navigation.navigate('OTP', {
        phone: '+243' + phone,
        email: email.trim(),
        purpose: 'registration',
        fullName: fullName.trim(),
      });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'PHONE_ALREADY_EXISTS') {
        setErrors(prev => ({
          ...prev,
          phone: 'Ce numéro est déjà inscrit.',
        }));
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else if (msg === 'EMAIL_ALREADY_EXISTS') {
        setErrors(prev => ({
          ...prev,
          email: 'Cet email est déjà utilisé.',
        }));
      } else if (msg.startsWith('RATE_LIMIT:')) {
        const secs = msg.split(':')[1];
        Toast.show({
          type: 'error',
          text1: 'Trop rapide',
          text2: `Réessayez dans ${secs} secondes`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: msg || 'Erreur réseau. Réessayez.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Créer mon compte</Text>
            <View style={styles.backButton} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── SECTION 1 : IDENTITÉ ────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Identité</Text>

              <AppInput
                label="Nom complet *"
                placeholder="Ex : Jean-Pierre Kabila"
                value={fullName}
                onChangeText={v => handleFieldChange(setFullName, v)}
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
                onChangeText={v => handleFieldChange(setPhone, v.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={9}
                error={errors.phone}
              />

              <View style={styles.operatorWrapper}>
                <Text style={styles.inputLabel}>Votre opérateur Mobile Money *</Text>
                <Text style={styles.inputSubLabel}>Pour recevoir et envoyer vos contributions</Text>
                <OperatorSelector
                  value={operator}
                  onChange={(v: MobileOperator) => {
                    setOperator(v);
                    setErrors(prev => ({ ...prev, operator: '' }));
                  }}
                />
                {errors.operator ? <Text style={styles.errorText}>{errors.operator}</Text> : null}
              </View>

              {/* ── SECTION 2 : EMAIL ──────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Email de vérification</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoText}>
                  Votre email sera utilisé pour vérifier votre compte et réinitialiser votre PIN en cas d&apos;oubli.
                  Il ne sera pas visible par les autres membres.
                </Text>
              </View>

              <AppInput
                label="Adresse email *"
                placeholder="exemple@gmail.com"
                value={email}
                onChangeText={v => handleFieldChange(setEmail, v.trim())}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              {/* ── SECTION 3 : CODE PIN ───────────────────────────────── */}
              <Text style={styles.sectionTitle}>Code PIN</Text>
              <View style={[styles.infoCard, styles.infoCardOrange]}>
                <Text style={styles.infoIcon}>🔒</Text>
                <Text style={styles.infoText}>
                  Choisissez un PIN à 6 chiffres. Il sera votre mot de passe pour vous connecter.
                  Ne le partagez jamais.
                </Text>
              </View>

              <AppInput
                label="Code PIN à 6 chiffres *"
                placeholder="••••••"
                value={pin}
                onChangeText={v => handleFieldChange(setPin, v.replace(/\D/g, ''))}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={6}
                error={errors.pin}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                    <Text style={styles.toggleText}>{showPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              <AppInput
                label="Confirmer le code PIN *"
                placeholder="••••••"
                value={confirmPin}
                onChangeText={v => handleFieldChange(setConfirmPin, v.replace(/\D/g, ''))}
                secureTextEntry={!showConfirmPin}
                keyboardType="numeric"
                maxLength={6}
                error={errors.confirmPin}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPin(!showConfirmPin)}>
                    <Text style={styles.toggleText}>{showConfirmPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              {/* ── Bouton principal ────────────────────────────────────── */}
              <AppButton
                title="Créer mon compte et recevoir le code →"
                onPress={handleRegister}
                disabled={!isFormValid || isLoading}
                loading={isLoading}
                loadingText="Création du compte..."
                style={styles.submitButton}
              />

              {/* ── Lien connexion ─────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Vous avez déjà un compte ?{' '}
                  <Text style={styles.loginLinkBold}>Se connecter →</Text>
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: { width: 40, justifyContent: 'center' },
  backButtonText: { fontSize: 24, color: Colors.textPrimary, fontWeight: 'bold' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  scrollContent: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 12,
  },

  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  inputSubLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },

  operatorWrapper: { marginBottom: 8 },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 4 },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EBF5FB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoCardOrange: { backgroundColor: '#FEF9E7' },
  infoIcon: { fontSize: 16, marginTop: 1 },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  toggleText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },

  submitButton: { marginTop: 28 },

  loginLink: { marginTop: 20, alignItems: 'center', paddingBottom: 8 },
  loginLinkText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
});
