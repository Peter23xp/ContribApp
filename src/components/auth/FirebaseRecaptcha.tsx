/**
 * FirebaseRecaptcha.tsx — Invisible reCAPTCHA pour Firebase Phone Auth
 * 
 * Ce composant rend un WebView invisible qui charge la page reCAPTCHA.
 * Il expose une ref pour déclencher la vérification depuis n'importe quel écran.
 * 
 * ALTERNATIVE SIMPLE : On utilise signInWithPhoneNumber avec
 * l'option appVerificationDisabledForTesting en dev,
 * et en prod on passe par un backend (Cloud Function) pour l'envoi d'OTP.
 * 
 * Pour Expo managed workflow sans ejecting, la meilleure approche est
 * d'utiliser le Firebase JS SDK avec un reCAPTCHA invisible.
 * On le fait ici via un portail WebView.
 */
import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { View, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { auth } from '../../config/firebase';

const RECAPTCHA_HTML = (siteKey: string, authDomain: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
  <style>
    body { background: transparent; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <script>
    // Invisible reCAPTCHA
    try {
      firebase.initializeApp({ apiKey: "${siteKey}", authDomain: "${authDomain}" });
      var recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function(token) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha_token', token: token }));
        },
        'expired-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha_expired' }));
        }
      });
      recaptchaVerifier.render().then(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha_ready' }));
      });
      
      window.sendVerification = function(phoneNumber) {
        firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
          .then(function(confirmationResult) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'verification_sent',
              verificationId: confirmationResult.verificationId
            }));
          })
          .catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'error',
              code: error.code,
              message: error.message
            }));
          });
      };
    } catch(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
    }
  </script>
</body>
</html>
`;

export interface FirebaseRecaptchaRef {
  sendVerification: (phone: string) => Promise<string>; // Returns verificationId
}

interface Props {
  onReady?: () => void;
}

const FirebaseRecaptcha = forwardRef<FirebaseRecaptchaRef, Props>(({ onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [visible, setVisible] = useState(false);
  const resolveRef = useRef<((verificationId: string) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);
  const [isReady, setIsReady] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';

  useImperativeHandle(ref, () => ({
    sendVerification: (phone: string) => {
      return new Promise<string>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
        setVisible(true);
        
        // Attendre que le WebView soit prêt, puis envoyer
        const checkAndSend = () => {
          if (isReady && webViewRef.current) {
            webViewRef.current.injectJavaScript(`window.sendVerification("${phone}"); true;`);
          } else {
            setTimeout(checkAndSend, 200);
          }
        };
        setTimeout(checkAndSend, 500);
      });
    }
  }));

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'recaptcha_ready':
          setIsReady(true);
          onReady?.();
          break;
          
        case 'verification_sent':
          resolveRef.current?.(data.verificationId);
          resolveRef.current = null;
          setVisible(false);
          break;
          
        case 'error':
          const error = new Error(data.message || 'RECAPTCHA_ERROR');
          (error as any).code = data.code;
          rejectRef.current?.(error);
          rejectRef.current = null;
          setVisible(false);
          break;
          
        case 'recaptcha_expired':
          rejectRef.current?.(new Error('RECAPTCHA_EXPIRED'));
          rejectRef.current = null;
          setVisible(false);
          break;
      }
    } catch (e) {
      console.error('[Recaptcha] Parse error', e);
    }
  }, [onReady]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: RECAPTCHA_HTML(apiKey, authDomain) }}
          onMessage={handleMessage}
          javaScriptEnabled
          style={styles.webview}
        />
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default FirebaseRecaptcha;
