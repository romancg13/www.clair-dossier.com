const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('SITE_URL') || 'https://www.clair-dossier.com,https://clair-dossier.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'https://www.clair-dossier.com';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function jsonResponse(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(request ? corsHeaders(request) : {}), 'Content-Type': 'application/json' },
  });
}
