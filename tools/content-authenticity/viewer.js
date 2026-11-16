const SDK_BASE = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.17.0';
const { createC2pa, Reader, Context } = await import(`${SDK_BASE}/+esm`);
const loadSample = async (url, name) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  return new File([await response.blob()], name, { type: 'image/jpeg' });
};

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 50 * 1024 * 1024;
const [sample, expressSample] = await Promise.all([
  loadSample('./sample.jpg', 'Brand-10-012.jpg'),
  loadSample('./express-sample.jpeg', 'Adobe-Express-modified.jpeg'),
]);
let selectedSample = sample;
let current = sample;
let previewUrl;
let store;
let generation = 0;
let sdk;
let sdkPromise;
let reading = false;
let importSequence = 0;
let credentialState = 'none';
let remotePointerDetected = false;

function status(message, kind = 'info') {
  $('status').textContent = message;
  $('status').dataset.kind = kind;
  $('remote-status').textContent = $('remote').checked
    ? credentialState === 'failed' ? 'This demo is allowed online, but retrieval failed. Check your connection and try again.'
      : credentialState === 'reading' ? 'This demo is allowed online. Reading credentials...' : 'This demo is allowed to retrieve cloud-hosted credentials.'
    : remotePointerDetected ? 'Demo action required: allow online retrieval for this image’s cloud-hosted credentials.'
      : 'Online retrieval is off. Embedded credentials are read in your browser.';
}

