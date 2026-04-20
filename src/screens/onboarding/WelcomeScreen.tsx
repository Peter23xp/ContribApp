import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, SafeAreaView, TextInput } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';

export default function WelcomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  const handleCreateGroup = () => {
    navigation.navigate('GroupCreation');
  };

  const handleJoinGroup = () => {
    // Logic to join group, not implemented yet
    setShowInviteModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Placeholder for Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="people-circle" size={140} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Bienvenue, {firstName} ! 👋</Text>
        <Text style={styles.subtitle}>
          Vous êtes administrateur. Commencez par créer votre groupe de contribution.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ce que vous allez configurer :</Text>
          
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.listItemText}>Le nom et les règles de votre groupe</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.listItemText}>Le montant de contribution mensuelle</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.listItemText}>Les coordonnées de la trésorière</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.listItemText}>Votre code d'invitation pour les membres</Text>
          </View>

          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>⏱ 2 minutes</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <AppButton 
          title="Créer mon groupe →" 
          onPress={handleCreateGroup} 
          style={styles.mainButton} 
        />

        <TouchableOpacity onPress={() => setShowInviteModal(true)}>
          <Text style={styles.secondaryLink}>J'ai déjà un code d'invitation</Text>
        </TouchableOpacity>
      </View>

      {/* Basic Modal for Invite Code */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rejoindre un groupe</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Saisissez le code d'invitation qu'on vous a fourni.</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: GRP-7K4M2X"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
            />
            <AppButton 
              title="Rejoindre" 
              onPress={handleJoinGroup} 
              disabled={inviteCode.length === 0}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#E8F8EF',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  durationContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  spacer: {
    flex: 1,
    minHeight: 32,
  },
  mainButton: {
    marginBottom: 20,
  },
  secondaryLink: {
    color: '#666666',
    textDecorationLine: 'underline',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
});
