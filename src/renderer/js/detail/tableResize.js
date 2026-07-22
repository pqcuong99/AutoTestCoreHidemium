/**
 * Keo resize cot / hang bang Detail Log.
 * Luu width/height vao localStorage de giu khi re-render / mo lai.
 */
window.DTableResize = (() => {
  const COL_LS = 'dl-col-widths';
  const ROW_LS = 'dl-row-heights';
  const MIN_COL = 80;
  const MIN_ROW = 36;
  /** Chieu cao hang khi bam thu nho (text dai). */
  const COLLAPSED_ROW = 44;

  /** @type {Record<string, number>} */
  let colWidths = load(COL_LS);
  /** @type {Record<string, number>} */
  let rowHeights = load(ROW_LS);

  let dragging = null;

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  }

  function save(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch { /* ignore quota */ }
  }

  function updateTableMinWidth() {
    const tbl = document.querySelector('.dl-tbl');
    if (!tbl) return;
    const ths = [...tbl.querySelectorAll('thead th')];
    let total = 0;
    ths.forEach((th, i) => {
      const key = th.dataset.colKey || String(i);
      const w = colWidths[key] || th.offsetWidth || 145;
      total += w;
    });
    tbl.style.minWidth = Math.max(total, 600) + 'px';
  }

  /** Gan handle + ap dung width da luu sau khi ve thead */
  function applyColumns() {
    const ths = document.querySelectorAll('#dl-thead th');
    ths.forEach((th, i) => {
      const key = th.dataset.colKey || String(i);
      if (!th.dataset.colKey) th.dataset.colKey = key;

      if (colWidths[key]) {
        th.style.width = colWidths[key] + 'px';
        th.style.minWidth = colWidths[key] + 'px';
        th.style.maxWidth = colWidths[key] + 'px';
      }

      if (!th.querySelector('.dl-col-resizer')) {
        const handle = document.createElement('span');
        handle.className = 'dl-col-resizer';
        handle.title = 'Kéo để đổi độ rộng cột';
        handle.addEventListener('mousedown', (e) => startColDrag(e, th, key));
        th.appendChild(handle);
      }
    });
    updateTableMinWidth();
  }

  function clearRowHeight(tr) {
    if (!tr) return;
    tr.style.height = '';
    tr.classList.remove('dl-row-resized');
    tr.querySelectorAll('td').forEach((td) => {
      td.style.maxHeight = '';
      td.style.height = '';
      td.style.overflow = '';
    });
  }

  function setRowHeight(tr, h) {
    tr.style.height = h + 'px';
    tr.classList.add('dl-row-resized');
    tr.querySelectorAll('td').forEach((td) => {
      td.style.maxHeight = h + 'px';
      td.style.height = h + 'px';
      td.style.overflow = 'auto';
    });
  }

  /** Thu nho / mo rong hang text dai — ep height that (khong chi clip chu). */
  function setCollapsed(tr, collapsed) {
    if (!tr) return;
    const key = tr.dataset.key;
    if (collapsed) {
      tr.classList.add('dl-row-collapsed');
      setRowHeight(tr, COLLAPSED_ROW);
      tr.querySelectorAll('td').forEach((td) => {
        td.style.overflow = 'hidden';
      });
    } else {
      tr.classList.remove('dl-row-collapsed');
      clearRowHeight(tr);
      const saved = key && rowHeights[key];
      if (saved) setRowHeight(tr, saved);
    }
  }

  /** Gan handle + ap dung height da luu sau khi ve tbody */
  function applyRows() {
    document.querySelectorAll('#dl-tbody tr[data-key]').forEach((tr) => {
      const key = tr.dataset.key;

      // Hang dang thu nho: luon ep height nho — khong ap height cu tu localStorage
      if (tr.classList.contains('dl-row-collapsed')) {
        setCollapsed(tr, true);
      } else {
        const h = rowHeights[key];
        if (h) setRowHeight(tr, h);
        else clearRowHeight(tr);
      }

      const cell = tr.querySelector('td.cell-a');
      if (cell && !cell.querySelector('.dl-row-resizer')) {
        const handle = document.createElement('span');
        handle.className = 'dl-row-resizer';
        handle.title = 'Kéo để đổi chiều cao hàng';
        handle.addEventListener('mousedown', (e) => startRowDrag(e, tr, key));
        cell.appendChild(handle);
      }
    });
  }

  function startColDrag(e, th, key) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    dragging = { type: 'col', key, th, startX, startW };
    document.body.classList.add('dl-resizing-col');
    th.querySelector('.dl-col-resizer')?.classList.add('active');
  }

  function startRowDrag(e, tr, key) {
    e.preventDefault();
    e.stopPropagation();
    // Keo resize = mo rong hang (bo che do thu nho)
    if (tr.classList.contains('dl-row-collapsed')) {
      tr.classList.remove('dl-row-collapsed');
      const btn = tr.querySelector('.dl-row-toggle');
      if (btn) {
        btn.textContent = '▴';
        btn.setAttribute('aria-expanded', 'true');
      }
      clearRowHeight(tr);
    }
    const startY = e.clientY;
    const startH = tr.getBoundingClientRect().height;
    dragging = { type: 'row', key, tr, startY, startH };
    document.body.classList.add('dl-resizing-row');
    tr.querySelector('.dl-row-resizer')?.classList.add('active');
  }

  function onMove(e) {
    if (!dragging) return;
    if (dragging.type === 'col') {
      const w = Math.max(MIN_COL, Math.round(dragging.startW + (e.clientX - dragging.startX)));
      dragging.th.style.width = w + 'px';
      dragging.th.style.minWidth = w + 'px';
      dragging.th.style.maxWidth = w + 'px';
      colWidths[dragging.key] = w;
      updateTableMinWidth();
    } else if (dragging.type === 'row') {
      const h = Math.max(MIN_ROW, Math.round(dragging.startH + (e.clientY - dragging.startY)));
      setRowHeight(dragging.tr, h);
      rowHeights[dragging.key] = h;
    }
  }

  function onUp() {
    if (!dragging) return;
    if (dragging.type === 'col') {
      save(COL_LS, colWidths);
      dragging.th.querySelector('.dl-col-resizer')?.classList.remove('active');
      document.body.classList.remove('dl-resizing-col');
    } else {
      save(ROW_LS, rowHeights);
      dragging.tr.querySelector('.dl-row-resizer')?.classList.remove('active');
      document.body.classList.remove('dl-resizing-row');
    }
    dragging = null;
  }

  /** Goi sau moi lan DRender.head() / table() */
  function apply() {
    applyColumns();
    applyRows();
  }

  function init() {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return {
    init,
    apply,
    applyColumns,
    applyRows,
    setCollapsed,
    setRowHeight,
    clearRowHeight,
    COLLAPSED_ROW,
  };
})();
