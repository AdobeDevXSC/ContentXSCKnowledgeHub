// eslint-disable-next-line import/no-unresolved
export default function decorate(block) {
  console.log("block: ", block);

  // Determine type based on class or data-type
  let type = 'primary'; // default
  if (block.classList.contains('warning') || block.dataset.type === 'warning') type = 'warning';
  else if (block.classList.contains('danger') || block.dataset.type === 'danger') type = 'danger';
  else if (block.classList.contains('success') || block.dataset.type === 'success') type = 'success';
  else if (block.classList.contains('info') || block.dataset.type === 'info') type = 'info';

  // Add base classes
  block.classList.add('notebox', 'uk-alert', 'uk-flex', `uk-alert-${type}`);

  // Icon mapping
  const icons = {
    primary: 'info',
    warning: 'warning',
    danger: 'close',
    success: 'check',
    info: 'info',
  };
  const iconName = icons[type] || 'info';

  // Create and prepend icon
  const icon = document.createElement('span');
  icon.className = 'notebox-icon';
  icon.setAttribute('uk-icon', `icon: ${iconName}; ratio: 1.2`);
  block.prepend(icon);

  // Optional close button
  if (block.dataset.closable === 'true') {
    const button = document.createElement('button');
    button.className = 'uk-alert-close';
    button.setAttribute('type', 'button');
    button.setAttribute('uk-close', '');
    block.appendChild(button);
  }

  // Wrap content in a div
  const contentWrapper = document.createElement('div');
  contentWrapper.classList.add('notebox-content');

  // First child after icon: convert heading to title if exists
  const firstChild = block.children[1]; // index 0 is icon
  if (firstChild && /^H[1-6]$/.test(firstChild.tagName)) {
    firstChild.classList.add('notebox-title');
  }

  // Move all children except icon and close button into content wrapper
  [...block.children].forEach((child) => {
    if (child !== icon && !child.classList.contains('uk-alert-close')) {
      contentWrapper.appendChild(child);
    }
  });

  block.appendChild(contentWrapper);
}
