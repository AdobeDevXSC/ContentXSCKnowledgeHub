export default async function decorate(block) {
  const test = '<div>Left navigation content</div>';
  try {
    // Fetch navigation content from a fragment
    // const resp = await fetch('/leftnav.plain.html');
    // if (!resp.ok) throw new Error('Failed to load leftnav');

    // const html = await resp.text();
    // block.innerHTML = html;
    block.innerHTML = test;
  } catch (e) {
    console.error('Left nav failed to load', e);
  }
}
