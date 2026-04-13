import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface ConfirmModalProps {
  visible?: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ 
  visible = true, 
  title = "Confirmation requise", 
  message, 
  confirmText = "Confirmer", 
  cancelText = "Annuler",
  isDestructive = false,
  onConfirm, 
  onCancel 
}: ConfirmModalProps) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={s.modalOverlay}>
        <View style={s.modal}>
          <MaterialCommunityIcons 
            name={isDestructive ? "alert-circle" : "alert-circle-outline"} 
            size={40} 
            color={isDestructive ? Colors.error : Colors.warning} 
          />
          <Text style={s.modalTitle}>{title}</Text>
          <Text style={s.modalMsg}>{message}</Text>
          <View style={s.modalBtns}>
            <TouchableOpacity style={s.modalCancel} onPress={onCancel}>
              <Text style={s.modalCancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalConfirm, isDestructive && s.modalConfirmDanger]} onPress={onConfirm}>
              <Text style={s.modalConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(7,30,39,0.55)', justifyContent: 'center', padding: 24,
  },
  modal: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl, padding: 28, alignItems: 'center', gap: 10,
  },
  modalTitle: { fontFamily: Fonts.headline, fontSize: 18, color: Colors.onSurface },
  modalMsg: {
    fontFamily: Fonts.body, fontSize: 14, color: Colors.onSurfaceVariant,
    textAlign: 'center', lineHeight: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center',
  },
  modalCancelText: { fontFamily: Fonts.title, color: Colors.onSurfaceVariant },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalConfirmDanger: {
    backgroundColor: Colors.error,
  },
  modalConfirmText: { fontFamily: Fonts.headline, color: '#FFF' },
});
