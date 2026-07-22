/**
 * BrowserScan Font — chi lay hash tu element "Fonts" tren trang chinh.
 */
const CFG = {
  fontsValue: 'hidemium.fonts_value',
};
const FONT_CONTAINER_SELECTOR = '#fonts_anchor';
const FONT_HASH_XPATH = '//*[@id="fonts_anchor"]/div[2]/div/p';
const LOAD_TIMEOUT_MS = 90000;

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function readFontHashInPage() {
  const container = document.querySelector('#fonts_anchor');
  if (!container) return '';

  const exact = document.evaluate(
    '//*[@id="fonts_anchor"]/div[2]/div/p',
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
  if (exact && (exact.textContent || '').trim()) {
    exact.setAttribute('data-autotest-bs-font-hash', '1');
    return (exact.textContent || '').trim();
  }

  const candidates = [...container.querySelectorAll('p, a, span, div')];
  for (const element of candidates) {
    const text = (element.innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const hash = text.match(/\b(?:0x)?[a-f0-9]{8,128}\b/i)?.[0];
    if (hash) {
      element.setAttribute('data-autotest-bs-font-hash', '1');
      return hash;
    }
  }

  const fallback = (container.innerText || container.textContent || '')
    .split(/\n+/)
    .map((text) => text.trim())
    .find(
      (text) =>
        text &&
        !/^fonts(?:\s+list)?$/i.test(text) &&
        !/^(?:show|hide) all fonts/i.test(text)
    );
  if (fallback) {
    container.setAttribute('data-autotest-bs-font-hash', '1');
    return fallback;
  }
  return '';
}

async function readFontHashViaCdp(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    for (let attempt = 0; attempt < 20; attempt++) {
      const { root } = await session.send('DOM.getDocument', {
        depth: 1,
        pierce: true,
      });
      const { nodeId } = await session.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: FONT_CONTAINER_SELECTOR,
      });
      if (nodeId) {
        const { outerHTML } = await session.send('DOM.getOuterHTML', { nodeId });
        const text = String(outerHTML || '').replace(/<[^>]*>/g, ' ');
        const hash = text.match(/\b(?:0x)?[a-f0-9]{8,128}\b/i)?.[0];
        if (hash) return hash;
      } else if (attempt === 0) {
        await session.send('Runtime.evaluate', {
          expression: `(() => {
            const button = [...document.querySelectorAll('button')]
              .find((element) => /^expand$/i.test((element.textContent || '').trim()));
            if (button) button.click();
          })()`,
        }).catch(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return '';
  } finally {
    await session.detach().catch(() => {});
  }
}

async function checkFont(page, configMap, ctx) {
  ctx.step(`BrowserScan Font: tim hash trong ${FONT_CONTAINER_SELECTOR}`);
  let actual = await readFontHashViaCdp(page);
  if (!actual) {
    if (ctx.signal?.aborted) throw new Error('aborted');
    ctx.step('BrowserScan Font: khong thay font (co the do quang cao) — reload 1 lan', 'warn');
    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
    if (ctx.signal?.aborted) throw new Error('aborted');
    actual = await readFontHashViaCdp(page);
  }
  const expected = cfgStr(configMap, CFG.fontsValue);
  const lines = [{
    label: 'fontHash',
    value: actual,
    expected: isDefault(expected) ? 'default' : expected,
    pass: null,
  }];
  ctx.step(`BrowserScan Font: hash=${actual || 'null'}`, 'ok');
  return {
    lines,
    state: 'skipped',
    pass: null,
    value: `fontHash\n${actual}`,
  };
}

module.exports = {
  checkFont,
  readFontHashInPage,
  readFontHashViaCdp,
  FONT_CONTAINER_SELECTOR,
  FONT_HASH_XPATH,
  CFG,
};
