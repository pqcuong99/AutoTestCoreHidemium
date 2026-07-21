/**
 * Doc text tren page theo nhieu kieu selector (khong chi XPath).
 *
 * Field co the dung 1 trong cac dang:
 *
 *   { xpath: '//h3[...]/td' }
 *   { css: '#id .class td:nth-child(2)' }
 *   { by: 'xpath', value: '//' }
 *   { by: 'css', value: '...' }
 *   { by: 'text', value: 'hardwareConcurrency', exact: true }
 *   { by: 'role', role: 'cell', name: '8' }
 *   { by: 'label', value: 'Email' }
 *   { by: 'testId', value: 'hw' }
 *   { by: 'js', value: '() => String(navigator.hardwareConcurrency)' }
 *   { by: 'tableCell', h3: 'Navigator Object', label: 'platform', h3Mode: 'exact'|'contains' }
 *
 * 1 configKey -> nhieu cho tren page:
 *   { sel: [ {css:'#gpu-limits ...'}, {js:'() => ...features...'} ], selMode: 'first'|'merge' }
 *   - first (mac dinh): thu lan luot, lay cai co text dau tien
 *   - merge: gop tat ca text non-empty (cach nhau bang \\n)
 *
 * Backward-compatible: neu chi co `xpath` string thi van chay nhu cu.
 */
const { xpathValue } = require('./recipes');

/**
 * @param {import('playwright-core').Page} page
 * @param {object|string|Array} fieldOrSel  field rule hoac selector object
 * @returns {Promise<string>}
 */
async function textBySelector(page, fieldOrSel) {
  const tries = normalizeSelList(fieldOrSel);
  const mode =
    (fieldOrSel && typeof fieldOrSel === 'object' && !Array.isArray(fieldOrSel) && fieldOrSel.selMode) ||
    'first';

  if (mode === 'merge') {
    const parts = [];
    for (const sel of tries) {
      const text = await readOne(page, sel);
      if (text) parts.push(text);
    }
    return parts.join('\n');
  }

  // first: thu lan luot den khi co text
  for (const sel of tries) {
    const text = await readOne(page, sel);
    if (text) return text;
  }
  return '';
}

/**
 * Chuan hoa thanh mang selector object { by, ... }.
 */
function normalizeSelList(fieldOrSel) {
  if (!fieldOrSel) return [];

  // Mang uu tien
  if (Array.isArray(fieldOrSel)) {
    return fieldOrSel.flatMap((s) => normalizeSelList(s));
  }

  // String thuan: //... -> xpath, con lai -> css
  if (typeof fieldOrSel === 'string') {
    const s = fieldOrSel.trim();
    if (s.startsWith('//') || s.startsWith('(//')) return [{ by: 'xpath', value: s }];
    return [{ by: 'css', value: s }];
  }

  // Field rule day du: uu tien field.sel / field.selector, roi xpath/css/by
  if (fieldOrSel.sel || fieldOrSel.selector) {
    return normalizeSelList(fieldOrSel.sel || fieldOrSel.selector);
  }

  const list = [];
  if (fieldOrSel.by) {
    list.push(fieldOrSel);
  } else {
    // Cho phep css/xpath/js la string HOAC mang string / object
    pushTyped(list, 'css', fieldOrSel.css);
    pushTyped(list, 'xpath', fieldOrSel.xpath);
    pushTyped(list, 'js', fieldOrSel.js);
    if (fieldOrSel.text) list.push({ by: 'text', value: fieldOrSel.text, exact: fieldOrSel.exact });
  }

  // Shorthand tableCell qua h3+label (khong can viet xpath)
  if (!list.length && fieldOrSel.h3 && fieldOrSel.cellLabel) {
    list.push({
      by: 'tableCell',
      h3: fieldOrSel.h3,
      label: fieldOrSel.cellLabel,
      h3Mode: fieldOrSel.h3Mode || 'exact',
    });
  }

  return list;
}

