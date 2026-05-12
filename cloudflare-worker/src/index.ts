export interface Env {
  BUCKET: R2Bucket;
  UPLOAD_SECRET: string; // wrangler secret put UPLOAD_SECRET
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS,PUT,DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  // Si UPLOAD_SECRET n'est pas encore configuré, refuser quand même les tokens vides
  if (!token) return false;
  if (!env.UPLOAD_SECRET) return false;
  return token === env.UPLOAD_SECRET;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── PUT /upload/<key> ────────────────────────────────────────────────────
    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      if (!isAuthorized(request, env)) {
        return json({ error: 'Not Authenticated' }, 401);
      }
      try {
        const key = decodeURIComponent(url.pathname.replace('/upload/', ''));
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        await env.BUCKET.put(key, request.body, {
          httpMetadata: { contentType },
        });

        const publicBaseUrl = 'https://pub-45a3bfa4592944adb4b365a939adcf46.r2.dev';
        return json({ url: `${publicBaseUrl}/${key}`, key });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // ── DELETE /delete ───────────────────────────────────────────────────────
    if (request.method === 'DELETE' && url.pathname === '/delete') {
      if (!isAuthorized(request, env)) {
        return json({ error: 'Not Authenticated' }, 401);
      }
      try {
        const body = await request.json() as { key: string };
        await env.BUCKET.delete(body.key);
        return json({ success: true });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    return new Response('ContribApp R2 Worker v2', { headers: corsHeaders });
  },
};
