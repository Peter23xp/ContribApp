// Configuration Cloudflare R2
export const CLOUDFLARE_CONFIG = {
  accountId:    process.env.EXPO_PUBLIC_CF_ACCOUNT_ID    ?? '',
  bucketName:   process.env.EXPO_PUBLIC_CF_BUCKET_NAME   ?? 'contrib-bucket',
  publicUrl:    process.env.EXPO_PUBLIC_CF_PUBLIC_URL    ?? '',
  workerUrl:    process.env.EXPO_PUBLIC_CF_WORKER_URL    ?? '',
  uploadSecret: process.env.EXPO_PUBLIC_CF_UPLOAD_SECRET ?? '',
};
