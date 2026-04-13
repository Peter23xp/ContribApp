/**
 * Menu de développement pour réinitialiser la base de données
 * À utiliser uniquement en développement
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { resetAllData, resetAndSeed } from '../../services/seedData';

export function DevMenu() {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAndSeed = async () => {
    Alert.alert(
      '🔄 Réinitialiser la Base de Données',
      'Toutes les données seront supprimées et recréées. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetAndSeed();
              Alert.alert(
                '✅ Succès',
                'Base de données réinitialisée ! Redémarrez l\'application.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('❌ Erreur', 'Impossible de réinitialiser la base de données.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      '🗑️ Supprimer Toutes les Données',
      'ATTENTION : Toutes les données seront supprimées définitivement !',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              resetAllData();
              Alert.alert(
                '✅ Succès',
                'Toutes les données ont été supprimées. Redémarrez l\'application.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('❌ Erreur', 'Impossible de supprimer les données.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="tools" size={24} color={Colors.primary} />
        <Text style={styles.title}>Menu Développeur</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.buttonPrimary]}
        onPress={handleResetAndSeed}
        disabled={isResetting}
      >
        {isResetting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Réinitialiser avec Seed</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={handleClearAll}
        disabled={isResetting}
      >
        {isResetting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <MaterialCommunityIcons name="delete-forever" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Supprimer Toutes les Données</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.info}>
        <MaterialCommunityIcons name="information-outline" size={16} color={Colors.onSurfaceVariant} />
        <Text style={styles.infoText}>
          Ces actions nécessitent un redémarrage de l'application.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    margin: 20,
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    color: Colors.onSurface,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonDanger: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: '#FFF',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
  },
});
