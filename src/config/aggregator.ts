export const AGGREGATOR_CONFIG = {
  provider: (process.env.EXPO_PUBLIC_AGGREGATOR ?? 'flexpay') as 'flexpay' | 'serdipay',
  isSandbox: process.env.EXPO_PUBLIC_ENV !== 'production',
  
  flexpay: {
    baseUrl: 'https://backend.flexpay.cd/api/rest/v1',
    sandboxUrl: 'https://backend.flexpay.cd/api/rest/v1', // FlexPay utilise la même URL avec token sandbox
    token: process.env.EXPO_PUBLIC_FLEXPAY_TOKEN ?? '',
    merchantCode: process.env.EXPO_PUBLIC_FLEXPAY_MERCHANT ?? '',
  },

  serdipay: {
    baseUrl: 'https://api.serdipay.com/v1',
    sandboxUrl: 'https://sandbox.serdipay.com/v1',
    apiKey: process.env.EXPO_PUBLIC_SERDIPAY_KEY ?? '',
  },
};
