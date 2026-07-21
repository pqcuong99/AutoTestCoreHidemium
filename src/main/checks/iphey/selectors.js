/**
 * iphey.com — URL + dieu kien DOM san sang.
 * Map field Config nam o normalize.js (khong dung label selector o day).
 */

const { CHECK_KEYS } = require('../../../shared/checkItems');

const IPHEY_URL = 'https://iphey.com/';

/** Cho detail list render xong (DetailInfo). */
const READY = {
  expression: `(() => {
    const st = document.querySelector('#hero-status');
    if (st && st.classList.contains('hero-status--loading')) return false;
    const tiles = document.querySelectorAll('.code-block p');
    for (const p of tiles) {
      if (/temporary value/i.test((p.textContent || '').trim())) return false;
    }
    const entries = document.querySelectorAll('#detail-info .detail-entry');
    return entries.length >= 3;
  })()`,
  timeoutMs: 90000,
  pollMs: 800,
};

module.exports = {
  IPHEY_URL,
  READY,
  CHECK_KEYS,
};
