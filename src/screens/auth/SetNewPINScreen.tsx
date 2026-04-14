import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { Colors } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import * as authService from '../../services/authService';

type SetNewPINScreenRouteProp = RouteProp<AuthStackParamList, 'SetNewPIN'>;
type SetNewPINScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SetNewPIN'>;

interface Props {
  route: SetNewPINScreenRouteProp;
  navigation: SetNewPINScreenNavigationProp;
}

export default function SetNewPINScreen({ route, navigation }: Props) {
  const { phone } = route.params;

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const confirmPinRef = useRef<TextInput>(null);

  const handleReset = async () => {
    if (pin.length < 6 || confirmPin.length < 6) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Le PIN doit faire 6 chiffres.' });
      return;
    }
    if (pin !== confirmPin) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Les deux PINs ne correspondent pas.' });
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPIN(phone, pin);
      Toast.show({ type: 'success', text1: 'Succès', text2: 'Votre PIN a été réinitialisé !' });
      // On redirige vers Login pour le forcer à se connecter avec son nouveau PIN
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: error.message || 'Impossible de réinitialiser le PIN' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        
        <View style={styles.topSection}>
          <Text style={styles.title}>Nouveau Code PIN</Text>
          <Text style={styles.subtitle}>Définissez un nouveau code sécurisé à 6 chiffres pour votre compte.</Text>
        </View>

        <KeyboardAvoidingView 
          style={styles.keyboardView} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formWrapper}>
            <ScrollView 
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <AppInput
                label="Nouveau Code PIN (6 chiffres)"
                placeholder="******"
                value={pin}
                onChangeText={setPin}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={6}
                autoFocus
                onSubmitEditing={() => confirmPinRef.current?.focus()}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                    <Text style={styles.showText}>{showPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              <AppInput
                ref={confirmPinRef}
                label="Confirmer le nouveau Code PIN"
                placeholder="******"
                value={confirmPin}
                onChangeText={setConfirmPin}
                secureTextEntry={!showConfirmPin}
                keyboardType="numeric"
                maxLength={6}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPin(!showConfirmPin)}>
                    <Text style={styles.showText}>{showConfirmPin ? 'Cacher' : 'Voir'}</Text>
                  </TouchableOpacity>
                }
              />

              <AppButton 
                title="Enregistrer le nouveau PIN"
                onPress={handleReset}
                disabled={pin.length < 6 || confirmPin.length < 6 || pin !== confirmPin}
                loading={isLoading}
                loadingText="Mise à jour..."
                style={styles.submitButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  topSection: { flex: 0.3, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  title: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  subtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, marginTop: 8, textAlign: 'center' },
  keyboardView: { flex: 0.7 },
  formWrapper: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  formContent: { flexGrow: 1, padding: 28 },
  showText: { color: Colors.primary, fontWeight: 'bold' },
  submitButton: { marginTop: 24 },
});
