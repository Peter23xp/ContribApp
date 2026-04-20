import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface GroupCreationStepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export default function GroupCreationStepIndicator({
  currentStep,
  totalSteps = 4,
}: GroupCreationStepIndicatorProps) {
  const steps = [
    { num: 1, label: 'Identité' },
    { num: 2, label: 'Finances' },
    { num: 3, label: 'Trésorière' },
    { num: 4, label: 'Accès' },
  ];

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const isFuture = currentStep < step.num;

        return (
          <React.Fragment key={step.num}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isActive && styles.circleActive,
                  isFuture && styles.circleFuture,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.textActive,
                      isFuture && styles.textFuture,
                    ]}
                  >
                    {step.num}
                  </Text>
                )}
              </View>
              <Text style={styles.label}>{step.label}</Text>
            </View>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  isCompleted ? styles.lineCompleted : styles.lineFuture,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleCompleted: {
    backgroundColor: '#27AE60',
  },
  circleActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  circleFuture: {
    backgroundColor: '#E0E0E0',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  textActive: {
    color: '#27AE60',
  },
  textFuture: {
    color: '#757575',
  },
  label: {
    fontSize: 10,
    color: '#757575',
    textAlign: 'center',
  },
  line: {
    flex: 1,
    height: 2,
    marginBottom: 16, // offset to match the circle vertical center
  },
  lineCompleted: {
    backgroundColor: '#27AE60',
  },
  lineFuture: {
    backgroundColor: '#E0E0E0',
  },
});
