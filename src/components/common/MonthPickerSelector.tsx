import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';

interface Props {
  selectedMonth: string;
  onChange: (month: string) => void;
  minMonth?: string;
  maxMonth?: string;
}

function toMonthDate(month: string): Date {
  const [year, monthPart] = month.split('-').map(Number);
  return new Date(year, monthPart - 1, 1);
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function shiftMonth(month: string, delta: number): string {
  const current = toMonthDate(month);
  current.setMonth(current.getMonth() + delta);
  return toMonthKey(current);
}

function formatMonthLabel(month: string): string {
  const date = toMonthDate(month);
  const raw = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getDefaultMaxMonth(): string {
  return toMonthKey(new Date());
}

function getDefaultMinMonth(maxMonth: string): string {
  return shiftMonth(maxMonth, -24);
}

function buildMonthRange(minMonth: string, maxMonth: string): string[] {
  const months: string[] = [];
  let cursor = minMonth;

  while (cursor <= maxMonth) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }

  return months;
}

export function MonthPickerSelector({ selectedMonth, onChange, minMonth, maxMonth }: Props) {
  const [isModalVisible, setModalVisible] = useState(false);

  const effectiveMaxMonth = maxMonth ?? getDefaultMaxMonth();
  const effectiveMinMonth = minMonth ?? getDefaultMinMonth(effectiveMaxMonth);
  const monthOptions = useMemo(
    () => buildMonthRange(effectiveMinMonth, effectiveMaxMonth),
    [effectiveMinMonth, effectiveMaxMonth],
  );

  const canGoPrevious = selectedMonth > effectiveMinMonth;
  const canGoNext = selectedMonth < effectiveMaxMonth;

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.arrowButton, !canGoPrevious && styles.arrowButtonDisabled]}
          disabled={!canGoPrevious}
          onPress={() => onChange(shiftMonth(selectedMonth, -1))}
        >
          <Text style={[styles.arrowText, !canGoPrevious && styles.arrowTextDisabled]}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.monthButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.monthText}>{formatMonthLabel(selectedMonth)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.arrowButton, !canGoNext && styles.arrowButtonDisabled]}
          disabled={!canGoNext}
          onPress={() => onChange(shiftMonth(selectedMonth, 1))}
        >
          <Text style={[styles.arrowText, !canGoNext && styles.arrowTextDisabled]}>→</Text>
        </TouchableOpacity>
      </View>

      <Modal transparent visible={isModalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir un mois</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {monthOptions.map((month) => {
                const isSelected = month === selectedMonth;
                return (
                  <TouchableOpacity
                    key={month}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      onChange(month);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{formatMonthLabel(month)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    alignSelf: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    ...Shadow.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    fontSize: 18,
    color: Colors.onSurface,
    fontFamily: Fonts.headline,
  },
  arrowTextDisabled: {
    color: Colors.onSurfaceVariant,
  },
  monthButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  monthText: {
    fontSize: 14,
    fontFamily: Fonts.title,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    maxHeight: 360,
    padding: 16,
    ...Shadow.card,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    color: Colors.onSurface,
    fontSize: 16,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
  },
  optionSelected: {
    backgroundColor: Colors.surfaceContainer,
  },
  optionText: {
    color: Colors.onSurface,
    fontFamily: Fonts.body,
  },
  optionTextSelected: {
    fontFamily: Fonts.title,
    fontWeight: '700',
    color: Colors.primary,
  },
});