/** css/xpath/js: string | string[] | object | object[] → day vao list {by,value} */
function pushTyped(list, by, raw) {
  if (raw == null || raw === '') return;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (item == null || item === '') continue;
    if (typeof item === 'string') {
      list.push({ by, value: item });
      continue;
    }
    if (typeof item === 'object') {
      // Da co by / css / xpath / js — de normalizeSelList xu ly 1 lan
      if (item.by || item.css || item.xpath || item.js || item.sel || (item.h3 && item.cellLabel)) {
        list.push(...normalizeSelList(item));
      } else if (item.value != null) {
        list.push({ by, value: String(item.value) });
      }
    }
  }
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ by:string, value?:string, [k:string]:any }} sel
 */
async function readOne(page, sel) {
  try {
    switch (sel.by) {
      case 'xpath': {
        const loc = page.locator(`xpath=${sel.value}`).first();
        if (!(await loc.count())) return '';
        return trim(await loc.innerText({ timeout: 5000 }));
      }
      case 'css': {
        const loc = page.locator(sel.value).first();
        if (!(await loc.count())) return '';
        return trim(await loc.innerText({ timeout: 5000 }));
      }
      case 'text': {
        const loc = page.getByText(sel.value, { exact: !!sel.exact }).first();
        if (!(await loc.count())) return '';
        // Lay o ke ben neu request sibling
        if (sel.sibling === 'next') {
          const next = loc.locator('xpath=following-sibling::*[1]').first();
          if (await next.count()) return trim(await next.innerText({ timeout: 5000 }));
        }
        return trim(await loc.innerText({ timeout: 5000 }));
      }
      case 'role': {
        const loc = page.getByRole(sel.role || 'cell', { name: sel.name, exact: !!sel.exact }).first();
        if (!(await loc.count())) return '';
        return trim(await loc.innerText({ timeout: 5000 }));
      }
      case 'label': {
        const loc = page.getByLabel(sel.value, { exact: !!sel.exact }).first();
        if (!(await loc.count())) return '';
        return trim(await loc.inputValue().catch(async () => loc.innerText({ timeout: 5000 })));
      }
      case 'testId': {
        const loc = page.getByTestId(sel.value).first();
        if (!(await loc.count())) return '';
        return trim(await loc.innerText({ timeout: 5000 }));
      }
      case 'js': {
        const src = sel.value;
        let v;
        if (typeof src === 'function') {
          v = await page.evaluate(src);
        } else {
          v = await page.evaluate(wrapJsSelector(String(src)));
        }
        return trimJsResult(v);
      }
      case 'tableCell': {
        // Sinh XPath bang helper — van dung duoc khi user chi biet h3 + label
        const xp = xpathValue(sel.h3, sel.label || sel.cellLabel, sel.h3Mode || 'exact');
        return readOne(page, { by: 'xpath', value: xp });
      }
      default:
        return '';
    }
  } catch {
    return '';
  }
}

function trim(v) {
  return String(v ?? '').trim();
}

/**
 * Chuan hoa chuoi js selector truoc khi page.evaluate:
 * - () => { ... } / function () { ... }  → goi truc tiep
 * - expression 1 dong (khong co ;)     → evaluate nhu cu
 * - nhieu cau lenh / co const/let/return → boc () => { ... }
 *
 * Luu y: script PHAI return gia tri (array/string). console.log khong du.
 */
function wrapJsSelector(src) {
  const code = String(src || '').trim();
  if (!code) return '() => ""';

  if (/^(async\s*)?\(\s*\)\s*=>/.test(code) || /^async\s+function\b/.test(code) || /^function\b/.test(code)) {
    return `(${code})()`;
  }

  // Expression don (khong block): document.querySelector(...).innerText
  const looksLikeBlock =
    /\b(const|let|var|return|if|for|while|function)\b/.test(code) ||
    code.includes('\n') ||
    code.includes(';');

  if (!looksLikeBlock) {
    return code;
  }

  // Neu user da co return → boc body; neu khong, van boc (ho se can them return)
  return `(() => {\n${code}\n})()`;
}

/** Array → join \\n de Detail Log / compare doc duoc. */
function trimJsResult(v) {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join('\n');
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v).trim();
}

module.exports = { textBySelector, normalizeSelList, readOne, wrapJsSelector, trimJsResult };
