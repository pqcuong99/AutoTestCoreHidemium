/**
 * CreepJS — Battery + Network (Status section).
 */
const { cfgStr, isDefault, lineResult, finishCheck } = require('./helpers');
const { scrapeStatusInPage } = require('./scrapeStatus');

const BATTERY_CFG = {
  charging: 'hidemium.value.battery.charging',
  charging_time: 'hidemium.value.battery.charging_time',
  discharging_time: 'hidemium.value.battery.discharging_time',
  level: 'hidemium.value.battery.level',
};

const NETWORK_CFG = {
  downlink: 'hidemium.network.downlink',
  downlinkmax: 'hidemium.network.downlinkmax',
  effective_type: 'hidemium.network.effective_type',
  rtt: 'hidemium.network.rtt',
  save_data: 'hidemium.network.save_data',
  type: 'hidemium.network.type',
};

async function scrape(page) {
  return page.evaluate(scrapeStatusInPage);
}

/** Luon tra du line cho moi field config — giong network. */
function buildAllLines(configMap, cfgMap, scraped, opts = {}) {
  const lines = [];
  let missingRequired = false;

  for (const [label, key] of Object.entries(cfgMap)) {
    const expected = cfgStr(configMap, key);
    let actual = scraped[label];
    if (scraped._batteryUnsupported && (actual == null || actual === '')) {
      actual = 'unsupported';
    }

    const mode = opts.mode?.[label] || 'str';
    const needle =
      opts.needle?.(label, actual) ||
      (actual != null && actual !== '' ? String(actual) : opts.fallbackNeedle || 'network:');
    const line = lineResult(label, actual, expected, needle, mode);

    if (!isDefault(expected) && (actual == null || actual === '')) {
      line.pass = false;
      missingRequired = true;
    }
    lines.push(line);
  }

  return { lines, missingRequired };
}

async function checkBattery(page, configMap, ctx) {
  ctx.step('CreepJS Battery: select battery block...');
  const scraped = await scrape(page);
  ctx.step(
    `CreepJS Battery: level=${scraped.level ?? 'null'} charging=${scraped.charging ?? 'null'} unsupported=${!!scraped._batteryUnsupported}`
  );

  const { lines, missingRequired } = buildAllLines(configMap, BATTERY_CFG, scraped, {
    fallbackNeedle: 'battery:',
    needle: (label, actual) => {
      if (actual === 'unsupported') return 'battery:';
      if (label === 'level' && actual != null) return `level: ${actual}%`;
      if (label === 'charging' && actual != null) return `charging: ${actual}`;
      if (label === 'charging_time' && actual) return `charge time: ${actual}`;
      if (label === 'discharging_time' && actual) return `discharge time: ${actual}`;
      return 'battery:';
    },
  });

  return finishCheck(page, ctx, 'Battery', lines, missingRequired);
}

async function checkNetwork(page, configMap, ctx) {
  ctx.step('CreepJS Network: select network block...');
  const scraped = await scrape(page);
  ctx.step(`CreepJS Network: rtt=${scraped.rtt ?? 'null'} downlink=${scraped.downlink ?? 'null'}`);

  const { lines, missingRequired } = buildAllLines(configMap, NETWORK_CFG, scraped, {
    fallbackNeedle: 'network:',
    mode: { downlink: 'num', downlinkmax: 'num', rtt: 'num' },
    needle: (label, actual) => {
      if (label === 'rtt' && actual != null) return `rtt: ${actual}`;
      if (label === 'downlink' && actual != null) return `downlink: ${actual}`;
      if (label === 'downlinkmax' && actual != null) return `max: ${actual}`;
      if (label === 'effective_type' && actual) return `effectiveType: ${actual}`;
      if (label === 'save_data' && actual != null) return `saveData: ${actual}`;
      if (label === 'type' && actual) return `type: ${actual}`;
      return 'network:';
    },
  });

  return finishCheck(page, ctx, 'Network', lines, missingRequired);
}

module.exports = {
  checkBattery,
  checkNetwork,
  BATTERY_CFG,
  NETWORK_CFG,
};
