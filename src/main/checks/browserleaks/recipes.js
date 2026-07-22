/**
 * RECIPES BrowserLeaks — sinh tu toan bo configMapper.MAPPING.
 *
 * Phan EDITABLE (giua marker) sua bang recipes-config.html:
 *   npm run recipes:config → http://127.0.0.1:5179/recipes-config.html
 * Save API chi ghi de khoi EDITABLE — khong mat helper scrape/webgpu.
 */
const { MAPPING } = require('../../configMapper');

// === BEGIN EDITABLE CONFIG ===
// =============================================================================
// 1) PAGE URL — them page moi o day
// =============================================================================
const PAGES = {
  javascript: "https://browserleaks.com/javascript",
  webgl: "https://browserleaks.com/webgl",
  canvas: "https://browserleaks.com/canvas",
  webgpu: "https://browserleaks.com/webgpu",
  fonts: "https://browserleaks.com/fonts"
};

/** Check khong chay tren BrowserLeaks (font kho scrape; mac/desktop khong co tren web). */
const SKIP_CHECKS = new Set([
  "mac_address",
  "desktop_name"
]);

// =============================================================================
// 2) checkKey -> page (chi doi chuoi page)
// =============================================================================
const PAGE_OF = {
  screen: "javascript",
  platform_navigator: "javascript",
  hardware: "javascript",
  device_memory: "javascript",
  max_touch_points: "javascript",
  brands: "javascript",
  platform_ua: "javascript",
  platform_version: "javascript",
  ua_full_version: "javascript",
  model: "javascript",
  full_version_list: "javascript",
  form_factors: "javascript",
  battery: "javascript",
  network: "javascript",
  webgl: "webgl",
  webgl_param: "webgl",
  webgpu: "webgpu",
  font: "fonts"
};

// =============================================================================
// 3) Section mac dinh (h3) cho by:'tableCell' — doi neu dung section khac tren web
// =============================================================================
const SECTION_OF = {
  screen: {
    h3: "Screen Object",
    h3Mode: "exact"
  },
  platform_navigator: {
    h3: "Navigator Object",
    h3Mode: "exact"
  },
  hardware: {
    h3: "Navigator Object",
    h3Mode: "exact"
  },
  device_memory: {
    h3: "Navigator Object",
    h3Mode: "exact"
  },
  max_touch_points: {
    h3: "Navigator Object",
    h3Mode: "exact"
  },
  brands: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  platform_ua: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  platform_version: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  ua_full_version: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  model: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  full_version_list: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  form_factors: {
    h3: "userAgentData",
    h3Mode: "contains"
  },
  battery: {
    h3: "Battery Status API",
    h3Mode: "contains"
  },
  network: {
    h3: "Network Information API",
    h3Mode: "contains"
  },
  webgl: {
    h3: "WebGL Context Info",
    h3Mode: "exact"
  },
  webgl_param: {
    h3: "Vertex Shader",
    h3Mode: "exact"
  },
  webgpu: {
    h3: "WebGPU",
    h3Mode: "contains"
  }
};

