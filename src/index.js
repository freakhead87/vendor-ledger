async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const decoded = atob(encoded);
  const [user, pass] = decoded.split(':');

  if (user !== env.BASIC_AUTH_USER || pass !== env.BASIC_AUTH_PASS) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
        'Cache-Control': 'no-store',
      },
    });
  }

  return null;
}

export default {
  async fetch(request, env, ctx) {
const authResult = await requireAuth(request, env);
if (authResult) return authResult;
    const authResult = await requireAuth(request, env);
    if (authResult) return authResult;

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return new Response(assetResponse.body, {
headers: {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
}
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
