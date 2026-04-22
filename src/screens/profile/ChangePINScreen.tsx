import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { AppButton, LoadingOverlay, PINInputRow } from '../../components/common';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import * as userService from '../../services/userService';

export default function ChangePINScreen({ navigation }: any) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [oldPinError, setOldPinError] = useState<string | null>(null);
  const [newPinError, setNewPinError] = useState<string | null>(null);
  const [confirmPinError, setConfirmPinError] = useState<string | null>(null);

  const isValid =
    oldPin.length === 4 &&
    newPin.length === 4 &&
    confirmPin.length === 4 &&
    newPin === confirmPin;

  const handleOldPinChange = (value: string) => {
    setOldPin(value);
    setOldPinError(null);
  };

  const handleNewPinChange = (value: string) => {
    setNewPin(value);
    setNewPinError(null);
    if (confirmPin && value !== confirmPin) {
      setConfirmPinError('Les codes PIN ne correspondent pas');
    } else {
      setConfirmPinError(null);
    }
  };

  const handleConfirmPinChange = (value: string) => {
    setConfirmPin(value);
    if (value && newPin && value !== newPin) {
      setConfirmPinError('Les codes PIN ne correspondent pas');
    } else {
      setConfirmPinError(null);
    }
  };

  const hashPIN = async (pin: string): Promise<string> => {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  };

  const handleChangePIN = async () => {
    if (!isValid) return;

    try {
      setIsLoading(true);
      const oldPinHash = await hashPIN(oldPin);
      const newPinHash = await hashPIN(newPin);

      await userService.updatePIN({
        currentPin: oldPinHash,
        newPin: newPinHash,
      });

      Toast.show({
        type: 'success',
        text1: 'PIN modifie avec succes',
        text2: 'Votre nouveau code confidentiel a ete enregistre.',
      });
      navigation.goBack();
    } catch (error: any) {
      console.error('[ChangePINScreen] handleChangePIN error:', error);

      if (error.message === 'INVALID_CURRENT_PIN') {
        setOldPinError('Ancien PIN incorrect');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Impossible de modifier le PIN. Reessayez.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Top App Bar (référence AdminDashboard) ── */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <TouchableOpacity style={s.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={s.topBarTitle}>Modifier mon PIN</Text>
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={s.instructionsBox}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.tertiary} />
          <Text style={s.instructionsText}>
            Votre code PIN doit contenir exactement 4 chiffres. Choisissez une combinaison mémorisable mais difficile à deviner.
          </Text>
        </View>

        <View style={s.formCard}>
          <Text style={s.formTitle}>Modifier mon code confidentiel</Text>
          <View style={s.form}>
            <PINInputRow
              label="Ancien PIN"
              value={oldPin}
              onChange={handleOldPinChange}
              error={oldPinError}
              showToggle
            />

            <PINInputRow
              label="Nouveau PIN"
              value={newPin}
              onChange={handleNewPinChange}
              error={newPinError}
              showToggle
            />

            <PINInputRow
              label="Confirmer le nouveau PIN"
              value={confirmPin}
              onChange={handleConfirmPinChange}
              error={confirmPinError}
              showToggle
            />
          </View>
        </View>

        <View style={s.tipsBox}>
          <Text style={s.tipsTitle}>Conseils de sécurité</Text>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>N'utilisez pas de dates de naissance.</Text>
          </View>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>Évitez les séquences simples comme 1234.</Text>
          </View>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>Ne partagez jamais votre PIN avec un tiers.</Text>
          </View>
        </View>

        <AppButton
          title="Changer mon PIN"
          onPress={handleChangePIN}
          disabled={!isValid || isLoading}
          loading={isLoading}
          loadingText="Modification..."
          style={{ marginTop: 28 }}
        />
      </ScrollView>

      {isLoading ? <LoadingOverlay /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // ── Top App Bar (référence AdminDashboard) ──
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: 12,
    shadowColor: Colors.onSurface, shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarTitle: { fontFamily: Fonts.display, fontSize: 20, color: Colors.onSurface },
  topBarBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 34,
  },

  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '45',
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 20,
    ...Shadow.card,
  },
  instructionsText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurface,
    lineHeight: 20,
  },

  formCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '45',
    ...Shadow.card,
  },
  formTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 10,
  },
  form: { gap: 8 },

  tipsBox: {
    marginTop: 20,
    padding: 18,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '45',
    ...Shadow.card,
  },
  tipsTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
});
