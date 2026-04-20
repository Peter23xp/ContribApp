/**
 * SCR-013 — Configuration / Création du Groupe
 * GroupConfigScreen.tsx
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Switch,
  ActivityIndicator, Image, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

import { Colors, Fonts, Radius, Shadow } from '../../constants/colors';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { OperatorSelector } from '../../components/common/OperatorSelector';
import { SettingToggleRow } from '../../components/common/SettingToggleRow';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import {
  fetchGroupConfig,
  createGroup,
  updateGroup,
  type GroupConfig,
} from '../../services/groupService';
import { useAuthStore } from '../../stores/authStore';

interface FormState {
  photoUri: string | null;
  name: string;
  description: string;
  monthlyAmount: string;
  currency: 'CDF' | 'USD';
  dueDay: number;
  penaltyEnabled: boolean;
  penaltyType: 'fixed' | 'percentage';
  penaltyAmount: string;
  treasurerName: string;
  treasurerPhone: string;
  treasurerOperator: 'airtel' | 'orange' | 'mpesa' | 'mtn' | null;
  requireApproval: boolean;
  paymentsVisible: boolean;
}

const EMPTY_FORM: FormState = {
  photoUri: null,
  name: '',
  description: '',
  monthlyAmount: '',
  currency: 'CDF',
  dueDay: 15,
  penaltyEnabled: false,
  penaltyType: 'fixed',
  penaltyAmount: '0',
  treasurerName: '',
  treasurerPhone: '',
  treasurerOperator: null,
  requireApproval: true,
  paymentsVisible: false,
};

function configToForm(c: GroupConfig): FormState {
  return {
    photoUri:          c.photoUrl ?? null,
    name:              c.name,
    description:       c.description ?? '',
    monthlyAmount:     String(c.monthlyAmount),
    currency:          c.currency,
    dueDay:            c.dueDay,
    penaltyEnabled:    c.penaltyEnabled || c.penaltyAmount > 0,
    penaltyType:       c.penaltyType || 'fixed',
    penaltyAmount:     String(c.penaltyAmount),
    requireApproval:   c.requireApproval,
    paymentsVisible:   c.paymentsVisible,
    treasurerName:     c.treasurerName,
    treasurerPhone:    c.treasurerPhone,
    treasurerOperator: c.treasurerOperator,
  };
}

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <TouchableOpacity style={s.tooltip} onPress={() => setVisible(false)} activeOpacity={0.9}>
      <MaterialCommunityIcons name="information-outline" size={14} color={Colors.primary} />
      <Text style={s.tooltipText}>{text}</Text>
    </TouchableOpacity>
  );
}

export default function GroupConfigScreen({ navigation, route }: any) {
  const user = useAuthStore(state => state.user);
  const groupId: string | undefined = route?.params?.groupId;
  const isEdit = !!groupId;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [hasContributions, setHasContributions] = useState(isEdit); // Simule le fait que le groupe ait des paiements
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  
  // Modals de pré-validation
  const [modal, setModal] = useState<null | 'amount' | 'treasurer'>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isEdit || !groupId) return;
    fetchGroupConfig(groupId)
      .then(data => {
        const f = configToForm(data);
        setForm(f);
        setOriginal(f);
        setHasContributions(true); // En vrai, dépendrait des données de l'API
      })
      .catch(() => Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de charger la config.' }))
      .finally(() => setIsLoading(false));
  }, [groupId]);

  const isDirty = JSON.stringify({ ...form, photoUri: null }) !== JSON.stringify({ ...original, photoUri: null });
  const amountChanged = isEdit && form.monthlyAmount !== original.monthlyAmount;
  const treasurerChanged = isEdit && (
    form.treasurerName !== original.treasurerName ||
    form.treasurerPhone !== original.treasurerPhone ||
    form.treasurerOperator !== original.treasurerOperator
  );

  const setF = <K extends keyof FormState>(key: K) => (val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  // ─── Actions sur la Photo ───
  const handlePhotoSelect = () => {
    Alert.alert('Photo du Groupe', 'Choisissez une option', [
      { text: 'Prendre une photo', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission requise', 'Accès à la caméra refusé.');
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });
          if (!result.canceled) processPhoto(result.assets[0].uri);
        }
      },
      { text: 'Choisir dans la galerie', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission requise', 'Accès à la galerie refusé.');
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });
          if (!result.canceled) processPhoto(result.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  const processPhoto = async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setF('photoUri')(manipResult.uri);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Traitement de l\'image impossible.' });
    }
  };

  // ─── Validation ───
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Le nom du groupe est obligatoire.';
    if (!form.monthlyAmount || Number(form.monthlyAmount) <= 0) e.monthlyAmount = 'Montant invalide.';
    if (!form.treasurerName.trim()) e.treasurerName = 'Nom requis.';
    if (!form.treasurerPhone.trim()) e.treasurerPhone = 'Numéro de téléphone requis.';
    if (!form.treasurerOperator) e.treasurerOperator = 'Sélectionnez un opérateur pour la trésorière.';
    if (form.penaltyEnabled && (!form.penaltyAmount || Number(form.penaltyAmount) <= 0)) e.penaltyAmount = 'Valeur de pénalité invalide.';
    
    setErrors(e);
    if (Object.keys(e).length > 0) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    return true;
  };

  // ─── Sauvegarde ───
  const doSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim(),
        monthlyAmount: Number(form.monthlyAmount),
        currency: form.currency,
        dueDay: form.dueDay,
        penaltyEnabled: form.penaltyEnabled,
        penaltyType: form.penaltyType,
        penaltyAmount: form.penaltyEnabled ? Number(form.penaltyAmount) : 0,
        requireApproval: form.requireApproval,
        paymentsVisible: form.paymentsVisible,
        treasurerName: form.treasurerName.trim(),
        treasurerPhone: form.treasurerPhone.trim(),
        treasurerOperator: form.treasurerOperator!,
      };

      // Notes: L'upload de la photo sera fait ici (ex: upload vers S3) puis affectation de payload.photoUrl.
      if (form.photoUri && form.photoUri !== original.photoUri) {
        // payload.photoUrl = uploadedUrl;
      }

      if (isEdit && groupId) {
        await updateGroup(groupId, payload, user?.id ?? '');
        Toast.show({ type: 'success', text1: 'Configuration sauvegardée' });
        navigation.goBack();
      } else {
        await createGroup(payload, user?.id ?? '');
        Toast.show({ type: 'success', text1: 'Groupe créé !' });
        navigation.navigate('DashboardTab');
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de sauvegarder.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePress = () => {
    if (!validate()) return;
    if (isEdit && treasurerChanged) {
      setModal('treasurer');
      return;
    }
    if (isEdit && amountChanged && hasContributions) {
      setModal('amount');
      return;
    }
    doSave();
  };

  const handleModalConfirm = () => {
    const currentModal = modal;
    setModal(null);
    if (currentModal === 'treasurer' && isEdit && amountChanged && hasContributions) {
      setTimeout(() => setModal('amount'), 500);
    } else {
      doSave();
    }
  };

  if (isLoading) {
    return (
      <View style={s.loadingCenter}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, fontFamily: Fonts.body, color: Colors.primary }}>
          Chargement de la configuration...
        </Text>
      </View>
    );
  }

  const isFormValid = !!(form.name.trim() && form.monthlyAmount && form.treasurerName.trim() && form.treasurerPhone.trim() && form.treasurerOperator);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* HEADER */}
      <View style={s.header}>
        {isEdit && (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>{isEdit ? 'Modifier le groupe' : 'Créer mon groupe'}</Text>
        {isEdit && isDirty && (
          <View style={s.dirtyBadge}>
            <Text style={s.dirtyBadgeText}>Non sauvegardé</Text>
          </View>
        )}
      </View>

      <ScrollView ref={scrollViewRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* SECTION 1 : Identité du groupe */}
        <Text style={s.sectionTitle}>Identité du groupe</Text>
        <View style={s.card}>
          <View style={s.photoRow}>
            <TouchableOpacity style={s.photoCircle} onPress={handlePhotoSelect} activeOpacity={0.8}>
              {form.photoUri ? (
                <Image source={{ uri: form.photoUri }} style={s.photoImg} />
              ) : (
                <MaterialCommunityIcons name="camera-plus-outline" size={32} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          <AppInput
            label="Nom du groupe"
            value={form.name}
            onChangeText={(txt) => setF('name')(txt.substring(0, 100))}
            placeholder="Ex : Mutuelle Les As"
            error={errors.name}
            rightIcon={<Text style={s.counter}>{form.name.length}/100</Text>}
          />
          {!isEdit && <Tooltip text="Ce nom sera visible par tous les membres. Choisissez un nom clair." />}

          <AppInput
            label="Description ou objectif (optionnel)"
            value={form.description}
            onChangeText={(txt) => setF('description')(txt.substring(0, 300))}
            placeholder="Ex : Contribution mensuelle pour..."
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top' }}
            rightIcon={<Text style={s.counter}>{form.description.length}/300</Text>}
          />
        </View>

        {/* SECTION 2 : Paramètres financiers */}
        <Text style={s.sectionTitle}>Paramètres financiers</Text>
        <View style={s.card}>
          <AppInput
            label="Montant mensuel"
            value={form.monthlyAmount}
            onChangeText={setF('monthlyAmount')}
            keyboardType="numeric"
            placeholder="Ex : 50"
            error={errors.monthlyAmount}
            rightIcon={<Text style={s.currencySuffix}>{form.currency}</Text>}
          />
          {isEdit && hasContributions && (
            <View style={s.warningBanner}>
              <MaterialCommunityIcons name="alert" size={14} color="#F57F17" />
              <Text style={s.warningBannerText}>
                Modifier ce montant n'affectera pas les contributions déjà enregistrées.
              </Text>
            </View>
          )}
          {!isEdit && <Tooltip text="Ce montant sera demandé à chaque membre chaque mois." />}

          <View style={s.currencySelector}>
             <TouchableOpacity style={[s.currencyBtn, form.currency === 'CDF' && s.currencyBtnActive]} onPress={() => setF('currency')('CDF')}>
               <Text style={[s.currencyBtnText, form.currency === 'CDF' && s.currencyBtnTextActive]}>Francs Congolais (CDF)</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[s.currencyBtn, form.currency === 'USD' && s.currencyBtnActive]} onPress={() => setF('currency')('USD')}>
               <Text style={[s.currencyBtnText, form.currency === 'USD' && s.currencyBtnTextActive]}>Dollars (USD)</Text>
             </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={s.fieldLabel}>Jour de l'échéance (1 à 28)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10, gap: 10 }}>
              {[...Array(28)].map((_, i) => {
                const day = i + 1;
                const active = form.dueDay === day;
                return (
                  <TouchableOpacity key={day} style={[s.dayPill, active && s.dayPillActive]} onPress={() => setF('dueDay')(day)}>
                    <Text style={[s.dayPillText, active && s.dayPillTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={s.subLabel}>Les contributions seront dues le {form.dueDay} de chaque mois</Text>
          </View>

          <View style={s.penaltySection}>
            <View style={s.penaltyHeader}>
              <Text style={s.fieldLabel}>Activer une pénalité de retard</Text>
              <Switch
                value={form.penaltyEnabled}
                onValueChange={setF('penaltyEnabled')}
                trackColor={{ false: Colors.outlineVariant, true: Colors.secondaryContainer }}
                thumbColor={form.penaltyEnabled ? Colors.secondary : Colors.surfaceContainerHigh}
              />
            </View>
            
            {form.penaltyEnabled && (
              <View style={s.penaltyBody}>
                <View style={s.currencySelector}>
                  <TouchableOpacity style={[s.currencyBtn, form.penaltyType === 'fixed' && s.currencyBtnActive]} onPress={() => setF('penaltyType')('fixed')}>
                    <Text style={[s.currencyBtnText, form.penaltyType === 'fixed' && s.currencyBtnTextActive]}>Montant fixe ({form.currency})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.currencyBtn, form.penaltyType === 'percentage' && s.currencyBtnActive]} onPress={() => setF('penaltyType')('percentage')}>
                    <Text style={[s.currencyBtnText, form.penaltyType === 'percentage' && s.currencyBtnTextActive]}>Pourcentage (%)</Text>
                  </TouchableOpacity>
                </View>
                <AppInput
                  label="Valeur de la pénalité"
                  value={form.penaltyAmount}
                  onChangeText={setF('penaltyAmount')}
                  keyboardType="numeric"
                  placeholder={form.penaltyType === 'fixed' ? 'Ex: 5000' : 'Ex: 5'}
                  error={errors.penaltyAmount}
                />
              </View>
            )}
            <Text style={s.subLabel}>La pénalité est ajoutée automatiquement après la date d'échéance.</Text>
          </View>
        </View>

        {/* SECTION 3 : Trésorière */}
        <Text style={s.sectionTitle}>Trésorière</Text>
        <View style={s.card}>
          <AppInput
            label="Nom complet de la trésorière"
            value={form.treasurerName}
            onChangeText={setF('treasurerName')}
            placeholder="Ex : Marie Kabila"
            error={errors.treasurerName}
          />
          <AppInput
            label="Numéro Mobile Money de la trésorière"
            value={form.treasurerPhone}
            onChangeText={setF('treasurerPhone')}
            placeholder="+243 9X XXX XXXX"
            keyboardType="phone-pad"
            error={errors.treasurerPhone}
          />
          <Text style={s.fieldLabel}>Opérateur de la trésorière</Text>
          <OperatorSelector value={form.treasurerOperator} onChange={setF('treasurerOperator')} />
          {errors.treasurerOperator && <Text style={s.errorText}>{errors.treasurerOperator}</Text>}
          
          {isEdit && treasurerChanged && (
            <View style={s.infoBanner}>
              <MaterialCommunityIcons name="information" size={16} color={Colors.tertiary} />
              <Text style={s.infoBannerText}>
                Les futurs paiements seront dirigés vers ce nouveau compte. Les paiements existants ne sont pas affectés.
              </Text>
            </View>
          )}
        </View>

        {/* SECTION 4 : Règles et accès */}
        <Text style={s.sectionTitle}>Règles et accès</Text>
        <View style={s.card}>
          <SettingToggleRow
            title="Approbation manuelle des nouveaux membres"
            value={form.requireApproval}
            onValueChange={setF('requireApproval')}
          />
          <Text style={s.subLabelToggle}>
            {form.requireApproval 
              ? "L'Admin doit approuver chaque nouvelle inscription avant que le membre puisse payer."
              : "Tout membre possédant le code d'invitation peut rejoindre automatiquement."}
          </Text>

          <View style={s.divider} />

          <SettingToggleRow
            title="Contributions visibles par tous les membres"
            value={form.paymentsVisible}
            onValueChange={setF('paymentsVisible')}
          />
          <Text style={s.subLabelToggle}>
            {form.paymentsVisible 
              ? "Les membres peuvent voir qui a payé et qui ne l'a pas encore fait."
              : "Seuls Admin et Trésorière voient les statuts de paiement."}
          </Text>
        </View>

        <View style={{ height: 40 }} />

        <AppButton 
          title="Sauvegarder la configuration" 
          onPress={handleSavePress} 
          loading={isSaving} 
          disabled={!isFormValid || isSaving}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      {modal === 'treasurer' && (
        <ConfirmModal
          message={`Les prochains paiements des membres seront envoyés à ${form.treasurerName} sur ${form.treasurerOperator}. Confirmer ?`}
          onConfirm={handleModalConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'amount' && (
        <ConfirmModal
          message="Modifier le montant affectera les futurs paiements uniquement. Confirmer ?"
          onConfirm={handleModalConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.outlineVariant + '40',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceContainerHigh,
  },
  headerTitle: { flex: 1, fontFamily: Fonts.display, fontSize: 20, color: Colors.onSurface, letterSpacing: -0.3 },
  dirtyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: '#FFF3E0' },
  dirtyBadgeText: { fontFamily: Fonts.label, fontSize: 11, fontWeight: '700', color: '#EF6C00' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontFamily: Fonts.headline, fontSize: 16, color: Colors.primary, marginLeft: 4, marginBottom: 8, marginTop: 16 },
  
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, padding: 16, marginBottom: 12,
    ...Shadow.card,
  },

  tooltip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10, borderRadius: Radius.md,
    marginTop: -8, marginBottom: 16,
  },
  tooltipText: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.onSurfaceVariant },

  photoRow: { alignItems: 'center', marginBottom: 20 },
  photoCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', borderWidth: 2, borderColor: Colors.outlineVariant, borderStyle: 'dashed'
  },
  photoImg: { width: '100%', height: '100%' },

  counter: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginRight: 8 },
  currencySuffix: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurface, marginRight: 8 },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFDE7', padding: 10, borderRadius: Radius.md,
    marginTop: -8, marginBottom: 16,
  },
  warningBannerText: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: '#F57F17' },

  currencySelector: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 16 },
  currencyBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLow,
  },
  currencyBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceContainerHighest },
  currencyBtnText: { fontFamily: Fonts.title, fontSize: 13, color: Colors.textMuted },
  currencyBtnTextActive: { color: Colors.primary },

  fieldLabel: { fontFamily: Fonts.title, fontSize: 13, color: Colors.onSurface, marginBottom: 8, fontWeight: '600' },
  subLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 4, marginBottom: 12 },
  subLabelToggle: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginLeft: 16, marginRight: 16, marginTop: -6, marginBottom: 12 },

  dayPill: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  dayPillActive: { backgroundColor: Colors.primary },
  dayPillText: { fontFamily: Fonts.headline, fontSize: 14, color: Colors.onSurfaceVariant },
  dayPillTextActive: { color: '#FFF' },

  penaltySection: { marginTop: 8 },
  penaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  penaltyBody: { marginTop: 8 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.tertiary + '15', padding: 12, borderRadius: Radius.md,
    marginTop: 12,
  },
  infoBannerText: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.tertiary },
  
  errorText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.error, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.outlineVariant + '40', marginVertical: 8 },
});