// =============================================================================
// 4) OVERRIDE theo configKey — xpath / css / sel / selMode / js / skip / match
//    Key = dung config key trong config.hidemium
// =============================================================================
const FIELD_OVERRIDE = {
  "hidemium.navigator.screen.width": {
    css: "#js-width"
  },
  "hidemium.navigator.screen.height": {
    css: "#js-height"
  },
  "hidemium.navigator.screen.avail_width": {
    css: "#js-availWidth"
  },
  "hidemium.navigator.screen.avail_height": {
    css: "#js-availHeight"
  },
  "hidemium.navigator.screen.color_depth": {
    css: "#js-colorDepth"
  },
  "hidemium.navigator.screen.pixcel_depth": {
    css: "#js-pixelDepth"
  },
  "hidemium.navigator.screen.inner_width": {
    css: "#js-innerWidth"
  },
  "hidemium.navigator.screen.inner_height": {
    css: "#js-innerHeight"
  },
  "hidemium.navigator.screen.outer_width": {
    css: "#js-outerWidth"
  },
  "hidemium.navigator.screen.outer_height": {
    css: "#js-outerHeight"
  },
  "hidemium.navigator.pixel_ratio": {
    css: "#js-devicePixelRatio"
  },
  "hidemium.navigator.useragent.platforms": {
    css: "#js-platform"
  },
  "hidemium.navigator.hardware_concurrency": {
    css: "#js-hardwareConcurrency"
  },
  "hidemium.navigator.device_memory": {
    css: "#js-deviceMemory"
  },
  "hidemium.navigator.physical_memory": {
    skip: true
  },
  "hidemium.navigator.max_touch_point": {
    css: "#js-maxTouchPoints"
  },
  "hidemium.chrome.version": {
    js: "function getBrowserVersion() {\n    const ua = document.getElementById(\"js-userAgent\").textContent.trim();\n\n    const patterns = [\n        /Edg\\/([\\d.]+)/,         // Edge\n        /Chrome\\/([\\d.]+)/,      // Chrome\n        /Version\\/([\\d.]+).*Safari/, // Safari\n        /Safari\\/([\\d.]+)/       // Safari WebKit (fallback)\n    ];\n\n    for (const pattern of patterns) {\n        const match = ua.match(pattern);\n        if (match) {\n            return match[1];\n        }\n    }\n\n    return null;\n}"
  },
  "hidemium.navigator.useragent.version_useragent": {
    match: "includes",
    sel: [
      {
        css: "#js-uadata-fullVersionList"
      },
      {
        js: "function getBrowserVersion() {\n    const ua = document.getElementById(\"js-userAgent\").textContent.trim();\n\n    const patterns = [\n        /Edg\\/([\\d.]+)/,         // Edge\n        /Chrome\\/([\\d.]+)/,      // Chrome\n        /Version\\/([\\d.]+).*Safari/, // Safari\n        /Safari\\/([\\d.]+)/       // Safari WebKit (fallback)\n    ];\n\n    for (const pattern of patterns) {\n        const match = ua.match(pattern);\n        if (match) {\n            return match[1];\n        }\n    }\n\n    return null;\n}"
      }
    ],
    selMode: "first"
  },
  "hidemium.navigator.os.platform_os": {
    sel: [
      {
        css: "#js-uadata-platform"
      },
      {
        css: "#js-platform"
      }
    ],
    selMode: "first"
  },
  "hidemium.navigator.os.platforms_version": {
    css: "#js-uadata-platformVersion"
  },
  "hidemium.navigator.useragent.fullversion": {
    css: "#js-uadata-uaFullVersion",
    selMode: "merge"
  },
  "hidemium.navigator.useragent.useragent": {
    css: "#js-userAgent"
  },
  "hidemium.navigator.useragent.model": {
    css: "#js-uadata-model"
  },
  "hidemium.navigator.useragent.manufacturer": {
    skip: true
  },
  "hidemium.navigator.is_mobile": {
    match: "bool",
    css: "#js-uadata-mobile"
  },
  "hidemium.navigator.is_tablet": {
    match: "formFactors",
    css: "#js-uadata-formFactors"
  },
  "hidemium.value.battery.level": {
    css: "#js-level"
  },
  "hidemium.value.battery.charging": {
    match: "bool",
    css: "#js-charging"
  },
  "hidemium.value.battery.chargingTime": {
    css: "#js-chargingTime"
  },
  "hidemium.value.battery.charging_time": {
    css: "#js-chargingTime"
  },
  "hidemium.value.battery.dischargingTime": {
    css: "#js-dischargingTime"
  },
  "hidemium.value.battery.discharging_time": {
    css: "#js-dischargingTime"
  },
  "hidemium.network.effectiveType": {
    css: "#js-effectiveType"
  },
  "hidemium.network.effective_type": {
    css: "#js-effectiveType"
  },
  "hidemium.network.downlink": {
    css: "#js-downlink"
  },
  "hidemium.network.downlinkmax": {
    css: "#js-downlinkMax"
  },
  "hidemium.network.rtt": {
    css: "#js-rtt"
  },
  "hidemium.network.saveData": {
    match: "bool",
    css: "#js-saveData"
  },
  "hidemium.network.save_data": {
    match: "bool",
    css: "#js-saveData"
  },
  "hidemium.network.type": {
    css: "#js-type"
  },
  "hidemium.webgl.mode": {
    skip: true
  },
  "hidemium.webgl.vendor": {
    match: "includes",
    css: "#UNMASKED_VENDOR_WEBGL"
  },
  "hidemium.webgl.renderer": {
    base64: true,
    match: "includes",
    css: "#UNMASKED_RENDERER_WEBGL"
  },
  "hidemium.webgl.webgl_param.max_vertex_attribs": {
    css: "#MAX_VERTEX_ATTRIBS"
  },
  "hidemium.webgl.webgl_param.max_texture_size": {
    css: "#MAX_TEXTURE_SIZE"
  },
  "hidemium.webgl.webgl_param.max_viewport_dims": {
    match: "includes",
    css: "#MAX_VIEWPORT_DIMS"
  },
  "hidemium.webgpu.vendor": {
    match: "includes",
    css: "#gpu-info > tr:nth-child(3) > td:nth-child(2)"
  },
  "hidemium.webgpu.architecture": {
    match: "includes",
    css: "#gpu-info > tr:nth-child(4) > td:nth-child(2)"
  },
  "hidemium.webgpu.features": {
    match: "featureSet",
    js: "() => [...document.querySelectorAll('#gpu-features tr')].map((tr) => {\n      const name = (tr.cells[0] && tr.cells[0].innerText || '').trim();\n      if (!name) return '';\n      const val = (tr.cells[1] && tr.cells[1].innerText || '').replace(/\\s+/g, ' ').trim();\n      const on = /true|✔/i.test(val);\n      return name + ': ' + (on ? 'True' : 'False');\n    }).filter(Boolean).join('\\n')"
  },
  "hidemium.fonts": {
    match: "includes",
    js: "function getFontsMetricsHash() {\n    return document\n        .getElementById(\"fonts-metrics-hash\")\n        .childNodes[1]\n        .textContent\n        .trim();\n}"
  },
  "hidemium.fontface": {
    skip: true
  },
  "hidemium.fontsfaceset": {
    skip: true
  },
  "hidemium.fonts_value": {
    skip: true
  },
  "hidemium.webgl.report_hash": {
    label: "report hash",
    css: "#gl-report-hash"
  },
  "hidemium.webgl.image_hash": {
    label: "image hash",
    css: "#gl-image-hash"
  }
};

