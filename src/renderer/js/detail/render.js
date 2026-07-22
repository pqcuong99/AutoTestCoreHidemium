/**
 * Ve giao dien man Detail Log: sidebar lane/profile, bang chi tiet, log.
 */
window.DRender = (() => {
  const S = () => DStore.state;

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function groupLabel(group) {
    const key = 'checkGroup.' + group;
    const translated = t(key);
    return translated === key ? group : translated;
  }

  function lanes() {
    const box = document.getElementById('dl-lanes');
    document.getElementById('dl-lane-count').textContent = S().lanes.length;
    box.innerHTML = S().lanes
      .map((l) => {
        const active = l.uuid && l.uuid === S().current ? 'active' : '';
        const who = l.uuid
          ? esc(l.name || l.uuid.slice(0, 8))
          : `<span class="cell-missing">${esc(t('detail.idle'))}</span>`;
        return `<div class="lane-item ${active}" data-uuid="${esc(l.uuid || '')}">
          <span class="lane-id">#${l.laneId}</span>${who}
        </div>`;
      })
      .join('');
  }

  function profiles() {
    const box = document.getElementById('dl-profiles');
    const osLabel = (os) =>
      window.ProfileOs?.osDisplayLabel?.(os) || String(os || '').trim();
    box.innerHTML = S().order
      .map((uuid) => {
        const r = DStore.get(uuid);
        const active = uuid === S().current ? 'active' : '';
        const lane = r.laneId ? `<span class="lane-id">#${r.laneId}</span>` : '';
        const stText = r.statusText || I18n.statusLabel(r.status);
        const os = osLabel(r.os);
        const browser = String(r.browser || '').trim();
        const metaBits = [];
        if (browser) metaBits.push(`<span class="prof-tag prof-tag-browser">${esc(browser)}</span>`);
        if (os) metaBits.push(`<span class="prof-tag prof-tag-os">${esc(os)}</span>`);
        const meta = metaBits.length
          ? `<span class="prof-meta">${metaBits.join('')}</span>`
          : '';
        return `<div class="prof-item ${active}" data-uuid="${esc(uuid)}">
          <span class="st st-${r.status}" title="${esc(stText)}">${esc(stText)}</span>
          <span class="prof-name">${lane}${esc(r.name || t('detail.noName'))}</span>
          ${meta}
          <span class="prof-uuid">${esc(uuid)}</span>
        </div>`;
      })
      .join('');
  }

  function head() {
    const thead = document.getElementById('dl-thead');
    const siteCols = WEBSITES.map(
      (w) =>
        `<th data-col-key="site:${esc(w.key)}" class="col-site">${esc(w.label)}</th>`
    ).join('');
    thead.innerHTML = `<tr>
      <th class="col-a" data-col-key="check">${esc(t('detail.colCheck'))}</th>
      <th class="col-b" data-col-key="config">${esc(t('detail.colConfig'))}</th>
      ${siteCols}
    </tr>`;
    if (window.DTableResize) DTableResize.applyColumns();
  }

  const FIELD_MAX = 6;

  /** Bo prefix [HARDWARE] / [BROWSER] ... trong label. */
  function cleanLabel(label) {
    return String(label || '')
      .replace(/^\[[^\]]+\]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Chuan hoa fields: { label, value } giong cot Config. */
  function normalizeFields(fields) {
    if (!Array.isArray(fields)) return [];
    return fields
      .map((f) => ({
        label: cleanLabel(f.label),
        value: String(f.value ?? '').trim(),
      }))
      .filter((f) => f.value !== '');
  }

  /** Parse chuoi "label: value" (1 hoac nhieu dong), strip [SECTION]. */
  function parseValueToFields(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cleaned = line.replace(/^\[[^\]]+\]\s*/g, '');
        const i = cleaned.indexOf(':');
        if (i < 0) return { label: '', value: cleaned.trim() };
        return {
          label: cleaned.slice(0, i).trim(),
          value: cleaned.slice(i + 1).trim(),
        };
      })
      .filter((f) => f.value);
  }

  function kvListHtml(fields, { max = FIELD_MAX } = {}) {
    const list = normalizeFields(fields);
    if (!list.length) return '';
    const shown = list.slice(0, max);
    let html = shown
      .map((f) => `<div class="kv"><span class="kv-k">${esc(f.label)}</span><span class="kv-v">${esc(f.value)}</span></div>`)
      .join('');
    if (list.length > max) {
      html += `<div class="kv-more" data-expand="1">${esc(t('detail.moreFields', { n: list.length - max }))}</div>`;
    }
    return html;
  }

  function fieldsHtml(cfg) {
    if (!cfg || !cfg.found) return `<span class="cell-missing">${esc(t('detail.noConfig'))}</span>`;
    return kvListHtml(cfg.fields);
  }

  function fieldsHtmlAll(fieldsOrCfg) {
    const fields = Array.isArray(fieldsOrCfg) ? fieldsOrCfg : fieldsOrCfg?.fields || [];
    return kvListHtml(fields, { max: fields.length });
  }

  /** BrowserLeaks / CreepJS: lines SiteHighlight { text, status }. */
  function siteLinesHtml(txt, structuredLines) {
    const SH = window.SiteHighlight;

    if (Array.isArray(structuredLines) && structuredLines.length) {
      return structuredLines
        .map((row) => {
          const status = row.status || 'ok';
          const cls = SH ? SH.cssClassFor(status) : '';
          const raw = String(row.text || '');
          const parsed = SH ? SH.parseLineStatus(raw) : { body: raw, status };
          const body = parsed.body;
          const idx = body.indexOf(':');
          if (idx <= 0) {
            return `<div class="kv ${cls}"><span class="kv-v">${esc(body)}</span></div>`;
          }
          const k = body.slice(0, idx).trim();
          const v = body.slice(idx + 1).trim();
          return `<div class="kv ${cls}"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`;
        })
        .join('');
    }

    const lines = String(txt ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return '';

    const hasKv = lines.some((l) => /^[^:]+:\s*.+/.test(l));
    if (!hasKv) {
      return `<span class="site-cell-plain">${esc(lines.join('\n'))}</span>`;
    }

    return lines
      .map((line) => {
        const parsed = SH ? SH.parseLineStatus(line) : { body: line, status: 'ok' };
        const cls = SH ? SH.cssClassFor(parsed.status) : '';
        const body = parsed.body;
        const idx = body.indexOf(':');
        if (idx <= 0) {
          return `<div class="kv ${cls}"><span class="kv-v">${esc(body)}</span></div>`;
        }
        const k = body.slice(0, idx).trim();
        const v = body.slice(idx + 1).trim();
        return `<div class="kv ${cls}"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`;
      })
      .join('');
  }

  /** Cot website: SiteHighlight lines, hoac fields (sannysoft/iphey), hoac value. */
  function siteCell(site) {
    if (!site) return '<span class="site-pending">-</span>';
    const cls =
      {
        pending: 'site-pending',
        skipped: 'site-skipped',
        pass: 'site-pass',
        fail: 'site-fail',
      }[site.state] || (site.pass ? 'site-pass' : 'site-pending');

    if (site.state === 'pending') {
      return `<span class="site-cell ${cls}"><span class="site-cell-plain">${esc(t('detail.sitePending'))}</span></span>`;
    }

    if (site.state === 'skipped' && (!site.value || site.value === '-') && !(site.fields && site.fields.length) && !(site.lines && site.lines.length)) {
      return `<span class="site-cell ${cls}"><span class="site-cell-plain">${esc(t('detail.siteSkipped'))}</span></span>`;
    }

    // Prefer SiteHighlight structured lines (BrowserLeaks / CreepJS)
    if (Array.isArray(site.lines) && site.lines.length && site.lines.some((l) => l && (l.text || l.status))) {
      return `<div class="site-cell ${cls}">${siteLinesHtml(site.value, site.lines)}</div>`;
    }

    // sannysoft / iphey: fields { label, value }
    let fields = normalizeFields(site.fields);
    // BrowserScan legacy: lines cung co dang { label, value, expected, pass }.
    if (!fields.length) fields = normalizeFields(site.lines);
    if (!fields.length && site.value && site.value !== '-') fields = parseValueToFields(site.value);
    if (fields.length) {
      return `<div class="site-cell site-kv ${cls}">${kvListHtml(fields)}</div>`;
    }

    const txt =
      site.state === 'fail'
        ? site.value || site.state
        : site.value || t('detail.noData');
    return `<span class="site-cell ${cls}"><span class="site-cell-plain">${esc(txt)}</span></span>`;
  }

  function table() {
    const r = DStore.current();
    const tbody = document.getElementById('dl-tbody');
    const empty = document.getElementById('dl-empty');

    if (!r) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = t('detail.empty');
      document.getElementById('dl-cur-name').textContent = t('detail.noProfile');
      document.getElementById('dl-cur-uuid').textContent = '';
      document.getElementById('dl-cur-meta').innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    document.getElementById('dl-cur-name').textContent = r.name || t('detail.noName');
    document.getElementById('dl-cur-uuid').textContent = r.uuid;
    const osShow =
      (window.ProfileOs?.osDisplayLabel?.(r.os) || r.os || '').trim() ||
      (r.open && (r.open.os || r.open.OS || r.open.platform)) ||
      '';
    const browserShow = String(r.browser || '').trim();
    const metaBits = [`lane #${r.laneId ?? '-'}`];
    if (browserShow) metaBits.push(esc(browserShow));
    if (osShow) metaBits.push(esc(osShow));
    if (r.open?.remote_port) metaBits.push(`port ${esc(r.open.remote_port)}`);
    document.getElementById('dl-cur-meta').innerHTML = r.open
      ? `${metaBits.join(' &middot; ')}<br>
         <span class="kv-v">${esc(r.open.profile_path)}</span>`
      : `${metaBits.join(' &middot; ')}${
          r.error ? ' &middot; <span class="site-fail">' + esc(r.error) + '</span>' : ''
        }`;

    const keys = S().checkKeys.length ? S().checkKeys : Object.keys(r.rows);
    if (!keys.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = t('detail.emptyTest');
      return;
    }
    empty.textContent = t('detail.empty');

    tbody.innerHTML = keys
      .map((key) => {
        const item = CHECK_ITEMS.find((i) => i.key === key) || { label: key, group: '' };
        const row = r.rows[key];
        const siteCells = WEBSITES.map(
          (w) => `<td class="cell-site" data-site="${esc(w.key)}">${siteCell(row?.sites?.[w.key])}</td>`
        ).join('');
        return `<tr data-key="${esc(key)}">
          <td class="cell-a">${esc(item.label)}<small>${esc(groupLabel(item.group))}</small></td>
          <td class="cell-b">${row ? fieldsHtml(row.config) : `<span class="cell-missing">${esc(t('detail.noData'))}</span>`}</td>
          ${siteCells}
        </tr>`;
      })
      .join('');
    if (window.DTableResize) DTableResize.applyRows();
  }

  function logs() {
    const r = DStore.current();
    const box = document.getElementById('dl-log');
    if (!r) return (box.innerHTML = '');
    box.innerHTML = r.logs
      .map((l) => `<div class="${l.kind ? 'l-' + l.kind : ''}">[${esc(l.time)}] ${esc(l.message)}</div>`)
      .join('');
    box.scrollTop = box.scrollHeight;
  }

  function header() {
    document.getElementById('dl-run').textContent =
      `runId: ${S().runId || '-'} | ${S().mode || 'check'}`;
    document.getElementById('dl-progress').textContent = S().progress || t('status.ready');
  }

  function all() {
    head();
    header();
    lanes();
    profiles();
    table();
    logs();
  }

  return { all, head, lanes, profiles, table, logs, header, fieldsHtmlAll, siteCell, esc };
})();
