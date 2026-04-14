import { AwsClient } from 'aws4fetch';

export interface Env {
  BUCKET: R2Bucket;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Cors Helper
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS,PUT,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST' && url.pathname === '/presign') {
      try {
        const body = await request.json() as { fileName: string; contentType: string; category: string };
        const authHeader = request.headers.get('Authorization');
        
        // TODO: En prod, vérifier le Token JWT (Firebase)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Not Authenticated', { status: 401, headers: corsHeaders });
        }

        const bucketName = 'contrib-bucket'; 
        // Note : Il faut configurer vos credentials API R2 S3 depuis l'interface Cloudflare
        const accountId = 'VOTRE_ID_COMPTE_(REMPLACER_EN_PROD)'; 
        
        // C'est un code simplifié, on génère juste un chemin
        const key = `${body.category}/${body.fileName}`;
        const s3Url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

        // Initialiser l'AWScLient (S3 compatible)
        const aws = new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID || 'dummy',
          secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'dummy',
          service: 's3',
          region: 'auto',
        });

        const signed = await aws.sign(s3Url, {
          method: 'PUT',
          aws: { signQuery: true },
          headers: {
            'Content-Type': body.contentType
          }
        });

        // Simulons temporairement si les clés ne sont pas encore mises: on revoie l'url public.
        // Sinon en prod on renvoit l'URL `signed.url`.
        const uploadUrl = env.R2_ACCESS_KEY_ID ? signed.url : `https://pub-replace-me.r2.dev/${key}`;

        return new Response(JSON.stringify({
          uploadUrl: uploadUrl,
          publicUrl: `https://pub-replace-me.r2.dev/${key}`, // À remplacer par votre public URL R2
          key: key
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('ContribApp R2 Worker Running', { headers: corsHeaders });
  },
};
