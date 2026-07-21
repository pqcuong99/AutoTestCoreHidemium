/**
 * CreepJS — check muc Screen.
 * Nhan page da mo san (index.js quan ly session CDP).
 */
const {
  cfgStr,
  isDefault,
  eqNum,
  highlightMarksInPage,
  summarizeLines,
} = require('./helpers');

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
  dpr: 'hidemium.navigator.pixel_ratio',
};

/**
 * Lay gia tri Screen tu DOM (#creep-resize) + window.Fingerprint.screen.
 * Chay trong browser context (page.evaluate).
 */
function scrapeScreenInPage() {
  const root = document.getElementById('creep-resize');
  const fp = window.Fingerprint && window.Fingerprint.screen;
  const text = root ? root.innerText || '' : '';

  const pick = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  const screenWH = pick(/\.\.\.screen:\s*([^\n]+)/i);
  const availWH = pick(/\.\.\.\.avail:\s*([^\n]+)/i);
  const depthRaw = pick(/depth:\s*([^\n]+)/i);

  let width = fp?.width ?? window.screen.width;
  let height = fp?.height ?? window.screen.height;
  let availWidth = fp?.availWidth ?? window.screen.availWidth;
  let availHeight = fp?.availHeight ?? window.screen.availHeight;
  let colorDepth = fp?.colorDepth ?? window.screen.colorDepth;
  let pixelDepth = fp?.pixelDepth ?? window.screen.pixelDepth;

  if (screenWH) {
    const p = screenWH.split(/\s*x\s*/i);
    if (p.length === 2) {
      width = width ?? Number(p[0]);
      height = height ?? Number(p[1]);
    }
  }
  if (availWH) {
    const p = availWH.split(/\s*x\s*/i);
    if (p.length === 2) {
      availWidth = availWidth ?? Number(p[0]);
      availHeight = availHeight ?? Number(p[1]);
    }
  }
  if (depthRaw) {
    const p = depthRaw.split('|');
    if (p.length >= 1) colorDepth = colorDepth ?? Number(p[0]);
    if (p.length >= 2) pixelDepth = pixelDepth ?? Number(p[1]);
  }

  const outerW = document.querySelector('.screen-outer-w');
  const outerH = document.querySelector('.screen-outer-h');
  const innerW = document.querySelector('.screen-inner-w');
  const innerH = document.querySelector('.screen-inner-h');
  const dprEl = document.querySelector('.screen-dpr');

  return {
    width,
    height,
    availWidth,
    availHeight,
    colorDepth,
    pixelDepth,
    outerWidth: outerW ? Number(outerW.textContent.trim()) : window.outerWidth,
    outerHeight: outerH ? Number(outerH.textContent.trim()) : window.outerHeight,
    innerWidth: innerW ? Number(innerW.textContent.trim()) : window.innerWidth,
    innerHeight: innerH ? Number(innerH.textContent.trim()) : window.innerHeight,
    dpr: dprEl ? Number(dprEl.textContent.trim()) : window.devicePixelRatio,
    hasDom: !!root,
  };
}

function compareScreen(scraped, configMap) {
  const fields = [
    { label: 'width', actual: scraped.width, expected: cfgStr(configMap, CFG.width), needle: '...screen:' },
    { label: 'height', actual: scraped.height, expected: cfgStr(configMap, CFG.height), needle: '...screen:' },
    { label: 'availWidth', actual: scraped.availWidth, expected: cfgStr(configMap, CFG.availWidth), needle: '....avail:' },
    { label: 'availHeight', actual: scraped.availHeight, expected: cfgStr(configMap, CFG.availHeight), needle: '....avail:' },
    { label: 'colorDepth', actual: scraped.colorDepth, expected: cfgStr(configMap, CFG.colorDepth), needle: 'depth:' },
    { label: 'pixelDepth', actual: scraped.pixelDepth, expected: cfgStr(configMap, CFG.pixelDepth), needle: 'depth:' },
    { label: 'innerWidth', actual: scraped.innerWidth, expected: cfgStr(configMap, CFG.innerWidth), selector: '.screen-inner-w' },
    { label: 'innerHeight', actual: scraped.innerHeight, expected: cfgStr(configMap, CFG.innerHeight), selector: '.screen-inner-h' },
    { label: 'outerWidth', actual: scraped.outerWidth, expected: cfgStr(configMap, CFG.outerWidth), selector: '.screen-outer-w' },
    { label: 'outerHeight', actual: scraped.outerHeight, expected: cfgStr(configMap, CFG.outerHeight), selector: '.screen-outer-h' },
    { label: 'devicePixelRatio', actual: scraped.dpr, expected: cfgStr(configMap, CFG.dpr), selector: '.screen-dpr' },
  ];

  const lines = fields.map((f) => {
    const expected = f.expected;
    let pass = null;
    if (!isDefault(expected)) pass = eqNum(f.actual, expected);
    return {
      label: f.label,
      value: f.actual == null || Number.isNaN(f.actual) ? '' : String(f.actual),
      expected: isDefault(expected) ? 'default' : expected,
      pass,
      needle: f.needle || null,
      selector: f.selector || null,
    };
  });

  const markMap = new Map();
  for (const l of lines) {
    const key = l.selector ? `sel:${l.selector}` : l.needle ? `n:${l.needle}` : null;
    if (!key) continue;
    const prev = markMap.get(key);
    let pass = l.pass;
    if (prev) {
      if (prev.pass === false || pass === false) pass = false;
      else if (prev.pass === true && pass === true) pass = true;
      else pass = prev.pass ?? pass;
    }
    markMap.set(key, { needle: l.needle, selector: l.selector, pass });
  }

  return { ...summarizeLines(lines), marks: [...markMap.values()] };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {object} configMap
 * @param {{ step:Function }} ctx
 */
async function checkScreen(page, configMap, ctx) {
  const { step } = ctx;
  step('CreepJS Screen: select #creep-resize + so sanh config...');

  const scraped = await page.evaluate(scrapeScreenInPage);
  if (!scraped.hasDom && scraped.width == null) {
    return { state: 'fail', value: 'Khong doc duoc Screen tu CreepJS', pass: false, lines: [] };
  }

  const compared = compareScreen(scraped, configMap);
  const painted = await page.evaluate(highlightMarksInPage, compared.marks || []);
  step(
    `CreepJS Screen: ${compared.state} — highlight ${painted} o (${compared.lines.filter((l) => l.pass === false).length} lech)`,
    compared.pass === false ? 'err' : 'ok'
  );
  return compared;
}

module.exports = { checkScreen, compareScreen, scrapeScreenInPage };
