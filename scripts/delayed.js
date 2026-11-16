import {
  ORG_ID, TENANT_ID, getBlockAnalyticsVars, getDatastreamId, getLinkType, getSection,
  isAnalyticsEnabled,
} from './martech-config.mjs'; // eslint-disable-line import/extensions

const ALLOY_SRC = 'https://cdn1.adoberesources.net/alloy/2.37.1/alloy.min.js';

function loadAlloy() {
  /* eslint-disable */
  !function(n,o){o.forEach(function(o){n[o]||((n.__alloyNS=n.__alloyNS||[]).push(o),n[o]=function(){var u=arguments;return new Promise(function(i,l){n[o].q.push([i,l,u])})},n[o].q=[])})}(window,['alloy']);
  /* eslint-enable */
  const script = document.createElement('script');
  script.async = true;
  script.src = ALLOY_SRC;
  script.nonce = 'aem';
  document.head.append(script);
}

function withTenant(data) {
  return TENANT_ID ? { [TENANT_ID]: { knowledgeHub: data } } : {};
}

const SEQ_KEY = 'kh_block_seq';

function nextSequence() {
  try {
    const n = (Number(sessionStorage.getItem(SEQ_KEY)) || 0) + 1;
    sessionStorage.setItem(SEQ_KEY, n);
    return n;
  } catch {
    return 0;
  }
}

function blockInfo(block) {
  return {
    name: block.dataset.blockName || block.classList[0],
    position: Number(block.dataset.blockPos) || 0,
    variant: [...block.classList].filter((c) => !['block', block.dataset.blockName].includes(c)).join(' '),
    sequence: nextSequence(),
  };
}

function sendBlockEvent(e) {
  const isClick = e.event === 'block-click';
  window.alloy('sendEvent', {
    xdm: {
      eventType: isClick ? 'web.webinteraction.linkClicks' : 'web.webinteraction.display',
      // A webInteraction makes Analytics record a link call, so impressions don't add page views.
      web: {
        webInteraction: isClick ? {
          name: `${e.block.name}:${e.interaction?.label || ''}`,
          URL: e.interaction?.href,
          type: e.interaction?.linkType || 'other',
          linkClicks: { value: 1 },
        } : {
          name: `${e.event}:${e.block.name}`,
          type: 'other',
          linkClicks: { value: 0 },
        },
      },
      ...withTenant({
        blockName: e.block.name,
        blockPosition: e.block.position,
        blockVariant: e.block.variant,
        blockSequence: e.block.sequence,
        blockEvent: e.event,
      }),
    },
    data: {
      __adobe: { analytics: getBlockAnalyticsVars(e, getSection(window.location.pathname)) },
    },
  });
}

/** Forwards block events pushed to window.adobeDataLayer to Web SDK. */
function listenToDataLayer() {
  const dl = window.adobeDataLayer;
  const handle = (item) => {
    if (item && ['block-impression', 'block-click', 'block-journey'].includes(item.event)) sendBlockEvent(item);
  };
  dl.forEach(handle);
  const push = dl.push.bind(dl);
  dl.push = (...items) => {
    items.forEach(handle);
    return push(...items);
  };
}

function trackBlocks() {
  // An impression needs the block at least 50% visible for 1 second.
  const timers = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (!entry.isIntersecting) {
        clearTimeout(timers.get(el));
        timers.delete(el);
        return;
      }
      if (timers.has(el)) return;
      timers.set(el, setTimeout(() => {
        io.unobserve(el);
        timers.delete(el);
        window.adobeDataLayer.push({ event: 'block-impression', block: blockInfo(el) });
      }, 1000));
    });
  }, { threshold: [0.5] });
  document.querySelectorAll('main .block').forEach((el, i) => {
    el.dataset.blockPos = i + 1;
    io.observe(el);
  });

  document.addEventListener('click', (ev) => {
    const block = ev.target.closest?.('main .block');
    const link = block && ev.target.closest('a, button');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    window.adobeDataLayer.push({
      event: 'block-click',
      block: blockInfo(block),
      interaction: {
        label: (link.textContent || '').trim().slice(0, 100),
        href,
        linkType: getLinkType(href, window.location.hostname),
      },
    });
  }, { capture: true });
}

function initAnalytics() {
  const { hostname } = window.location;
  if (!isAnalyticsEnabled(hostname)) return;
  window.adobeDataLayer = window.adobeDataLayer || [];
  loadAlloy();
  // Internal, sign-in-only site: no consent banner, so tracking is always on.
  window.alloy('configure', {
    datastreamId: getDatastreamId(hostname),
    orgId: ORG_ID,
    defaultConsent: 'in',
  });
  window.alloy('sendEvent', {
    xdm: {
      eventType: 'web.webpagedetails.pageViews',
      web: {
        webPageDetails: {
          name: document.title,
          URL: window.location.href,
          pageViews: { value: 1 },
        },
      },
      ...withTenant({
        section: getSection(window.location.pathname),
        template: document.body.dataset.template || '',
      }),
    },
    data: { __adobe: { analytics: { eVar13: getSection(window.location.pathname) } } },
  });
  listenToDataLayer();
  trackBlocks();
}

initAnalytics();
