// Configuration Cloudflare R2
export const CLOUDFLARE_CONFIG = {
  accountId: process.env.EXPO_PUBLIC_CF_ACCOUNT_ID ?? '',
  bucketName: process.env.EXPO_PUBLIC_CF_BUCKET_NAME ?? 'contributapp-rdc',
  publicUrl: process.env.EXPO_PUBLIC_CF_PUBLIC_URL ?? '',
  // URL du Worker Cloudflare qui gère les uploads signés
  workerUrl: process.env.EXPO_PUBLIC_CF_WORKER_URL ?? '',
};