/** Config snake_case / typo -> id tren /webgl (null = khong co tren page) */
const WEBGL_PARAM_ID = {
  max_anisotropy: "MAX_TEXTURE_MAX_ANISOTROPY_EXT",
  max_render_buffer_size: "MAX_RENDERBUFFER_SIZE",
  max_vertext_exture_image_units: "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
  gl_version: "VERSION",
  gl_sample: "MAX_SAMPLES",
  shading_language: "SHADING_LANGUAGE_VERSION",
  shading_language_version: "SHADING_LANGUAGE_VERSION",
  webgl_extension: null,
  webgl_extension_2: null,
  fragment_shader_high_float: null,
  fragment_shader_high_int: null,
  fragment_shader_low_float: null,
  fragment_shader_low_int: null,
  fragment_shader_medium_float: null,
  fragment_shader_medium_int: null,
  vertex_shader_high_float: null,
  vertex_shader_high_int: null,
  vertex_shader_low_float: null,
  vertex_shader_low_int: null,
  vertex_shader_medium_float: null,
  vertex_shader_medium_int: null,
  stencil_back_value_mask: null,
  stencil_back_value_mask2: null,
  stencil_back_writemask: null,
  stencil_back_writemask2: null,
  stencil_value_mask: null,
  stencil_value_mask2: null,
  stencil_writemask: null,
  stencil_writemask2: null,
  sample_buffers: null,
  sample_buffers2: null,
  max_element_index: null,
  max_elements_indices: null,
  max_elements_vertices: null,
  max_server_wait_timeout: null,
  subpixel_bits: null,
  max_inter_stage_shader_components: null
};

/** Chi cac id that su co tren https://browserleaks.com/webgl (doi chieu view-source) */
const WEBGL_PAGE_IDS = new Set([
  "ALIASED_LINE_WIDTH_RANGE",
  "ALIASED_POINT_SIZE_RANGE",
  "ALPHA_BITS",
  "BLUE_BITS",
  "DEPTH_BITS",
  "FRAGMENT_SHADER",
  "GREEN_BITS",
  "HIGH_FLOAT_HIGH_INT",
  "MAX_3D_TEXTURE_SIZE",
  "MAX_ARRAY_TEXTURE_LAYERS",
  "MAX_COLOR_ATTACHMENTS",
  "MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS",
  "MAX_COMBINED_TEXTURE_IMAGE_UNITS",
  "MAX_COMBINED_UNIFORM_BLOCKS",
  "MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS",
  "MAX_CUBE_MAP_TEXTURE_SIZE",
  "MAX_DRAW_BUFFERS",
  "MAX_DRAW_BUFFERS_WEBGL",
  "MAX_FRAGMENT_INPUT_COMPONENTS",
  "MAX_FRAGMENT_UNIFORM_BLOCKS",
  "MAX_FRAGMENT_UNIFORM_COMPONENTS",
  "MAX_FRAGMENT_UNIFORM_VECTORS",
  "MAX_PROGRAM_TEXEL_OFFSET",
  "MAX_RENDERBUFFER_SIZE",
  "MAX_SAMPLES",
  "MAX_TEXTURE_IMAGE_UNITS",
  "MAX_TEXTURE_LOD_BIAS",
  "MAX_TEXTURE_MAX_ANISOTROPY_EXT",
  "MAX_TEXTURE_SIZE",
  "MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS",
  "MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS",
  "MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS",
  "MAX_UNIFORM_BLOCK_SIZE",
  "MAX_UNIFORM_BUFFER_BINDINGS",
  "MAX_VARYING_COMPONENTS",
  "MAX_VARYING_VECTORS",
  "MAX_VERTEX_ATTRIBS",
  "MAX_VERTEX_OUTPUT_COMPONENTS",
  "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
  "MAX_VERTEX_UNIFORM_BLOCKS",
  "MAX_VERTEX_UNIFORM_COMPONENTS",
  "MAX_VERTEX_UNIFORM_VECTORS",
  "MAX_VIEWPORT_DIMS",
  "MIN_PROGRAM_TEXEL_OFFSET",
  "RED_BITS",
  "SHADING_LANGUAGE_VERSION",
  "STENCIL_BITS",
  "UNIFORM_BUFFER_OFFSET_ALIGNMENT",
  "VERSION",
  "VERTEX_SHADER"
]);

