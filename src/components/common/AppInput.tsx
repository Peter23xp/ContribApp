import React, { forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../../constants/colors';

export interface AppInputProps extends TextInputProps {
  label: string;
  error?: string;
  prefix?: string;
  rightIcon?: React.ReactNode;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(({ label, error, prefix, rightIcon, ...props }, ref) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput 
          ref={ref}
          style={styles.input} 
          placeholderTextColor={Colors.textMuted}
          {...props} 
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { marginBottom: 6, color: Colors.textPrimary, fontWeight: '600' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    height: 48,
  },
  inputError: { borderColor: Colors.danger },
  prefix: { color: Colors.textPrimary, marginRight: 4, fontWeight: 'bold' },
  input: { flex: 1, color: Colors.textPrimary, height: '100%' },
  rightIcon: { marginLeft: 8 },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 4 }
});
