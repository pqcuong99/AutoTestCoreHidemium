/**
 * Scrape DOM iphey.com + map sang tung checkKey (qua normalize.js).
 */

const { CHECK_KEYS } = require('./selectors');
const { normalizeToConfigFields } = require('./normalize');

const SCRAPE_DOM_EXPRESSION = `(() => {
  const pairs = [];
  const sections = {};
  const push = (section, label, value, source) => {
    const l = String(label || '').replace(/\\s+/g, ' ').trim();
    const v = String(value || '').replace(/\\s+/g, ' ').trim();
    if (!l || !v) return;
    if (/^temporary value$/i.test(v)) return;
    const row = { section: section || '', label: l, value: v, source: source || 'detail' };
    pairs.push(row);
    const sec = section || '_';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push({ label: l, value: v });
  };

  document.querySelectorAll('#detail-info .detail-block').forEach((block) => {
    const h = block.querySelector('h3');
    const section = (h && h.textContent ? h.textContent : '').replace(/\\s+/g, ' ').trim();
    block.querySelectorAll('.detail-entry').forEach((entry) => {
      const nameEl = entry.querySelector('.detail-name');
      const valEl = entry.querySelector('.detail-value');
      if (!nameEl || !valEl) return;
      push(section, nameEl.textContent, valEl.innerText || valEl.textContent, 'detail');
    });
  });

  if (!pairs.length) {
    document.querySelectorAll('#detail-info .detail-entry').forEach((entry) => {
      const nameEl = entry.querySelector('.detail-name');
      const valEl = entry.querySelector('.detail-value');
      if (!nameEl || !valEl) return;
      push('', nameEl.textContent, valEl.innerText || valEl.textContent, 'detail');
    });
  }

  document.querySelectorAll('.code-block').forEach((tile) => {
    const h = tile.querySelector('h4');
    const p = tile.querySelector('p');
    if (!h || !p) return;
    push('HERO', h.textContent, p.textContent, 'tile');
  });

  const st = document.querySelector('#hero-status');
  let trustStatus = '';
  if (st) {
    trustStatus = (st.getAttribute('aria-label') || st.textContent || '').replace(/\\s+/g, ' ').trim();
    if (trustStatus) push('HERO', 'trustStatus', trustStatus, 'hero');
  }

  return {
    pairs,
    sections,
    trustStatus,
    entryCount: document.querySelectorAll('#detail-info .detail-entry').length,
  };
})()`;

function isDetailPair(p) {
  const src = (p.source || '').toLowerCase();
  if (src === 'tile' || src === 'hero') return false;
  if (String(p.section || '').toUpperCase() === 'HERO') return false;
  return true;
}

const CHECK_KEY_SET = new Set(CHECK_KEYS);

/**
 * Map pair detail -> tung checkKey (normalize chon field giong Config).
 */
function mapPairsToChecks(pairs, checkKeys) {
  const out = {};
  const detailPairs = (Array.isArray(pairs) ? pairs : []).filter(isDetailPair);
  const keys = checkKeys?.length ? checkKeys : CHECK_KEYS;

  for (const key of keys) {
    if (!CHECK_KEY_SET.has(key)) {
      out[key] = { value: '', fields: [], matched: [], state: 'skipped', reason: 'no-rule' };
      continue;
    }

    const fields = normalizeToConfigFields(key, [], detailPairs);
    if (!fields.length) {
      out[key] = {
        value: '',
        fields: [],
        matched: [],
        state: 'skipped',
        reason: 'not-on-page',
      };
      continue;
    }

    out[key] = {
      value: fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
      fields,
      matched: fields,
      state: 'ok',
      source: 'dom',
    };
  }

  return out;
}

module.exports = {
  SCRAPE_DOM_EXPRESSION,
  mapPairsToChecks,
  isDetailPair,
};
