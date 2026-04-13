/**
 * SCR-011 — Confirmation de Paiement Réussi
 * PaymentConfirmationScreen.tsx
 *
 * Arrivée depuis SCR-010 via navigation.replace('PaymentConfirm', { txId })
 * Pas de retour possible vers SCR-010.
 */
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, Animated, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OPERATORS }            from '../../constants/operators';
import { fetchReceiptDetail, type ReceiptDetail }  from '../../services/contributionService';

// ─── Helpers ─────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh  = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} à ${hh}:${min}`;
  } catch { return iso; }
}

// ─── Skeleton shimmer ────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[s.detailCard, { opacity }]}>
      {[80, 60, 70, 50, 65, 55].map((w, i) => (
        <View key={i} style={s.skeletonRow}>
          <View style={[s.skeletonLine, { width: `${w * 0.55}%` }]} />
          <View style={[s.skeletonLine, { width: `${w * 0.45}%` }]} />
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Animation d'entrée ──────────────────────────────────────

function SuccessAnimation({ onComplete }: { onComplete: () => void }) {
  const waveAnim  = useRef(new Animated.Value(0)).current;   // 0 = bas, 1 = haut
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const textAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Vague verte monte
      Animated.timing(waveAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
      // 2. Icône check rebondit (en parallèle avec le texte)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1, useNativeDriver: true,
          tension: 120, friction: 6,
        }),
        Animated.timing(textAnim, {
          toValue: 1, duration: 400, delay: 100, useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // 3. Légère pulsation infinie sur l'icône
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
      onComplete();
    });
  }, []);

  const waveHeight = waveAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '40%'],
  });

  return (
    <View style={s.animationZone}>
      {/* Vague verte qui monte */}
      <Animated.View style={[s.wave, { height: waveHeight }]} />

      {/* Icône check */}
      <Animated.View style={[
        s.checkCircle,
        { transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] },
      ]}>
        <MaterialCommunityIcons name="check" size={52} color="#FFFFFF" />
      </Animated.View>

      {/* Texte succès */}
      <Animated.Text style={[s.successLabel, { opacity: textAnim }]}>
        Paiement confirmé !
      </Animated.Text>
    </View>
  );
}

// ─── Ligne de détail ─────────────────────────────────────────

