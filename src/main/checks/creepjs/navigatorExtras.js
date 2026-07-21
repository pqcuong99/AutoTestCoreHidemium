/**
 * CreepJS — Hardware / Device Memory / MaxTouchPoints / Brands.
 */
const { cfgStr, lineResult, finishCheck } = require('./helpers');
const { scrapeNavigatorDataInPage } = require('./scrapeNavigator');

const CFG = {
  hardwareConcurrency: 'hidemium.navigator.hardware_concurrency',
  deviceMemory: 'hidemium.navigator.device_memory',
  maxTouchPoints: 'hidemium.navigator.max_touch_point',
  chromeVersion: 'hidemium.chrome.version',
  uaVersion: 'hidemium.navigator.useragent.version_useragent',
};

async function scrape(page) {
  return page.evaluate(scrapeNavigatorDataInPage);
}

async function checkHardware(page, configMap, ctx) {
  ctx.step('CreepJS Hardware: select cores...');
  const scraped = await scrape(page);
  const line = lineResult(
    'hardwareConcurrency',
    scraped.hardwareConcurrency,
    cfgStr(configMap, CFG.hardwareConcurrency),
    scraped.hardwareConcurrency != null ? `cores: ${scraped.hardwareConcurrency}` : 'cores:',
    'num'
  );
  return finishCheck(page, ctx, 'Hardware', [line], scraped.hardwareConcurrency == null);
}

async function checkDeviceMemory(page, configMap, ctx) {
  ctx.step('CreepJS Device Memory: select ram...');
  const scraped = await scrape(page);
  ctx.step(`CreepJS Device Memory: ram=${scraped.deviceMemory ?? 'null'}`);
  const line = lineResult(
    'deviceMemory',
    scraped.deviceMemory,
    cfgStr(configMap, CFG.deviceMemory),
    scraped.deviceMemory != null ? `ram: ${scraped.deviceMemory}` : 'ram:',
    'num'
  );
  return finishCheck(page, ctx, 'Device Memory', [line], scraped.deviceMemory == null);
}

async function checkMaxTouchPoints(page, configMap, ctx) {
  ctx.step('CreepJS MaxTouchPoints: select touch...');
  const scraped = await scrape(page);
  const line = lineResult(
    'maxTouchPoints',
    scraped.maxTouchPoints,
    cfgStr(configMap, CFG.maxTouchPoints),
    scraped.maxTouchPoints != null ? `touch: ${scraped.maxTouchPoints}` : 'touch:',
    'num'
  );
  return finishCheck(page, ctx, 'MaxTouchPoints', [line], scraped.maxTouchPoints == null);
}

async function checkBrands(page, configMap, ctx) {
  ctx.step('CreepJS Brands: select userAgentData...');
  const scraped = await scrape(page);
  ctx.step(
    `CreepJS Brands: chrome=${scraped.chromeVersion ?? 'null'} ua=${scraped.uaVersion ?? 'null'}`
  );
  const lines = [
    lineResult(
      'chromeVersion',
      scraped.chromeVersion,
      cfgStr(configMap, CFG.chromeVersion),
      scraped.chromeVersion,
      'str'
    ),
    lineResult(
      'uaVersion',
      scraped.uaVersion,
      cfgStr(configMap, CFG.uaVersion),
      scraped.uaVersion,
      'str'
    ),
  ];
  return finishCheck(
    page,
    ctx,
    'Brands',
    lines,
    scraped.chromeVersion == null && scraped.uaVersion == null
  );
}

module.exports = {
  checkHardware,
  checkDeviceMemory,
  checkMaxTouchPoints,
  checkBrands,
  scrape,
  CFG,
};