function runtime() {
  if (!sdkPromise) {
    sdkPromise = createC2pa({ wasmSrc: `${SDK_BASE}/dist/resources/c2pa_bg.wasm` }).then((value) => {
      sdk = value;
      return value;
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function row(list, label, value) {
  list.append(element('dt', label), element('dd', value == null || value === '' ? 'Not supplied' : String(value)));
}

function setPin(state) {
  credentialState = state;
  const label = state === 'manifest' ? 'Show Content Credentials and validation results'
    : state === 'pending' ? 'Remote Content Credentials not retrieved — show information'
      : 'Remote Content Credentials retrieval failed — show information';
  $('cr').hidden = !['manifest', 'pending', 'failed'].includes(state);
  $('cr').dataset.state = state;
  $('cr').setAttribute('aria-label', label);
  $('cr').title = label;
}

function renderUnavailable(message, state) {
  const target = $('credential-details');
  target.replaceChildren();
  target.append(
    element('h3', state === 'failed' ? 'Remote retrieval failed' : state === 'reading' ? 'Reading credentials...' : 'Remote credentials not retrieved'),
    element('p', message),
    element('p', 'No manifest validation result is available. A remote pointer is not a validated signature, trusted identity or proof of AI use.'),
  );
  if (state === 'reading') return;
  target.append(element('p', 'This demo defaults to local-only reading. Permission to retrieve online is a demo privacy control, not a universal Content Credentials requirement. Fetching sends metadata requests to credential hosts, exposing your IP address; image bytes are not uploaded. Internet access and the host’s CORS support are required.'));
  const fetchButton = element('button', state === 'failed' ? 'Retry online retrieval' : 'Fetch remote credentials (online)');
  fetchButton.type = 'button';
  fetchButton.className = 'primary';
  fetchButton.id = 'fetch-remote';
  fetchButton.addEventListener('click', () => {
    $('remote').checked = true;
    readCredentials(current);
  });
  target.append(fetchButton);
}

function renderDetails(data) {
  const target = $('credential-details');
  target.replaceChildren();
  const active = data.manifests?.[data.active_manifest];
  const list = document.createElement('dl');
  const signature = active?.signature_info;
  row(list, 'SDK validation', data.validation_state || 'Not reported');
  row(list, 'Trust policy', 'No external trust anchors configured. Valid is not the same as Trusted.');
  row(list, 'Signer issuer', signature?.issuer);
  row(list, 'Signed at', signature?.time);
  row(list, 'Manifest title', active?.title);
  row(list, 'App / device', active?.claim_generator_info?.map((agent) => [agent.name, agent.version].filter(Boolean).join(' ')).join(', ') || active?.claim_generator);
  row(list, 'Manifest history', Object.keys(data.manifests || {}).length);
  target.append(list);
  for (const [label, manifest] of Object.entries(data.manifests || {})) {
    const section = element('section', '');
    section.className = 'credential-section';
    section.append(element('h3', label === data.active_manifest ? 'Active manifest' : 'History manifest'), element('p', manifest.title || label));
    const assertions = document.createElement('ul');
    for (const assertion of manifest.assertions || []) {
      const item = element('li', assertion.label);
      const detail = document.createElement('details');
      detail.append(element('summary', 'Show assertion data'), element('pre', JSON.stringify(assertion.data, null, 2)));
      item.append(detail);
      assertions.append(item);
    }
    section.append(assertions);
    if (manifest.ingredients?.length) section.append(element('h3', 'Ingredients'), element('pre', JSON.stringify(manifest.ingredients, null, 2)));
    target.append(section);
  }
  const validation = document.createElement('details');
  validation.append(element('summary', 'Signature, trust and validation results'), element('pre', JSON.stringify({
    validation_state: data.validation_state,
    validation_results: data.validation_results,
    validation_status: data.validation_status,
  }, null, 2)));
  const raw = document.createElement('details');
  raw.append(element('summary', 'Full manifest store (JSON)'), element('pre', JSON.stringify(data, null, 2)));
  target.append(validation, raw);
}

function errorText(error, online) {
  const message = error instanceof Error ? error.message : String(error);
  if (!online && /RemoteManifestUrl/.test(message)) {
    return 'This demo has not retrieved the image’s remote Content Credentials. Complete demo step 3 to allow retrieval and validation. No image bytes will be uploaded.';
  }
  if (/remote|fetch|network|http|cors|url|connection/i.test(message)) {
    return online
      ? `Remote credential retrieval failed. Check connectivity or CORS; no conclusion about credentials can be made. SDK: ${message}`
      : `Credentials may be remote-only. This demo’s online retrieval is disabled; embedded credentials could not be read. SDK: ${message}`;
  }
  return `Could not parse or validate this file's credentials. This is not a “no credentials” result. SDK: ${message}`;
}

async function readCredentials(file) {
  const version = ++generation;
  const online = $('remote').checked;
  if (file !== current) return;
  store = undefined;
  setPin('reading');
  $('credential-details').replaceChildren();
  if ($('details-dialog').open) renderUnavailable('The SDK is reading this file. Please wait for the validation result.', 'reading');
  reading = true;
  $('retry').disabled = true;
  status('Reading and validating Content Credentials in your browser...');
  let reader;
  try {
    const handle = await runtime();
    if (version !== generation) return;
    const context = new Context({
      verify: { verifyAfterReading: true, verifyTrust: true, remoteManifestFetch: online, ocspFetch: false },
    }, { maxSizeInBytes: MAX_BYTES });
    reader = await Reader.fromBlob(handle, file.type || undefined, file, context);
    if (version !== generation) return;
    if (!reader) {
      remotePointerDetected = false;
      setPin('none');
      if ($('details-dialog').open) $('credential-details').replaceChildren(element('p', 'The SDK found no Content Credentials. No validation result is available.'));
      status(online
        ? 'No Content Credentials found by the SDK. This does not prove the image is authentic or unedited.'
        : 'No embedded Content Credentials found. This demo’s online retrieval is off; remote-only credentials cannot be ruled out.', 'warning');
      return;
    }
    const result = await reader.manifestStore();
    if (version !== generation) return;
    store = result;
    renderDetails(result);
    setPin('manifest');
    const state = result.validation_state;
    status(`Content Credentials found. SDK validation: ${state || 'not reported'}. ${state === 'Invalid' ? 'Validation failed; inspect the reported failures.' : 'Inspect CR for signature, claims and trust results. Valid does not mean trusted.'}`, state === 'Invalid' ? 'error' : 'info');
  } catch (error) {
    if (version === generation) {
      console.error('Content Credentials read failed', error);
      const message = errorText(error, online);
      if (/RemoteManifestUrl|RemoteManifestFetch/.test(String(error))) remotePointerDetected = true;
      if (remotePointerDetected) {
        const state = !online && /RemoteManifestUrl/.test(String(error)) ? 'pending' : 'failed';
        setPin(state);
        renderUnavailable(message, state);
      } else {
        setPin('none');
        if ($('details-dialog').open) $('credential-details').replaceChildren(element('p', message));
      }
      status(message, credentialState === 'pending' ? 'warning' : 'error');
    }
  } finally {
    if (reader) {
      try {
        await reader.free();
      } catch (error) {
        console.error('Reader cleanup failed', error);
        if (version === generation) status(`Reader cleanup failed: ${String(error)}`, 'error');
      }
    }
    if (version === generation) {
      reading = false;
      $('retry').disabled = false;
      $('retry').hidden = false;
    }
  }
}

async function importFile(file) {
  if (!file) return;
  const sequence = ++importSequence;
  ++generation;
  reading = false;
  $('retry').disabled = false;
  $('retry').hidden = false;
  status('Checking the selected image...');
  if (file.size === 0 || file.size > MAX_BYTES) {
    status('Choose a non-empty image of 50 MB or less. The current image has not changed.', 'error');
    return;
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (sequence !== importSequence) return;
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
    : bytes[0] === 0x89 && ascii(1, 4) === 'PNG' ? 'image/png'
      : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' ? 'image/webp'
        : ascii(4, 8) === 'ftyp' && ['avif', 'avis', 'mif1'].includes(ascii(8, 12)) ? 'image/avif' : null;
  if (!type) {
    status('Unsupported or invalid input. Choose a JPEG, PNG, WebP or AVIF image, not a ZIP, PDF or screenshot export. The current image has not changed.', 'error');
    return;
  }
  // A Blob slice supplies a reliable MIME type without re-encoding any bytes.
  current = new File([file], file.name, { type });
  showImage(current, false);
  await readCredentials(current);
}

function showImage(file, isSample) {
  remotePointerDetected = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('preview').src = previewUrl;
  $('preview').alt = isSample ? (file === sample ? 'Starting sample: a family walking through a sunlit vineyard' : 'User-provided Adobe Express-modified image') : `Imported image: ${file.name}`;
  $('image-label').textContent = isSample ? (file === sample ? 'Original sample' : 'Adobe Express-modified sample') : 'Imported image';
  $('filename').textContent = file.name;
  $('file-info').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · Original bytes preserved. No image conversion.`;
  const downloadLabel = `${isSample ? (file === sample ? 'Download original image' : 'Download Adobe Express image') : 'Download imported image'}: ${file.name}`;
  $('download').setAttribute('aria-label', downloadLabel);
  $('download').title = downloadLabel;
  $('reset').hidden = isSample;
  $('reset-actions').hidden = isSample;
}

$('preview').addEventListener('error', () => {
  status('Your browser could not display this image. Its original bytes are preserved; any SDK credential result remains independent of image display.', 'error');
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(current);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = current.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$('file').addEventListener('change', () => {
  const file = $('file').files[0];
  $('file').value = '';
  importFile(file).catch((error) => {
    console.error('File import failed', error);
    status(`Could not import the selected file: ${String(error)}`, 'error');
  });
});
for (const name of ['dragenter', 'dragover']) $('drop').addEventListener(name, (event) => {
  event.preventDefault();
  $('drop').classList.add('drag');
});
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('drag'));
$('drop').addEventListener('drop', (event) => {
  event.preventDefault();
  $('drop').classList.remove('drag');
  if (event.dataTransfer.files.length !== 1) {
    status('Drop exactly one image at a time. The current image has not changed.', 'error');
    return;
  }
  importFile(event.dataTransfer.files[0]).catch((error) => {
    console.error('File drop failed', error);
    status(`Could not import the dropped file: ${String(error)}`, 'error');
  });
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());
$('reset').addEventListener('click', () => {
  ++importSequence;
  current = selectedSample;
  showImage(selectedSample, true);
  readCredentials(selectedSample);
});
$('sample-choice').addEventListener('change', () => {
  ++importSequence;
  selectedSample = $('sample-choice').value === 'express' ? expressSample : sample;
  current = selectedSample;
  showImage(current, true);
  readCredentials(current);
});
$('retry').addEventListener('click', () => { if (!reading) readCredentials(current); });
$('remote').addEventListener('change', () => {
  ++importSequence;
  readCredentials(current);
});
$('cr').addEventListener('click', () => {
  if (store || ['pending', 'failed'].includes(credentialState)) $('details-dialog').showModal();
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
}
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  sdk?.dispose();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
showImage(sample, true);
readCredentials(sample);

if (window.parent !== window) {
  const postHeight = () => window.parent.postMessage({ type: 'content-authenticity:height', height: document.documentElement.scrollHeight }, window.location.origin);
  new ResizeObserver(postHeight).observe(document.body);
  postHeight();
}
