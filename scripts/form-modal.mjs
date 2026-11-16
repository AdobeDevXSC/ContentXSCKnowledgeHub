const FORM_HOSTS = ['forms.office.com', 'forms.microsoft.com', 'forms.cloud.microsoft'];

/**
 * Returns the embeddable URL for a Microsoft Forms link, or null for other links.
 * @param {string} href
 */
export function getFormEmbedUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !FORM_HOSTS.includes(url.hostname)) return null;
  url.searchParams.set('embed', 'true');
  return url.toString();
}

function buildDialog(doc) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'form-modal';
  dialog.innerHTML = `
    <div class="form-modal-header">
      <h2 class="form-modal-title"></h2>
      <a class="form-modal-newtab" target="_blank" rel="noopener noreferrer">Open in new tab</a>
      <form method="dialog"><button type="submit" class="form-modal-close" aria-label="Close">&times;</button></form>
    </div>
    <iframe class="form-modal-frame" allowfullscreen></iframe>`;
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.querySelector('.form-modal-frame').src = 'about:blank';
  });
  doc.body.append(dialog);
  return dialog;
}

/**
 * Opens Microsoft Forms links (e.g. Contact us) in an in-page modal instead of a new tab.
 * @param {Document} doc
 */
export function initFormModal(doc = document) {
  let dialog;
  doc.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    const src = link && getFormEmbedUrl(link.href);
    if (!src || typeof doc.createElement('dialog').showModal !== 'function') return;
    event.preventDefault();
    dialog ||= buildDialog(doc);
    const title = link.textContent.trim() || 'Form';
    dialog.querySelector('.form-modal-title').textContent = title;
    dialog.setAttribute('aria-label', title);
    dialog.querySelector('.form-modal-newtab').href = link.href;
    const frame = dialog.querySelector('.form-modal-frame');
    frame.title = title;
    frame.src = src;
    dialog.showModal();
  }, true);
}
