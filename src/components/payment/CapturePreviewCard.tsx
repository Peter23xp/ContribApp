import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { GeminiAnalysis } from '../../services/geminiService';

interface CapturePreviewCardProps {
  imageUrl: string;
  geminiResult: GeminiAnalysis | null;
  isAnalyzing: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
}

const STATUS_THEME: Record<
  CapturePreviewCardProps['status'],
  { label: string; bg: string; color: string; border: string }
> = {
  pending: {
    label: 'En attente',
    bg: '#FFF3E0',
    color: Colors.statusPending,
    border: '#FFD39A',
  },
  approved: {
    label: 'Approuvee',
    bg: '#E8F5E9',
    color: Colors.statusPaid,
    border: '#A9D8AF',
  },
  rejected: {
    label: 'Rejetee',
    bg: '#FFEBEE',
    color: Colors.error,
    border: '#F2B8BD',
  },
  needs_review: {
    label: 'Verification requise',
    bg: Colors.tertiaryContainer + '18',
    color: Colors.info,
    border: Colors.tertiaryContainer + '55',
  },
};

function getConfidenceTheme(confidence: number) {
  if (confidence >= 85) {
    return { label: 'Elevee', bg: '#E8F5E9', color: Colors.statusPaid };
  }

  if (confidence >= 60) {
    return { label: 'Moyenne', bg: '#FFF3E0', color: Colors.statusPending };
  }

  return { label: 'Faible', bg: '#FFEBEE', color: Colors.error };
}

export function CapturePreviewCard({
  imageUrl,
  geminiResult,
  isAnalyzing,
  status,
}: CapturePreviewCardProps) {
  const hasImage = !!imageUrl;
  const statusTheme = STATUS_THEME[status];
  const confidenceTheme = getConfidenceTheme(Number(geminiResult?.confidence ?? 0));
  const hasAmountWarning = geminiResult?.warningFlags?.includes('montant_different_attendu');

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {hasImage ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.emptyImageState}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>+</Text>
            </View>
            <Text style={styles.emptyImageTitle}>Aucune capture disponible</Text>
            <Text style={styles.emptyImageText}>
              Ajoutez une image nette pour faciliter la verification du paiement.
            </Text>
          </View>
        )}

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
          ]}
        >
          <Text style={[styles.statusText, { color: statusTheme.color }]}>
            {statusTheme.label}
          </Text>
        </View>

        {isAnalyzing ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.analyzingText}>Gemini analyse la capture...</Text>
            <Text style={styles.analyzingSubtext}>Extraction du montant et des references</Text>
          </View>
        ) : null}
      </View>

      {geminiResult ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultEyebrow}>Lecture automatique</Text>
              <Text style={styles.resultTitle}>Synthese de la capture</Text>
            </View>
            <View style={[styles.confidenceBadge, { backgroundColor: confidenceTheme.bg }]}>
              <Text style={[styles.confidenceText, { color: confidenceTheme.color }]}>
                {confidenceTheme.label} {Math.round(geminiResult.confidence)}%
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Montant detecte</Text>
              <Text
                style={[
                  styles.metricValue,
                  hasAmountWarning && { color: Colors.error },
                ]}
              >
                {geminiResult.amount !== null
                  ? `${geminiResult.amount} ${geminiResult.currency || ''}`.trim()
                  : 'Inconnu'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Operateur</Text>
              <Text style={styles.metricValue}>
                {geminiResult.operator ? geminiResult.operator.toUpperCase() : 'Non detecte'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Reference</Text>
              <Text style={styles.metricMono}>
                {geminiResult.transactionRef || 'Non trouvee'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Date detectee</Text>
              <Text style={styles.metricValue}>
                {geminiResult.detectedDate || 'Non detectee'}
              </Text>
            </View>
          </View>

          {geminiResult.warningFlags?.length ? (
            <View style={styles.flagsRow}>
              {geminiResult.warningFlags.map((flag) => (
                <View key={flag} style={styles.flagChip}>
                  <Text style={styles.flagChipText}>{flag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant + '42',
    overflow: 'hidden',
    ...Shadow.card,
  },
  imageContainer: {
    position: 'relative',
    height: 238,
    width: '100%',
    backgroundColor: Colors.surfaceContainerLow,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyImageState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.surfaceContainerLow,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIcon: {
    color: Colors.primary,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 30,
  },
  emptyImageTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 6,
  },
  emptyImageText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7, 30, 39, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  analyzingText: {
    color: '#FFFFFF',
    marginTop: 14,
    fontFamily: Fonts.headline,
    fontSize: 16,
    textAlign: 'center',
  },
  analyzingSubtext: {
    color: 'rgba(255,255,255,0.74)',
    marginTop: 6,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Fonts.headline,
  },
  resultCard: {
    padding: 18,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  resultEyebrow: {
    fontFamily: Fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: 4,
  },
  resultTitle: {
    fontFamily: Fonts.headline,
    fontSize: 17,
    color: Colors.onSurface,
  },
  confidenceBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confidenceText: {
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
  },
  metricLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    lineHeight: 20,
  },
  metricMono: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  flagChip: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  flagChipText: {
    color: Colors.statusPending,
    fontFamily: Fonts.headline,
    fontSize: 12,
  },
});
