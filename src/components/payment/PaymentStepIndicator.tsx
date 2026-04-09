/**
 * PaymentStepIndicator — Composant Module 03 PAIEMENT
 * Indicateur de progression en 3 étapes pour le tunnel de paiement.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface Props {
  currentStep: 1 | 2 | 3;
  steps: [string, string, string];
}

const CIRCLE_SIZE = 28;
const CONNECTOR_HEIGHT = 2;

export function PaymentStepIndicator({ currentStep, steps }: Props) {
  // Animation d'échelle pour l'étape active
  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Animation opacité connecteurs
  const connectorAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Pulse sur l'étape active
    const idx = currentStep - 1;
    scaleAnims.forEach((anim, i) => {
      if (i === idx) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1,    duration: 700, useNativeDriver: true }),
          ]),
          { iterations: 2 }
        ).start(() => {
          Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
      } else {
        Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    });

    // Connecteurs qui se remplissent progressivement
    connectorAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: currentStep > i + 1 ? 1 : 0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    });
  }, [currentStep]);

  return (
    <View style={styles.container}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isDone    = stepNum < currentStep;
        const isActive  = stepNum === currentStep;
        const isFuture  = stepNum > currentStep;

        return (
          <React.Fragment key={index}>
            {/* Connecteur entre étapes */}
            {index > 0 && (
              <View style={styles.connectorTrack}>
                <Animated.View
                  style={[
                    styles.connectorFill,
                    {
                      width: connectorAnims[index - 1].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            )}

            {/* Cercle + label */}
            <View style={styles.stepWrapper}>
              <Animated.View
                style={[
                  styles.circle,
                  isDone   && styles.circleDone,
                  isActive && styles.circleActive,
                  isFuture && styles.circleFuture,
                  { transform: [{ scale: scaleAnims[index] }] },
                ]}
              >
                {isDone ? (
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.circleNum,
                    isFuture && styles.circleNumFuture,
                  ]}>
                    {stepNum}
                  </Text>
                )}
              </Animated.View>
              <Text
                style={[
                  styles.label,
                  isDone   && styles.labelDone,
                  isActive && styles.labelActive,
                  isFuture && styles.labelFuture,
                ]}
                numberOfLines={2}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    height: 64,
    paddingHorizontal: 4,
  },

  // Cercles
  stepWrapper: {
    alignItems: 'center',
    gap: 5,
    width: 56,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: {
    backgroundColor: Colors.secondary,
  },
  circleActive: {
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primaryFixed,
  },
  circleFuture: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
  },
  circleNum: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    color: '#FFFFFF',
  },
  circleNumFuture: {
    color: Colors.textMuted,
  },

  // Labels
  label: {
    fontFamily: Fonts.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  labelDone:   { color: Colors.secondary },
  labelActive: { color: Colors.primary,        fontFamily: Fonts.title },
  labelFuture: { color: Colors.onSurfaceVariant },

  // Connecteurs
  connectorTrack: {
    flex: 1,
    height: CONNECTOR_HEIGHT,
    backgroundColor: Colors.outlineVariant + '60',
    alignSelf: 'center',
    marginBottom: 20, // align with circle vertical center
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
  },
});
