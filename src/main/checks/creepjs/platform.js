/**
 * CreepJS — Platform (navigator) + Platform (UA).
 */
const {
  cfgStr,
  lineResult,
  highlightMarksInPage,
  summarizeLines,
  toFieldResult,
} = require('./helpers');
const { scrapeNavigatorDataInPage } = require('./scrapeNavigator');

const CFG = {
  navigatorPlatform: 'hidemium.navigator.useragent.platforms',
  uaPlatform: 'hidemium.navigator.os.platform_os',
};

async function waitAndScrape(page) {
  return page.evaluate(scrapeNavigatorDataInPage);
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
    const field = toFieldResult(line);
    return {
      state: 'fail',
      value: 'Khong doc duoc navigator.platform',
      pass: false,
      lines: summarizeLines([field]).lines,
    };
  }

  const result = summarizeLines([line]);
  await page.evaluate(highlightMarksInPage, [
    { needle: line.needle, pass: line.infoOnly ? null : line.pass },
  ]);
  return result;
}

async function checkPlatformUa(page, configMap, ctx) {
  const { step } = ctx;
  step('CreepJS Platform (UA): select userAgent...');
  const scraped = await waitAndScrape(page);
  step(
    `CreepJS Platform (UA): ${scraped.uaPlatform ?? 'null'} (needle: ${scraped.uaPlatformNeedle ?? 'null'})`
  );

  const line = lineResult(
    'platform',
    scraped.uaPlatform,
    cfgStr(configMap, CFG.uaPlatform),
    scraped.uaPlatformNeedle || scraped.uaPlatform || 'userAgent:'
  );

  if (!scraped.uaPlatform) {
    const field = toFieldResult(line);
    return {
      state: 'fail',
      value: 'Khong doc duoc platform (UA)',
      pass: false,
      lines: summarizeLines([field]).lines,
    };
  }

  const result = summarizeLines([line]);
  await page.evaluate(highlightMarksInPage, [
    { needle: line.needle, pass: line.infoOnly ? null : line.pass },
  ]);
  return result;
}

module.exports = {
  checkPlatformNavigator,
  checkPlatformUa,
  CFG,
};
