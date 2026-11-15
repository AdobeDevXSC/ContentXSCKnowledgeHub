export function isHtmlDocumentNavigation(request, url) {
  const accept = request.headers.get('accept') || '';
  const destination = request.headers.get('sec-fetch-dest');
  return request.method === 'GET'
    && accept.toLowerCase().includes('text/html')
    && (!destination || destination.toLowerCase() === 'document')
    && (url.pathname === '/' || url.pathname === '/home');
}

export function homeDocumentAction(request, url, session) {
  if (!isHtmlDocumentNavigation(request, url)) return null;
  if (url.pathname === '/') return session ? null : { type: 'redirect', location: '/home' };
  if (url.pathname === '/home') {
    return session
      ? { type: 'redirect', location: '/' }
      : { type: 'public' };
  }
  return null;
}
