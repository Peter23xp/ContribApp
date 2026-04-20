/**
 * FirebaseRecaptcha.tsx — reCAPTCHA pour Firebase Phone Auth
 * 
 * Le WebView est rendu en plein écran dans un Modal transparent
 * pendant la vérification, pour que le reCAPTCHA puisse afficher
 * son challenge si nécessaire.
 */
import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { View, Modal, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/colors';

const RECAPTCHA_HTML = (apiKey: string, authDomain: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
  <style>
    body {
      background: transparent;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: -apple-system, sans-serif;
    }
    #status {
      display: none;
    }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <div id="status"></div>
  <script>
    var statusEl = document.getElementById('status');
    
    function log(msg) {
      statusEl.textContent = msg;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    function sendError(code, message) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: code, message: message }));
    }

    try {
      log('Connexion au serveur...');
      firebase.initializeApp({ apiKey: "${apiKey}", authDomain: "${authDomain}" });
      firebase.auth().languageCode = 'fr';

      var recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function(token) {
          log('Vérification de sécurité OK');
        },
        'expired-callback': function() {
          log('Vérification expirée');
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'recaptcha_expired' }));
        }
      });

      recaptchaVerifier.render().then(function(widgetId) {
        log('Prêt');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }).catch(function(err) {
        log('Erreur: ' + err.message);
        sendError('render_failed', err.message);
      });
      
      window.sendVerification = function(phoneNumber) {
        log('Envoi du SMS à ' + phoneNumber + '...');
        firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
          .then(function(confirmationResult) {
            log('SMS envoyé !');
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'sent',
              verificationId: confirmationResult.verificationId
            }));
          })
          .catch(function(error) {
            log('Erreur: ' + (error.message || 'inconnue'));
            sendError(error.code || 'unknown', error.message || 'Erreur inconnue');
          });
      };
    } catch(e) {
      sendError('init_failed', e.message);
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

const TIMEOUT_MS = 120000; // 2 minutes — le reCAPTCHA peut prendre du temps

const FirebaseRecaptcha = forwardRef<FirebaseRecaptchaRef, Props>(({ onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const resolveRef = useRef<((id: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [statusText, setStatusText] = useState('');

  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    resolveRef.current = null;
    rejectRef.current = null;
    pendingPhoneRef.current = null;
  }, []);

  useImperativeHandle(ref, () => ({
    sendVerification: (phone: string) => {
      cleanup();
      setVisible(true); // Afficher le Modal pour que le reCAPTCHA fonctionne
      setStatusText('Préparation...');

      return new Promise<string>((resolve, reject) => {
        resolveRef.current = (id: string) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setVisible(false);
          resolve(id);
        };
        rejectRef.current = (err: Error) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setVisible(false);
          reject(err);
        };

        timerRef.current = setTimeout(() => {
          console.error('[Recaptcha] Timeout');
          rejectRef.current?.(new Error('Délai dépassé. Vérifiez votre connexion internet.'));
          cleanup();
          setVisible(false);
        }, TIMEOUT_MS);

        if (isReadyRef.current && webViewRef.current) {
          console.log('[Recaptcha] Sending verification for:', phone);
          setStatusText('Envoi du code SMS...');
          webViewRef.current.injectJavaScript(`window.sendVerification("${phone}"); true;`);
        } else {
          console.log('[Recaptcha] Queuing phone:', phone);
          pendingPhoneRef.current = phone;
        }
      });
    }
  }));

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'log') {
        console.log('[Recaptcha WebView]', data.message);
        setStatusText(data.message);
        return;
      }

      console.log('[Recaptcha] Event:', data.type);
      
      switch (data.type) {
        case 'ready':
          isReadyRef.current = true;
          onReady?.();
          if (pendingPhoneRef.current && webViewRef.current) {
            const phone = pendingPhoneRef.current;
            pendingPhoneRef.current = null;
            setStatusText('Envoi du code SMS...');
            webViewRef.current.injectJavaScript(`window.sendVerification("${phone}"); true;`);
          }
          break;
          
        case 'sent':
          console.log('[Recaptcha] ✅ SMS envoyé !');
          resolveRef.current?.(data.verificationId);
          break;
          
        case 'error': {
          console.error('[Recaptcha] ❌', data.code, data.message);
          const error = new Error(data.message || 'Erreur reCAPTCHA');
          (error as any).code = data.code;
          rejectRef.current?.(error);
          break;
        }
          
        case 'recaptcha_expired':
          rejectRef.current?.(new Error('Le reCAPTCHA a expiré. Réessayez.'));
          break;
      }
    } catch (e) {
      console.error('[Recaptcha] Parse error:', e);
    }
  }, [onReady]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Vérification en cours</Text>
          <Text style={styles.status}>{statusText}</Text>
          
          {/* WebView plein écran pour que le reCAPTCHA puisse fonctionner */}
          <View style={styles.webviewContainer}>
            <WebView
              ref={webViewRef}
              source={{
                html: RECAPTCHA_HTML(apiKey, authDomain),
                baseUrl: `https://${authDomain}`,
              }}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              style={styles.webview}
              onError={(e) => console.error('[Recaptcha] WebView error:', e.nativeEvent)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    minHeight: 200,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  status: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  webviewContainer: {
    width: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default FirebaseRecaptcha;
