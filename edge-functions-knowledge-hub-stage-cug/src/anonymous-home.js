const HOMEPAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>XSC Knowledge Hub</title>
    <style>
      :root { color-scheme: light; font-family: Arial, sans-serif; color: #292929; background: #f5f5f5; }
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; }
      main { box-sizing: border-box; width: min(36rem, calc(100% - 2rem)); padding: 3rem; border-radius: .5rem; background: #fff; box-shadow: 0 2px 12px #0002; }
      h1 { margin-top: 0; font-size: 2rem; }
      p { line-height: 1.6; }
      a { display: inline-block; margin-top: 1rem; padding: .8rem 1.4rem; border-radius: 2rem; background: #1473e6; color: #fff; font-weight: 700; text-decoration: none; }
      a:hover { background: #0d66d0; }
      a:focus-visible { outline: 3px solid #292929; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <h1>XSC Knowledge Hub</h1>
      <p>Sign in with your Adobe account to access the Knowledge Hub.</p>
      <a href="/auth/login?returnTo=%2F">Sign in</a>
    </main>
  </body>
</html>`;

export function anonymousHomepage(request, url, session) {
  const accept = request.headers.get('accept') || '';
  const destination = request.headers.get('sec-fetch-dest');
  const isDocumentNavigation = request.method === 'GET'
    && url.pathname === '/'
    && accept.toLowerCase().includes('text/html')
    && (!destination || destination.toLowerCase() === 'document');

  if (session || !isDocumentNavigation) return null;
  return new Response(HOMEPAGE, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}
