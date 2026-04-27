/**
 * NewPINScreen.tsx — SCR-004-C v3.0
 * Définir un nouveau PIN après réinitialisation par email OTP.
 * Reçoit : phone (string), verifiedOtpCode (string — OTP déjà vérifié)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, SafeAreaView, Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Colors } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import * as authService from '../../services/authService';

type Props = {
  route: RouteProp<AuthStackParamList, 'NewPIN'>;
  navigation: NativeStackNavigationProp<AuthStackParamList, 'NewPIN'>;
};

export default function NewPINScreen({ route, navigation }: Props) {
  const { phone, verifiedOtpCode } = route.params;

  const [pin, setPin]               = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setLoading]     = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (pin.length !== 6) errs.pin = 'Le PIN doit contenir 6 chiffres';
    if (pin !== confirmPin) errs.confirmPin = 'Les codes PIN ne correspondent pas';
    return errs;
  };

  const isFormValid = pin.length === 6 && pin === confirmPin;

  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await authService.confirmPinReset(phone, verifiedOtpCode, pin);
      Toast.show({
        type: 'success',
        text1: 'PIN réinitialisé avec succès !',
        text2: 'Connectez-vous avec votre nouveau PIN.',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'OTP_ALREADY_USED') {
        Toast.show({
          type: 'error',
          text1: 'Session expirée',
          text2: 'Recommencez la réinitialisation depuis la connexion.',
        });
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: msg || 'Impossible de réinitialiser le PIN.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backBtn} />
            <Text style={styles.headerTitle}>Nouveau code PIN</Text>
            <View style={styles.backBtn} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>🔐</Text>
              </View>

              <Text style={styles.title}>Choisissez votre nouveau PIN</Text>
              <Text style={styles.desc}>
                Votre nouveau code PIN à 6 chiffres sera votre mot de passe de connexion.
                Ne le partagez jamais.
              </Text>

              <AppInput
                label="Nouveau PIN à 6 chiffres"
                placeholder="••••••"
                value={pin}
                onChangeText={v => {
                  setPin(v.replace(/\D/g, ''));
                  setErrors(prev => ({ ...prev, pin: '' }));
                }}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={6}
                error={errors.pin}
                autoFocus
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                    <Text style={styles.toggleText}>{showPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              <AppInput
                label="Confirmer le nouveau PIN"
                placeholder="••••••"
                value={confirmPin}
                onChangeText={v => {
                  setConfirmPin(v.replace(/\D/g, ''));
                  setErrors(prev => ({ ...prev, confirmPin: '' }));
                }}
                secureTextEntry={!showConfirm}
                keyboardType="numeric"
                maxLength={6}
                error={errors.confirmPin}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Text style={styles.toggleText}>{showConfirm ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              <AppButton
                title="Enregistrer le nouveau PIN"
                onPress={handleSave}
                disabled={!isFormValid || isLoading}
                loading={isLoading}
                loadingText="Enregistrement..."
                style={styles.saveButton}
              />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  content: {
    alignItems: 'center', paddingHorizontal: 28,
    paddingTop: 32, paddingBottom: 40,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 10,
  },
  desc: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },
  toggleText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  saveButton: { marginTop: 28, width: '100%' },
});
