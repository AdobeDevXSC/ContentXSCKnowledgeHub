export default function decorate(block) {
  // Create the parent <ul> for UIkit accordion
  const accordion = document.createElement('ul');
  accordion.className = 'uk-accordion-default';
  accordion.setAttribute('uk-accordion', '');

  [...block.children].forEach((row, index) => {
    const titleCell = row.children[0];
    const bodyCell = row.children[1];

    // Create <li> for each accordion item
    const li = document.createElement('li');
    if (index === 0) li.className = 'uk-open'; // optional: open first item

    // Create <a> for title
    const a = document.createElement('a');
    a.className = 'uk-accordion-title';
    a.href = '#';
    // Move all title children into <a>
    a.append(...titleCell.childNodes);
    // Add UIkit accordion icon
    const span = document.createElement('span');
    span.setAttribute('uk-accordion-icon', '');
    a.appendChild(span);

    // Create content container
    const content = document.createElement('div');
    content.className = 'uk-accordion-content';
    content.append(...bodyCell.childNodes);

    // Assemble <li>
    li.append(a, content);
    accordion.appendChild(li);
  });

  // Replace original block content with the UIkit accordion
  block.innerHTML = '';
  block.appendChild(accordion);
}
