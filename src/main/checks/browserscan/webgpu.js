/**
 * BrowserScan WebGPU — Adapter Info / Features / Limits.
 * Scrape DOM qua CDP (tranh locator timeout); fallback navigator.gpu; reload 1 lan.
 */
const { summarizeFieldResults } = require('../../../shared/siteHighlight');
const { evaluateInPage } = require('./runtime');
const { BROWSERSCAN_WEBGPU_URL } = require('./urls');

const CFG = {
  vendor: 'hidemium.webgpu.vendor',
  architecture: 'hidemium.webgpu.architecture',
  features: 'hidemium.webgpu.features',
};
const PARAM_PREFIX = 'hidemium.webgpu.param.';
const LOAD_TIMEOUT_MS = 90000;

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function normalizeValue(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeList(value) {
  const values = String(value == null ? '' : value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(values)].sort().join(',');
}

/** Chay trong page: doc bang theo heading + fallback WebGPU API. */
async function scrapeWebgpuBundleInPage() {
  function readTableNearHeading(headingText) {
    const heading = [...document.querySelectorAll('h2, h3')].find(
      (element) =>
        (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() ===
        headingText.toLowerCase()
    );
    if (!heading) return {};
    let table = null;
    let node = heading.nextElementSibling;
    for (let depth = 0; node && depth < 8; depth++, node = node.nextElementSibling) {
      if (node.tagName === 'TABLE') {
        table = node;
        break;
      }
      const nested = node.querySelector?.('table');
      if (nested) {
        table = nested;
        break;
      }
    }
    if (!table) {
      const parent = heading.parentElement;
      table = parent?.querySelector('table') || null;
      if (!table) {
        const after = document.evaluate(
          'following::table[1]',
          heading,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
        table = after;
      }
    }
    if (!table) return {};

    const values = {};
    for (const row of table.querySelectorAll('tbody tr, tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      const key = (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
      const value = (cells[1].innerText || cells[1].textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (key) {
        values[key] = value;
        cells[1].setAttribute(
          'data-autotest-bs-webgpu',
          key.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );
      }
    }
    table.setAttribute('data-autotest-bs-webgpu-table', headingText);
    return values;
  }

  function supportFlag() {
    const heading = [...document.querySelectorAll('h3')].find((element) =>
      /webgpu support detection/i.test((element.textContent || '').trim())
    );
    if (heading) {
      const card =
        heading.parentElement?.parentElement || heading.parentElement || heading;
      const text = (card.innerText || '').replace(/\s+/g, ' ').toLowerCase();
      if (/\bfalse\b/.test(text) || /not\s*supported/.test(text)) return false;
      if (/\btrue\b/.test(text)) return true;
    }
    return null;
  }

  const KNOWN_LIMITS = [
    'maxTextureDimension1D',
    'maxTextureDimension2D',
    'maxTextureDimension3D',
    'maxTextureArrayLayers',
    'maxBindGroups',
    'maxBindGroupsPlusVertexBuffers',
    'maxBindingsPerBindGroup',
    'maxDynamicUniformBuffersPerPipelineLayout',
    'maxDynamicStorageBuffersPerPipelineLayout',
    'maxSampledTexturesPerShaderStage',
    'maxSamplersPerShaderStage',
    'maxStorageBuffersPerShaderStage',
    'maxStorageTexturesPerShaderStage',
    'maxUniformBuffersPerShaderStage',
    'maxUniformBufferBindingSize',
    'maxStorageBufferBindingSize',
    'minUniformBufferOffsetAlignment',
    'minStorageBufferOffsetAlignment',
    'maxVertexBuffers',
    'maxBufferSize',
    'maxVertexAttributes',
    'maxVertexBufferArrayStride',
    'maxInterStageShaderVariables',
    'maxColorAttachments',
    'maxColorAttachmentBytesPerSample',
    'maxComputeWorkgroupStorageSize',
    'maxComputeInvocationsPerWorkgroup',
    'maxComputeWorkgroupSizeX',
    'maxComputeWorkgroupSizeY',
    'maxComputeWorkgroupSizeZ',
    'maxComputeWorkgroupsPerDimension',
    'maxImmediateSize',
    'maxStorageBuffersInFragmentStage',
    'maxStorageTexturesInFragmentStage',
    'maxStorageBuffersInVertexStage',
    'maxStorageTexturesInVertexStage',
  ];

  let adapterInfo = readTableNearHeading('WebGPU Adapter Info');
  let limits = readTableNearHeading('Adapter Limits');
  let featureStates = readTableNearHeading('Adapter Features');
  let features = Object.entries(featureStates)
    .filter(([, enabled]) => /^true$/i.test(enabled))
    .map(([name]) => name);

  let supported = supportFlag();
  let apiUsed = false;

  try {
    if (!navigator.gpu) {
      if (supported == null) supported = false;
    } else {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        if (supported == null) supported = false;
      } else {
        if (supported == null) supported = true;
        apiUsed = true;

        let info = adapter.info || null;
        if (!info && typeof adapter.requestAdapterInfo === 'function') {
          try {
            info = await adapter.requestAdapterInfo();
          } catch { /* ignore */ }
        }
        if ((!adapterInfo.vendor || /^undefined$/i.test(adapterInfo.vendor)) && info?.vendor) {
          adapterInfo = { ...adapterInfo, vendor: String(info.vendor) };
        }
        if (
          (!adapterInfo.architecture || /^undefined$/i.test(adapterInfo.architecture)) &&
          info?.architecture
        ) {
          adapterInfo = {
            ...adapterInfo,
            architecture: String(info.architecture),
          };
        }

        const limitCount = Object.keys(limits).filter(
          (key) => limits[key] && !/^undefined$/i.test(String(limits[key]))
        ).length;
        if (limitCount < 5 && adapter.limits) {
          const next = { ...limits };
          for (const key of KNOWN_LIMITS) {
            try {
              const value = adapter.limits[key];
              if (value != null && value !== '') next[key] = String(value);
            } catch { /* ignore */ }
          }
          limits = next;
        }

        if (!features.length && adapter.features) {
          features = [...adapter.features.values()];
          featureStates = Object.fromEntries(
            features.map((name) => [name, 'True'])
          );
        }
      }
    }
  } catch {
    if (supported == null) supported = false;
  }

  const usableLimits = Object.keys(limits).filter(
    (key) => limits[key] && !/^undefined$/i.test(String(limits[key]))
  );
  const hasLimits = usableLimits.length >= 5;
  const hasInfo = !!(
    (adapterInfo.vendor && !/^undefined$/i.test(adapterInfo.vendor)) ||
    (adapterInfo.architecture && !/^undefined$/i.test(adapterInfo.architecture))
  );
  // Chi ready khi co limits that (DOM hoac API) — tranh ready som chi vi co features.
  const ready = hasLimits || (hasInfo && usableLimits.length > 0);

  return {
    supported,
    ready,
    apiUsed,
    adapterInfo,
    limits,
    featureStates,
    features,
  };
}

function paintMarksInPage(marks) {
  const styleId = 'autotest-browserscan-webgpu-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-webgpu-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-webgpu-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-webgpu-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }
  let count = 0;
  for (const mark of marks || []) {
    const key = String(mark.key || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const element = document.querySelector(`[data-autotest-bs-webgpu="${key}"]`);
    if (!element) continue;
    element.classList.remove(
      'at-bs-webgpu-pass',
      'at-bs-webgpu-fail',
      'at-bs-webgpu-na'
    );
    element.classList.add(
      mark.pass === true
        ? 'at-bs-webgpu-pass'
        : mark.pass === false
          ? 'at-bs-webgpu-fail'
          : 'at-bs-webgpu-na'
    );
    count++;
  }
  return count;
}

function makeLine(label, actual, expected, list = false) {
  const raw = actual == null || actual === '' ? '' : String(actual);
  if (isDefault(expected)) {
    return {
      label,
      actual: raw || 'undefined',
      expected: '',
      pass: true,
      skipped: true,
      infoOnly: true,
    };
  }
  if (!raw || /^undefined$/i.test(raw)) {
    return {
      label,
      actual: 'undefined',
      expected: String(expected),
      pass: false,
      skipped: true,
      missingOnWeb: true,
    };
  }
  return {
    label,
    actual: raw,
    expected: String(expected),
    pass: list
      ? normalizeList(raw) === normalizeList(expected)
      : normalizeValue(raw) === normalizeValue(expected),
  };
}

function skippedUnsupported() {
  return {
    state: 'skipped',
    pass: null,
    value: 'WebGPU not supported — skipped',
    lines: [{ text: 'WebGPU not supported — skipped', status: 'info' }],
  };
}

function looksUnsupported(bundle) {
  if (bundle?.supported === false) return true;
  const vendor = normalizeValue(bundle?.adapterInfo?.vendor);
  const architecture = normalizeValue(bundle?.adapterInfo?.architecture);
  const emptyInfo =
    !vendor ||
    vendor === 'undefined' ||
    vendor === 'empty' ||
    !architecture ||
    architecture === 'undefined' ||
    architecture === 'empty';
  const limitValues = Object.values(bundle?.limits || {});
  const emptyLimits =
    !limitValues.length ||
    limitValues.every((value) => {
      const text = normalizeValue(value);
      return !text || text === 'undefined' || text === 'false' || text === 'empty';
    });
  return emptyInfo && emptyLimits && !(bundle?.features || []).length;
}

async function gotoWebgpu(page) {
  if (!/^https?:\/\/(?:www\.)?browserscan\.net\/webgpu\/?$/i.test(page.url())) {
    await page.goto(BROWSERSCAN_WEBGPU_URL, {
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
    return;
  }
  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: LOAD_TIMEOUT_MS,
  });
}

async function checkWebgpu(page, configMap, ctx) {
  ctx.step(`BrowserScan WebGPU: goto ${BROWSERSCAN_WEBGPU_URL}`);
  if (!/^https?:\/\/(?:www\.)?browserscan\.net\/webgpu\/?$/i.test(page.url())) {
    await page.goto(BROWSERSCAN_WEBGPU_URL, {
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
  }

  let bundle = await evaluateInPage(page, scrapeWebgpuBundleInPage);

  if (!bundle?.ready && bundle?.supported !== false) {
    if (ctx.signal?.aborted) throw new Error('aborted');
    ctx.step('BrowserScan WebGPU: DOM chua san — reload 1 lan', 'warn');
    await gotoWebgpu(page);
    if (ctx.signal?.aborted) throw new Error('aborted');
    bundle = await evaluateInPage(page, scrapeWebgpuBundleInPage);
  }

  if (!bundle) {
    bundle = {
      supported: null,
      ready: false,
      adapterInfo: {},
      limits: {},
      featureStates: {},
      features: [],
    };
  }

  if (looksUnsupported(bundle) || bundle.supported === false) {
    ctx.step('BrowserScan WebGPU: not supported — skip webgpu/param', 'warn');
    return skippedUnsupported();
  }

  if (!bundle.ready && !Object.keys(bundle.limits || {}).length) {
    const msg = 'Khong doc duoc WebGPU Adapter Limits (DOM/API)';
    ctx.step(`BrowserScan WebGPU: ${msg}`, 'err');
    return {
      state: 'fail',
      pass: false,
      value: msg,
      lines: [{ text: msg, status: 'mismatch' }],
    };
  }

  const lines = [
    makeLine('vendor', bundle.adapterInfo.vendor, cfgStr(configMap, CFG.vendor)),
    makeLine(
      'architecture',
      bundle.adapterInfo.architecture,
      cfgStr(configMap, CFG.architecture)
    ),
    makeLine(
      'features',
      bundle.features.join(','),
      cfgStr(configMap, CFG.features),
      true
    ),
  ];

  const configuredParams = Object.keys(configMap)
    .filter((key) => key.startsWith(PARAM_PREFIX))
    .sort();
  if (configuredParams.length) {
    for (const configKey of configuredParams) {
      const label = configKey.slice(PARAM_PREFIX.length);
      const actualKey = Object.keys(bundle.limits).find(
        (key) => key.toLowerCase() === label.toLowerCase()
      );
      lines.push(
        makeLine(
          label,
          actualKey ? bundle.limits[actualKey] : null,
          configMap[configKey]
        )
      );
    }
  } else {
    for (const [label, value] of Object.entries(bundle.limits)) {
      lines.push(makeLine(label, value, null));
    }
  }

  const result = summarizeFieldResults(lines, { discoverMode: true });
  const marks = [
    { key: 'vendor', pass: lines[0].infoOnly || lines[0].missingOnWeb ? null : lines[0].pass },
    {
      key: 'architecture',
      pass: lines[1].infoOnly || lines[1].missingOnWeb ? null : lines[1].pass,
    },
  ];
  for (const line of lines.slice(3)) {
    marks.push({
      key: line.label,
      pass: line.infoOnly || line.missingOnWeb ? null : line.pass,
    });
  }
  const painted = await evaluateInPage(page, paintMarksInPage, marks).catch(() => 0);

  ctx.step(
    `BrowserScan WebGPU: ${bundle.features.length} features + ${Object.keys(bundle.limits).length} limits${bundle.apiUsed ? ' (api fallback)' : ''}, ${result.state} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  checkWebgpu,
  scrapeWebgpuBundleInPage,
  normalizeValue,
  normalizeList,
  CFG,
  PARAM_PREFIX,
};
