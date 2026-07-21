/**
 * BrowserScan — Screen.
 * Select Screen Resolution / Available Screen Size / Color Depth tren DOM,
 * cac field con lai fallback tu window.screen/window.
 */
const { evaluateInPage } = require('./runtime');

const CFG = {
  width: 'hidemium.navigator.screen.width',
  height: 'hidemium.navigator.screen.height',
  availWidth: 'hidemium.navigator.screen.avail_width',
  availHeight: 'hidemium.navigator.screen.avail_height',
  colorDepth: 'hidemium.navigator.screen.color_depth',
  pixelDepth: 'hidemium.navigator.screen.pixcel_depth',
  innerWidth: 'hidemium.navigator.screen.inner_width',
  innerHeight: 'hidemium.navigator.screen.inner_height',
  outerWidth: 'hidemium.navigator.screen.outer_width',
  outerHeight: 'hidemium.navigator.screen.outer_height',
  devicePixelRatio: 'hidemium.navigator.pixel_ratio',
};

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function scrapeScreenInPage() {
  const normalize = (value) =>
    String(value || '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase();

  function findRow(labels, key) {
    const wanted = new Set(labels.map(normalize));
    let label = null;
    let shortest = Infinity;
    for (const element of document.querySelectorAll('body *')) {
      const text = normalize(element.textContent);
      if (!wanted.has(text)) continue;
      if ((element.textContent || '').length < shortest) {
        label = element;
        shortest = (element.textContent || '').length;
      }
    }
    if (!label) return { text: '', target: null };

    const candidates = [];
    if (label.nextElementSibling) candidates.push(label.nextElementSibling);
    let parent = label.parentElement;
    for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
      for (const child of parent.children) {
        if (child !== label) candidates.push(child);
      }
    }

    let target = null;
    let text = '';
    for (const candidate of candidates) {
      const value = (candidate.innerText || candidate.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!value || wanted.has(normalize(value)) || value.length > 150) continue;
      if (!target || value.length < text.length) {
        target = candidate;
        text = value;
      }
    }
    const highlightTarget = target || label.parentElement || label;
    highlightTarget.setAttribute('data-autotest-bs-screen', key);
    return { text, target: highlightTarget };
  }

  function dimensions(text) {
    const match = String(text || '').match(/(\d+)\s*[x×*]\s*(\d+)/i);
    return match ? [Number(match[1]), Number(match[2])] : [null, null];
  }

  function number(text) {
    const match = String(text || '').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  const resolution = findRow(
    ['Screen Resolution', 'Screen Size', 'Resolution'],
    'resolution'
  );
  const available = findRow(
    ['Available Screen Size', 'Available Screen', 'Available Size'],
    'available'
  );
  const depth = findRow(['Color Depth', 'Colour Depth'], 'colorDepth');
  const [domWidth, domHeight] = dimensions(resolution.text);
  const [domAvailWidth, domAvailHeight] = dimensions(available.text);

  return {
    values: {
      width: domWidth ?? screen.width,
      height: domHeight ?? screen.height,
      availWidth: domAvailWidth ?? screen.availWidth,
      availHeight: domAvailHeight ?? screen.availHeight,
      colorDepth: number(depth.text) ?? screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    selected: {
      resolution: !!resolution.target,
      available: !!available.target,
      colorDepth: !!depth.target,
    },
  };
}

function paintScreenInPage(marks) {
  const styleId = 'autotest-browserscan-screen-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-screen-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-screen-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-screen-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }

  let count = 0;
  for (const mark of marks) {
    const element = document.querySelector(
      `[data-autotest-bs-screen="${mark.key}"]`
    );
    if (!element) continue;
    element.classList.remove(
      'at-bs-screen-pass',
      'at-bs-screen-fail',
      'at-bs-screen-na'
    );
    element.classList.add(
      mark.pass === true
        ? 'at-bs-screen-pass'
        : mark.pass === false
          ? 'at-bs-screen-fail'
          : 'at-bs-screen-na'
    );
    count++;
  }
  return count;
}

async function checkScreen(page, configMap, ctx) {
  ctx.step('BrowserScan Screen: select screen elements...');
  const scraped = await evaluateInPage(page, scrapeScreenInPage);
  const lines = Object.entries(CFG).map(([label, configKey]) => {
    const actual = scraped.values[label];
    const expected = cfgStr(configMap, configKey);
    let pass = null;
    if (!isDefault(expected)) {
      pass = Number(actual) === Number(expected);
    }
    return {
      label,
      value: actual == null ? '' : String(actual),
      expected: isDefault(expected) ? 'default' : expected,
      pass,
    };
  });

  const judged = lines.filter((line) => line.pass === true || line.pass === false);
  const anyFail = judged.some((line) => line.pass === false);
  const allPass = judged.length > 0 && judged.every((line) => line.pass === true);
  const result = {
    lines,
    state: anyFail ? 'fail' : allPass ? 'pass' : 'skipped',
    pass: anyFail ? false : allPass ? true : null,
    value: lines.map((line) => `${line.label}\n${line.value}`).join('\n'),
  };

  const passFor = (...labels) => {
    const selectedLines = lines.filter((line) => labels.includes(line.label));
    const tested = selectedLines.filter(
      (line) => line.pass === true || line.pass === false
    );
    if (!tested.length) return null;
    return tested.every((line) => line.pass === true);
  };
  const painted = await evaluateInPage(page, paintScreenInPage, [
    { key: 'resolution', pass: passFor('width', 'height') },
    { key: 'available', pass: passFor('availWidth', 'availHeight') },
    { key: 'colorDepth', pass: passFor('colorDepth') },
  ]);

  ctx.step(
    `BrowserScan Screen: ${result.state} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = { checkScreen, scrapeScreenInPage, CFG };
