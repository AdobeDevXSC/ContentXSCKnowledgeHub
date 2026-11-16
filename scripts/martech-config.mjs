/**
 * Adobe Analytics (Web SDK) settings. See docs/Adobe-Analytics-Build-Guide-XSC-Knowledge-Hub.docx.
 * Tracking stays off until ORG_ID and the datastream ID for the current host are filled in.
 */
export const ORG_ID = '708E423B67F3C2050A495C27@AdobeOrg';
export const TENANT_ID = '_aemshowcase2';

// No stage datastream yet: other preview hosts send nothing.
const STAGE_DATASTREAM_ID = '';
// Report suite: xscknowledgehubprod
const PROD_DATASTREAM_ID = '9c15e2f4-56ab-4f26-8d3d-c34762e6d5d9';

const DATASTREAMS = {
  'xscknowledgehub.adobe.com': PROD_DATASTREAM_ID,
  // Temporary: stage sends to the prod datastream for testing until it has its own.
  'stage.xscknowledgehub.adobe.com': PROD_DATASTREAM_ID,
  'stage--contentxscknowledgehub--adobedevxsc.aem.live': PROD_DATASTREAM_ID,
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

/**
 * Analytics variables for a block event, per the build guide's mapping table.
 * The custom events, eVars and props must exist in the report suite admin.
 * @param {{ event: string, block: object, interaction?: object }} e
 * @param {string} [section] site section (eVar13)
 */
export function getBlockAnalyticsVars(e, section) {
  const vars = {
    eVar10: e.block?.name,
    eVar13: section,
    prop12: e.block?.name,
    prop10: String(e.block?.position ?? ''),
    eVar11: e.block?.variant,
    prop11: String(e.block?.sequence ?? ''),
  };
  if (e.event === 'block-impression') vars.events = 'event10';
  if (e.event === 'block-click') {
    vars.events = 'event11';
    vars.eVar12 = e.interaction?.label;
  }
  return Object.fromEntries(Object.entries(vars).filter(([, v]) => v));
}

/** Site section: the first path segment, or 'home' for the root. */
export function getSection(pathname) {
  return pathname.split('/')[1] || 'home';
}