function DetailRow({
  label, value, mono, isTotal, valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  isTotal?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[s.detailRow, isTotal && s.detailRowTotal]}>
      <Text style={[s.detailLabel, isTotal && s.detailLabelTotal]}>{label}</Text>
      <Text style={[
        s.detailValue,
        mono       && s.detailValueMono,
        isTotal    && s.detailValueTotal,
        valueColor && { color: valueColor },
      ]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Écran principal ─────────────────────────────────────────

export default function PaymentConfirmationScreen({ navigation, route }: any) {
  const txId: string = route?.params?.txId ?? '';

  const [animDone,   setAnimDone]   = useState(false);
  const [receipt,    setReceipt]    = useState<ReceiptDetail | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // ── Interception bouton retour Android ──
  useFocusEffect(
    useCallback(() => {
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Toujours vrai = bloque le retour vers SCR-010
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Accueil' } }],
        });
        return true;
      });
      return () => handler.remove();
    }, [navigation])
  );

  // ── Chargement des détails du reçu ──
  useEffect(() => {
    async function load() {
      if (!txId) { setIsLoading(false); setFetchError(true); return; }
      try {
        const data = await fetchReceiptDetail(txId);
        setReceipt(data);
      } catch {
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [txId]);

  // ── Navigation vers le tableau de bord ──
  const goToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Accueil' } }],
    });
  };

  // ── Navigation vers SCR-012 ──
  const goToReceipt = () => {
    navigation.navigate('Receipt', { txId });
  };

  const op = receipt ? OPERATORS.find(o => o.id === receipt.operator) : null;

  // ─── Render ───────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* ════════ HEADER (sans retour) ════════ */}
      <View style={s.header}>
        <View style={{ width: 40 }} />
        <Text style={s.headerTitle}>Paiement confirmé</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ════════ ZONE ANIMATION ════════ */}
        <SuccessAnimation onComplete={() => setAnimDone(true)} />

        {/* ════════ CARTE DÉTAILS TRANSACTION ════════ */}
        <View style={s.detailCard}>
          <Text style={s.detailCardTitle}>Détails de la transaction</Text>

          {isLoading ? (
            <SkeletonCard />
          ) : fetchError ? (
            <View style={s.errorBlock}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={Colors.error} />
              <Text style={s.errorText}>
                Impossible de charger les détails. Vérifiez votre historique.
              </Text>
              <TouchableOpacity
                style={s.errorBtn}
                onPress={() => navigation.navigate('Historique')}
              >
                <Text style={s.errorBtnText}>Mon historique</Text>
              </TouchableOpacity>
            </View>
          ) : receipt ? (
            <View style={s.detailRows}>
              <DetailRow
                label="Montant payé"
                value={`${receipt.totalAmount.toLocaleString('fr-FR')} CDF`}
                isTotal
                valueColor={Colors.secondary}
              />
              <DetailRow
                label="Opérateur"
                value={op?.name ?? receipt.operator}
              />
              <DetailRow
                label="Date et heure"
                value={formatDateTime(receipt.paidAt)}
              />
              <DetailRow
                label="Référence"
                value={`#${receipt.receiptNumber}`}
                mono
              />
              <DetailRow
                label="Bénéficiaire"
                value={receipt.treasurerName}
              />
              <DetailRow
                label="Mois concerné"
                value={receipt.period}
              />
              {receipt.penaltyAmount > 0 && (
                <DetailRow
                  label="Dont pénalité"
                  value={`+${receipt.penaltyAmount.toLocaleString('fr-FR')} CDF`}
                  valueColor={Colors.error}
                />
              )}
            </View>
          ) : null}
        </View>

        {/* ════════ BOUTONS D'ACTION ════════ */}
        <View style={s.actions}>
          {/* Bouton 1 — Voir le reçu */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={goToReceipt}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFF" />
            <Text style={s.primaryBtnText}>Voir mon reçu</Text>
          </TouchableOpacity>

          {/* Bouton 2 — Retour au tableau de bord */}
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={goToDashboard}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="home-outline" size={18} color={Colors.onSurfaceVariant} />
            <Text style={s.outlineBtnText}>Retour au tableau de bord</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const WAVE_COLOR = '#E8F8EF';
const CHECK_SIZE = 96;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface,
  },

  scroll: { paddingBottom: 40 },

  // ─── Animation zone ──────────────────────────────────────

  animationZone: {
    height: 240,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  wave: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: WAVE_COLOR,
  },
  checkCircle: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.secondary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 2,
  },
  successLabel: {
    fontFamily: Fonts.display,
    fontSize: 22,
    color: Colors.secondary,
    marginTop: 16,
    zIndex: 2,
    letterSpacing: -0.3,
  },

  // ─── Carte détails ────────────────────────────────────────

  detailCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    ...Shadow.card,
  },
  detailCardTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 16,
  },
  detailRows: { gap: 0 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  detailRowTotal: {
    paddingTop: 14,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  detailLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
  },
  detailLabelTotal: {
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
  },
  detailValue: {
    fontFamily: Fonts.title,
    fontSize: 13,
    color: Colors.onSurface,
    textAlign: 'right',
    flex: 1,
  },
  detailValueMono: {
    fontFamily: 'Courier',
    letterSpacing: 0.3,
  },
  detailValueTotal: {
    fontFamily: Fonts.display,
    fontSize: 20,
    letterSpacing: -0.5,
  },

  // ─── Skeleton ─────────────────────────────────────────────

  skeletonRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '30',
  },
  skeletonLine: {
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceContainerHigh,
  },

  // ─── Bloc erreur ──────────────────────────────────────────

  errorBlock: {
    alignItems: 'center', gap: 10, paddingVertical: 16,
  },
  errorText: {
    fontFamily: Fonts.body, fontSize: 13,
    color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 18,
  },
  errorBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  errorBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.primary },

  // ─── Boutons ──────────────────────────────────────────────

  actions: {
    paddingHorizontal: 16,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    shadowColor: Colors.primary, shadowOpacity: 0.22,
    shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  primaryBtnText: {
    fontFamily: Fonts.headline, fontSize: 16, color: '#FFFFFF',
  },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52,
    borderWidth: 1.5, borderColor: Colors.outlineVariant,
    borderRadius: Radius.lg,
  },
  outlineBtnText: {
    fontFamily: Fonts.title, fontSize: 15, color: Colors.onSurfaceVariant,
  },
});
