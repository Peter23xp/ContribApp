import React from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';

export default function PayContributionScreen() {
  const navigation = useNavigation<any>();
  const { scrollY, headerHeight, onScroll } = useCollapsibleHeader({
    expandedHeight: 290,
    collapsedHeight: 136,
    collapseDistance: 160,
  });

  const heroContentOpacity = scrollY.interpolate({
    inputRange: [0, 80, 160],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });
  const heroContentTranslateY = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });
  const titleScale = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [1, 0.84],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <Animated.View style={[styles.heroShell, { height: headerHeight }]}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryContainer, '#0B5E55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlowLeft} />
          <View style={styles.heroGlowRight} />

          <SafeAreaView edges={['top']} style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Payer ma contribution</Text>
            <View style={styles.headerSpacer} />
          </SafeAreaView>

          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: heroContentOpacity,
                transform: [{ translateY: heroContentTranslateY }, { scale: titleScale }],
              },
            ]}
          >
            <Text style={styles.heroEyebrow}>Paiement membre</Text>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#EFFFFB" />
              <Text style={styles.heroBadgeText}>Parcours premium assiste</Text>
            </View>
            <Text style={styles.heroTitle}>Deux parcours, une seule validation fiable</Text>
            <Text style={styles.heroSubtitle}>
              Le paiement automatique arrive bientot. En attendant, le parcours manuel
              avec analyse IA vous permet deja de soumettre votre preuve proprement.
            </Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Disponible</Text>
            <Text style={styles.summaryValue}>Manuel + IA</Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Bientot</Text>
            <Text style={styles.summaryValue}>Debit direct</Text>
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Controle</Text>
            <Text style={styles.summaryValue}>Tresoriere</Text>
          </View>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Actif maintenant</Text>
              <Text style={styles.cardTitle}>Paiement manuel avec verification IA</Text>
            </View>
            <View style={styles.livePill}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.statusPaid} />
              <Text style={styles.livePillText}>Pret</Text>
            </View>
          </View>

          <Text style={styles.cardBody}>
            Payez avec votre application Mobile Money, ajoutez votre capture, puis
            laissez Gemini preanalyser les details avant validation finale.
          </Text>

          <View style={styles.featureList}>
            {[
              { icon: 'phone-portrait-outline', text: 'Paiement depuis votre application habituelle' },
              { icon: 'camera-outline', text: 'Capture de preuve en quelques secondes' },
              { icon: 'sparkles-outline', text: 'Lecture automatique du montant et de la reference' },
              { icon: 'shield-checkmark-outline', text: 'Validation finale par la tresoriere' },
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

        <View style={styles.futureCard}>
          <View style={styles.futureBadge}>
            <Ionicons name="time-outline" size={14} color={Colors.statusPending} />
            <Text style={styles.futureBadgeText}>En preparation</Text>
          </View>

          <Text style={styles.futureTitle}>Paiement automatique Mobile Money</Text>
          <Text style={styles.futureText}>
            Cet ancien ecran est conserve pour la future integration avec
            l’agregateur de paiement. Lorsqu’il sera pret, vous pourrez debiter
            votre numero directement depuis l’application.
          </Text>

          <View style={styles.futureSteps}>
            {[
              'Choisir votre operateur et votre numero a debiter',
              'Valider le paiement en un parcours ultra-court',
              'Recevoir un recu numerique instantane',
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
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 34,
  },
  heroGlowLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(160, 242, 225, 0.14)',
    top: 20,
    left: -30,
  },
  heroGlowRight: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -20,
    right: -80,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  heroContent: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: Fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  heroBadgeText: {
    color: '#EFFFFB',
    fontFamily: Fonts.title,
    fontSize: 12,
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 36,
    color: '#FFFFFF',
    marginBottom: 10,
    maxWidth: 320,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 34,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -36,
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
  futureSteps: {
    gap: 12,
  },
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
