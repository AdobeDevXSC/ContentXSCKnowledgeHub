/**
 * Feedback Form Block
 * Renders a Microsoft Forms iframe for feedback collection.
 */

const IFRAME_SRC = 'https://forms.office.com/r/HGANSfKpHP?embed=true';

export default function decorate(block) {
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'feedback-form-wrapper';

  const iframe = document.createElement('iframe');
  iframe.src = IFRAME_SRC;
  iframe.width = '640';
  iframe.height = '480';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('marginwidth', '0');
  iframe.setAttribute('marginheight', '0');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('webkitallowfullscreen', '');
  iframe.setAttribute('mozallowfullscreen', '');
  iframe.setAttribute('msallowfullscreen', '');
  iframe.title = 'Feedback form';

  wrapper.appendChild(iframe);
  block.appendChild(wrapper);
}
