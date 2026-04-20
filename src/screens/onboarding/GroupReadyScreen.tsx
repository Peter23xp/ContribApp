import React, { useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, BackHandler, Share
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { AppButton } from '../../components/common/AppButton';

// Mocking useAuthStore and useFocusEffect
import { useAuthStore } from '../../stores/authStore';

export default function GroupReadyScreen({ navigation, route }: any) {
  const { groupId, inviteCode } = route.params || {};
  const { user } = useAuthStore();
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    const onBackPress = () => {
      handleGoToDashboard();
      return true; // prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, []);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode || 'N/A');
    // Ideally use ToastNotification here
    alert("Code copié !");
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Rejoins mon groupe sur ContribApp RDC !\nCode d'invitation : ${inviteCode}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleGoToDashboard = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      })
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        
        <View style={styles.successSection}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: bounceAnim }] }]}>
            <Ionicons name="checkmark" size={40} color="#27AE60" />
          </Animated.View>
          <Animated.Text style={[styles.successTitle, { opacity: fadeAnim }]}>
            Groupe créé !
          </Animated.Text>
          <Text style={styles.successSubtitle}>
            Votre groupe est prêt. Invitez maintenant vos premiers membres.
          </Text>
        </View>

        <View style={styles.contentOuter}>
          <View style={styles.codeSection}>
            <Text style={styles.codeTitle}>Votre code d'invitation</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{inviteCode || '... '}</Text>
            </View>
            <AppButton 
              title="Copier le code" 
              onPress={handleCopyCode} 
              variant="outline" 
              style={styles.actionButton} 
            />
            <AppButton 
              title="Partager le code" 
              onPress={handleShareCode} 
              variant="outline" 
              style={{ ...styles.actionButton, borderColor: '#E0E0E0' } as any} 
            />
            <Text style={styles.codeNote}>
              Partagez ce code avec vos membres. Ils l'utiliseront pour rejoindre le groupe.
            </Text>
          </View>

          <View style={styles.stepsSection}>
            <Text style={styles.stepsTitle}>Et maintenant ?</Text>
            
            <View style={styles.stepItem}>
              <View style={styles.stepIconBox}>
                <Ionicons name="share-social" size={16} color="#FFF" />
              </View>
              <Text style={styles.stepText}>Invitez vos membres en partageant le code ou le QR code</Text>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepIconBox}>
                <Ionicons name="phone-portrait" size={16} color="#FFF" />
              </View>
              <Text style={styles.stepText}>Attendez qu'ils s'inscrivent sur ContribApp</Text>
            </View>
            
            <View style={styles.stepItem}>
              <View style={styles.stepIconBox}>
                <Ionicons name="wallet" size={16} color="#FFF" />
              </View>
              <Text style={styles.stepText}>Les contributions débuteront dès que les membres rejoignent</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <AppButton 
          title="Inviter des membres →" 
          onPress={() => navigation.navigate('InviteHub', { inviteCode, groupId })} 
          style={{ marginBottom: 12 }} 
        />
        <AppButton 
          title="Accéder au tableau de bord" 
          onPress={handleGoToDashboard} 
          variant="outline" 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  successSection: {
    backgroundColor: '#27AE60',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
  },
  contentOuter: {
    padding: 20,
    marginTop: -20,
  },
  codeSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
    alignItems: 'center',
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
    color: Colors.textPrimary,
  },
  actionButton: {
    width: '100%',
    marginBottom: 12,
  },
  codeNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  stepsSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});