/** title= tren #gpu-limits (BrowserLeaks /webgpu) — doi chieu view-source */
const WEBGPU_PAGE_LIMITS = new Set([
  "maxTextureDimension1D",
  "maxTextureDimension2D",
  "maxTextureDimension3D",
  "maxTextureArrayLayers",
  "maxBindGroups",
  "maxBindGroupsPlusVertexBuffers",
  "maxBindingsPerBindGroup",
  "maxDynamicUniformBuffersPerPipelineLayout",
  "maxDynamicStorageBuffersPerPipelineLayout",
  "maxSampledTexturesPerShaderStage",
  "maxSamplersPerShaderStage",
  "maxStorageBuffersPerShaderStage",
  "maxStorageBuffersInVertexStage",
  "maxStorageBuffersInFragmentStage",
  "maxStorageTexturesPerShaderStage",
  "maxStorageTexturesInVertexStage",
  "maxStorageTexturesInFragmentStage",
  "maxUniformBuffersPerShaderStage",
  "maxUniformBufferBindingSize",
  "maxStorageBufferBindingSize",
  "minUniformBufferOffsetAlignment",
  "minStorageBufferOffsetAlignment",
  "maxVertexBuffers",
  "maxBufferSize",
  "maxVertexAttributes",
  "maxVertexBufferArrayStride",
  "maxInterStageShaderVariables",
  "maxColorAttachments",
  "maxColorAttachmentBytesPerSample",
  "maxComputeWorkgroupStorageSize",
  "maxComputeInvocationsPerWorkgroup",
  "maxComputeWorkgroupSizeX",
  "maxComputeWorkgroupSizeY",
  "maxComputeWorkgroupSizeZ",
  "maxComputeWorkgroupsPerDimension",
  "maxImmediateSize"
]);

/** title= tren #gpu-info (Adapter Info) — doi chieu view-source */
const WEBGPU_PAGE_INFO = new Set([
  "powerPreference",
  "isFallbackAdapter",
  "vendor",
  "architecture",
  "device",
  "description",
  "driver",
  "backend",
  "type",
  "memoryHeaps",
  "d3dShaderModel",
  "vkDriverVersion",
  "subgroupMatrixConfigs",
  "subgroupMaxSize",
  "subgroupMinSize"
]);

/** #js-* co tren /javascript cho battery + network */
const JS_BATTERY_IDS = new Set([
  "charging",
  "chargingTime",
  "dischargingTime",
  "level"
]);
const JS_NETWORK_IDS = new Set([
  "type",
  "effectiveType",
  "downlink",
  "downlinkMax",
  "rtt",
  "saveData"
]);
// === END EDITABLE CONFIG ===

