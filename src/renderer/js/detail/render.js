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
    box.innerHTML = S().order
      .map((uuid) => {
        const r = DStore.get(uuid);
        const active = uuid === S().current ? 'active' : '';
        const lane = r.laneId ? `<span class="lane-id">#${r.laneId}</span>` : '';
        const stText = r.statusText || I18n.statusLabel(r.status);
        return `<div class="prof-item ${active}" data-uuid="${esc(uuid)}">
          <span class="st st-${r.status}" title="${esc(stText)}">${esc(stText)}</span>
          <span class="prof-name">${lane}${esc(r.name || t('detail.noName'))}</span>
          <span class="prof-uuid">${esc(uuid)}</span>
        </div>`;
      })
      .join('');
  }

  function head() {
    const thead = document.getElementById('dl-thead');
    const siteCols = WEBSITES.map((w) => `<th data-url="${esc(w.url)}" class="col-site">${esc(w.label)}</th>`).join('');
    thead.innerHTML = `<tr>
      <th class="col-a">${esc(t('detail.colCheck'))}</th>
      <th class="col-b">${esc(t('detail.colConfig'))}</th>
      ${siteCols}
    </tr>`;
  }

  function fieldsHtml(cfg) {
    if (!cfg || !cfg.found) return `<span class="cell-missing">${esc(t('detail.noConfig'))}</span>`;
    const MAX = 6;
    const shown = cfg.fields.slice(0, MAX);
    let html = shown
      .map((f) => `<div class="kv"><span class="kv-k">${esc(f.label)}</span><span class="kv-v">${esc(f.value)}</span></div>`)
      .join('');
    if (cfg.fields.length > MAX) {
      html += `<div class="kv-more" data-expand="1">${esc(t('detail.moreFields', { n: cfg.fields.length - MAX }))}</div>`;
    }
    return html;
  }

  function fieldsHtmlAll(cfg) {
    return cfg.fields
      .map((f) => `<div class="kv"><span class="kv-k">${esc(f.label)}</span><span class="kv-v">${esc(f.value)}</span></div>`)
      .join('');
  }

  function siteCell(site) {
    if (!site) return '<span class="site-pending">-</span>';
    if (site.state === 'pending') {
      return `<span class="site-cell site-pending">${esc(t('detail.sitePending'))}</span>`;
    }
    if (site.state === 'skipped') {
      if (!(Array.isArray(site.lines) && site.lines.length)) {
        return `<span class="site-cell site-skipped">${esc(t('detail.siteSkipped'))}</span>`;
      }
    }

    // Mot dong: "label: value"
    if (Array.isArray(site.lines) && site.lines.length) {
      const rows = site.lines
        .map((l) => {
          const lineCls =
            l.pass === true ? 'site-line-pass' : l.pass === false ? 'site-line-fail' : 'site-line-na';
          const hint = l.pass === false && l.expected != null ? ` title="config: ${esc(l.expected)}"` : '';
          const val = l.value === '' || l.value == null ? '—' : l.value;
          const text = `${l.label}: ${val}`;
          return `<div class="site-line ${lineCls}"${hint}>${esc(text)}</div>`;
        })
        .join('');
      return `<div class="site-cell site-lines">${rows}</div>`;
    }

    const cls = { pass: 'site-pass', fail: 'site-fail' }[site.state] || 'site-pending';
    return `<span class="site-cell ${cls}">${esc(site.value || site.state)}</span>`;
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
    document.getElementById('dl-cur-meta').innerHTML = r.open
      ? `lane #${r.laneId ?? '-'} &middot; port ${esc(r.open.remote_port)} &middot; os ${esc(r.open.os)}<br>
         <span class="kv-v">${esc(r.open.profile_path)}</span>`
      : `lane #${r.laneId ?? '-'}${r.error ? ' &middot; <span class="site-fail">' + esc(r.error) + '</span>' : ''}`;

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
        const siteCells = WEBSITES.map((w) => `<td>${siteCell(row?.sites?.[w.key])}</td>`).join('');
        return `<tr data-key="${esc(key)}">
          <td class="cell-a">${esc(item.label)}<small>${esc(groupLabel(item.group))}</small></td>
          <td class="cell-b">${row ? fieldsHtml(row.config) : `<span class="cell-missing">${esc(t('detail.noData'))}</span>`}</td>
          ${siteCells}
        </tr>`;
      })
      .join('');
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

  return { all, head, lanes, profiles, table, logs, header, fieldsHtmlAll, esc };
})();
