/**
 * CreepJS — PlatformVersion / UaFullVersion / Model (User-Agent Data).
 */
const { cfgStr, isDefault, lineResult, finishCheck } = require('./helpers');
const { scrapeNavigatorDataInPage } = require('./scrapeNavigator');

const CFG = {
  platformVersion: 'hidemium.navigator.os.platforms_version',
  uaFullVersion: 'hidemium.navigator.useragent.fullversion',
  userAgent: 'hidemium.navigator.useragent.useragent',
  model: 'hidemium.navigator.useragent.model',
  manufacturer: 'hidemium.navigator.useragent.manufacturer',
};

async function scrape(page) {
  return page.evaluate(scrapeNavigatorDataInPage);
}

function lineOrFail(label, actual, expected, needle) {
  const line = lineResult(label, actual, expected, needle, 'str');
  if (!isDefault(expected) && (actual == null || actual === '')) {
    line.pass = false;
  }
  return line;
}

async function checkPlatformVersion(page, configMap, ctx) {
  ctx.step('CreepJS PlatformVersion: select userAgentData...');
  const scraped = await scrape(page);
  ctx.step(`CreepJS PlatformVersion: ${scraped.platformVersion ?? 'null'}`);

  const expected = cfgStr(configMap, CFG.platformVersion);
  const line = lineOrFail(
    'platformVersion',
    scraped.platformVersion,
    expected,
    scraped.platformVersion && scraped.uaPlatform
      ? `${scraped.uaPlatform} ${scraped.platformVersion}`
      : scraped.platformVersion || 'userAgentData:'
  );

  const needValue = !isDefault(expected);
  return finishCheck(
    page,
    ctx,
    'PlatformVersion',
    [line],
    needValue && !scraped.platformVersion
  );
}

async function checkUaFullVersion(page, configMap, ctx) {
  ctx.step('CreepJS UaFullVersion: select userAgentData + userAgent...');
  const scraped = await scrape(page);
  ctx.step(
    `CreepJS UaFullVersion: full=${scraped.uaFullVersion ?? 'null'} ua=${scraped.userAgent ? 'ok' : 'null'}`
  );

  const expFull = cfgStr(configMap, CFG.uaFullVersion);
  const expUa = cfgStr(configMap, CFG.userAgent);

  const lines = [
    lineOrFail(
      'uaFullVersion',
      scraped.uaFullVersion,
      expFull,
      scraped.uaFullVersion
        ? scraped.userAgent && /Version\//i.test(scraped.userAgent)
          ? `Version/${scraped.uaFullVersion}`
          : `(${scraped.uaFullVersion})`
        : 'userAgentData:'
    ),
    lineOrFail(
      'userAgent',
      scraped.userAgent,
      expUa,
      scraped.userAgent ? scraped.userAgent.slice(0, 40) : 'userAgent:'
    ),
  ];

  const anyRequiredMissing =
    (!isDefault(expFull) && !scraped.uaFullVersion) ||
    (!isDefault(expUa) && !scraped.userAgent);
  return finishCheck(page, ctx, 'UaFullVersion', lines, anyRequiredMissing);
}

async function checkModel(page, configMap, ctx) {
  ctx.step('CreepJS Model: select userAgentData.model...');
  const scraped = await scrape(page);
  ctx.step(`CreepJS Model: ${scraped.model ?? 'null'}`);

  const expModel = cfgStr(configMap, CFG.model);
  const line = lineOrFail('model', scraped.model, expModel, scraped.model || 'userAgentData:');

  const needModel = !isDefault(expModel);
  return finishCheck(page, ctx, 'Model', [line], needModel && !scraped.model);
}

module.exports = {
  checkPlatformVersion,
  checkUaFullVersion,
  checkModel,
  scrape,
  lineOrFail,
  CFG,
};
