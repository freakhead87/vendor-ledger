// --------------------------------------------------------------------------
// Cloudflare Worker – CITADEL Vendor Bills & Payment Ledger
// --------------------------------------------------------------------------

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Citadel Vendor Ledger"' },
    });
  }

  try {
    const decoded = atob(encoded);
    const [user, pass] = decoded.split(':');

    // Secrets configured in Cloudflare Worker settings / wrangler secret
    if (user !== env.BASIC_AUTH_USER || pass !== env.BASIC_AUTH_PASS) {
      return new Response('Invalid credentials', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Citadel Vendor Ledger"' },
      });
    }
  } catch (e) {
    return new Response('Invalid authorization header format', { status: 400 });
  }

  return null; // Auth succeeded
}

export default {
  async fetch(request, env, ctx) {
    // If BASIC_AUTH_USER and BASIC_AUTH_PASS are configured in Cloudflare environment secrets,
    // protect the dashboard with basic HTTP auth. If not configured, allow access.
    if (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASS) {
      const authResult = await requireAuth(request, env);
      if (authResult) return authResult;
    }

    // Serve static dashboard web app (HTML, CSS, JS, logo, favicons) via Workers Static Assets binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Citadel Vendor Ledger: Static assets binding not configured.', { status: 500 });
  },
};
