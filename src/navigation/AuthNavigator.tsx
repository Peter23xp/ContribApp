import React from 'react';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';

import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import NewPINScreen from '../screens/auth/NewPINScreen';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  OTP: {
    phone: string;
    email: string;
    purpose: 'registration' | 'pin_reset';
    /** fullName — utilisé pour le renvoi OTP */
    fullName?: string;
  };
  NewPIN: {
    phone: string;
    /** OTP vérifié transmis pour appel confirmPinReset */
    verifiedOtpCode: string;
  };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: Colors.background },
};

export default function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={screenOptions}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="NewPIN" component={NewPINScreen} />
    </Stack.Navigator>
  );
}
