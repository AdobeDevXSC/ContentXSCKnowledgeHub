/**
 * Sizes the embedded demo iframe to its content.
 * @param {Element} widget The widget block element
 */
export default function decorate(widget) {
  const iframe = widget.querySelector('iframe');
  if (!iframe) return;
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
    const { type, height } = event.data || {};
    if (type === 'content-authenticity:height' && Number.isFinite(height)) {
      iframe.style.height = `${Math.ceil(height)}px`;
    }
  });
}
