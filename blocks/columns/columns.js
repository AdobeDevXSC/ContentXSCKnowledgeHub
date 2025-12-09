export default function decorate(block) {
  const rows = [...block.children];

  rows.forEach((row) => {
    row.classList.add('row', 'justify-content-lg-between');

    const columns = [...row.children];

    columns.forEach((column) => {
      column.classList.add('col-lg');
    });
  });

  const section = document.createElement('section');
  section.classList.add('py-10', 'py-lg-10', 'bg-bg-3');

  const sectionDiv = document.createElement('div');
  sectionDiv.classList.add('container');

  sectionDiv.append(...block.children);
  section.append(sectionDiv);
  block.append(section);
}