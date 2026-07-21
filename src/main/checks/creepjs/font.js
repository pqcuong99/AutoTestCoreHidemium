/**
 * CreepJS Font — chi lay hash tren trang CreepJS chinh (web-only, khong so config).
 */
const { infoLine, summarizeLines } = require('./helpers');

const FONT_HASH_XPATH = '//*[@id="fingerprint-data"]/div[7]/div[2]/span[2]';
const CFG = {
  fontsValue: 'hidemium.fonts_value',
};

function readFontHashInPage() {
  const exact = document.evaluate(
    '//*[@id="fingerprint-data"]/div[7]/div[2]/span[2]',
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
  return (exact?.textContent || '').trim();
}

async function checkFont(page, configMap, ctx) {
  void configMap;
  ctx.step(`CreepJS Font: lay hash ${FONT_HASH_XPATH}`);
  const actual = await page.evaluate(readFontHashInPage);
  const result = summarizeLines([infoLine('fontHash', actual, actual)]);
  ctx.step(`CreepJS Font: hash=${actual || 'null'}`, 'ok');
  return result;
}

module.exports = {
  checkFont,
  readFontHashInPage,
  FONT_HASH_XPATH,
  CFG,
};
