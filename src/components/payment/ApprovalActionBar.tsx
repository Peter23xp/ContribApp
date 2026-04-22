import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';

interface ApprovalActionBarProps {
  onApprove: () => void;
  onReject: () => void;
  onRequestInfo: () => void;
  isLoading: boolean;
  geminiConfidence: number;
}

export function ApprovalActionBar({
  onApprove,
  onReject,
  onRequestInfo,
  isLoading,
  geminiConfidence,
}: ApprovalActionBarProps) {
  const insets = useSafeAreaInsets();
  const showWarning = geminiConfidence < 60;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {showWarning ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Confiance IA faible. Verifiez la capture manuellement avant d'approuver.
          </Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={onReject} disabled={isLoading} activeOpacity={0.85}>
          {isLoading ? <ActivityIndicator color={Colors.error} /> : <Text style={styles.rejectText}>Rejeter</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={onRequestInfo} disabled={isLoading} activeOpacity={0.85}>
          {isLoading ? <ActivityIndicator color={Colors.textSecondary} /> : <Text style={styles.infoText}>Demander info</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.approveButton]} onPress={onApprove} disabled={isLoading} activeOpacity={0.85}>
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveText}>Approuver</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: 12,
    ...Shadow.card,
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.lg,
    marginBottom: 10,
  },
  warningText: {
    color: '#E65100',
    fontSize: 12,
    fontFamily: Fonts.headline,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: Radius.lg,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  rejectText: {
    color: Colors.error,
    fontFamily: Fonts.headline,
    fontSize: 14,
  },
  infoButton: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainerLow,
  },
  infoText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.headline,
    fontSize: 14,
  },
  approveButton: {
    flex: 1.4,
    backgroundColor: Colors.primary,
  },
  approveText: {
    color: '#FFFFFF',
    fontFamily: Fonts.headline,
    fontSize: 15,
  },
});
