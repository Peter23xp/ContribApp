import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

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
  
  const showWarning = geminiConfidence < 60;

  return (
    <View style={styles.container}>
      {showWarning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠ Confiance IA faible — vérifiez manuellement la capture avant d'approuver</Text>
        </View>
      )}
      
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.button, styles.rejectButton]} 
          onPress={onReject}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#F44336" /> : <Text style={styles.rejectText}>✗ Rejeter</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={onRequestInfo}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#666666" /> : <Text style={styles.infoText}>? Info</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.approveButton]} 
          onPress={onApprove}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.approveText}>✓ Approuver</Text>}
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
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    paddingBottom: 20, // To account for safe area
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  warningText: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F44336',
    backgroundColor: 'transparent',
  },
  rejectText: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#9E9E9E',
    backgroundColor: 'transparent',
  },
  infoText: {
    color: '#616161',
    fontWeight: 'bold',
    fontSize: 14,
  },
  approveButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
  },
  approveText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