// =============================================================================
// Auto-map expand suffix -> selector (battery / network / webgl_param / webgpu)
// =============================================================================
function toCamel(suffix) {
  return String(suffix).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function webglParamCssId(suffix) {
  let s = String(suffix).replace(/2$/, '');
  if (Object.prototype.hasOwnProperty.call(WEBGL_PARAM_ID, s)) {
    return WEBGL_PARAM_ID[s];
  }
  const id = s.toUpperCase();
  return WEBGL_PAGE_IDS.has(id) ? id : null;
}

function glIdToSnake(id) {
  return String(id).toLowerCase();
}

/** Tim configKey ung voi WebGL id (MAX_TEXTURE_SIZE -> hidemium.webgl.webgl_param.max_texture_size) */
function findWebglConfigKey(configMap, glId) {
  const map = configMap || {};
  const prefix = 'hidemium.webgl.webgl_param.';
  const snake = glIdToSnake(glId);

  for (const suf of [snake, `${snake}2`]) {
    const k = prefix + suf;
    if (k in map) return k;
  }

  for (const k of Object.keys(map)) {
    if (!k.startsWith(prefix)) continue;
    const suf = k.slice(prefix.length);
    if (webglParamCssId(suf) === glId) return k;
  }

  return prefix + snake;
}

function findWebgpuLimitConfigKey(configMap, title) {
  const map = configMap || {};
  const snake = String(title)
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  const candidates = [
    `hidemium.webgpu.param.${title}`,
    `hidemium.webgpu.param.${snake}`,
    `hidemium.webgpu.limits.${title}`,
    `hidemium.webgpu.limits.${snake}`,
    `hidemium.webgpu.${title}`,
    `hidemium.webgpu.${snake}`,
  ];
  for (const k of candidates) {
    if (k in map) return k;
  }
  const suffixCamel = `.${title}`;
  const suffixSnake = `.${snake}`;
  for (const k of Object.keys(map)) {
    if (!k.includes('webgpu')) continue;
    if (k.endsWith(suffixCamel) || k.endsWith(suffixSnake)) return k;
  }
  return candidates[0];
}

/**
 * Doc 1 lan toan bo WebGPU report.
 * Limits uu tien:
 *   1) #gpu-limits tr cot 2 (nth-child / title tren tr|td)
 *   2) JSON Dump
 *   3) navigator.gpu.requestAdapter().limits (fallback khi DOM chua fill)
 */
async function scrapeWebGpuBundle(page) {
  const limitTitles = [...WEBGPU_PAGE_LIMITS];
  const infoTitles = [...WEBGPU_PAGE_INFO];

  return page.evaluate(
    async ({ limitTitles, infoTitles }) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      function cellText(el) {
        if (!el) return '';
        return String(el.innerText || el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function rowKey(tr) {
        if (!tr) return '';
        return (
          tr.getAttribute('title') ||
          (tr.cells && tr.cells[0] && tr.cells[0].getAttribute('title')) ||
          ''
        );
      }

      function isPlaceholder(key, val) {
        if (!val) return true;
        const bare = val.replace(/^_+|_+$/g, '');
        return bare === key || val === key;
      }

      // Cho WebGPU / bang limits render (toi da ~10s)
      for (let i = 0; i < 50; i++) {
        const rows = document.querySelectorAll('#gpu-limits tr');
        let ready = false;
        for (const tr of rows) {
          if (!tr.cells || tr.cells.length < 2) continue;
          const key = rowKey(tr) || '';
          const val = cellText(tr.cells[1]);
          if (val && /\d/.test(val) && !isPlaceholder(key, val)) {
            ready = true;
            break;
          }
        }
        const hash = cellText(document.querySelector('#gpu-hash'));
        if (ready || (hash && hash.length > 8 && !/loading|false/i.test(hash))) break;
        await sleep(200);
      }
      await sleep(400);

      function tableMap(rootSel) {
        const out = {};
        document.querySelectorAll(`${rootSel} tr`).forEach((tr) => {
          if (!tr.cells || tr.cells.length < 2) return;
          const key = rowKey(tr);
          const val = cellText(tr.cells[1]);
          if (!key || isPlaceholder(key, val)) return;
          out[key] = val;
        });
        return out;
      }

      /**
       * Adapter Limits:
       * - #gpu-limits > tr:nth-child(i) > td:nth-child(2)  (tbody#gpu-limits)
       * - #gpu-limits tr:nth-child(i) > td:nth-child(2)   (table#gpu-limits > tbody > tr)
       */
      function limitsByNthChild() {
        const out = {};
        const root = document.querySelector('#gpu-limits');
        if (!root) return out;
        const rows = root.querySelectorAll(':scope > tr, :scope > tbody > tr, tr');
        const list = rows.length ? [...rows] : [];
        const n = Math.max(list.length, limitTitles.length, 36);
        for (let i = 1; i <= n; i++) {
          const td =
            document.querySelector(`#gpu-limits > tr:nth-child(${i}) > td:nth-child(2)`) ||
            document.querySelector(`#gpu-limits > tbody > tr:nth-child(${i}) > td:nth-child(2)`) ||
            document.querySelector(`#gpu-limits tr:nth-child(${i}) > td:nth-child(2)`) ||
            (list[i - 1] && list[i - 1].cells && list[i - 1].cells[1]);
          const tr =
            document.querySelector(`#gpu-limits > tr:nth-child(${i})`) ||
            document.querySelector(`#gpu-limits > tbody > tr:nth-child(${i})`) ||
            document.querySelector(`#gpu-limits tr:nth-child(${i})`) ||
            list[i - 1];
          const key = rowKey(tr) || limitTitles[i - 1] || '';
          const val = cellText(td);
          if (!key || isPlaceholder(key, val)) continue;
          if (!/\d/.test(val)) continue;
          out[key] = val;
        }
        return out;
      }

      function byTitles(rootSel, titles, requireDigit) {
        const out = {};
        for (const title of titles) {
          const td =
            document.querySelector(`${rootSel} tr[title="${title}"] td:nth-child(2)`) ||
            document.querySelector(`${rootSel} td[title="${title}"] + td`) ||
            document.querySelector(`${rootSel} td[title="${title}"] ~ td`);
          const val = cellText(td);
          if (!val || isPlaceholder(title, val)) continue;
          if (requireDigit && !/\d/.test(val)) continue;
          out[title] = val;
        }
        return out;
      }

      async function limitsFromGpuApi() {
        const out = {};
        try {
          if (!navigator.gpu) return out;
          const adapter = await navigator.gpu.requestAdapter();
          if (!adapter || !adapter.limits) return out;
          for (const title of limitTitles) {
            const v = adapter.limits[title];
            if (v === undefined || v === null) continue;
            out[title] = String(v);
          }
        } catch {
          /* WebGPU bi chan / fail */
        }
        return out;
      }

      // Features tu DOM
      const features = {};
      document.querySelectorAll('#gpu-features tr').forEach((tr) => {
        if (!tr.cells || tr.cells.length < 2) return;
        const name = cellText(tr.cells[0]);
        if (!name) return;
        const val = cellText(tr.cells[1]);
        if (!val || isPlaceholder(name, val)) return;
        features[name] = /true|✔/i.test(val) ? 'True' : 'False';
      });

      let info = {
        ...tableMap('#gpu-info'),
        ...byTitles('#gpu-info', infoTitles, false),
      };
      let limits = {
        ...limitsByNthChild(),
        ...tableMap('#gpu-limits'),
        ...byTitles('#gpu-limits', limitTitles, true),
      };

      // JSON Dump
      const btn = document.querySelector('input.more-button[value="JSON Dump"]');
      if (btn) {
        btn.click();
        await sleep(500);
      }
      const ta =
        document.querySelector('tr.json-output textarea') ||
        document.querySelector('.json-output textarea') ||
        document.querySelector('textarea');
      const raw = (ta && ta.value) || '';
      if (raw.trim().startsWith('{')) {
        try {
          const data = JSON.parse(raw);
          const ad = data.adapters && data.adapters[0];
          if (ad) {
            if (ad.info && typeof ad.info === 'object') {
              for (const [k, v] of Object.entries(ad.info)) {
                if (v === undefined || v === null || v === '') continue;
                info[k] = String(v);
              }
            }
            if (ad.limits && typeof ad.limits === 'object') {
              for (const [k, v] of Object.entries(ad.limits)) {
                if (v === undefined || v === null || v === '') continue;
                limits[k] = String(v);
              }
            }
            if (Array.isArray(ad.features)) {
              for (const f of ad.features) {
                if (f) features[f] = 'True';
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Fallback API neu DOM/JSON van thieu limits
      if (Object.keys(limits).length < 10) {
        const apiLim = await limitsFromGpuApi();
        limits = { ...apiLim, ...limits };
      }

      return { info, limits, features };
    },
    { limitTitles, infoTitles }
  );
}

/**
 * webgl_param: lay TAT CA id co tren /webgl, map sang config neu co.
 */
function fieldsFromWebGlParam(configMap) {
  return [...WEBGL_PAGE_IDS].sort().map((id) => ({
    label: glIdToSnake(id),
    configKey: findWebglConfigKey(configMap, id),
    css: `#${id}`,
    match: 'includes',
    fromWeb: true,
  }));
}

/**
 * 1 key WebGPU limit: nth-child (dung thu tu trang) + tr[title] + td[title].
 * index1Based: 1..36 theo WEBGPU_PAGE_LIMITS / #gpu-limits.
 */
function webgpuLimitSel(title, index1Based) {
  const safe = String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const i = index1Based > 0 ? index1Based : 1;
  return {
    sel: [
      { css: `#gpu-limits > tr:nth-child(${i}) > td:nth-child(2)` },
      { css: `#gpu-limits > tbody > tr:nth-child(${i}) > td:nth-child(2)` },
      { css: `#gpu-limits tr:nth-child(${i}) > td:nth-child(2)` },
      { css: `#gpu-limits tr[title="${safe}"] td:nth-child(2)` },
      { css: `#gpu-limits td[title="${safe}"] + td` },
      {
        js: `() => {
          const title = ${JSON.stringify(title)};
          const tr =
            document.querySelector('#gpu-limits tr[title="' + title + '"]') ||
            [...document.querySelectorAll('#gpu-limits tr')].find(
              (r) => r.cells[0] && r.cells[0].getAttribute('title') === title
            );
          if (!tr || !tr.cells[1]) return '';
          const val = (tr.cells[1].innerText || '').replace(/\\s+/g, ' ').trim();
          if (!val || val === title || !/\\d/.test(val)) return '';
          return val;
        }`,
      },
    ],
    selMode: 'first',
    match: 'includes',
  };
}

/**
 * @deprecated dung webgpuLimitSel — giu ten cu cho export.
 */
function webgpuDualSel(title) {
  const idx = [...WEBGPU_PAGE_LIMITS].indexOf(title) + 1;
  return webgpuLimitSel(title, idx > 0 ? idx : 1);
}

/**
 * webgpu: TAT CA Adapter Info (#gpu-info) + features + TAT CA limits (#gpu-limits).
 * Limit/param: 1 configKey co the thu ca limits lan features (sel dual).
 */
function fieldsFromWebGpu(configMap) {
  const fields = [];
  const seen = new Set();
  const seenLabels = new Set();

  // Adapter Info — moi title= tren #gpu-info (view-source)
  for (const title of [...WEBGPU_PAGE_INFO].sort()) {
    const keyCandidates =
      title === 'vendor'
        ? ['hidemium.webgpu.vendor']
        : title === 'architecture'
          ? ['hidemium.webgpu.architecture']
          : [
              `hidemium.webgpu.info.${title}`,
              `hidemium.webgpu.param.${title}`,
              `hidemium.webgpu.${title}`,
            ];
    const resolved =
      keyCandidates.find((k) => k in (configMap || {})) || keyCandidates[0];

    const ov = FIELD_OVERRIDE[resolved];
    if (ov && (ov.sel || ov.css || ov.js || ov.xpath)) {
      fields.push(buildField('webgpu', { key: resolved, label: title }));
    } else {
      fields.push({
        label: title,
        configKey: resolved,
        css: `#gpu-info tr[title="${title}"] td:nth-child(2)`,
        match: 'includes',
        fromWeb: true,
      });
    }
    seen.add(resolved);
    seenLabels.add(title);
  }

  // Adapter Features — full list
  const featKey = 'hidemium.webgpu.features';
  fields.push(buildField('webgpu', { key: featKey, label: 'features' }));
  seen.add(featKey);
  seenLabels.add('features');

  // Adapter Limits — moi limit theo thu tu trang (nth-child 1..36)
  let limIdx = 0;
  for (const title of WEBGPU_PAGE_LIMITS) {
    limIdx += 1;
    const configKey = findWebgpuLimitConfigKey(configMap, title);
    if (seen.has(configKey)) continue;
    fields.push({
      label: title,
      configKey,
      ...webgpuLimitSel(title, limIdx),
      fromWeb: true,
    });
    seen.add(configKey);
    seenLabels.add(title);
  }

  // Config con thua (param.*) chua nam trong whitelist limits — van thu 2 cho tren web
  const prefix = 'hidemium.webgpu.param.';
  for (const key of Object.keys(configMap || {}).sort()) {
    if (!key.startsWith(prefix)) continue;
    if (seen.has(key)) continue;
    const title = key.slice(prefix.length);
    if (!title || seenLabels.has(title)) continue;
    fields.push({
      label: title,
      configKey: key,
      ...webgpuLimitSel(title, [...WEBGPU_PAGE_LIMITS].indexOf(title) + 1 || 1),
      fromWeb: true,
    });
    seen.add(key);
  }

  return fields.filter((f) => !f.skip);
}

// =============================================================================
// Helper XPath (dung noi bo / selector.js)
// =============================================================================
function xpathValue(h3, label, h3Mode = 'exact') {
  const h3Expr = h3Mode === 'contains' ? `contains(., '${h3}')` : `text()='${h3}'`;
  const safeLabel = String(label).replace(/'/g, "\\'");
  return (
    `//h3[${h3Expr}]/following-sibling::table[1]` +
    `//td[text()='${safeLabel}']/following-sibling::td[1]`
  );
}

/**
 * Tao 1 field rule tu mapping + override.
 * Chi set selector: xpath | css | sel | by+value | tableCell (mac dinh).
 * css/xpath/js co the la string HOAC mang → build thanh sel[].
 */
function normalizeOverrideMulti(ov) {
  const out = [];
  const push = (by, raw) => {
    if (raw == null || raw === '') return;
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      if (item == null || item === '') continue;
      if (typeof item === 'string') out.push({ [by]: item });
      else if (typeof item === 'object') out.push(item);
    }
  };
  push('css', ov.css);
  push('xpath', ov.xpath);
  push('js', ov.js);
  // Chi coi la "multi" khi tong > 1 entry (1 string van giu css/xpath/js don)
  return out.length > 1 ? out : null;
}

/**
 * Tao 1 field rule tu mapping + override.
 * Chi set selector: xpath | css | sel | by+value | tableCell (mac dinh).
 */
function buildField(checkKey, mappingField) {
  const section = SECTION_OF[checkKey] || { h3: checkKey, h3Mode: 'contains' };
  const ov = FIELD_OVERRIDE[mappingField.key] || {};
  const label = ov.label || mappingField.label;

  const base = {
    label,
    configKey: mappingField.key,
    base64: ov.base64 ?? mappingField.base64,
    match: ov.match,
    altConfigKeys: ov.altConfigKeys,
    skip: ov.skip,
  };

  if (ov.skip) return base;
  // sel (nhieu cho) uu tien hon css/xpath don
  if (ov.sel) {
    return {
      ...base,
      sel: ov.sel,
      selMode: ov.selMode || 'first',
      match: ov.match || base.match,
    };
  }
  // css/xpath/js mang → chuan hoa thanh sel[]
  const multi = normalizeOverrideMulti(ov);
  if (multi) {
    return {
      ...base,
      sel: multi,
      selMode: ov.selMode || 'first',
      match: ov.match || base.match,
    };
  }
  if (ov.xpath) return { ...base, xpath: ov.xpath };
  if (ov.css) return { ...base, css: ov.css };
  if (ov.js) return { ...base, js: ov.js };
  if (ov.by) {
    return {
      ...base,
      by: ov.by,
      value: ov.value,
      role: ov.role,
      name: ov.name,
      exact: ov.exact,
      sibling: ov.sibling,
      h3: ov.h3,
      cellLabel: ov.cellLabel,
      h3Mode: ov.h3Mode,
    };
  }

  // Auto selector theo loai check — chi map neu web co show
  if (checkKey === 'battery') {
    const id = toCamel(label);
    if (!JS_BATTERY_IDS.has(id)) return { ...base, skip: true };
    return {
      ...base,
      css: `#js-${id}`,
      match: ov.match || (id === 'charging' ? 'bool' : undefined),
    };
  }
  if (checkKey === 'network') {
    let id = toCamel(label);
    if (id === 'downlinkmax') id = 'downlinkMax';
    if (!JS_NETWORK_IDS.has(id)) return { ...base, skip: true };
    return {
      ...base,
      css: `#js-${id}`,
      match: ov.match || (id === 'saveData' ? 'bool' : undefined),
    };
  }
  if (checkKey === 'webgl_param') {
    const id = webglParamCssId(label);
    if (!id || !WEBGL_PAGE_IDS.has(id)) return { ...base, skip: true };
    return { ...base, css: `#${id}`, match: ov.match || 'includes' };
  }
  if (checkKey === 'webgpu') {
    // Expand / buildField: 1 key thu ca limits + features
    const dual = webgpuDualSel(label);
    return { ...base, ...dual, match: ov.match || dual.match };
  }

  return {
    ...base,
    by: 'tableCell',
    h3: ov.h3 || section.h3,
    cellLabel: ov.cellLabel || mappingField.label,
    h3Mode: ov.h3Mode || section.h3Mode || 'exact',
  };
}

/** Field dong tu expand prefix + configMap (battery / network / webgl_param / ...) */
function buildExpandFields(checkKey, expandPrefix, configMap) {
  if (!expandPrefix || !configMap) return [];
  const section = SECTION_OF[checkKey] || { h3: checkKey, h3Mode: 'contains' };
  const out = [];

  for (const key of Object.keys(configMap).sort()) {
    if (!key.startsWith(expandPrefix)) continue;
    const suffix = key.slice(expandPrefix.length);
    if (!suffix) continue;
    out.push(buildField(checkKey, { key, label: suffix }));
  }

  // Chi them override khi config co key (tranh FAIL "no config" tu chargingTime camelCase)
  for (const [configKey, ov] of Object.entries(FIELD_OVERRIDE)) {
    if (!configKey.startsWith(expandPrefix)) continue;
    if (out.some((f) => f.configKey === configKey)) continue;
    if (!(configKey in (configMap || {}))) continue;
    out.push(
      buildField(checkKey, {
        key: configKey,
        label: ov.cellLabel || ov.label || configKey.slice(expandPrefix.length),
      })
    );
  }

  return out.map((f) => {
    if (f.by === 'tableCell' && !FIELD_OVERRIDE[f.configKey]?.h3) {
      return { ...f, h3: section.h3, h3Mode: section.h3Mode || f.h3Mode };
    }
    return f;
  });
}

function buildRecipes() {
  const recipes = {};
  for (const [checkKey, rule] of Object.entries(MAPPING)) {
    // Include tat ca checkKey — skip theo platform.skipChecks luc run (khong hardcode OS).
    const staticFields = (rule.fields || []).map((f) => buildField(checkKey, f));
    recipes[checkKey] = {
      page: PAGE_OF[checkKey] || 'javascript',
      fields: staticFields,
      expand: rule.expand || null,
    };
  }
  return recipes;
}

const RECIPES = buildRecipes();

/**
 * @param {string} checkKey
 * @param {Record<string,string>} [configMap]
 * @param {{ skipConfigKeys?: Set<string> } | null} [platform]
 */
function fieldsForCheck(checkKey, configMap, platform) {
  // webgl_param / webgpu: uu tien TAT CA key tren web de doi chieu / bo sung config
  if (checkKey === 'webgl_param') return fieldsFromWebGlParam(configMap || {});
  if (checkKey === 'webgpu') return fieldsFromWebGpu(configMap || {});

  const recipe = RECIPES[checkKey];
  if (!recipe) return [];
  const staticKeys = new Set(recipe.fields.map((f) => f.configKey));
  const fields = [...recipe.fields];
  if (recipe.expand) {
    for (const f of buildExpandFields(checkKey, recipe.expand, configMap || {})) {
      if (staticKeys.has(f.configKey)) continue;
      fields.push(f);
      staticKeys.add(f.configKey);
    }
  }
  const skipKeys = platform?.skipConfigKeys;
  return fields.filter((f) => {
    if (f.skip) return false;
    if (skipKeys && f.configKey && skipKeys.has(f.configKey)) return false;
    return true;
  });
}

module.exports = {
  PAGES,
  PAGE_OF,
  SECTION_OF,
  FIELD_OVERRIDE,
  SKIP_CHECKS,
  WEBGL_PARAM_ID,
  WEBGL_PAGE_IDS,
  WEBGPU_PAGE_LIMITS,
  WEBGPU_PAGE_INFO,
  JS_BATTERY_IDS,
  JS_NETWORK_IDS,
  RECIPES,
  xpathValue,
  fieldsForCheck,
  buildField,
  buildExpandFields,
  fieldsFromWebGlParam,
  fieldsFromWebGpu,
  webgpuDualSel,
  webgpuLimitSel,
  scrapeWebGpuBundle,
  findWebgpuLimitConfigKey,
};
