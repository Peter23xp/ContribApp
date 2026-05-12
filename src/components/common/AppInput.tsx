import React, { forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

export interface AppInputProps extends TextInputProps {
  label: string;
  subLabel?: string;
  subLabelColor?: string;
  error?: string;
  prefix?: string;
  rightIcon?: React.ReactNode;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(
  ({ label, subLabel, subLabelColor, error, prefix, rightIcon, ...props }, ref) => {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        {subLabel ? (
          <Text style={[styles.subLabel, subLabelColor ? { color: subLabelColor } : null]}>
            {subLabel}
          </Text>
        ) : null}
        <View
          style={[
            styles.inputWrapper,
            props.multiline && { height: 'auto', minHeight: 52, paddingVertical: 14 },
            error ? styles.inputError : null,
          ]}
        >
          {prefix && (
            <View style={styles.prefixWrap}>
              <Text style={styles.prefix}>{prefix}</Text>
              <View style={styles.prefixDivider} />
            </View>
          )}
          <TextInput
            ref={ref}
            style={[styles.input, props.multiline && { height: 'auto' }, props.style]}
            placeholderTextColor={Colors.outlineVariant}
            {...props}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  label: {
    marginBottom: 6,
    color: Colors.textPrimary,
    fontFamily: Fonts.title,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
    marginBottom: 8,
    lineHeight: 17,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    height: 52,
  },
  inputError: { borderColor: Colors.danger },
  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  prefix: {
    color: Colors.primary,
    fontFamily: Fonts.headline,
    fontSize: 15,
    marginRight: 10,
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.body,
    fontSize: 15,
    height: '100%',
  },
  rightIcon: { marginLeft: 8 },
  errorText: {
    color: Colors.danger,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 5,
  },
});
