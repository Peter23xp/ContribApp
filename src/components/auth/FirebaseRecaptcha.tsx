/**
 * FirebaseRecaptcha.tsx — Invisible reCAPTCHA pour Firebase Phone Auth
 * 
 * Rend un WebView invisible TOUJOURS monté qui charge Firebase Auth
 * avec un RecaptchaVerifier invisible.
 * 
 * Le WebView est rendu dans un conteneur 1x1px transparent,
 * sans Modal — pour éviter le rechargement à chaque ouverture.
 */
import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const RECAPTCHA_HTML = (apiKey: string, authDomain: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
  <style>
    body { background: transparent; margin: 0; overflow: hidden; }
    .grecaptcha-badge { visibility: hidden; }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <script>
    try {
      firebase.initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
      
      var recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function(token) {
          // Token reçu — on n'en a pas besoin directement,
          // signInWithPhoneNumber l'utilisera automatiquement
        },
        'expired-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha_expired' }));
        }
      });
      
      recaptchaVerifier.render().then(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }).catch(function(err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: 'render_failed', message: err.message }));
      });
      
      window.sendVerification = function(phoneNumber) {
        firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
          .then(function(confirmationResult) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'sent',
              verificationId: confirmationResult.verificationId
            }));
          })
          .catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'error',
              code: error.code || 'unknown',
              message: error.message || 'Unknown error'
            }));
          });
      };
    } catch(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: 'init_failed', message: e.message }));
    }
  </script>
</body>
</html>
`;

export interface FirebaseRecaptchaRef {
  sendVerification: (phone: string) => Promise<string>;
}

interface Props {
  onReady?: () => void;
}

const TIMEOUT_MS = 30000; // 30 secondes max

const FirebaseRecaptcha = forwardRef<FirebaseRecaptchaRef, Props>(({ onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const resolveRef = useRef<((id: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);

  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';

  useImperativeHandle(ref, () => ({
    sendVerification: (phone: string) => {
      return new Promise<string>((resolve, reject) => {
        // Nettoyer toute promesse précédente
        resolveRef.current = resolve;
        rejectRef.current = reject;

        // Timeout de sécurité
        const timer = setTimeout(() => {
          if (rejectRef.current) {
            rejectRef.current(new Error('Délai dépassé. Vérifiez votre connexion.'));
            resolveRef.current = null;
            rejectRef.current = null;
          }
        }, TIMEOUT_MS);

        const wrappedResolve = (id: string) => {
          clearTimeout(timer);
          resolve(id);
        };
        const wrappedReject = (err: Error) => {
          clearTimeout(timer);
          reject(err);
        };
        resolveRef.current = wrappedResolve;
        rejectRef.current = wrappedReject;

        if (isReadyRef.current && webViewRef.current) {
          // WebView prêt → envoyer immédiatement
          console.log('[Recaptcha] Sending verification for:', phone);
          webViewRef.current.injectJavaScript(`window.sendVerification("${phone}"); true;`);
        } else {
          // WebView pas encore prêt → stocker le numéro, sera envoyé au ready
          console.log('[Recaptcha] WebView not ready, queuing phone:', phone);
          pendingPhoneRef.current = phone;
        }
      });
    }
  }));

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[Recaptcha] Message:', data.type);
      
      switch (data.type) {
        case 'ready':
          isReadyRef.current = true;
          onReady?.();
          // Si un envoi était en attente
          if (pendingPhoneRef.current && webViewRef.current) {
            const phone = pendingPhoneRef.current;
            pendingPhoneRef.current = null;
            console.log('[Recaptcha] Sending queued verification for:', phone);
            webViewRef.current.injectJavaScript(`window.sendVerification("${phone}"); true;`);
          }
          break;
          
        case 'sent':
          console.log('[Recaptcha] Verification sent, id:', data.verificationId?.substring(0, 20) + '...');
          resolveRef.current?.(data.verificationId);
          resolveRef.current = null;
          rejectRef.current = null;
          break;
          
        case 'error': {
          console.error('[Recaptcha] Error:', data.code, data.message);
          const error = new Error(data.message || 'Erreur reCAPTCHA');
          (error as any).code = data.code;
          rejectRef.current?.(error);
          resolveRef.current = null;
          rejectRef.current = null;
          break;
        }
          
        case 'recaptcha_expired':
          rejectRef.current?.(new Error('Le reCAPTCHA a expiré. Réessayez.'));
          resolveRef.current = null;
          rejectRef.current = null;
          break;
      }
    } catch (e) {
      console.error('[Recaptcha] Parse error:', e);
    }
  }, [onReady]);

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html: RECAPTCHA_HTML(apiKey, authDomain) }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        style={styles.webview}
        onError={(e) => console.error('[Recaptcha] WebView error:', e.nativeEvent)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
});

export default FirebaseRecaptcha;
