import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://api.contributapp-rdc.com/v1'; // remplacer par l'URL réelle

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Injection automatique du token JWT
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gestion automatique du refresh token si 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        await SecureStore.setItemAsync('access_token', data.access_token);
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
        return api.request(error.config);
      } catch {
        // Refresh échoué → déconnecter l'utilisateur
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        // TODO: naviguer vers LoginScreen
      }
    }
    return Promise.reject(error);
  }
);
