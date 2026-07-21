/**
 * CreepJS — Platform (navigator) + Platform (UA).
 */
const {
  cfgStr,
  isDefault,
  eqStr,
  highlightMarksInPage,
  summarizeLines,
} = require('./helpers');
const { scrapeNavigatorDataInPage } = require('./scrapeNavigator');

const CFG = {
  navigatorPlatform: 'hidemium.navigator.useragent.platforms',
  uaPlatform: 'hidemium.navigator.os.platform_os',
};

async function waitAndScrape(page) {
  return page.evaluate(scrapeNavigatorDataInPage);
}

function lineResult(label, actual, expected, needle) {
  let pass = null;
  if (!isDefault(expected) && actual != null && actual !== '') {
    pass = eqStr(actual, expected);
  }
  return {
    label,
    value: actual == null || actual === '' ? '' : String(actual),
    expected: isDefault(expected) ? 'default' : expected,
    pass,
    needle: needle || (actual ? String(actual) : null),
  };
}

async function checkPlatformNavigator(page, configMap, ctx) {
  const { step } = ctx;
  step('CreepJS Platform (navigator): select device...');
  const scraped = await waitAndScrape(page);
  step(`CreepJS Platform (navigator): ${scraped.navigatorPlatform ?? 'null'}`);

  const line = lineResult(
    'navigator.platform',
    scraped.navigatorPlatform,
    cfgStr(configMap, CFG.navigatorPlatform),
    scraped.navigatorPlatform ? `(${scraped.navigatorPlatform})` : 'device:'
  );

  if (!scraped.navigatorPlatform) {
    return { state: 'fail', value: 'Khong doc duoc navigator.platform', pass: false, lines: [line] };
  }

  const result = summarizeLines([line]);
  await page.evaluate(highlightMarksInPage, [{ needle: line.needle, pass: line.pass }]);
  return result;
}

async function checkPlatformUa(page, configMap, ctx) {
  const { step } = ctx;
  step('CreepJS Platform (UA): select userAgent...');
  const scraped = await waitAndScrape(page);
  step(`CreepJS Platform (UA): ${scraped.uaPlatform ?? 'null'} (needle: ${scraped.uaPlatformNeedle ?? 'null'})`);

  const line = lineResult(
    'platform',
    scraped.uaPlatform,
    cfgStr(configMap, CFG.uaPlatform),
    scraped.uaPlatformNeedle || scraped.uaPlatform || 'userAgent:'
  );

  if (!scraped.uaPlatform) {
    return { state: 'fail', value: 'Khong doc duoc platform (UA)', pass: false, lines: [line] };
  }

  const result = summarizeLines([line]);
  await page.evaluate(highlightMarksInPage, [{ needle: line.needle, pass: line.pass }]);
  return result;
}

module.exports = {
  checkPlatformNavigator,
  checkPlatformUa,
  CFG,
};
