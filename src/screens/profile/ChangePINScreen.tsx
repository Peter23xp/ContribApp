/**
 * ChangePINScreen.tsx — SCR-021 Module 06 (Prompt 3)
 * 
 * Sous-écran de changement de code PIN avec :
 *  - 3 champs PIN (ancien, nouveau, confirmation)
 *  - Validation en temps réel
 *  - Hachage SHA-256 côté client
 *  - Feedback utilisateur
 */

import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AppButton, LoadingOverlay, PINInputRow } from '../../components/common';
import { Colors, Fonts, Radius } from '../../constants/colors';
import * as userService from '../../services/userService';

// ─── Composant principal ──────────────────────────────────────

export default function ChangePINScreen({ navigation }: any) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Erreurs
  const [oldPinError, setOldPinError] = useState<string | null>(null);
  const [newPinError, setNewPinError] = useState<string | null>(null);
  const [confirmPinError, setConfirmPinError] = useState<string | null>(null);

  // ── Validation ──
  const isValid = 
    oldPin.length === 6 &&
    newPin.length === 6 &&
    confirmPin.length === 6 &&
    newPin === confirmPin;

  // ── Gestion des changements ──
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

  // ── Hachage PIN ──
  const hashPIN = async (pin: string): Promise<string> => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    );
  };

  // ── Changement de PIN ──
  const handleChangePIN = async () => {
    if (!isValid) return;

    try {
      setIsLoading(true);

      // Hacher les PINs
      const oldPinHash = await hashPIN(oldPin);
      const newPinHash = await hashPIN(newPin);

      // Appeler l'API
      await userService.updatePIN({
        currentPin: oldPinHash,
        newPin: newPinHash,
      });

      // Succès
      Toast.show({
        type: 'success',
        text1: 'PIN modifié avec succès',
        text2: 'Votre nouveau code PIN a été enregistré',
      });

      // Retour vers ProfileScreen
      navigation.goBack();
    } catch (error: any) {
      console.error('[ChangePINScreen] handleChangePIN error:', error);

      if (error.message === 'INVALID_CURRENT_PIN') {
        // Ancien PIN incorrect
        setOldPinError('Ancien PIN incorrect');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        // Erreur réseau ou autre
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Impossible de modifier le PIN. Réessayez.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <SafeAreaView edges={['top']} style={s.header}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Modifier mon PIN</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Contenu */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Instructions */}
        <View style={s.instructionsBox}>
          <Ionicons name="information-circle" size={24} color={Colors.tertiary} />
          <Text style={s.instructionsText}>
            Votre code PIN doit contenir exactement 6 chiffres. Assurez-vous de le mémoriser.
          </Text>
        </View>

        {/* Champs PIN */}
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

        {/* Conseils de sécurité */}
        <View style={s.tipsBox}>
          <Text style={s.tipsTitle}>Conseils de sécurité</Text>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>N'utilisez pas de dates de naissance</Text>
          </View>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>Évitez les séquences simples (123456)</Text>
          </View>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>Ne partagez jamais votre PIN</Text>
          </View>
        </View>

        {/* Bouton */}
        <AppButton
          title="Changer mon PIN"
          onPress={handleChangePIN}
          disabled={!isValid || isLoading}
          loading={isLoading}
          loadingText="Modification..."
          style={{ marginTop: 32 }}
        />
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && <LoadingOverlay message="Modification du PIN..." />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '50',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },

  // Contenu
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Instructions
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.tertiaryContainer + '30',
    padding: 16,
    borderRadius: Radius.lg,
    marginBottom: 24,
  },
  instructionsText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurface,
    lineHeight: 20,
  },

  // Formulaire
  form: {
    gap: 8,
  },

  // Conseils
  tipsBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
  },
  tipsTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
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
