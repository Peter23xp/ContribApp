import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Image, Keyboard, TouchableWithoutFeedback, Animated
} from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import * as authService from '../../services/authService';
import { MobileOperator } from '../../services/authService';
import { Colors } from '../../constants/colors';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<MobileOperator | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Animation pour switcher de page
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (fullName.trim().length < 3) errs.fullName = "Minimum 3 caractères";
    }
    if (step === 2) {
      if (!/^[0-9]{9}$/.test(phone)) {
        errs.phone = "9 chiffres requis après +243";
      } else if (!['81','82','83','84','85','89','90','91','97','98','99'].some(p => phone.startsWith(p))) {
        errs.phone = "Préfixe non reconnu.";
      }
      if (!operator) errs.operator = "Sélectionnez votre opérateur";
    }
    if (step === 3) {
      if (pin.length !== 6) errs.pin = "Le PIN doit contenir 6 chiffres";
      if (pin !== confirmPin) errs.confirmPin = "Les codes PIN ne correspondent pas";
    }
    return errs;
  };

  const handleValidation = () => {
    if (hasSubmitted) setErrors(validate());
  };

  const handleBlur = () => {
    setErrors(validate());
  };

  const isStepValid = Object.keys(validate()).length === 0;

  const handleNextStep = () => {
    setHasSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStep(step + 1);
        setHasSubmitted(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }
  };

  const handlePrevStep = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(step - 1);
      setHasSubmitted(false);
      setErrors({});
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    setHasSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      const pin_hash = await authService.hashPIN(pin);
      
      await authService.register({
        full_name: fullName.trim(),
        phone: '+243' + phone,
        operator: operator!,
        pin_hash
      });

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: `Code envoyé au +243${phone}`
      });

      navigation.navigate('OTP', { phone: '+243' + phone, context: 'register' });
    } catch (error: any) {
      if (error.message === 'PHONE_ALREADY_EXISTS') {
        Toast.show({ type: 'error', text1: 'Erreur', text2: "Ce numéro est déjà inscrit" });
        setStep(2); 
      } else if (error.message === 'NETWORK_ERROR') {
        Toast.show({ type: 'error', text1: 'Erreur réseau', text2: 'Vérifiez votre connexion internet' });
      } else {
        Toast.show({ type: 'error', text1: 'Erreur', text2: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header avec barre de progression */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => step > 1 ? handlePrevStep() : navigation.goBack()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressWrap}>
            {[1, 2, 3, 4].map((s) => (
              <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
            ))}
          </View>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              {/* ÉTAPE 1 : IDENTITÉ */}
              {step === 1 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepEmoji}>👤</Text>
                  <Text style={styles.stepTitle}>Faisons connaissance</Text>
                  <Text style={styles.stepSubtitle}>Comment souhaitez-vous être appelé sur la plateforme ?</Text>
                  
                  <AppInput 
                    label="Nom complet"
                    placeholder="Ex: Jean Mbeki"
                    value={fullName}
                    onChangeText={(v) => { setFullName(v); handleValidation(); }}
                    onBlur={handleBlur}
                    error={errors.fullName}
                    autoFocus
                  />
                </View>
              )}

              {/* ÉTAPE 2 : NUMÉRO & OPÉRATEUR */}
              {step === 2 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepEmoji}>📱</Text>
                  <Text style={styles.stepTitle}>Votre compte Mobile Money</Text>
                  <Text style={styles.stepSubtitle}>Ce numéro servira à payer et recevoir vos cotisations.</Text>

                  <AppInput 
                    label="Numéro de téléphone"
                    prefix="+243"
                    placeholder="9XXXXXXXX"
                    value={phone}
                    onChangeText={(v) => { setPhone(v); handleValidation(); }}
                    onBlur={handleBlur}
                    error={errors.phone}
                    keyboardType="phone-pad"
                    maxLength={9}
                    autoFocus
                  />

                  <View style={styles.operatorWrapper}>
                    <Text style={styles.label}>Sélectionnez l'opérateur</Text>
                    <OperatorSelector 
                      value={operator}
                      onChange={(v: MobileOperator) => { setOperator(v); handleValidation(); }}
                    />
                    {errors.operator && <Text style={styles.errorText}>{errors.operator}</Text>}
                  </View>
                </View>
              )}

              {/* ÉTAPE 3 : PIN */}
              {step === 3 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepEmoji}>🔒</Text>
                  <Text style={styles.stepTitle}>Sécurisez votre profil</Text>
                  <Text style={styles.stepSubtitle}>Créez un code PIN secret à 6 chiffres pour protéger vos transactions.</Text>

                  <AppInput 
                    label="Code PIN (6 chiffres)"
                    placeholder="******"
                    value={pin}
                    onChangeText={(v) => { setPin(v); handleValidation(); }}
                    onBlur={handleBlur}
                    error={errors.pin}
                    secureTextEntry
                    keyboardType="numeric"
                    maxLength={6}
                    autoFocus
                  />

                  <AppInput 
                    label="Confirmer le PIN"
                    placeholder="******"
                    value={confirmPin}
                    onChangeText={(v) => { setConfirmPin(v); handleValidation(); }}
                    onBlur={handleBlur}
                    error={errors.confirmPin}
                    secureTextEntry
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              )}

              {/* ÉTAPE 4 : PHOTO */}
              {step === 4 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepEmoji}>📸</Text>
                  <Text style={styles.stepTitle}>Et pour finir...</Text>
                  <Text style={styles.stepSubtitle}>Une belle photo rend les choses plus humaines (Optionnel).</Text>

                  <View style={styles.photoContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.photoArea}>
                      {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.photoPreviewLarge} />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Text style={styles.photoPlaceholderIcon}>+</Text>
                          <Text style={styles.photoPlaceholderText}>Ajouter une photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Pagination & Footer */}
            <View style={styles.footerContainer}>
              <View style={styles.buttonsRow}>
                {step > 1 && (
                  <AppButton 
                    title="Retour" 
                    onPress={handlePrevStep} 
                    style={styles.navButtonSecondary} 
                  />
                )}
                
                {step < 4 ? (
                  <AppButton 
                    title="Continuer" 
                    onPress={handleNextStep} 
                    disabled={!isStepValid}
                    style={styles.navButtonPrimary} 
                  />
                ) : (
                  <AppButton 
                    title="Terminer" 
                    onPress={handleRegister} 
                    disabled={!isStepValid}
                    loading={isLoading}
                    loadingText="Création..."
                    style={styles.navButtonPrimary} 
                  />
                )}
              </View>

              {step === 1 && (
                <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLinkText}>Déjà un compte ? Se connecter</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backButtonText: { color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold' },
  progressWrap: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  progressDot: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' },
  progressDotActive: { backgroundColor: Colors.primary },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 32 },
  
  stepContainer: { flex: 1 },
  stepEmoji: { fontSize: 44, marginBottom: 16 },
  stepTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 36, lineHeight: 22 },

  label: { marginBottom: 8, color: Colors.textPrimary, fontWeight: '600' },
  operatorWrapper: { marginBottom: 16, marginTop: 8 },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 4 },

  photoContainer: { alignItems: 'center', marginTop: 20 },
  photoArea: { width: 150, height: 150, borderRadius: 75, overflow: 'hidden', backgroundColor: '#F5F5F5', borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  photoPreviewLarge: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderIcon: { fontSize: 36, color: Colors.primary, marginBottom: 8 },
  photoPlaceholderText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  footerContainer: { marginTop: 'auto', paddingTop: 20 },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  navButton: { flex: 1 },
  navButtonSecondary: { flex: 1, backgroundColor: '#95A5A6' },
  navButtonPrimary: { flex: 2 },

  loginLink: { marginTop: 32, alignItems: 'center' },
  loginLinkText: { color: Colors.primary, fontSize: 16, fontWeight: '600' }
});
