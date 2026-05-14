export interface Env {
  BUCKET: R2Bucket;
  UPLOAD_SECRET: string;
  APP_TOKEN: string;
  PAYMENT_ACTIVE_STRATEGY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS,PUT,DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Token',
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
  if (!token) return false;
  if (!env.UPLOAD_SECRET) return false;
  return token === env.UPLOAD_SECRET;
}

function isAppTokenValid(request: Request, env: Env): boolean {
  const token = request.headers.get('X-App-Token');
  if (!token || !env.APP_TOKEN) return false;
  return token === env.APP_TOKEN;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── GET /api/config/payment ──────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/config/payment') {
      if (!isAppTokenValid(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const activeStrategy = env.PAYMENT_ACTIVE_STRATEGY || 'manual_capture';

      const config = {
        activeStrategy,
        strategies: {
          manual_capture: { enabled: true },
          airtel_money: { enabled: false, apiBaseUrl: '' },
          m_pesa: { enabled: false, apiBaseUrl: '' },
          orange_money: { enabled: false, apiBaseUrl: '' },
          mtn_momo: { enabled: false, apiBaseUrl: '' },
        },
      };

      // Mark the active strategy as enabled
      if (
        activeStrategy !== 'manual_capture' &&
        config.strategies[activeStrategy as keyof typeof config.strategies] !== undefined
      ) {
        (config.strategies[activeStrategy as keyof typeof config.strategies] as any).enabled = true;
      }

      return json(config);
    }

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
