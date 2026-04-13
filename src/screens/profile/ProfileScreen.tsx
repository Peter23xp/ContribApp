/**
 * ProfileScreen.tsx — SCR-021 Module 06
 * 
 * Écran de profil et paramètres avec :
 *  - Header visuel (avatar + nom + rôle + téléphone)
 *  - Section "Mon Profil"
 *  - Section "Sécurité"
 *  - Section "Notifications"
 *  - Section "Application"
 *  - Bouton de déconnexion
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AppInput, LoadingOverlay, OperatorSelector, SettingsRow } from '../../components/common';
import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import type { MobileOperator } from '../../services/authService';
import type { UserProfile } from '../../services/userService';
import * as userService from '../../services/userService';
import { useAuthStore } from '../../stores/authStore';

// ─── Types ────────────────────────────────────────────────────

type RoleLabel = 'Administrateur' | 'Trésorière' | 'Membre' | 'Auditeur';
type RoleColor = string;

const ROLE_CONFIG: Record<string, { label: RoleLabel; color: RoleColor; bg: string }> = {
  admin:     { label: 'Administrateur', color: '#D4AF37', bg: '#FFF9E6' },  // doré
  treasurer: { label: 'Trésorière',     color: Colors.tertiary, bg: Colors.tertiaryContainer + '30' },  // bleu
  member:    { label: 'Membre',         color: Colors.secondary, bg: Colors.secondaryContainer + '30' },  // vert clair
  auditor:   { label: 'Auditeur',       color: Colors.warning, bg: '#FFF3E0' },  // orange
};

// ─── Composant principal ──────────────────────────────────────

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // BottomSheets states
  const [showNameModal, setShowNameModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState('');
  const [editOperator, setEditOperator] = useState<MobileOperator | null>(null);
  const [editLanguage, setEditLanguage] = useState<'fr' | 'en'>('fr');
  const [editCurrency, setEditCurrency] = useState<'CDF' | 'USD'>('CDF');

  // ── Chargement du profil ──
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserProfile();
      setProfile(data);
    } catch (error) {
      console.error('[ProfileScreen] loadProfile error:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de charger le profil',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Gestion de la photo de profil ──
  const handlePhotoPress = () => {
    if (Platform.OS === 'ios') {
      const options = profile?.avatar
        ? ['Prendre une photo', 'Choisir dans la galerie', 'Supprimer la photo', 'Annuler']
        : ['Prendre une photo', 'Choisir dans la galerie', 'Annuler'];
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: profile?.avatar ? 2 : undefined,
          cancelButtonIndex: profile?.avatar ? 3 : 2,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) await takePhoto();
          else if (buttonIndex === 1) await pickImage();
          else if (buttonIndex === 2 && profile?.avatar) await deletePhoto();
        }
      );
    } else {
      // Android : utiliser Alert
      const buttons = [
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir dans la galerie', onPress: pickImage },
      ];
      if (profile?.avatar) {
        buttons.push({ text: 'Supprimer la photo', onPress: deletePhoto, style: 'destructive' as const });
      }
      buttons.push({ text: 'Annuler', style: 'cancel' as const });

      Alert.alert('Photo de profil', 'Choisissez une option', buttons);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission refusée',
        text2: 'Accès à la caméra requis',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission refusée',
        text2: 'Accès à la galerie requis',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      setIsUpdating(true);
      await userService.updateAvatar(uri);
      await loadProfile();
      Toast.show({
        type: 'success',
        text1: 'Photo mise à jour',
        text2: 'Votre photo de profil a été modifiée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour la photo',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const deletePhoto = async () => {
    try {
      setIsUpdating(true);
      await userService.deleteAvatar();
      await loadProfile();
      Toast.show({
        type: 'success',
        text1: 'Photo supprimée',
        text2: 'Votre photo de profil a été supprimée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de supprimer la photo',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Gestion des toggles ──
  const handleTogglePreference = async (key: keyof UserProfile['preferences'], value: boolean) => {
    if (!profile) return;
    try {
      const updatedProfile = await userService.updatePreferences({ [key]: value });
      setProfile(updatedProfile);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour les préférences',
      });
    }
  };

  // ── Déconnexion ──
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              // Appeler l'API de déconnexion (ne pas bloquer si erreur)
              await userService.logout().catch(() => {});
              await logout();
              Toast.show({
                type: 'success',
                text1: 'Déconnecté',
                text2: 'À bientôt !',
              });
            } catch (error) {
              // Déconnecter quand même localement
              await logout();
            }
          },
        },
      ]
    );
  };

  // ── Gestion du nom ──
  const handleOpenNameModal = () => {
    setEditName(profile?.fullName ?? '');
    setShowNameModal(true);
  };

  const handleSaveName = async () => {
    if (editName.trim().length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Le nom doit contenir au moins 3 caractères',
      });
      return;
    }

    try {
      setIsUpdating(true);
      await userService.updateProfile({ fullName: editName.trim() });
      await loadProfile();
      setShowNameModal(false);
      Toast.show({
        type: 'success',
        text1: 'Nom mis à jour',
        text2: 'Votre nom a été modifié avec succès',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour le nom',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Gestion de l'opérateur ──
  const handleOpenOperatorModal = () => {
    setEditOperator(profile?.operator as MobileOperator ?? null);
    setShowOperatorModal(true);
  };

  const handleSaveOperator = async () => {
    if (!editOperator) return;

    try {
      setIsUpdating(true);
      await userService.updateProfile({ operator: editOperator });
      await loadProfile();
      setShowOperatorModal(false);
      Toast.show({
        type: 'success',
        text1: 'Opérateur mis à jour',
        text2: 'Votre opérateur a été modifié avec succès',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour l\'opérateur',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Gestion de la biométrie ──
  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      // Vérifier la disponibilité
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Toast.show({
          type: 'warning',
          text1: 'Biométrie non disponible',
          text2: 'Biométrie non disponible sur cet appareil',
        });
        return;
      }

      // Demander confirmation biométrique
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirmez votre identité pour activer la biométrie',
        fallbackLabel: 'Utiliser le code',
      });

      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: 'Authentification échouée',
          text2: 'Impossible d\'activer la biométrie',
        });
        return;
      }

      // Activer
      await userService.toggleBiometric(true);
      await loadProfile();
      Toast.show({
        type: 'success',
        text1: 'Biométrie activée',
        text2: 'Vous pouvez maintenant vous connecter avec la biométrie',
      });
    } else {
      // Désactiver avec confirmation
      Alert.alert(
        'Désactiver la biométrie ?',
        'Vous devrez utiliser votre PIN pour vous connecter.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Désactiver',
            style: 'destructive',
            onPress: async () => {
              await userService.toggleBiometric(false);
              await loadProfile();
              Toast.show({
                type: 'success',
                text1: 'Biométrie désactivée',
                text2: 'Vous devrez utiliser votre PIN',
              });
            },
          },
        ]
      );
    }
  };

  // ── Gestion des notifications push ──
  const handleTogglePush = async (enabled: boolean) => {
    if (enabled) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Toast.show({
          type: 'warning',
          text1: 'Permission refusée',
          text2: 'Permission notifications refusée. Activez-la dans les réglages.',
        });
        return;
      }

      // Récupérer le push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await userService.updatePreferences({ pushEnabled: true });
      await loadProfile();
      Toast.show({
        type: 'success',
        text1: 'Notifications activées',
        text2: 'Vous recevrez les alertes en temps réel',
      });
    } else {
      await handleTogglePreference('pushEnabled', false);
    }
  };

  // ── Gestion de la langue ──
  const handleOpenLanguageModal = () => {
    setEditLanguage(profile?.preferences.language ?? 'fr');
    setShowLanguageModal(true);
  };

  const handleSaveLanguage = async () => {
    try {
      setIsUpdating(true);
      await userService.updatePreferences({ language: editLanguage });
      await loadProfile();
      setShowLanguageModal(false);
      Toast.show({
        type: 'success',
        text1: 'Langue mise à jour',
        text2: 'La langue de l\'application a été modifiée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour la langue',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Gestion de la devise ──
  const handleOpenCurrencyModal = () => {
    setEditCurrency(profile?.preferences.currency ?? 'CDF');
    setShowCurrencyModal(true);
  };

  const handleSaveCurrency = async () => {
    try {
      setIsUpdating(true);
      await userService.updatePreferences({ currency: editCurrency });
      await loadProfile();
      setShowCurrencyModal(false);
      Toast.show({
        type: 'success',
        text1: 'Devise mise à jour',
        text2: 'La devise d\'affichage a été modifiée',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de mettre à jour la devise',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Loading ──
  if (isLoading || !profile) {
    return <LoadingOverlay message="Chargement du profil..." />;
  }

  const roleConfig = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.member;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header visuel */}
      <View style={s.header}>
        <SafeAreaView edges={['top']} style={s.headerContent}>
          {/* Avatar */}
          <View style={s.avatarContainer}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>
                  {profile.fullName
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
            )}
            
            {/* Bouton appareil photo */}
            <TouchableOpacity
              style={s.cameraButton}
              onPress={handlePhotoPress}
              activeOpacity={0.8}
              disabled={isUpdating}
            >
              <Ionicons name="camera" size={16} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Nom */}
          <Text style={s.headerName}>{profile.fullName}</Text>

          {/* Badge rôle */}
          <View style={[s.roleBadge, { backgroundColor: roleConfig.bg }]}>
            <Text style={[s.roleBadgeText, { color: roleConfig.color }]}>
              {roleConfig.label}
            </Text>
          </View>

          {/* Téléphone */}
          <Text style={s.headerPhone}>{profile.phone}</Text>
        </SafeAreaView>
      </View>

      {/* Contenu scrollable */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section : Mon Profil */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mon Profil</Text>
          <View style={s.sectionContent}>
            <SettingsRow
              icon="person-outline"
              label="Nom complet"
              type="navigate"
              onPress={handleOpenNameModal}
              subtitle={profile.fullName}
            />
            <SettingsRow
              icon="business-outline"
              label="Opérateur Mobile Money"
              type="navigate"
              onPress={handleOpenOperatorModal}
              subtitle={profile.operator.toUpperCase()}
            />
            <SettingsRow
              icon="call-outline"
              label="Numéro Mobile Money"
              type="info"
              value={profile.phone}
              subtitle="Le numéro ne peut pas être modifié"
            />
            <SettingsRow
              icon="lock-closed-outline"
              label="Modifier mon code PIN"
              type="navigate"
              onPress={() => navigation.navigate('ChangePIN')}
            />
          </View>
        </View>

        {/* Section : Sécurité */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sécurité</Text>
          <View style={s.sectionContent}>
            <SettingsRow
              icon="finger-print-outline"
              label="Empreinte digitale / Face ID"
              type="toggle"
              value={profile.biometricEnabled}
              onPress={handleToggleBiometric}
              subtitle="Se connecter sans saisir le PIN"
            />
            {profile.lastLogin && (
              <SettingsRow
                icon="time-outline"
                label="Dernière connexion"
                type="info"
                value={new Date(profile.lastLogin.date).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                subtitle={profile.lastLogin.city}
              />
            )}
          </View>
        </View>

        {/* Section : Notifications */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notifications</Text>
          <View style={s.sectionContent}>
            <SettingsRow
              icon="notifications-outline"
              label="Notifications push"
              type="toggle"
              value={profile.preferences.pushEnabled}
              onPress={handleTogglePush}
              subtitle="Alertes en temps réel sur votre téléphone"
            />
            <SettingsRow
              icon="chatbubble-outline"
              label="Rappels par SMS"
              type="toggle"
              value={profile.preferences.smsReminders}
              onPress={(val) => handleTogglePreference('smsReminders', val)}
              subtitle="Recevoir un SMS avant la date d'échéance"
            />
            <SettingsRow
              icon="checkmark-circle-outline"
              label="Confirmation de paiement par SMS"
              type="toggle"
              value={profile.preferences.smsConfirmation}
              onPress={(val) => handleTogglePreference('smsConfirmation', val)}
              subtitle="Recevoir un SMS après chaque paiement confirmé"
            />
            <SettingsRow
              icon="document-text-outline"
              label="Rapport mensuel automatique"
              type="toggle"
              value={profile.preferences.monthlyReport}
              onPress={(val) => handleTogglePreference('monthlyReport', val)}
              subtitle="Recevoir le rapport du mois par notification"
            />
          </View>
        </View>

        {/* Section : Application */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Application</Text>
          <View style={s.sectionContent}>
            <SettingsRow
              icon="language-outline"
              label="Langue"
              type="navigate"
              onPress={handleOpenLanguageModal}
              subtitle={profile.preferences.language === 'fr' ? 'Français' : 'English'}
            />
            <SettingsRow
              icon="cash-outline"
              label="Devise d'affichage"
              type="navigate"
              onPress={handleOpenCurrencyModal}
              subtitle={profile.preferences.currency}
            />
            <SettingsRow
              icon="information-circle-outline"
              label="Version de l'application"
              type="info"
              value={Constants.expoConfig?.version ?? '1.0.0'}
            />
            <SettingsRow
              icon="help-circle-outline"
              label="Aide & Support"
              type="navigate"
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Aide & Support',
                  text2: 'Fonctionnalité à venir',
                });
              }}
            />
            <SettingsRow
              icon="document-outline"
              label="Conditions d'utilisation"
              type="navigate"
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Conditions d\'utilisation',
                  text2: 'Fonctionnalité à venir',
                });
              }}
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              label="Politique de confidentialité"
              type="navigate"
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Politique de confidentialité',
                  text2: 'Fonctionnalité à venir',
                });
              }}
            />
          </View>
        </View>

        {/* Bouton de déconnexion */}
        <View style={[s.section, { marginBottom: 40 }]}>
          <View style={s.sectionContent}>
            <SettingsRow
              label="Se déconnecter"
              type="destructive"
              onPress={handleLogout}
            />
          </View>
        </View>
      </ScrollView>

      {/* Overlay de mise à jour */}
      {isUpdating && <LoadingOverlay message="Mise à jour..." />}

      {/* Modal : Modifier le nom */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNameModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Modifier le nom</Text>
            <AppInput
              label="Nom complet"
              value={editName}
              onChangeText={setEditName}
              placeholder="Entrez votre nom complet"
              autoFocus
            />
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonCancel]}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={s.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={handleSaveName}
                disabled={editName.trim().length < 3}
              >
                <Text style={s.modalButtonConfirmText}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal : Changer d'opérateur */}
      <Modal
        visible={showOperatorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOperatorModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Changer d'opérateur</Text>
            <OperatorSelector
              value={editOperator}
              onChange={setEditOperator}
            />
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonCancel]}
                onPress={() => setShowOperatorModal(false)}
              >
                <Text style={s.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={handleSaveOperator}
                disabled={!editOperator}
              >
                <Text style={s.modalButtonConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal : Changer la langue */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Changer la langue</Text>
            <TouchableOpacity
              style={[s.radioOption, editLanguage === 'fr' && s.radioOptionSelected]}
              onPress={() => setEditLanguage('fr')}
            >
              <View style={s.radioCircle}>
                {editLanguage === 'fr' && <View style={s.radioCircleInner} />}
              </View>
              <Text style={s.radioLabel}>Français</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.radioOption, editLanguage === 'en' && s.radioOptionSelected]}
              onPress={() => setEditLanguage('en')}
            >
              <View style={s.radioCircle}>
                {editLanguage === 'en' && <View style={s.radioCircleInner} />}
              </View>
              <Text style={s.radioLabel}>English</Text>
            </TouchableOpacity>
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonCancel]}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text style={s.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={handleSaveLanguage}
              >
                <Text style={s.modalButtonConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal : Changer la devise */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Changer la devise</Text>
            <TouchableOpacity
              style={[s.radioOption, editCurrency === 'CDF' && s.radioOptionSelected]}
              onPress={() => setEditCurrency('CDF')}
            >
              <View style={s.radioCircle}>
                {editCurrency === 'CDF' && <View style={s.radioCircleInner} />}
              </View>
              <Text style={s.radioLabel}>CDF (Franc Congolais)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.radioOption, editCurrency === 'USD' && s.radioOptionSelected]}
              onPress={() => setEditCurrency('USD')}
            >
              <View style={s.radioCircle}>
                {editCurrency === 'USD' && <View style={s.radioCircleInner} />}
              </View>
              <Text style={s.radioLabel}>USD (Dollar Américain)</Text>
            </TouchableOpacity>
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonCancel]}
                onPress={() => setShowCurrencyModal(false)}
              >
                <Text style={s.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonConfirm]}
                onPress={handleSaveCurrency}
              >
                <Text style={s.modalButtonConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  // Header visuel
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 28,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    overflow: 'hidden',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginTop: 20,
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#004D43',
    borderWidth: 3,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.display,
    fontSize: 32,
    color: '#FFF',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.card,
  },
  headerName: {
    fontFamily: Fonts.display,
    fontSize: 21,
    color: '#FFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: 8,
  },
  roleBadgeText: {
    fontFamily: Fonts.headline,
    fontSize: 13,
    fontWeight: '700',
  },
  headerPhone: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // Contenu scrollable
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 18,
    paddingBottom: 36,
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    color: Colors.onSurface,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionContent: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.outlineVariant + '60',
    borderRadius: Radius.xl,
    marginHorizontal: 16,
    overflow: 'hidden',
    ...Shadow.card,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 30, 39, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    color: Colors.onSurface,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  modalButtonCancelText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
  },
  modalButtonConfirm: {
    backgroundColor: Colors.primary,
  },
  modalButtonConfirmText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: '#FFF',
  },

  // Radio buttons
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  radioOptionSelected: {
    backgroundColor: Colors.primaryContainer + '30',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.onSurface,
  },
});
