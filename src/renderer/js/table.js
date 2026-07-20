/**
 * Ve bang profile + xu ly checkbox / tim kiem.
 */
window.Table = (() => {
  const STATUS_LABEL = {
    idle: 'Cho',
    running: 'Dang chay',
    pass: 'PASS',
    fail: 'FAIL',
    error: 'LOI',
    stopped: 'Da dung',
  };

  function visibleRows() {
    const q = State.filter.trim().toLowerCase();
    if (!q) return State.rows;
    return State.rows.filter(
      (r) => r.uuid.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }

  function render() {
    const rows = visibleRows();
    const tbody = $('#tbody');

    tbody.innerHTML = rows
      .map((r, i) => {
        const st = State.status[r.uuid] || 'idle';
        const stText = State.statusText[r.uuid] || STATUS_LABEL[st];
        const checked = State.selected.has(r.uuid) ? 'checked' : '';
        return `<tr data-uuid="${escapeHtml(r.uuid)}">
          <td class="col-chk"><input type="checkbox" class="row-chk" ${checked} /></td>
          <td class="col-no">${i + 1}</td>
          <td class="uuid">${escapeHtml(r.uuid)}</td>
          <td>${escapeHtml(r.name || '-')}</td>
          <td class="col-status"><span class="st st-${st}" title="${escapeHtml(stText)}">${escapeHtml(stText)}</span></td>
        </tr>`;
      })
      .join('');

    $('#empty').style.display = rows.length ? 'none' : 'block';
    updateCount();
  }

  function updateCount() {
    // Tick giu nguyen khi doi trang -> mau so la tong tat ca trang, khong phai trang nay.
    $('#sel-count').textContent = `${State.selected.size} / ${State.meta.total || State.rows.length}`;
    const vis = visibleRows();
    const all = vis.length > 0 && vis.every((r) => State.selected.has(r.uuid));
    $('#chk-all').checked = all;
  }

  /** Cap nhat trang thai 1 dong ma khong ve lai ca bang */
  function setStatus(uuid, status, statusText) {
    State.status[uuid] = status;
    State.statusText[uuid] = statusText || '';
    const tr = $(`tr[data-uuid="${CSS.escape(uuid)}"]`);
    if (!tr) return;
    const span = tr.querySelector('.st');
    span.className = 'st st-' + status;
    span.textContent = statusText || STATUS_LABEL[status] || status;
    span.title = statusText || '';
  }

  function persistSelection() {
    window.api.config.set({ selectedUuids: Array.from(State.selected.keys()) });
  }

  /** Luu ca name de van chay duoc profile da tick o trang khac. */
  function toggle(row, on) {
    if (on) State.selected.set(row.uuid, { uuid: row.uuid, name: row.name });
    else State.selected.delete(row.uuid);
  }

  function init() {
    // Tick tung dong
    $('#tbody').addEventListener('change', (e) => {
      if (!e.target.classList.contains('row-chk')) return;
      const uuid = e.target.closest('tr').dataset.uuid;
      const row = State.rows.find((r) => r.uuid === uuid);
      if (!row) return;
      toggle(row, e.target.checked);
      updateCount();
      persistSelection();
    });

    // Chon tat ca (theo ket qua dang loc, trong trang dang xem)
    $('#chk-all').addEventListener('change', (e) => {
      const on = e.target.checked;
      visibleRows().forEach((r) => toggle(r, on));
      render();
      persistSelection();
    });

    // Tim kiem
    let t;
    $('#txt-search').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        State.filter = e.target.value;
        render();
      }, 150);
    });
  }

  /** Tat ca profile da tick - ke ca o trang dang khong hien tren man hinh. */
  function selectedProfiles() {
    return Array.from(State.selected.values());
  }

  function resetStatus() {
    State.status = {};
    State.statusText = {};
    render();
  }

  return { init, render, setStatus, selectedProfiles, resetStatus, updateCount, persistSelection };
})();
