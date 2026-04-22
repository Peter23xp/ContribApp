import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';

export default function PayContributionScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ── Top App Bar (référence AdminDashboard) ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.topBarBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Payer ma contribution</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary metrics */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Disponible</Text>
            <Text style={styles.summaryValue}>Manuel + IA</Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Bientôt</Text>
            <Text style={styles.summaryValue}>Débit direct</Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Contrôle</Text>
            <Text style={styles.summaryValue}>Trésorière</Text>
          </View>
        </View>

        {/* Active method card */}
        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Actif maintenant</Text>
              <Text style={styles.cardTitle}>Paiement manuel avec vérification IA</Text>
            </View>
            <View style={styles.livePill}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.statusPaid} />
              <Text style={styles.livePillText}>Prêt</Text>
            </View>
          </View>

          <Text style={styles.cardBody}>
            Payez avec votre application Mobile Money, ajoutez votre capture, puis
            laissez Gemini pré-analyser les détails avant validation finale.
          </Text>

          <View style={styles.featureList}>
            {[
              { icon: 'phone-portrait-outline', text: 'Paiement depuis votre application habituelle' },
              { icon: 'camera-outline', text: 'Capture de preuve en quelques secondes' },
              { icon: 'sparkles-outline', text: 'Lecture automatique du montant et de la référence' },
              { icon: 'shield-checkmark-outline', text: 'Validation finale par la trésorière' },
            ].map((item) => (
              <View key={item.text} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.featureText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SubmitContribution')}
            activeOpacity={0.86}
          >
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Soumettre ma capture de paiement</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Coming soon card */}
        <View style={styles.futureCard}>
          <View style={styles.futureBadge}>
            <Ionicons name="time-outline" size={14} color={Colors.statusPending} />
            <Text style={styles.futureBadgeText}>En préparation</Text>
          </View>

          <Text style={styles.futureTitle}>Paiement automatique Mobile Money</Text>
          <Text style={styles.futureText}>
            Cet écran est conservé pour la future intégration avec l'agrégateur de paiement.
            Lorsqu'il sera prêt, vous pourrez débiter votre numéro directement depuis l'application.
          </Text>

          <View style={styles.futureSteps}>
            {[
              'Choisir votre opérateur et votre numéro à débiter',
              'Valider le paiement en un parcours ultra-court',
              'Recevoir un reçu numérique instantané',
            ].map((step, index) => (
              <View key={step} style={styles.futureStepRow}>
                <View style={styles.futureStepNumber}>
                  <Text style={styles.futureStepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.futureStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Retour</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    padding: 18,
    paddingTop: 16,
    paddingBottom: 34,
  },

  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    padding: 14,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '48',
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
    marginBottom: 5,
  },
  summaryValue: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: Colors.onSurface,
  },

  liveCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '48',
    marginBottom: 18,
    ...Shadow.card,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  cardEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: Fonts.headline,
    fontSize: 19,
    lineHeight: 25,
    color: Colors.onSurface,
    maxWidth: 240,
  },
  cardBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#E8F5E9',
  },
  livePillText: {
    color: Colors.statusPaid,
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
  featureList: {
    gap: 12,
    marginBottom: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    color: Colors.onSurface,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...Shadow.fab,
  },
  primaryButtonText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: '#FFFFFF',
  },

  futureCard: {
    backgroundColor: '#F6F9FB',
    borderRadius: Radius.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '40',
    marginBottom: 18,
  },
  futureBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#FFF3E0',
    marginBottom: 10,
  },
  futureBadgeText: {
    color: Colors.statusPending,
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
  futureTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  futureText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  futureSteps: { gap: 12 },
  futureStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  futureStepNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureStepNumberText: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    color: Colors.primary,
  },
  futureStepText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
  },

  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: Colors.textMuted,
    fontFamily: Fonts.headline,
    fontSize: 14,
  },
});
