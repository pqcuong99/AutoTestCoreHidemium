/**
 * Ve giao dien man Detail Log: sidebar lane/profile, bang chi tiet, log.
 */
window.DRender = (() => {
  const S = () => DStore.state;

  const STATUS_LABEL = {
    idle: 'Cho', running: 'Dang chay', pass: 'PASS',
    fail: 'FAIL', error: 'LOI', stopped: 'Da dung',
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Sidebar ----------
  function lanes() {
    const box = document.getElementById('dl-lanes');
    document.getElementById('dl-lane-count').textContent = S().lanes.length;
    box.innerHTML = S().lanes
      .map((l) => {
        const active = l.uuid && l.uuid === S().current ? 'active' : '';
        const who = l.uuid ? esc(l.name || l.uuid.slice(0, 8)) : '<span class="cell-missing">trong</span>';
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
        const stText = r.statusText || STATUS_LABEL[r.status];
        return `<div class="prof-item ${active}" data-uuid="${esc(uuid)}">
          <span class="st st-${r.status}" title="${esc(stText)}">${esc(stText)}</span>
          <span class="prof-name">${lane}${esc(r.name || '(khong ten)')}</span>
          <span class="prof-uuid">${esc(uuid)}</span>
        </div>`;
      })
      .join('');
  }

  // ---------- Bang chi tiet ----------
  function head() {
    const thead = document.getElementById('dl-thead');
    const siteCols = WEBSITES.map((w) => `<th data-url="${esc(w.url)}" class="col-site">${esc(w.label)}</th>`).join('');
    thead.innerHTML = `<tr>
      <th class="col-a">Mục Check</th>
      <th class="col-b">Config (config.hidemium)</th>
      ${siteCols}
    </tr>`;
  }

  function fieldsHtml(cfg) {
    if (!cfg || !cfg.found) return '<span class="cell-missing">(khong co trong config)</span>';
    const MAX = 6;
    const shown = cfg.fields.slice(0, MAX);
    let html = shown
      .map((f) => `<div class="kv"><span class="kv-k">${esc(f.label)}</span><span class="kv-v">${esc(f.value)}</span></div>`)
      .join('');
    if (cfg.fields.length > MAX) {
      html += `<div class="kv-more" data-expand="1">+ ${cfg.fields.length - MAX} truong nua...</div>`;
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
    const cls = { pending: 'site-pending', skipped: 'site-skipped', pass: 'site-pass', fail: 'site-fail' }[site.state] || 'site-pending';
    const txt = { pending: 'cho...', skipped: 'chua check' }[site.state] || site.value || site.state;
    return `<span class="site-cell ${cls}">${esc(txt)}</span>`;
  }

  function table() {
    const r = DStore.current();
    const tbody = document.getElementById('dl-tbody');
    const empty = document.getElementById('dl-empty');

    if (!r) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      document.getElementById('dl-cur-name').textContent = 'Chua chon profile';
      document.getElementById('dl-cur-uuid').textContent = '';
      document.getElementById('dl-cur-meta').innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    document.getElementById('dl-cur-name').textContent = r.name || '(khong ten)';
    document.getElementById('dl-cur-uuid').textContent = r.uuid;
    document.getElementById('dl-cur-meta').innerHTML = r.open
      ? `lane #${r.laneId ?? '-'} &middot; port ${esc(r.open.remote_port)} &middot; os ${esc(r.open.os)}<br>
         <span class="kv-v">${esc(r.open.profile_path)}</span>`
      : `lane #${r.laneId ?? '-'}${r.error ? ' &middot; <span class="site-fail">' + esc(r.error) + '</span>' : ''}`;

    const keys = S().checkKeys.length ? S().checkKeys : Object.keys(r.rows);
    if (!keys.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = 'Che do "Test luong" khong check muc nao - xem log ben duoi.';
      return;
    }
    empty.textContent = 'Chua co du lieu. Tick profile roi bam Chay.';

    tbody.innerHTML = keys
      .map((key) => {
        const item = CHECK_ITEMS.find((i) => i.key === key) || { label: key, group: '' };
        const row = r.rows[key];
        const siteCells = WEBSITES.map((w) => `<td>${siteCell(row?.sites?.[w.key])}</td>`).join('');
        return `<tr data-key="${esc(key)}">
          <td class="cell-a">${esc(item.label)}<small>${esc(item.group)}</small></td>
          <td class="cell-b">${row ? fieldsHtml(row.config) : '<span class="cell-missing">chua co du lieu</span>'}</td>
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
    document.getElementById('dl-progress').textContent = S().progress || 'San sang';
  }

  function all() {
    head();      // ve lai header cot -> luon du 2 cot A/B + cac cot website
    header();
    lanes();
    profiles();
    table();
    logs();
  }

  return { all, head, lanes, profiles, table, logs, header, fieldsHtmlAll, esc, STATUS_LABEL };
})();
