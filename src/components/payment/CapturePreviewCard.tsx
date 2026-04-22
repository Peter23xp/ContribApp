import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { GeminiAnalysis } from '../../services/geminiService';

interface CapturePreviewCardProps {
  imageUrl: string;
  geminiResult: GeminiAnalysis | null;
  isAnalyzing: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
}

export function CapturePreviewCard({
  imageUrl,
  geminiResult,
  isAnalyzing,
  status,
}: CapturePreviewCardProps) {
  const hasImage = !!imageUrl;
  
  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return <View style={[styles.statusBadge, { backgroundColor: '#FFA500' }]}><Text style={styles.statusText}>En attente</Text></View>;
      case 'approved':
        return <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}><Text style={styles.statusText}>Approuvée ✓</Text></View>;
      case 'rejected':
        return <View style={[styles.statusBadge, { backgroundColor: '#F44336' }]}><Text style={styles.statusText}>Rejetée ✗</Text></View>;
      case 'needs_review':
        return <View style={[styles.statusBadge, { backgroundColor: '#9C27B0' }]}><Text style={styles.statusText}>Vérification requise</Text></View>;
      default:
        return null;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 85) {
      return <View style={[styles.confidenceBadge, { backgroundColor: '#E8F5E9' }]}><Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>Élevée</Text></View>;
    } else if (confidence >= 60) {
      return <View style={[styles.confidenceBadge, { backgroundColor: '#FFF3E0' }]}><Text style={{ color: '#FF9800', fontWeight: 'bold' }}>Moyenne</Text></View>;
    } else {
      return <View style={[styles.confidenceBadge, { backgroundColor: '#FFEBEE' }]}><Text style={{ color: '#F44336', fontWeight: 'bold' }}>Faible</Text></View>;
    }
  };

  const hasAmountWarning = geminiResult?.warningFlags?.includes('montant_different_attendu');
  const amountColor = hasAmountWarning ? '#F44336' : '#4CAF50';

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.emptyImageState}>
            <Text style={styles.emptyImageText}>Aucune capture disponible</Text>
          </View>
        )}
        
        {getStatusBadge()}

        {isAnalyzing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.analyzingText}>Gemini analyse la capture...</Text>
          </View>
        )}
      </View>

      {geminiResult && !isAnalyzing && (
        <View style={styles.resultCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Montant détecté :</Text>
            <Text style={[styles.value, { color: amountColor, fontWeight: 'bold' }]}>
              {geminiResult.amount !== null ? `${geminiResult.amount} ${geminiResult.currency || ''}` : 'Inconnu'}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Opérateur :</Text>
            <Text style={styles.value}>
              {geminiResult.operator ? geminiResult.operator.toUpperCase() : 'Non détecté'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Référence :</Text>
            <Text style={[styles.value, styles.monospace]}>
              {geminiResult.transactionRef || 'Non trouvée'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date détectée :</Text>
            <Text style={styles.value}>
              {geminiResult.detectedDate || 'Non détectée'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Confiance IA :</Text>
            {getConfidenceBadge(geminiResult.confidence)}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 220,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    // if no resultCard below, also round bottom
  },
  emptyImageState: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyImageText: {
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  analyzingText: {
    color: '#fff',
    marginTop: 10,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultCard: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
  },
  monospace: {
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  }
});
