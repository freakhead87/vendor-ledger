// -----------------------------------------------------
//  Cloudflare Worker – vendor‑ledger dashboard
// -----------------------------------------------------

// ---------- BASIC AUTH helper ----------
async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const [scheme, encoded] = authHeader.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Dashboard"' },
    });
  }

  const decoded = atob(encoded);
  const [user, pass] = decoded.split(':');

  // Secrets are injected by Wrangler at runtime
  if (user !== env.BASIC_AUTH_USER || pass !== env.BASIC_AUTH_PASS) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Dashboard"' },
    });
  }

  return null; // auth succeeded
}
// ---------------------------------------

export default {
  async fetch(request, env, ctx) {
    // <<<--- **Only ONE** declaration of authResult ---
    const authResult = await requireAuth(request, env);
    if (authResult) return authResult; // <-- stop here if auth failed

    // -------------------------------------------------
    // Your original dashboard logic starts here.
    // -------------------------------------------------

    // Example: fetch the Google Sheet (replace with your own code)
    const sheetUrl = 'https://sheets.googleapis.com/...'; // <- your sheet API URL
    const sheetResp = await fetch(sheetUrl, {
      headers: { Authorization: `Bearer ${env.GOOGLE_TOKEN}` },
    });
    const sheetData = await sheetResp.json();

    // Build the HTML you want to serve
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Vendor Ledger</title>
        <style>
          /* add any CSS you need */
          body {font-family:Arial,sans-serif;margin:1rem;}
        </style>
      </head>
      <body>
        <h1>Vendor Ledger Dashboard</h1>
        <!-- render sheetData here – this is just a placeholder -->
        <pre>${JSON.stringify(sheetData, null, 2)}</pre>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // <-- this header forces fresh data on every request (helps mobile)
        'Cache-Control': 'no-store',
      },
    });
  },
};
