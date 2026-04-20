import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, 
  TouchableOpacity, Alert, BackHandler 
} from 'react-native';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/colors';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import GroupCreationStepIndicator from '../../components/common/GroupCreationStepIndicator';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import { ToastNotification } from '../../components/common/ToastNotification';

import { useAuthStore } from '../../stores/authStore';
import { createGroup } from '../../services/groupService';
// Import storageService assuming it exports uploadFile
import { uploadFile } from '../../services/storageService';

export default function GroupCreationScreen({ navigation }: any) {
  const { user, setGroupId } = useAuthStore();
  const adminUid = user?.id || '';

  const [formData, setFormData] = useState({
    // Étape 1
    groupName: '',
    description: '',
    groupPhotoUri: null as string | null,

    // Étape 2
    contributionAmount: '',
    currency: 'CDF' as 'CDF' | 'USD',
    deadlineDay: 15,
    penaltyEnabled: false,
    penaltyType: 'percent' as 'percent' | 'fixed',
    penaltyValue: '',

    // Étape 3
    treasurerName: '',
    treasurerPhone: '',
    treasurerOperator: null as string | null,

    // Étape 4
    requireApproval: false,
    contributionsVisible: true,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<{message: string, type: 'success' | 'error' | 'warning'} | null>(null);

  // Handle hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (currentStep > 1) {
          handlePrev();
          return true;
        } else {
          Alert.alert("Annuler", "Annuler la création du groupe ?", [
            { text: "Non", style: 'cancel' },
            { text: "Oui", style: 'destructive', onPress: () => navigation.goBack() }
          ]);
          return true;
        }
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [currentStep])
  );

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNext = () => {
    let errors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.groupName) errors.groupName = "Le nom du groupe est obligatoire";
      else if (formData.groupName.length < 3) errors.groupName = "Le nom doit faire au moins 3 caractères";

      if (Object.keys(errors).length === 0) {
        setFieldErrors({});
        setCurrentStep(2);
      } else {
        setFieldErrors(errors);
      }
    } else if (currentStep === 2) {
      if (!formData.contributionAmount || parseFloat(formData.contributionAmount) <= 0) {
        errors.contributionAmount = "Entrez un montant valide supérieur à 0";
      }
      if (formData.penaltyEnabled) {
        if (!formData.penaltyValue || parseFloat(formData.penaltyValue) <= 0) {
          errors.penaltyValue = "Entrez une valeur de pénalité valide";
        }
      }

      if (Object.keys(errors).length === 0) {
        setFieldErrors({});
        setCurrentStep(3);
      } else {
        setFieldErrors(errors);
      }
    } else if (currentStep === 3) {
      if (!formData.treasurerName) errors.treasurerName = "Le nom de la trésorière est obligatoire";
      if (!formData.treasurerOperator) errors.treasurerOperator = "Sélectionnez l'opérateur de la trésorière";
      
      if (formData.treasurerOperator && formData.treasurerPhone) {
        const phone = formData.treasurerPhone;
        let isValid = false;
        if (formData.treasurerOperator === 'airtel' && /^\+243(97|98)\d{7}$/.test(phone)) isValid = true;
        else if (formData.treasurerOperator === 'orange' && /^\+243(89|84)\d{7}$/.test(phone)) isValid = true;
        else if (formData.treasurerOperator === 'mpesa' && /^\+243(81|82|83)\d{7}$/.test(phone)) isValid = true;
        else if (formData.treasurerOperator === 'mtn' && /^\+24383\d{7}$/.test(phone)) isValid = true;

        if (!isValid) errors.treasurerPhone = `Ce numéro ne correspond pas au format ${formData.treasurerOperator}`;
      } else if (!formData.treasurerPhone) {
        errors.treasurerPhone = "Le numéro de téléphone est obligatoire";
      }

      if (Object.keys(errors).length === 0) {
        setFieldErrors({});
        setCurrentStep(4);
      } else {
        setFieldErrors(errors);
      }
    }
  };

  const handlePrev = () => {
    setFieldErrors({});
    setCurrentStep(prev => prev - 1);
  };

  const handleCreateGroup = async () => {
    setIsSubmitting(true);
    let groupPhotoUrl = null;

    try {
      if (formData.groupPhotoUri) {
        groupPhotoUrl = (await uploadFile(formData.groupPhotoUri, 'group_photos', adminUid)) as unknown as string;
      }

      const contrAmount = parseFloat(formData.contributionAmount);
      let penaltyPercent = 0;
      if (formData.penaltyEnabled) {
        const pVal = parseFloat(formData.penaltyValue);
        penaltyPercent = formData.penaltyType === 'percent' ? pVal : (pVal / contrAmount) * 100;
      }

      const groupId = await createGroup({
        name: formData.groupName,
        description: formData.description,
        photoUrl: groupPhotoUrl || undefined,
        adminUid: adminUid,
        treasurerUid: adminUid,
        treasurerName: formData.treasurerName,
        treasurerPhone: formData.treasurerPhone,
        treasurerOperator: formData.treasurerOperator as 'airtel' | 'orange' | 'mpesa' | 'mtn',
        contributionAmount: contrAmount,
        currency: formData.currency,
        paymentDeadlineDay: formData.deadlineDay,
        latePenaltyPercent: penaltyPercent,
        requireApproval: formData.requireApproval,
        contributionsVisible: formData.contributionsVisible,
      }, adminUid);

      setGroupId(groupId);

      navigation.replace('GroupReady', { groupId, inviteCode: '' }); // GroupReady fetch of the code or handled there

    } catch (error) {
      showToast("Erreur lors de la création. Réessayez.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData(prev => ({ ...prev, groupPhotoUri: result.assets[0].uri }));
    }
  };

  const renderStepHeader = () => {
    let title = "";
    switch (currentStep) {
      case 1: title = "Identité du groupe"; break;
      case 2: title = "Paramètres financiers"; break;
      case 3: title = "La trésorière"; break;
      case 4: title = "Règles d'accès"; break;
    }

    return (
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (currentStep === 1) {
              Alert.alert("Annuler", "Annuler la création du groupe ?", [
                { text: "Non", style: 'cancel' },
                { text: "Oui", style: 'destructive', onPress: () => navigation.goBack() }
              ]);
            } else {
              handlePrev();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderStepHeader()}
      <GroupCreationStepIndicator currentStep={currentStep} />
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
          
          {currentStep === 1 && (
            <View>
              <View style={styles.photoSection}>
                <TouchableOpacity style={styles.photoCircle} onPress={pickImage}>
                  {formData.groupPhotoUri ? (
                    <>
                      <View style={[styles.photoCircle, { backgroundColor: '#E8F8EF' }]} />
                      <Text style={{ position: 'absolute' }}>Photo sélectionnée</Text>
                      <TouchableOpacity 
                        style={styles.removePhoto} 
                        onPress={() => setFormData(prev => ({ ...prev, groupPhotoUri: null }))}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
              <Ionicons name="camera" size={32} color={Colors.primary} />
              <Text style={styles.photoText}>Ajouter une photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <AppInput
                label="Nom du groupe *"
                placeholder="Ex : Tontine des Mamans du Marché"
                value={formData.groupName}
                onChangeText={t => setFormData({ ...formData, groupName: t })}
                maxLength={100}
                error={fieldErrors.groupName}
              />
              <Text style={styles.charCount}>{formData.groupName.length}/100</Text>
              
              <View style={styles.mb24} />

              <AppInput
                label="Description ou objectif du groupe"
                placeholder="Ex : Contributions mensuelles pour soutenir..."
                value={formData.description}
                onChangeText={t => setFormData({ ...formData, description: t })}
                maxLength={300}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: 'top' }}
              />
              <Text style={styles.charCount}>{formData.description.length}/300</Text>
            </View>
          )}

          {currentStep === 2 && (
            <View>
              <AppInput
                label={`Montant mensuel * [${formData.currency}]`}
                placeholder="Ex : 5000"
                value={formData.contributionAmount}
                onChangeText={t => setFormData({ ...formData, contributionAmount: t })}
                keyboardType="numeric"
                error={fieldErrors.contributionAmount}
              />
              <Text style={styles.infoText}>Ce montant sera demandé à chaque membre chaque mois, sans exception</Text>
              
              <View style={styles.mb24} />

              <Text style={styles.label}>Devise</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.currencyTile, formData.currency === 'CDF' && styles.currencyTileActive]}
                  onPress={() => setFormData({ ...formData, currency: 'CDF' })}
                >
                  <Text style={[styles.currencyText, formData.currency === 'CDF' && styles.currencyTextActive]}>CDF — Franc Congolais</Text>
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                <TouchableOpacity 
                  style={[styles.currencyTile, formData.currency === 'USD' && styles.currencyTileActive]}
                  onPress={() => setFormData({ ...formData, currency: 'USD' })}
                >
                  <Text style={[styles.currencyText, formData.currency === 'USD' && styles.currencyTextActive]}>USD — Dollar américain</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mb24} />
              
              <Text style={styles.label}>Jour de l'échéance mensuelle *</Text>
              <Text style={styles.deadlineTitle}>Le {formData.deadlineDay} de chaque mois</Text>
              {/* Fake Slider for simplicity as standard rn doesn't have it, normally use @react-native-community/slider */}
              <View style={styles.sliderContainer}>
                <TouchableOpacity onPress={() => setFormData(p => ({...p, deadlineDay: Math.max(2, p.deadlineDay - 1)}))}>
                  <Ionicons name="remove-circle" size={32} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={{fontSize: 20, fontWeight: 'bold'}}>{formData.deadlineDay}</Text>
                <TouchableOpacity onPress={() => setFormData(p => ({...p, deadlineDay: Math.min(28, p.deadlineDay + 1)}))}>
                  <Ionicons name="add-circle" size={32} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoText}>Limité à 28 pour éviter les problèmes en février</Text>

              <View style={styles.mb24} />

              <TouchableOpacity 
                style={styles.toggleRow} 
                onPress={() => setFormData({ ...formData, penaltyEnabled: !formData.penaltyEnabled })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Activer une pénalité de retard</Text>
                  <Text style={styles.infoText}>Une pénalité sera ajoutée passée la date d'échéance</Text>
                </View>
                <View style={[styles.toggleDot, formData.penaltyEnabled && styles.toggleDotActive]} />
              </TouchableOpacity>

              {formData.penaltyEnabled && (
                <View style={{ marginTop: 16 }}>
                  <View style={styles.row}>
                    <TouchableOpacity 
                      style={[styles.currencyTile, formData.penaltyType === 'percent' && styles.currencyTileActive]}
                      onPress={() => setFormData({ ...formData, penaltyType: 'percent' })}
                    >
                      <Text style={[styles.currencyText, formData.penaltyType === 'percent' && styles.currencyTextActive]}>% du montant</Text>
                    </TouchableOpacity>
                    <View style={{ width: 12 }} />
                    <TouchableOpacity 
                      style={[styles.currencyTile, formData.penaltyType === 'fixed' && styles.currencyTileActive]}
                      onPress={() => setFormData({ ...formData, penaltyType: 'fixed' })}
                    >
                      <Text style={[styles.currencyText, formData.penaltyType === 'fixed' && styles.currencyTextActive]}>Montant fixe</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ marginTop: 16 }}>
                    <AppInput
                      label="Valeur de la pénalité"
                      placeholder={formData.penaltyType === 'percent' ? "Ex : 10" : "Ex : 500"}
                      value={formData.penaltyValue}
                      onChangeText={t => setFormData({ ...formData, penaltyValue: t })}
                      keyboardType="numeric"
                      error={fieldErrors.penaltyValue}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {currentStep === 3 && (
            <View>
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color="#0288D1" />
                <Text style={styles.infoCardText}>
                  La trésorière reçoit les paiements des membres sur son compte Mobile Money. 
                  Son numéro sera affiché aux membres au moment du paiement.
                </Text>
              </View>

              <AppInput
                label="Nom complet de la trésorière *"
                placeholder="Ex : Marie Kabila"
                value={formData.treasurerName}
                onChangeText={t => setFormData({ ...formData, treasurerName: t })}
                error={fieldErrors.treasurerName}
              />
              <View style={styles.mb24} />

              <Text style={styles.label}>Opérateur Mobile Money *</Text>
              <OperatorSelector 
                value={formData.treasurerOperator as any}
                onChange={(op: any) => setFormData({ ...formData, treasurerOperator: op })}
              />
              {fieldErrors.treasurerOperator && <Text style={styles.errorText}>{fieldErrors.treasurerOperator}</Text>}
              
              <View style={styles.mb24} />

              <AppInput
                label="Numéro Mobile Money *"
                placeholder="+243..."
                value={formData.treasurerPhone}
                onChangeText={t => setFormData({ ...formData, treasurerPhone: t })}
                keyboardType="phone-pad"
                error={fieldErrors.treasurerPhone}
              />

              {formData.treasurerName && formData.treasurerPhone ? (
                <View style={styles.previewCard}>
                  <Text style={{ fontWeight: 'bold' }}>{formData.treasurerName}</Text>
                  <Text>{formData.treasurerPhone}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Les paiements seront envoyés à ce compte</Text>
                </View>
              ) : null}
            </View>
          )}

          {currentStep === 4 && (
            <View>
              <Text style={styles.infoText}>Ces paramètres définissent comment les membres rejoignent et interagissent dans le groupe.</Text>
              <View style={styles.mb24} />

              <TouchableOpacity 
                style={styles.toggleRow} 
                onPress={() => setFormData({ ...formData, requireApproval: !formData.requireApproval })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Approbation manuelle des membres</Text>
                  <Text style={styles.infoText}>
                    {formData.requireApproval 
                      ? "Vous devrez approuver chaque nouvelle demande d'adhésion" 
                      : "Tout membre avec le code d'invitation peut rejoindre automatiquement"}
                  </Text>
                </View>
                <View style={[styles.toggleDot, formData.requireApproval && styles.toggleDotActive]} />
              </TouchableOpacity>
              
              <View style={styles.mb24} />

              <TouchableOpacity 
                style={styles.toggleRow} 
                onPress={() => setFormData({ ...formData, contributionsVisible: !formData.contributionsVisible })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Contributions visibles par tous</Text>
                  <Text style={styles.infoText}>
                    {formData.contributionsVisible
                      ? "Les membres peuvent voir qui a payé et qui ne l'a pas encore fait"
                      : "Seuls vous et la trésorière voyez les statuts de paiement"}
                  </Text>
                </View>
                <View style={[styles.toggleDot, formData.contributionsVisible && styles.toggleDotActive]} />
              </TouchableOpacity>

              <View style={styles.mb24} />

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Récapitulatif de votre groupe</Text>
                <Text style={styles.summaryLine}>Nom : {formData.groupName}</Text>
                <Text style={styles.summaryLine}>Montant : {formData.contributionAmount} {formData.currency} / mois</Text>
                <Text style={styles.summaryLine}>Échéance : le {formData.deadlineDay} de chaque mois</Text>
                <Text style={styles.summaryLine}>Pénalité : {formData.penaltyEnabled ? `${formData.penaltyValue} ${formData.penaltyType}` : "Aucune"}</Text>
                <Text style={styles.summaryLine}>Trésorière : {formData.treasurerName} — {formData.treasurerOperator}</Text>
                <Text style={styles.summaryLine}>Approbation : {formData.requireApproval ? "Manuelle" : "Automatique"}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <AppButton 
            title="← Précédent" 
            onPress={handlePrev} 
            variant="outline" 
            style={{ flex: 1, marginRight: 8 }} 
          />
        )}
        {currentStep < 4 ? (
          <AppButton 
            title="Suivant →" 
            onPress={handleNext} 
            style={{ flex: 2 }} 
          />
        ) : (
          <AppButton 
            title="Créer le groupe ✓" 
            onPress={handleCreateGroup} 
            style={{ flex: 2 }} 
          />
        )}
      </View>

      {isSubmitting && <LoadingOverlay message="Création du groupe en cours..." />}
      {toastMessage && <View style={styles.toastContainer}><ToastNotification message={toastMessage.message} type={toastMessage.type as any} onHide={() => setToastMessage(null)} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 24,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F8EF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoText: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  currencyTile: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyTileActive: {
    backgroundColor: Colors.primary,
  },
  currencyText: {
    color: '#666',
    fontWeight: 'bold',
  },
  currencyTextActive: {
    color: '#FFF',
  },
  deadlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginVertical: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleDot: {
    width: 48,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  toggleDotActive: {
    backgroundColor: Colors.primary,
  },
  infoCard: {
    backgroundColor: '#E1F5FE',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoCardText: {
    flex: 1,
    marginLeft: 12,
    color: '#0277BD',
    fontSize: 14,
    lineHeight: 20,
  },
  previewCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  summaryLine: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  mb24: {
    height: 24,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  }
});
