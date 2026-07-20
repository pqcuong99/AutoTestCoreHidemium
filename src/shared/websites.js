/**
 * Cac cot website trong bang Detail Log.
 * Them / bot website -> chi sua mang nay, bang tu sinh them cot.
 */
const WEBSITES = [
  { key: 'sannysoft', label: 'bot.sannysoft.com', url: 'https://bot.sannysoft.com' },
  { key: 'iphey', label: 'iphey.com', url: 'https://iphey.com/' },
  { key: 'browserleaks', label: 'browserleaks', url: 'https://browserleaks.com/javascript' },
  { key: 'creepjs', label: 'creepjs', url: 'https://abrahamjuliot.github.io/creepjs/' },
  { key: 'browserscan', label: 'browserscan.net', url: 'https://www.browserscan.net/' },
];

const WEBSITE_KEYS = WEBSITES.map((w) => w.key);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEBSITES, WEBSITE_KEYS };
}
