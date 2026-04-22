import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AppButton, LoadingOverlay, PINInputRow } from '../../components/common';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import * as userService from '../../services/userService';

export default function ChangePINScreen({ navigation }: any) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [oldPinError, setOldPinError] = useState<string | null>(null);
  const [newPinError, setNewPinError] = useState<string | null>(null);
  const [confirmPinError, setConfirmPinError] = useState<string | null>(null);
  const { scrollY, headerHeight, onScroll } = useCollapsibleHeader({
    expandedHeight: 260,
    collapsedHeight: 126,
    collapseDistance: 140,
  });

  const heroContentOpacity = scrollY.interpolate({
    inputRange: [0, 70, 140],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });
  const heroContentTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });
  const heroIconScale = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [1, 0.78],
    extrapolate: 'clamp',
  });

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
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <Animated.View style={[s.heroShell, { height: headerHeight }]}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryContainer, '#0B5E55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <SafeAreaView edges={['top']} style={s.header}>
            <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Modifier mon PIN</Text>
            <View style={{ width: 40 }} />
          </SafeAreaView>

          <Animated.View
            style={[
              s.heroContent,
              {
                opacity: heroContentOpacity,
                transform: [{ translateY: heroContentTranslateY }],
              },
            ]}
          >
            <Animated.View style={[s.heroIconWrap, { transform: [{ scale: heroIconScale }] }]}>
              <Ionicons name="shield-checkmark-outline" size={28} color="#FFFFFF" />
            </Animated.View>
            <Text style={s.heroTitle}>Renforcez la securite de votre compte</Text>
            <Text style={s.heroSubtitle}>
              Mettez a jour votre code confidentiel avec un parcours simple, clair et plus securise.
            </Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={s.summaryCard}>
          <View style={s.summaryMetric}>
            <Text style={s.summaryLabel}>Format</Text>
            <Text style={s.summaryValue}>4 chiffres</Text>
          </View>
          <View style={s.summaryMetric}>
            <Text style={s.summaryLabel}>Validation</Text>
            <Text style={s.summaryValue}>{isValid ? 'Prete' : 'En attente'}</Text>
          </View>
          <View style={s.summaryMetric}>
            <Text style={s.summaryLabel}>Protection</Text>
            <Text style={s.summaryValue}>Chiffree</Text>
          </View>
        </View>

        <View style={s.instructionsBox}>
          <Ionicons name="information-circle" size={22} color={Colors.tertiary} />
          <Text style={s.instructionsText}>
            Votre code PIN doit contenir exactement 4 chiffres. Choisissez une combinaison memorisable mais difficile a deviner.
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
          <Text style={s.tipsTitle}>Conseils de securite</Text>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>N'utilisez pas de dates de naissance.</Text>
          </View>
          <View style={s.tipRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.secondary} />
            <Text style={s.tipText}>Evitez les sequences simples comme 1234.</Text>
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
      </Animated.ScrollView>

      {isLoading ? <LoadingOverlay /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  heroShell: {
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  hero: {
    flex: 1,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#FFFFFF',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 19,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 34,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -38,
    marginBottom: 20,
    padding: 14,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    ...Shadow.card,
  },
  summaryMetric: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
  },
  summaryLabel: {
    fontFamily: Fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: Colors.onSurface,
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
  form: {
    gap: 8,
  },
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
