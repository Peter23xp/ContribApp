import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SCR-010 — Paiement Mobile Money Automatique
 * ⚠️ SUSPENDU — En attente d'intégration de l'agrégateur de paiement (FlexPay / SerdiPay)
 *
 * L'utilisateur est redirigé automatiquement vers SCR-010-B
 * (paiement manuel assisté par Gemini).
 *
 * Cet écran reste dans le projet pour référence future.
 * Il sera réactivé quand l'intégration FlexPay sera disponible.
 */
export default function PayContributionScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payer ma contribution</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>

        {/* BADGE COMING SOON */}
        <View style={styles.comingSoonBadge}>
          <Ionicons name="construct-outline" size={16} color="#F39C12" />
          <Text style={styles.comingSoonText}>En cours d'intégration</Text>
        </View>

        {/* ILLUSTRATION */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationCircle}>
            <Ionicons name="phone-portrait-outline" size={64} color="#BDC3C7" />
          </View>
        </View>

        {/* TITRE */}
        <Text style={styles.title}>
          Paiement Mobile Money{'\n'}Automatique
        </Text>

        {/* DESCRIPTION GRISÉE */}
        <View style={styles.disabledCard}>
          <Text style={styles.disabledCardTitle}>
            🔒 Fonctionnalité suspendue
          </Text>
          <Text style={styles.disabledCardBody}>
            Le paiement automatique via Mobile Money (Airtel Money, Orange Money,
            M-Pesa, MTN MoMo) sera disponible prochainement, après l'intégration
            de notre partenaire de paiement.
          </Text>

          {/* ÉTAPES GRISÉES DE L'ANCIEN FLUX */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>Ce qui sera disponible bientôt :</Text>
            {[
              'Sélectionner votre opérateur Mobile Money',
              'Saisir votre numéro à débiter',
              'Confirmer en un tap — paiement en 30 secondes',
              'Reçu numérique généré automatiquement',
            ].map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SÉPARATEUR */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>En attendant</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* CARTE NOUVEAU FLUX ACTIF */}
        <View style={styles.activeCard}>
          <View style={styles.activeCardHeader}>
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
              <Text style={styles.activeBadgeText}>Disponible maintenant</Text>
            </View>
          </View>
          <Text style={styles.activeCardTitle}>
            Paiement Manuel + Vérification IA
          </Text>
          <Text style={styles.activeCardBody}>
            Effectuez votre paiement Mobile Money manuellement, prenez une
            capture d'écran et soumettez-la. Notre IA (Gemini) analysera
            votre capture et la trésorière validera votre paiement.
          </Text>

          {/* ÉTAPES DU NOUVEAU FLUX */}
          <View style={styles.activeStepsContainer}>
            {[
              { icon: 'phone-portrait-outline', text: 'Payez sur votre app Mobile Money' },
              { icon: 'camera-outline', text: 'Prenez une capture de la confirmation' },
              { icon: 'sparkles-outline', text: 'Gemini analyse automatiquement la capture' },
              { icon: 'checkmark-circle-outline', text: 'La trésorière valide et votre compte est mis à jour' },
            ].map((step, index) => (
              <View key={index} style={styles.activeStepRow}>
                <View style={styles.activeStepIcon}>
                  <Ionicons name={step.icon as any} size={20} color="#27AE60" />
                </View>
                <Text style={styles.activeStepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* BOUTON PRINCIPAL */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SubmitContribution')}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            Soumettre ma capture de paiement
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* BOUTON SECONDAIRE */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Retour</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  body: {
    padding: 16,
    paddingBottom: 40,
  },

  // COMING SOON BADGE
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#F39C12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
    gap: 6,
  },
  comingSoonText: {
    fontSize: 12,
    color: '#F39C12',
    fontWeight: '600',
  },

  // ILLUSTRATION
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  illustrationCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },

  // TITRE
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9E9E9E',           // gris — suspendu
    textAlign: 'center',
    marginBottom: 20,
    textDecorationLine: 'line-through', // barré pour indiquer la suspension
  },

  // CARTE GRISÉE (ancien flux)
  disabledCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
    opacity: 0.7,               // opacité réduite pour l'effet "désactivé"
  },
  disabledCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9E9E9E',
    marginBottom: 8,
  },
  disabledCardBody: {
    fontSize: 13,
    color: '#BDBDBD',
    lineHeight: 20,
    marginBottom: 16,
  },
  stepsContainer: {
    gap: 10,
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BDBDBD',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BDBDBD',
  },
  stepText: {
    fontSize: 13,
    color: '#BDBDBD',
    flex: 1,
  },

  // SÉPARATEUR
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
  },

  // CARTE ACTIVE (nouveau flux)
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#27AE60',
    marginBottom: 24,
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeCardHeader: {
    marginBottom: 10,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '700',
  },
  activeCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  activeCardBody: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  activeStepsContainer: {
    gap: 12,
  },
  activeStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F8EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStepText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    lineHeight: 18,
  },

  // BOUTONS
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#9E9E9E',
  },
});
