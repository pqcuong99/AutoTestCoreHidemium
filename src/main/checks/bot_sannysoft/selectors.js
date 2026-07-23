/**
 * bot.sannysoft.com — URL + dieu kien DOM san sang.
 */

const { CHECK_KEYS } = require('../../../shared/checkItems');

const SANNYSOFT_URL = 'https://bot.sannysoft.com/';

/**
 * Cho day du:
 * - User Agent / WebGL result
 * - #fp2 (fpCollect + fpscanner) co hang SCREEN (JSON sWidth/…)
 */
const READY = {
  expression: `(() => {
    const ua = document.querySelector('#user-agent-result');
    const uaOk = ua && (ua.textContent || '').trim().length > 5;
    const fpRows = document.querySelectorAll('#fp2 tr');
    let screenFp = false;
    fpRows.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 3) return;
      const name = (tds[0].textContent || '').trim().toUpperCase();
      const pre = tds[2].querySelector('pre') || tds[2];
      const raw = (pre.textContent || '').trim();
      if (name.includes('SCREEN') || /"sWidth"\\s*:/.test(raw)) screenFp = true;
    });
    return uaOk && (screenFp || fpRows.length >= 3);
  })()`,
  /** Chi can UA — dung khi profile iOS (fp-collect thuong trong). */
  expressionUaOnly: `(() => {
    const ua = document.querySelector('#user-agent-result');
    return !!(ua && (ua.textContent || '').trim().length > 5);
  })()`,
  timeoutMs: 90000,
  pollMs: 600,
};

/**
 * checkKey phu thuoc #fp2 / fpCollect — tren iOS thuong khong co → skip.
 * (WebGL/UA van lay tu bang chinh / #user-agent-result.)
 */
const IOS_SKIP_CHECK_KEYS = ['screen'];

module.exports = {
  SANNYSOFT_URL,
  READY,
  CHECK_KEYS,
  IOS_SKIP_CHECK_KEYS,
};
