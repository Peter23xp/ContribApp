/**
 * OperatorInstructionBlock — Composant Module 03 PAIEMENT
 * Affiche l'instruction spécifique à l'opérateur avec countdown circulaire.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { OPERATORS } from '../../constants/operators';

type Operator = 'airtel' | 'orange' | 'mpesa' | 'mtn';

interface Props {
  operator: Operator;
  timerSeconds: number;
  onRetry?: () => void;
}

const INSTRUCTIONS: Record<Operator, string> = {
  airtel: 'Vous allez recevoir une notification Airtel Money. Entrez votre PIN Airtel pour confirmer.',
  orange: 'Un USSD *183# va s\'ouvrir sur votre téléphone. Entrez votre PIN Orange Money.',
  mpesa:  'Vous allez recevoir une notification M-Pesa (Vodacom). Entrez votre PIN M-Pesa.',
  mtn:    'Vous allez recevoir un SMS OTP MTN MoMo. Confirmez dans l\'app MTN.',
};

// ─── SVG Countdown circulaire ────────────────────────────────

const RADIUS = 44;
const STROKE  = 6;
const CIRCUM  = 2 * Math.PI * RADIUS;
const SVG_SIZE = (RADIUS + STROKE) * 2;

function CircularCountdown({
  remaining,
  total,
  color,
}: {
  remaining: number;
  total: number;
  color: string;
}) {
  const progress = total > 0 ? remaining / total : 0;
  const strokeDashoffset = CIRCUM * (1 - progress);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.countdownWrap}>
      <Svg width={SVG_SIZE} height={SVG_SIZE}>
        {/* Track */}
        <Circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          stroke={Colors.surfaceContainerHigh}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUM}`}
          strokeDashoffset={`${strokeDashoffset}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SVG_SIZE / 2}, ${SVG_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.countdownCenter}>
        <Text style={[styles.timerText, { color }]}>{mm}:{ss}</Text>
        <Text style={styles.timerLabel}>restant</Text>
      </View>
    </View>
  );
}

// ─── Composant principal ─────────────────────────────────────

export function OperatorInstructionBlock({ operator, timerSeconds, onRetry }: Props) {
  const [remaining, setRemaining] = useState(timerSeconds);
  const [expired, setExpired]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsation douce quand il reste peu de temps
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    setRemaining(timerSeconds);
    setExpired(false);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current!);
  }, [timerSeconds, operator]);

  useEffect(() => {
    if (remaining <= 10 && remaining > 0) {
      startPulse();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [remaining <= 10]);

  const op       = OPERATORS.find((o) => o.id === operator);
  const opColor  = Colors[operator as keyof typeof Colors] as string ?? Colors.primary;
  const instruction = INSTRUCTIONS[operator] ?? '';

  const handleRetry = () => {
    setRemaining(timerSeconds);
    setExpired(false);
    onRetry?.();

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <View style={[styles.card, { borderColor: opColor + '40' }]}>
      {/* ── En-tête opérateur ── */}
      <View style={styles.header}>
        {op?.logo && (
          <Image source={op.logo} style={styles.opLogo} resizeMode="contain" />
        )}
        <Text style={[styles.opName, { color: opColor }]}>{op?.name ?? operator}</Text>
      </View>

      {/* ── Message d'instruction ── */}
      <View style={[styles.instructionBox, { backgroundColor: opColor + '12' }]}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      {/* ── Countdown ou bouton Réessayer ── */}
      {expired ? (
        <View style={styles.retrySection}>
          <Text style={styles.expiredText}>La demande a expiré</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: opColor }]}
            onPress={handleRetry}
            activeOpacity={0.82}
          >
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.timerSection, { transform: [{ scale: pulseAnim }] }]}>
          <CircularCountdown
            remaining={remaining}
            total={timerSeconds}
            color={remaining <= 10 ? Colors.error : opColor}
          />
          <Text style={styles.expiresLabel}>
            Expiration dans 00:{String(remaining % 60).padStart(2, '0')}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    ...Shadow.card,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  opLogo: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
  },
  opName: {
    fontFamily: Fonts.display,
    fontSize: 22,
    letterSpacing: -0.5,
  },

  instructionBox: {
    borderRadius: Radius.lg,
    padding: 14,
  },
  instructionText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurface,
    lineHeight: 20,
  },

  timerSection: {
    alignItems: 'center',
    gap: 8,
  },
  countdownWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  timerText: {
    fontFamily: Fonts.display,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  timerLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  expiresLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  retrySection: {
    alignItems: 'center',
    gap: 12,
  },
  expiredText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.error,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    ...Shadow.fab,
  },
  retryBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
