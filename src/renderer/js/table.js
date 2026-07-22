/**
 * Ve bang profile + xu ly checkbox / tim kiem.
 */
window.Table = (() => {
  function visibleRows() {
    const targetOs =
      (typeof Settings !== 'undefined' && Settings.getTargetOs && Settings.getTargetOs()) ||
      'windows';
    const matchOs = window.ProfileOs
      ? (r) => window.ProfileOs.profileMatchesTargetOs(r.os, targetOs)
      : () => true;

    let rows = State.rows.filter(matchOs);
    const q = State.filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.uuid.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }

  /** Bo tick profile khong khop targetOs (goi khi doi Settings OS). */
  function pruneSelectionByTargetOs() {
    const targetOs =
      (typeof Settings !== 'undefined' && Settings.getTargetOs && Settings.getTargetOs()) ||
      'windows';
    if (!window.ProfileOs || targetOs === 'all') return 0;
    let removed = 0;
    for (const [uuid, row] of Array.from(State.selected.entries())) {
      const os = row.os != null ? row.os : State.rows.find((r) => r.uuid === uuid)?.os;
      if (!window.ProfileOs.profileMatchesTargetOs(os, targetOs)) {
        State.selected.delete(uuid);
        removed++;
      }
    }
    if (removed) persistSelection();
    return removed;
  }

  function render() {
    const rows = visibleRows();
    const tbody = $('#tbody');

    tbody.innerHTML = rows
      .map((r, i) => {
        const st = State.status[r.uuid] || 'idle';
        const stText = State.statusText[r.uuid] || I18n.statusLabel(st);
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
    $('#sel-count').textContent = `${State.selected.size} / ${State.meta.total || State.rows.length}`;
    const vis = visibleRows();
    const all = vis.length > 0 && vis.every((r) => State.selected.has(r.uuid));
    $('#chk-all').checked = all;
  }

  function setStatus(uuid, status, statusText) {
    State.status[uuid] = status;
    State.statusText[uuid] = statusText || '';
    const tr = $(`tr[data-uuid="${CSS.escape(uuid)}"]`);
    if (!tr) return;
    const span = tr.querySelector('.st');
    span.className = 'st st-' + status;
    span.textContent = statusText || I18n.statusLabel(status) || status;
    span.title = statusText || '';
  }

  function persistSelection() {
    window.api.config.set({ selectedUuids: Array.from(State.selected.keys()) });
  }

  function toggle(row, on) {
    if (on) {
      State.selected.set(row.uuid, {
        uuid: row.uuid,
        name: row.name,
        os: row.os || '',
        browser: row.browser || '',
      });
    } else State.selected.delete(row.uuid);
  }

  function init() {
    $('#tbody').addEventListener('change', (e) => {
      if (!e.target.classList.contains('row-chk')) return;
      const uuid = e.target.closest('tr').dataset.uuid;
      const row = State.rows.find((r) => r.uuid === uuid);
      if (!row) return;
      toggle(row, e.target.checked);
      updateCount();
      persistSelection();
    });

    $('#chk-all').addEventListener('change', (e) => {
      const on = e.target.checked;
      visibleRows().forEach((r) => toggle(r, on));
      render();
      persistSelection();
    });

    let timer;
    $('#txt-search').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        State.filter = e.target.value;
        render();
      }, 150);
    });
  }

  function selectedProfiles() {
    const targetOs =
      (typeof Settings !== 'undefined' && Settings.getTargetOs && Settings.getTargetOs()) ||
      'windows';
    return Array.from(State.selected.values())
      .map((r) => {
        const row = State.rows.find((x) => x.uuid === r.uuid);
        return {
          uuid: r.uuid,
          name: r.name || row?.name || '',
          os: r.os || row?.os || '',
          browser: r.browser || row?.browser || '',
        };
      })
      .filter((r) => {
        if (!window.ProfileOs) return true;
        return window.ProfileOs.profileMatchesTargetOs(r.os, targetOs);
      });
  }

  function resetStatus() {
    State.status = {};
    State.statusText = {};
    render();
  }

  return {
    init,
    render,
    setStatus,
    selectedProfiles,
    pruneSelectionByTargetOs,
    resetStatus,
    updateCount,
    persistSelection,
  };
})();
