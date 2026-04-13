// Configuration de l'application
// Les valeurs doivent être définies via des variables d'environnement

export const CONFIG = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || '',
  TIMEOUTS: {
    DEFAULT: 15000,
  },
  APP_VERSION: '1.0.0',
};
