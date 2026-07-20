/**
 * CreepJS — FullVersionList + FormFactors (User-Agent Data).
 */
const { cfgStr, isDefault, lineResult, finishCheck } = require('./helpers');
const { scrape, lineOrFail } = require('./userAgentData');

const CFG = {
  fullVersion: 'hidemium.navigator.useragent.fullversion',
  chromeVersion: 'hidemium.chrome.version',
  isMobile: 'hidemium.navigator.is_mobile',
  isTablet: 'hidemium.navigator.is_tablet',
};

function lineBool(label, actual, expected, needle) {
  const actualStr = actual == null ? '' : String(actual);
  const line = lineResult(label, actualStr, expected, needle, 'str');
  if (!isDefault(expected) && actual == null) line.pass = false;
  return line;
}

async function checkFullVersionList(page, configMap, ctx) {
  ctx.step('CreepJS FullVersionList: select userAgentData...');
  const scraped = await scrape(page);
  ctx.step(
    `CreepJS FullVersionList: full=${scraped.uaFullVersion ?? 'null'} chrome=${scraped.chromeVersion ?? 'null'}`
  );

  const expFull = cfgStr(configMap, CFG.fullVersion);
  const expChrome = cfgStr(configMap, CFG.chromeVersion);

  const lines = [
    lineOrFail(
      'fullVersion',
      scraped.uaFullVersion,
      expFull,
      scraped.uaFullVersion
        ? scraped.userAgent && /Version\//i.test(scraped.userAgent)
          ? `Version/${scraped.uaFullVersion}`
          : `(${scraped.uaFullVersion})`
        : 'userAgentData:'
    ),
    lineOrFail('chromeVersion', scraped.chromeVersion, expChrome, scraped.chromeVersion || 'userAgentData:'),
  ];

  const missing =
    (!isDefault(expFull) && !scraped.uaFullVersion) ||
    (!isDefault(expChrome) && !scraped.chromeVersion);
  return finishCheck(page, ctx, 'FullVersionList', lines, missing);
}

async function checkFormFactors(page, configMap, ctx) {
  ctx.step('CreepJS FormFactors: select userAgentData.mobile...');
  const scraped = await scrape(page);
  ctx.step(`CreepJS FormFactors: mobile=${scraped.isMobile} tablet=${scraped.isTablet}`);

  const expMobile = cfgStr(configMap, CFG.isMobile);
  const expTablet = cfgStr(configMap, CFG.isTablet);

  const lines = [
    lineBool('isMobile', scraped.isMobile, expMobile, scraped.isMobile ? ' mobile' : 'userAgentData:'),
    lineBool('isTablet', scraped.isTablet, expTablet, scraped.isTablet ? 'iPad' : 'userAgentData:'),
  ];

  const missing =
    (!isDefault(expMobile) && scraped.isMobile == null) ||
    (!isDefault(expTablet) && scraped.isTablet == null);
  return finishCheck(page, ctx, 'FormFactors', lines, missing);
}

module.exports = {
  checkFullVersionList,
  checkFormFactors,
  CFG,
};
