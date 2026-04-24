import { AwsClient } from 'aws4fetch';

export interface Env {
  BUCKET: R2Bucket;
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

    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      try {
        const key = url.pathname.replace('/upload/', '');
        const authHeader = request.headers.get('Authorization');
        
        // TODO: En prod, vérifier le Token JWT (Firebase)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Not Authenticated', { status: 401, headers: corsHeaders });
        }

        const publicBaseUrl = 'https://pub-45a3bfa4592944adb4b365a939adcf46.r2.dev';

        await env.BUCKET.put(key, request.body, {
          httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
        });

        return new Response(JSON.stringify({
          url: `${publicBaseUrl}/${key}`,
          key: key
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === 'DELETE' && url.pathname === '/delete') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response('Not Authenticated', { status: 401, headers: corsHeaders });
        }
        const body = await request.json() as { key: string };
        await env.BUCKET.delete(body.key);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err: any) {
         return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('ContribApp R2 Worker Running', { headers: corsHeaders });
  },
};
