/**
 * Adobe Analytics (Web SDK) settings. See docs/Adobe-Analytics-Build-Guide-XSC-Knowledge-Hub.docx.
 * Tracking stays off until ORG_ID and the datastream ID for the current host are filled in.
 */
export const ORG_ID = ''; // e.g. 'XXXXXXXXXXXXXXXXXXXXXXXX@AdobeOrg'
export const TENANT_ID = ''; // XDM tenant namespace, e.g. '_adobedevxsc'

const STAGE_DATASTREAM_ID = '';
const PROD_DATASTREAM_ID = '';

const DATASTREAMS = {
  'xscknowledgehub.adobe.com': PROD_DATASTREAM_ID,
  'stage.xscknowledgehub.adobe.com': STAGE_DATASTREAM_ID,
};

/**
 * Returns the datastream for a host. Hosts not listed (previews, localhost) use the
 * stage datastream so they can never write to the production report suite.
 * @param {string} host
 */
export function getDatastreamId(host) {
  return (host in DATASTREAMS ? DATASTREAMS[host] : STAGE_DATASTREAM_ID) || '';
}

export function isAnalyticsEnabled(host, orgId = ORG_ID) {
  return Boolean(orgId && getDatastreamId(host));
}

/**
 * Classifies a clicked link for Analytics.
 * @param {string} href
 * @param {string} host current page host
 */
export function getLinkType(href, host) {
  if (/\.(pdf|zip|docx?|xlsx?|pptx?)(\?|#|$)/i.test(href)) return 'download';
  try {
    const url = new URL(href, `https://${host}/`);
    if (/^https?:$/.test(url.protocol) && url.hostname !== host) return 'exit';
  } catch {
    // fall through
  }
  return 'other';
}
