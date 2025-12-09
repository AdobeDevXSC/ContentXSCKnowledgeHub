export default function decorate(block) {
  const rows = [...block.children];

  rows.forEach((row) => {
    [...row.querySelectorAll('img')].forEach((element) => {
      element.classList.add('img-fluid', 'w-100', 'mb-6');
    });

    [...row.querySelectorAll('h4')].forEach((element) => {
      element.classList.add('mb-4');
    });

    [...row.querySelectorAll('p')].forEach((element) => {
      element.classList.add('fs-4', 'mb-0');
    });

    // give the column css to semantic HTML row
    row.classList.add('col-sm-8', 'col-md-4', 'mb-15', 'mb-md-0');
  });

  const section = document.createElement('section');
  section.classList.add('py-5' ,'text-center', 'text-md-start', 'bg-bg-3');

  const sectionDiv = document.createElement('div');
  sectionDiv.classList.add('container');

  const sectionDivRow = document.createElement('div');
  sectionDivRow.classList.add('row', 'justify-content-center');

  sectionDivRow.append(...block.children);
  sectionDiv.append(sectionDivRow);
  section.append(sectionDiv);
  block.append(section);
}

/*
<section class="py-10 py-lg-20 text-center text-md-start bg-bg-3">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-sm-8 col-md-4 mb-15 mb-md-0">
        <img src="i/feature-20-1.png" srcset="i/feature-20-1@2x.png 2x" alt="" class="img-fluid w-100 mb-6">
        <h4 class="mb-4">Everything you need to build</h4>
        <p class="fs-4 mb-0">Want to create something beautiful? Now you can. In hours, not weeks. </p>
      </div>
      <div class="col-sm-8 col-md-4 mb-15 mb-md-0">
        <img src="i/feature-20-2.png" srcset="i/feature-20-2@2x.png 2x" alt="" class="img-fluid w-100 mb-6">
        <h4 class="mb-4">Everything you need to build</h4>
        <p class="fs-4 mb-0">That’s a brilliant idea you’ve got. Build it, and they will come. </p>
      </div>
      <div class="col-sm-8 col-md-4">
        <img src="i/feature-20-3.png" srcset="i/feature-20-3@2x.png 2x" alt="" class="img-fluid w-100 mb-6">
        <h4 class="mb-4">Everything you need to build</h4>
        <p class="fs-4 mb-0">The website builder to help you grow - free from bugs and errors.</p>
      </div>
    </div>
  </div>
</section>
*/