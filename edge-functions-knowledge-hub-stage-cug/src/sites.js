export const PUBLIC_HOST = 'stage.xscknowledgehub.adobe.com';
export const PUBLIC_ORIGIN = `https://${PUBLIC_HOST}`;
export const ORIGIN_HOSTNAME = 'stage--contentxscknowledgehub--adobedevxsc.aem.live';

const normalizeHost = (value) => String(value || '')
  .split(',')[0]
  .trim()
  .toLowerCase()
  .replace(/:\d+$/, '');

export function siteForRequest(request, url) {
  const candidates = [
    request.headers.get('x-forwarded-host'),
    request.headers.get('x-original-host'),
    request.headers.get('host'),
    url.hostname,
  ];
  const host = candidates.map(normalizeHost).find((candidate) => candidate === PUBLIC_HOST);
  return host ? { host, PUBLIC_ORIGIN, ORIGIN_HOSTNAME } : null;
}
