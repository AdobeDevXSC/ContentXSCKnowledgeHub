import {
  ORG_ID, TENANT_ID, getDatastreamId, getLinkType, isAnalyticsEnabled,
} from './martech-config.mjs'; // eslint-disable-line import/extensions

const ALLOY_SRC = 'https://cdn1.adoberesources.net/alloy/2.x/alloy.min.js';

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

function blockInfo(block) {
  return {
    name: block.dataset.blockName || block.classList[0],
    position: Number(block.dataset.blockPos) || 0,
    variant: [...block.classList].filter((c) => !['block', block.dataset.blockName].includes(c)).join(' '),
  };
}

function sendBlockEvent(e) {
  const isClick = e.event === 'block-click';
  window.alloy('sendEvent', {
    xdm: {
      eventType: isClick ? 'web.webinteraction.linkClicks' : 'web.webinteraction.display',
      ...(isClick && {
        web: {
          webInteraction: {
            name: `${e.block.name}:${e.interaction?.label || ''}`,
            URL: e.interaction?.href,
            type: e.interaction?.linkType || 'other',
            linkClicks: { value: 1 },
          },
        },
      }),
      ...withTenant({
        blockName: e.block.name,
        blockPosition: e.block.position,
        blockVariant: e.block.variant,
        blockEvent: e.event,
      }),
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
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      window.adobeDataLayer.push({ event: 'block-impression', block: blockInfo(entry.target) });
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
  window.alloy('configure', { datastreamId: getDatastreamId(hostname), orgId: ORG_ID });
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
        section: window.location.pathname.split('/')[1] || 'home',
        template: document.body.dataset.template || '',
      }),
    },
  });
  listenToDataLayer();
  trackBlocks();
}

initAnalytics();
